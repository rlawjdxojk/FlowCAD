/* 3D 형상 모델 — 설계 결과(DesignResult)에서 부재별 3D 형상(mm)을 만든다. (PRD v2.2 4장 "3D 뷰어", 9장 2단계)

   좌표계(mm): X = 수문 폭 방향, Y = 높이(위), Z = 흐름 방향(+Z 하류).
   개수·길이·두께는 BOM 과 같은 규칙(rules/*.ts)에서 나온다 — 3D 부재 수 = BOM 수량(1 SET 기준).
   형상 치수 중 데모·업체 도면에 없는 값은 rules/roller3d.ts, rules/gate3d.ts 의 [추정] 상수를 쓴다. */
import type { DesignInput, DesignResult } from "./types";
import { FRP_RULES as F, INTEG_LIFT_RULES as I, ROLLER_RULES as R } from "./rules";
import * as G from "./rules/roller3d";
import * as S from "./rules/gate3d";

export type Vec3 = [number, number, number];
export type Axis = "x" | "y" | "z";

export interface Part3D {
  id: string;
  /** 대응하는 BOM 줄 이름의 앞부분. BOM 밖 요소(배경·Cut List 전용)는 null */
  bomKey: string | null;
  label: string;
  spec: string;
  mat: string;
  /**
   * box:    size = [x, y, z]
   * cyl:    size = [지름, 길이, 지름], axis 방향으로 길이
   * ring:   XY 평면의 원형 고리, Z 방향 두께. size = [바깥지름, 바깥지름, 두께], hole = [안지름, 안지름]
   * rframe: XY 평면의 사각 테,   Z 방향 두께. size = [바깥 W, 바깥 H, 두께], hole = [안 W, 안 H]
   */
  kind: "box" | "cyl" | "ring" | "rframe";
  size: Vec3;
  hole?: [number, number];
  axis?: Axis;
  /** 중심 좌표 */
  pos: Vec3;
  /** 몇 번째 련(0부터, 롤러게이트). 그 외 형식은 0, 배경은 -1 */
  bay: number;
  /** BOM 이 길이(m)로 세는 부재의 길이(mm) — 수밀고무 */
  lengthMm?: number;
  /** BOM 밖 배경(콘크리트 교각·문턱·벽체) — 반투명, 클릭 대상 아님 */
  context?: boolean;
  /** BOM 에는 없고 Cut List 에만 있는 부재(데모 규칙 그대로, ANY 스펙 N5 등) */
  cutOnly?: boolean;
}

export type Model3D =
  | { supported: true; parts: Part3D[]; bounds: { min: Vec3; max: Vec3 }; notes: string[] }
  | { supported: false; reason: string };

export function buildModel3D(result: DesignResult): Model3D {
  const input = result.input;
  let built: { parts: Part3D[]; notes: string[] };
  switch (input.type) {
    case "roller": built = buildRoller(input, result.B); break;
    case "frp_circle": built = buildFrpCircle(input); break;
    case "frp_rect": built = buildFrpRect(input); break;
    case "integ":
    case "lift": built = buildIntegLift(input); break;
  }
  return {
    supported: true,
    parts: built.parts,
    bounds: boundsOf(built.parts),
    notes: ["1 SET 기준 표시 (수량 SET 은 반영하지 않음)", ...built.notes],
  };
}

/* ── 공통 도우미 ───────────────────────────────────── */

/** 부재 외곽(축 정렬 상자) 합집합 */
export function boundsOf(parts: Part3D[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const ext = extentOf(p);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.pos[i] - ext[i] / 2);
      max[i] = Math.max(max[i], p.pos[i] + ext[i] / 2);
    }
  }
  return { min, max };
}

/** 부재의 X·Y·Z 방향 크기 */
export function extentOf(p: Part3D): Vec3 {
  if (p.kind !== "cyl") return p.size;
  const [d, len] = p.size;
  return p.axis === "x" ? [len, d, d] : p.axis === "z" ? [d, d, len] : [d, len, d];
}

/** 사각형 둘레(w×h, 중심 cx·cy)에 n 개 점을 같은 간격으로 배치 */
function pointsOnRect(n: number, w: number, h: number, cx: number, cy: number): Array<[number, number]> {
  const per = 2 * (w + h);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * per;
    if (d < w) { pts.push([cx - w / 2 + d, cy - h / 2]); continue; }
    d -= w;
    if (d < h) { pts.push([cx + w / 2, cy - h / 2 + d]); continue; }
    d -= h;
    if (d < w) { pts.push([cx + w / 2 - d, cy + h / 2]); continue; }
    d -= w;
    pts.push([cx - w / 2, cy + h / 2 - d]);
  }
  return pts;
}

/** 원(지름 d, 중심 cx·cy)에 n 개 점을 같은 간격으로 배치 */
function pointsOnCircle(n: number, d: number, cx: number, cy: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI + Math.PI / 2;
    return [cx + (d / 2) * Math.cos(a), cy + (d / 2) * Math.sin(a)] as [number, number];
  });
}

/** 설치 벽체(배경). 개구는 반투명이라 뚫지 않고 그린다. 벽 하류면 = z 0 */
function wall(outerW: number, outerH: number, cy: number): Part3D {
  return {
    id: "wall", bomKey: null, label: "설치 벽체(콘크리트)", spec: "형상 추정", mat: "CONCRETE", kind: "box",
    size: [outerW + 2 * S.WALL_MARGIN, outerH + 2 * S.WALL_MARGIN, S.WALL_THK],
    pos: [0, cy, -S.WALL_THK / 2], bay: -1, context: true,
  };
}

/* ── FRP 자동수문 (원형) ── 출처: bom.ts frp 분기 = 데모 FlowCADDemo.jsx:78-91 ── */
function buildFrpCircle(input: Extract<DesignInput, { type: "frp_circle" }>) {
  const { D } = input;
  const parts: Part3D[] = [];
  const outer = D + 2 * S.FRP_FRAME_FLANGE;
  const cy = outer / 2 + S.WALL_MARGIN; // 바닥에서 띄움
  const sealD = D - F.SEAL_PLATE_D_OFFSET;
  const doorD = D + 2 * S.FRP_DOOR_OVERLAP;
  // Z 적층: 벽(−) | 문틀 | SEAL PLATE | 수밀고무 | 문짝
  const zFrame = S.FRP_FRAME_THK / 2;
  const zSealPl = S.FRP_FRAME_THK + F.SEAL_PLATE_THK / 2;
  const zRubber = S.FRP_FRAME_THK + F.SEAL_PLATE_THK + S.SEAL_T / 2;
  const zDoor = S.FRP_FRAME_THK + F.SEAL_PLATE_THK + S.SEAL_T + S.FRP_DOOR_THK / 2;

  parts.push(wall(outer, outer, cy));
  parts.push({
    id: "frame", bomKey: "FRAME (문틀)", label: "FRP 문틀", spec: `F.R.P + COATING / 개구 Ø${D}, 외경 Ø${outer}(추정)`,
    mat: "FRP", kind: "ring", size: [outer, outer, S.FRP_FRAME_THK], hole: [D, D], pos: [0, cy, zFrame], bay: 0,
  });
  parts.push({
    id: "seal-plate", bomKey: "SEAL PLATE", label: "SEAL PLATE",
    spec: `STS304 Ø${sealD} — BOM 1.5T 원판 / Cut List 5T 띠판 불일치(N1), 띠판 폭 ${F.SEAL_PLATE_W_CIRCLE}으로 표시`,
    mat: "STS304", kind: "ring", size: [sealD, sealD, F.SEAL_PLATE_THK],
    hole: [Math.max(50, sealD - 2 * F.SEAL_PLATE_W_CIRCLE), Math.max(50, sealD - 2 * F.SEAL_PLATE_W_CIRCLE)],
    pos: [0, cy, zSealPl], bay: 0,
  });
  parts.push({
    id: "seal-rubber", bomKey: "SEAL RUBBER", label: "수밀고무", spec: `EPDM 4T×40 / L=${Math.round(Math.PI * D)}`,
    mat: "EPDM", kind: "ring", size: [D + S.SEAL_W, D + S.SEAL_W, S.SEAL_T], hole: [D - S.SEAL_W, D - S.SEAL_W],
    pos: [0, cy, zRubber], bay: 0, lengthMm: Math.PI * D,
  });
  parts.push({
    id: "door", bomKey: "DOOR ASS'Y (문짝)", label: "FRP 문짝", spec: `F.R.P / Ø${doorD}(추정 — 개구+겹침)`,
    mat: "FRP", kind: "cyl", axis: "z", size: [doorD, S.FRP_DOOR_THK, doorD], pos: [0, cy, zDoor], bay: 0,
  });
  parts.push({
    id: "hinge", bomKey: "FRAME / DOOR HINGE", label: "문틀/문짝 힌지", spec: "STS304 / HINGE PIN Ø16~32 · 외형 추정",
    mat: "STS304", kind: "box", size: S.HINGE_SIZE,
    pos: [0, cy + outer / 2 + S.HINGE_SIZE[1] / 2 - 20, zDoor - S.FRP_DOOR_THK / 2], bay: 0,
  });
  const nb = Math.round((Math.PI * (D + F.FLANGE_OFFSET)) / F.BOLT_PITCH);
  pointsOnCircle(nb, D + F.FLANGE_OFFSET, 0, cy).forEach(([x, y], i) => parts.push(bolt(`bolt-${i}`, i, x, y, S.FRP_FRAME_THK, "M10")));

  return { parts, notes: ["문틀 외경·문짝 겹침·힌지 외형은 추정값", "SEAL PLATE 두께·형상은 BOM과 Cut List가 달라 업체 확인 필요(N1)"] };
}

/* ── FRP 자동수문 (사각) ── 출처: bom.ts frp 분기 = 데모 FlowCADDemo.jsx:78-91 ── */
function buildFrpRect(input: Extract<DesignInput, { type: "frp_rect" }>) {
  const { W, H } = input;
  const parts: Part3D[] = [];
  const oW = W + 2 * S.FRP_FRAME_FLANGE, oH = H + 2 * S.FRP_FRAME_FLANGE;
  const cy = oH / 2 + S.WALL_MARGIN;
  const dW = W + 2 * S.FRP_DOOR_OVERLAP, dH = H + 2 * S.FRP_DOOR_OVERLAP;
  const zFrame = S.FRP_FRAME_THK / 2;
  const zRubber = S.FRP_FRAME_THK + S.SEAL_T / 2;
  const zDoorBack = S.FRP_FRAME_THK + S.SEAL_T;
  const zDoor = zDoorBack + S.FRP_DOOR_THK / 2;
  const zFront = zDoorBack + S.FRP_DOOR_THK;

  parts.push(wall(oW, oH, cy));
  parts.push({
    id: "frame", bomKey: "FRAME (문틀)", label: "FRP 문틀", spec: `F.R.P + COATING / 개구 ${W}×${H}, 외곽 ${oW}×${oH}(추정)`,
    mat: "FRP", kind: "rframe", size: [oW, oH, S.FRP_FRAME_THK], hole: [W, H], pos: [0, cy, zFrame], bay: 0,
  });
  parts.push({
    id: "seal-rubber", bomKey: "SEAL RUBBER", label: "수밀고무", spec: `EPDM 4T×40 / L=${2 * (W + H)}`,
    mat: "EPDM", kind: "rframe", size: [W + S.SEAL_W, H + S.SEAL_W, S.SEAL_T], hole: [W - S.SEAL_W, H - S.SEAL_W],
    pos: [0, cy, zRubber], bay: 0, lengthMm: 2 * (W + H),
  });
  parts.push({
    id: "door", bomKey: "DOOR ASS'Y (문짝)", label: "FRP 문짝", spec: `F.R.P / ${dW}×${dH}(추정 — 개구+겹침)`,
    mat: "FRP", kind: "box", size: [dW, dH, S.FRP_DOOR_THK], pos: [0, cy, zDoor], bay: 0,
  });
  parts.push({
    id: "skin-reinf", bomKey: null, cutOnly: true, label: "SKIN 보강 PL", spec: `SS400 ${F.SKIN_REINF_THK}T / ${W}×${H} — Cut List 전용(BOM 누락, N5)`,
    mat: "SS400", kind: "box", size: [W, H, F.SKIN_REINF_THK], pos: [0, cy, zFront + F.SKIN_REINF_THK / 2], bay: 0,
  });
  const zBeam = zFront + F.SKIN_REINF_THK + S.SUPPORT_BEAM_D / 2;
  const nBeam = Math.max(F.SUPPORT_BEAM_MIN, Math.round(H / F.SUPPORT_BEAM_PITCH));
  for (let i = 0; i < nBeam; i++) {
    parts.push({
      id: `support-beam-${i}`, bomKey: "SUPPORT BEAM", label: `SUPPORT BEAM ${i + 1}`, spec: `SS400 ㄷ-100×50×5/7.5T / L=${W}`,
      mat: "SS400", kind: "box", size: [W, S.SUPPORT_BEAM_H, S.SUPPORT_BEAM_D],
      pos: [0, cy - H / 2 + (H * (i + 0.5)) / nBeam, zBeam], bay: 0,
    });
  }
  const linkL = Math.min(S.LINK_PLATE_L, dH);
  for (let i = 0; i < F.LINK_CLAMP_QTY; i++) {
    const x = (i === 0 ? -1 : 1) * (W / 4);
    parts.push({
      id: `link-${i}`, bomKey: "LINK / CLAMP PLATE", label: `LINK / CLAMP PLATE ${i + 1}`, spec: `STS304 5T·L-150 / L=${linkL}`,
      mat: "STS304", kind: "box", size: [F.LINK_PLATE.thk * 3, linkL, S.LINK_PLATE_W],
      pos: [x, cy + dH / 2 - linkL / 2, zBeam + S.SUPPORT_BEAM_D / 2 + S.LINK_PLATE_W / 2], bay: 0,
    });
  }
  parts.push({
    id: "hinge", bomKey: "FRAME / DOOR HINGE", label: "문틀/문짝 힌지", spec: "STS304 / HINGE PIN Ø16~32 · 외형 추정",
    mat: "STS304", kind: "box", size: [Math.min(W, S.HINGE_SIZE[0] * 3), S.HINGE_SIZE[1], S.HINGE_SIZE[2]],
    pos: [0, cy + oH / 2 + S.HINGE_SIZE[1] / 2 - 20, zDoor], bay: 0,
  });
  parts.push({
    id: "seal-plate", bomKey: "SEAL PLATE", label: "SEAL PLATE", spec: `STS304 5T / ${F.SEAL_PLATE_W_RECT}×${F.SEAL_PLATE_L_RECT} (데모 고정 규격 — 위치 추정)`,
    mat: "STS304", kind: "box", size: [F.SEAL_PLATE_L_RECT, F.SEAL_PLATE_W_RECT, F.SEAL_PLATE_THK],
    pos: [0, cy - oH / 2 + F.SEAL_PLATE_W_RECT / 2, S.FRP_FRAME_THK + F.SEAL_PLATE_THK / 2], bay: 0,
  });
  const nb = Math.round((2 * ((W + F.FLANGE_OFFSET) + (H + F.FLANGE_OFFSET))) / F.BOLT_PITCH);
  pointsOnRect(nb, W + F.FLANGE_OFFSET, H + F.FLANGE_OFFSET, 0, cy)
    .forEach(([x, y], i) => parts.push(bolt(`bolt-${i}`, i, x, y, S.FRP_FRAME_THK, "M10")));

  return { parts, notes: ["문틀 외곽·문짝 겹침·LINK 위치·힌지 외형은 추정값", "SKIN 보강 PL은 Cut List에만 있는 부재(BOM 누락, N5)"] };
}

/* ── 일체식·인양식 ── 출처: bom.ts integ/lift 분기 = 데모 FlowCADDemo.jsx:92-111 ── */
function buildIntegLift(input: Extract<DesignInput, { type: "integ" | "lift" }>) {
  const { W, H } = input;
  const parts: Part3D[] = [];
  const isInteg = input.type === "integ";
  // 가이드 프레임: 개구(W×H) 위로 문짝이 올라갈 공간(2H)까지 세운 사각 테. 바닥 = y 0
  const travelH = H * S.GUIDE_TRAVEL_FACTOR;
  const gW = W + 2 * S.GUIDE_CHANNEL_W, gH = travelH + 2 * S.GUIDE_BEAM_H;
  const gCy = gH / 2 - S.GUIDE_BEAM_H;
  const topY = travelH + S.GUIDE_BEAM_H; // 프레임 윗면
  const zFrame = S.GUIDE_DEPTH / 2;
  const zLeaf = S.GUIDE_DEPTH / 2;
  const zRib = zLeaf + I.LEAF_THK / 2 + I.RIB_W / 2;

  parts.push(wall(gW, gH, gCy));
  parts.push({
    id: "guide-frame", bomKey: "GUIDE FRAME (문틀)", label: "가이드 프레임", spec: `STS304 채널 / 외곽 ${gW}×${gH}(추정 — 표준 프레임고 미정)`,
    mat: "STS304", kind: "rframe", size: [gW, gH, S.GUIDE_DEPTH], hole: [W, travelH], pos: [0, gCy + 0, zFrame], bay: 0,
  });
  parts.push({
    id: "leaf", bomKey: "GATE LEAF (문짝)", label: "문짝 (GATE LEAF)", spec: `STS304 ${I.LEAF_THK}T / ${W}×${H}`,
    mat: "STS304", kind: "box", size: [W, H, I.LEAF_THK], pos: [0, H / 2, zLeaf], bay: 0,
  });
  const ribN = Math.max(I.RIB_MIN, Math.round(H / I.RIB_PITCH));
  for (let i = 0; i < ribN; i++) {
    parts.push({
      id: `rib-${i}`, bomKey: null, cutOnly: true, label: `보강 RIB ${i + 1}`, spec: `STS304 ${I.LEAF_THK}T × ${I.RIB_W} × ${W} — Cut List 부재`,
      mat: "STS304", kind: "box", size: [W, I.LEAF_THK, I.RIB_W], pos: [0, (H * (i + 0.5)) / ribN, zRib], bay: 0,
    });
  }
  parts.push({
    id: "seal-rubber", bomKey: "SEAL RUBBER", label: "수밀고무", spec: `EPDM 4T×40 / L=${2 * (W + H)}`,
    mat: "EPDM", kind: "rframe", size: [W + S.SEAL_W, H + S.SEAL_W, S.SEAL_T], hole: [W - S.SEAL_W, H - S.SEAL_W],
    pos: [0, H / 2, zLeaf - I.LEAF_THK / 2 - S.SEAL_T / 2], bay: 0, lengthMm: 2 * (W + H),
  });
  // CLAMP PLATE 4 EA — 프레임 네 모서리
  for (let i = 0; i < I.CLAMP_QTY; i++) {
    const sx = i % 2 === 0 ? -1 : 1, sy = i < 2 ? -1 : 1;
    parts.push({
      id: `clamp-${i}`, bomKey: "CLAMP PLATE", label: `CLAMP PLATE ${i + 1}`, spec: `STS304 4T×50 / L=${S.CLAMP_L}(추정)`,
      mat: "STS304", kind: "box", size: [S.CLAMP_W, S.CLAMP_L, S.CLAMP_T],
      pos: [sx * (gW / 2 - S.GUIDE_CHANNEL_W / 2), gCy + sy * (gH / 2 - S.CLAMP_L / 2 - 20), S.GUIDE_DEPTH + S.CLAMP_T / 2], bay: 0,
    });
  }
  const nb = Math.round((2 * (W + H + I.BOLT_OFFSET)) / I.BOLT_PITCH);
  // 개수는 BOM 식(개구 둘레 기준) 그대로, 위치는 문짝이 오르내리는 빈 공간을 피해 가이드 프레임 중심선에 배치
  pointsOnRect(nb, gW - S.GUIDE_CHANNEL_W, gH - S.GUIDE_BEAM_H, 0, gCy)
    .forEach(([x, y], i) => parts.push(bolt(`bolt-${i}`, i, x, y, S.GUIDE_DEPTH - 20, "M12")));

  if (isInteg) {
    const stem = H + I.STEM_EXTRA;
    const box = input.drive === "motor" ? S.ACTUATOR_SIZE : S.GEARBOX_SIZE;
    const boxY = topY + box[1] / 2;
    parts.push({
      id: "spindle", bomKey: "SPINDLE (스핀들)", label: "스핀들", spec: `STS304 Ø${S.SPINDLE_D} × ${stem}L`,
      mat: "STS304", kind: "cyl", axis: "y", size: [S.SPINDLE_D, stem, S.SPINDLE_D], pos: [0, H + stem / 2, zLeaf], bay: 0,
    });
    parts.push({
      id: "stem-cover", bomKey: "SPINDLE / STEM COVER", label: "스템 커버", spec: `Ø76.3×3.2T PIPE / L=${stem}`,
      mat: "STS304", kind: "cyl", axis: "y", size: [S.STEM_COVER_D, stem, S.STEM_COVER_D],
      pos: [0, topY + box[1] + stem / 2, zLeaf], bay: 0,
    });
    if (input.drive === "motor") {
      parts.push({
        id: "actuator", bomKey: "전동 액추에이터", label: "전동 액추에이터", spec: "전동 개폐기 + 스핀들 Ø38 · 외형 추정",
        mat: "전장", kind: "box", size: box, pos: [0, boxY, zLeaf], bay: 0,
      });
    } else {
      parts.push({
        id: "gearbox", bomKey: "GEAR BOX (수동)", label: "기어박스(수동)", spec: "핸들 기어박스 + BASE(STS304) · 외형 추정",
        mat: "전장", kind: "box", size: box, pos: [0, boxY, zLeaf], bay: 0,
      });
    }
    parts.push({
      id: "hinge-bracket", bomKey: "HINGE BRACKET / STOPPER", label: "힌지 브래킷 / 스토퍼", spec: "STS304 / PIN Ø16×110L · 위치·용도 확인 필요(N24)",
      mat: "STS304", kind: "box", size: S.HINGE_BRACKET_SIZE,
      pos: [gW / 2 - S.GUIDE_CHANNEL_W / 2, topY - S.GUIDE_BEAM_H - S.HINGE_BRACKET_SIZE[1] / 2, S.GUIDE_DEPTH + S.HINGE_BRACKET_SIZE[2] / 2], bay: 0,
    });
  } else {
    parts.push({
      id: "lift-rod", bomKey: "인양 ROD / 인양고리", label: "인양봉 / 인양고리", spec: `STS304 Ø${S.LIFT_ROD_D} 인양봉 · 길이 추정(N25)`,
      mat: "STS304", kind: "cyl", axis: "y", size: [S.LIFT_ROD_D, S.LIFT_ROD_L, S.LIFT_ROD_D],
      pos: [0, H + S.LIFT_ROD_L / 2, zLeaf], bay: 0,
    });
  }

  return {
    parts,
    notes: [
      "가이드 프레임 높이(문짝 2배 이동)·구동부 외형·CLAMP 길이는 추정값",
      "보강 RIB은 Cut List 부재(BOM에는 문짝에 포함)",
      ...(isInteg ? [] : ["인양 방식 미정 — 인양봉만 표시(N25)"]),
    ],
  };
}

function bolt(id: string, i: number, x: number, y: number, zFace: number, size: "M10" | "M12"): Part3D {
  const d = size === "M10" ? S.BOLT_D_M10 : S.BOLT_D_M12;
  const l = size === "M10" ? S.BOLT_L_M10 : S.BOLT_L_M12;
  return {
    id, bomKey: "BOLT/NUT (앵커)", label: `앵커 볼트 ${i + 1}`, spec: `STS304 ${size}×${l}L (머리 확대 표시)`,
    mat: "STS304", kind: "cyl", axis: "z", size: [d * S.BOLT_VIS_SCALE * 2, l, d * S.BOLT_VIS_SCALE * 2],
    pos: [x, y, zFace + l / 2 - 10], bay: 0,
  };
}

/* ── 롤러게이트 ── 출처: bom.ts roller 분기 = 데모 FlowCADDemo.jsx:112-126 ── */
function buildRoller(input: Extract<DesignInput, { type: "roller" }>, B: number) {
  const { W, H } = input;
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

  return { parts, notes: ["롤러 지름·레일 단면·교각 폭·권양기 외형은 추정값 — 업체 도면 확인 후 교체"] };
}
