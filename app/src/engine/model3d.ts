/* 3D 형상 모델 — 설계 결과(DesignResult)에서 부재별 3D 형상(mm)을 만든다. (PRD v2.2 4장 "3D 뷰어", 9장 2단계)

   좌표계(mm): X = 수문 폭 방향, Y = 높이(위), Z = 흐름 방향(+Z 하류). 원점 = 첫 련~끝 련 전체 폭의 가운데, 문턱 윗면.
   개수·길이·두께는 BOM 과 같은 규칙(rules/roller.ts)에서 나온다 — 3D 부재 수 = BOM 수량(1 SET 기준).
   형상 치수 중 데모·업체 도면에 없는 값은 rules/roller3d.ts 의 [추정] 상수를 쓴다.

   현재 롤러게이트만 지원. 나머지 형식은 supported:false 를 돌려준다. */
import type { DesignResult } from "./types";
import { ROLLER_RULES as R } from "./rules";
import * as G from "./rules/roller3d";

export type Vec3 = [number, number, number];
export type Axis = "x" | "y" | "z";

export interface Part3D {
  id: string;
  /** 대응하는 BOM 줄 이름의 앞부분. 콘크리트 등 BOM 밖 배경 요소는 null */
  bomKey: string | null;
  label: string;
  spec: string;
  mat: string;
  /** box: size = [x, y, z]. cyl: size = [지름, 길이, 지름], axis 방향으로 길이 */
  kind: "box" | "cyl";
  size: Vec3;
  axis?: Axis;
  /** 중심 좌표 */
  pos: Vec3;
  /** 몇 번째 련(0부터). 배경 요소는 -1 */
  bay: number;
  /** BOM 이 길이(m)로 세는 부재의 길이(mm) — 수밀고무 */
  lengthMm?: number;
  /** BOM 밖 배경(콘크리트 교각·문턱·데크) */
  context?: boolean;
}

export type Model3D =
  | { supported: true; parts: Part3D[]; bounds: { min: Vec3; max: Vec3 }; notes: string[] }
  | { supported: false; reason: string };

export function buildModel3D(result: DesignResult): Model3D {
  const input = result.input;
  if (input.type !== "roller") {
    return { supported: false, reason: "3D 뷰어는 현재 롤러게이트만 지원합니다. 다른 형식은 순서대로 추가 예정입니다." };
  }

  const { W, H } = input;
  const B = result.B;
  // 아래 4개는 bom.ts 롤러 분기와 같은 식 (출처: 데모 FlowCADDemo.jsx:113, 116, 119, 122)
  const tSkin = H >= R.SKIN_THK_THRESHOLD_H ? R.SKIN_THK_THICK : R.SKIN_THK_THIN;
  const ribN = Math.max(R.GIRDER_MIN, Math.round(H / R.GIRDER_PITCH));
  const rollersPerBay = Math.max(R.ROLLER_MIN, Math.round(H / R.ROLLER_PITCH) * 2);
  const railLen = H + R.RAIL_EXTRA;

  const parts: Part3D[] = [];
  const totalW = B * W + (B + 1) * G.PIER_W;
  const bayX = (b: number) => -totalW / 2 + G.PIER_W + W / 2 + b * (W + G.PIER_W);

  // Z 기준선: 스킨 상류면 z=0, 거더는 하류 쪽, 롤러·레일은 그 뒤
  const zSkin = tSkin / 2;
  const zGirder = tSkin + R.GIRDER_W / 2;
  const zRoller = tSkin + R.GIRDER_W - G.MAIN_ROLLER_D / 2 + 40;
  const zRail = zRoller + G.MAIN_ROLLER_D / 2 + G.RAIL_SECTION / 2;
  const zRack = tSkin + R.GIRDER_W + G.RACK_SECTION / 2;
  const zMid = (0 + zRail + G.RAIL_SECTION / 2) / 2;

  const half = rollersPerBay / 2;
  for (let b = 0; b < B; b++) {
    const x = bayX(b);
    const tag = `${b + 1}련`;

    parts.push({
      id: `skin-${b}`, bomKey: "GATE LEAF (문비)", label: `SKIN PLATE (${tag})`, spec: `SS400 ${tSkin}T / ${W}×${H}`,
      mat: "SS400", kind: "box", size: [W, H, tSkin], pos: [x, H / 2, zSkin], bay: b,
    });

    for (let i = 0; i < ribN; i++) {
      parts.push({
        id: `girder-${b}-${i}`, bomKey: "수평/수직 보강거더", label: `수평 보강거더 ${i + 1}단 (${tag})`,
        spec: `SS400 ${tSkin}T × ${R.GIRDER_W} × ${W}`, mat: "SS400", kind: "box",
        size: [W, tSkin, R.GIRDER_W], pos: [x, (H * (i + 0.5)) / ribN, zGirder], bay: b,
      });
    }

    for (const side of [-1, 1] as const) {
      const sideName = side < 0 ? "좌" : "우";
      for (let i = 0; i < half; i++) {
        const y = (H * (i + 0.5)) / half;
        parts.push({
          id: `main-roller-${b}-${side}-${i}`, bomKey: "MAIN ROLLER ASS'Y", label: `메인 롤러 ${sideName}${i + 1} (${tag})`,
          spec: `STS 주물 롤러 + BEARING · Ø${G.MAIN_ROLLER_D}(추정)`, mat: "STS304", kind: "cyl", axis: "x",
          size: [G.MAIN_ROLLER_D, G.MAIN_ROLLER_W, G.MAIN_ROLLER_D],
          pos: [x + side * (W / 2 - G.MAIN_ROLLER_W / 2), y, zRoller], bay: b,
        });
        parts.push({
          id: `side-roller-${b}-${side}-${i}`, bomKey: "SIDE / GUIDE ROLLER", label: `사이드 롤러 ${sideName}${i + 1} (${tag})`,
          spec: `STS 가이드 롤러 · Ø${G.SIDE_ROLLER_D}(추정)`, mat: "STS304", kind: "cyl", axis: "z",
          size: [G.SIDE_ROLLER_D, G.SIDE_ROLLER_W, G.SIDE_ROLLER_D],
          pos: [x + side * (W / 2 + G.SIDE_ROLLER_D / 2), y + (H / half) * 0.25, zGirder], bay: b,
        });
      }
      parts.push({
        id: `rail-${b}-${side}`, bomKey: "GUIDE RAIL (EMBED)", label: `가이드 레일 ${sideName} (${tag})`,
        spec: `SS400 매립 레일 / L=${railLen}`, mat: "SS400", kind: "box",
        size: [G.RAIL_SECTION, railLen, G.RAIL_SECTION],
        pos: [x + side * (W / 2 - G.MAIN_ROLLER_W / 2), railLen / 2, zRail], bay: b,
      });
    }

    parts.push({
      id: `rack-${b}`, bomKey: "RACK BAR", label: `랙바 (${tag})`, spec: `STS304 랙바 / L=${railLen}`,
      mat: "STS304", kind: "box", size: [G.RACK_SECTION, railLen, G.RACK_SECTION], pos: [x, railLen / 2, zRack], bay: b,
    });

    parts.push({
      id: `hoist-${b}`, bomKey: "전동 권양기 (HOIST)", label: `전동 권양기 (${tag})`, spec: "전동 권양기 + 감속기 · 외형 추정",
      mat: "전장", kind: "box", size: G.HOIST_SIZE,
      pos: [x, railLen + G.DECK_THK + G.HOIST_SIZE[1] / 2, zRack], bay: b,
    });

    // 수밀고무: 데모 BOM 은 4면 둘레 2(W+H)로 산정 → 3D 도 4면 (N16)
    const zSeal = -G.SEAL_SECTION / 2;
    const seals: Array<[string, Vec3, Vec3, number]> = [
      ["하부", [W, G.SEAL_SECTION, G.SEAL_SECTION], [x, G.SEAL_SECTION / 2, zSeal], W],
      ["상부", [W, G.SEAL_SECTION, G.SEAL_SECTION], [x, H - G.SEAL_SECTION / 2, zSeal], W],
      ["좌측", [G.SEAL_SECTION, H, G.SEAL_SECTION], [x - W / 2 + G.SEAL_SECTION / 2, H / 2, zSeal], H],
      ["우측", [G.SEAL_SECTION, H, G.SEAL_SECTION], [x + W / 2 - G.SEAL_SECTION / 2, H / 2, zSeal], H],
    ];
    for (const [nm, size, pos, len] of seals) {
      parts.push({
        id: `seal-${b}-${nm}`, bomKey: "SEAL RUBBER", label: `수밀고무 ${nm} (${tag})`, spec: `EPDM P/J-TYPE / L=${len}`,
        mat: "EPDM", kind: "box", size, pos, bay: b, lengthMm: len,
      });
    }

    parts.push({
      id: `anchor-${b}`, bomKey: "ANCHOR / EMBED", label: `매립철물 (${tag})`, spec: "SS400 매립철물 세트 · 형상 추정",
      mat: "SS400", kind: "box", size: [W, G.ANCHOR_THK, G.ANCHOR_W], pos: [x, -G.ANCHOR_THK / 2, zSkin], bay: b,
    });
  }

  // 배경: 교각(B+1), 문턱, 권양기 데크 — BOM 밖
  const pierH = railLen + G.DECK_THK;
  for (let p = 0; p <= B; p++) {
    const px = -totalW / 2 + G.PIER_W / 2 + p * (W + G.PIER_W);
    parts.push({
      id: `pier-${p}`, bomKey: null, label: `콘크리트 교각 ${p + 1}`, spec: `폭 ${G.PIER_W}(추정)`, mat: "CONCRETE",
      kind: "box", size: [G.PIER_W, railLen, G.PIER_DEPTH], pos: [px, railLen / 2, zMid], bay: -1, context: true,
    });
  }
  parts.push({
    id: "sill", bomKey: null, label: "콘크리트 문턱", spec: "형상 추정", mat: "CONCRETE", kind: "box",
    size: [totalW, G.SILL_THK, G.PIER_DEPTH], pos: [0, -G.SILL_THK / 2 - G.ANCHOR_THK, zMid], bay: -1, context: true,
  });
  parts.push({
    id: "deck", bomKey: null, label: "권양기 데크", spec: "형상 추정", mat: "CONCRETE", kind: "box",
    size: [totalW, G.DECK_THK, G.PIER_DEPTH], pos: [0, pierH - G.DECK_THK / 2, zMid], bay: -1, context: true,
  });

  const topY = railLen + G.DECK_THK + G.HOIST_SIZE[1];
  return {
    supported: true,
    parts,
    bounds: {
      min: [-totalW / 2, -G.SILL_THK - G.ANCHOR_THK, zMid - G.PIER_DEPTH / 2],
      max: [totalW / 2, topY, zMid + G.PIER_DEPTH / 2],
    },
    notes: [
      "1 SET 기준 표시 (수량 SET 은 반영하지 않음)",
      "롤러 지름·레일 단면·교각 폭·권양기 외형은 추정값 — 업체 도면 확인 후 교체",
    ],
  };
}
