/* 3D 형상 모델 테스트 — PRD v2.2 9장 2단계 통과 조건
   "5개 형식 모두 3D 표시, 3D 부재 수 = BOM 수량(1 SET 기준)" */
import { describe, expect, it } from "vitest";
import { buildModel3D, extentOf, runDesign, type DesignResult, type Part3D, type RawDesignForm } from "../src/engine";

function design(raw: RawDesignForm): DesignResult {
  const run = runDesign(raw);
  if (!run.ok) throw new Error(JSON.stringify(run.errors));
  return run.result;
}

function partsOf(r: DesignResult): Part3D[] {
  const m = buildModel3D(r);
  if (!m.supported) throw new Error(m.reason);
  return m.parts;
}

const CASES: RawDesignForm[] = [
  { type: "roller", W: 3500, H: 4000, bays: 3, qty: 1 },
  { type: "roller", W: 2000, H: 3000, bays: 1, qty: 1 },
  { type: "roller", W: 5000, H: 1000, bays: 5, qty: 1 },
  { type: "roller", W: 1500, H: 6200, bays: 2, qty: 4 },
  { type: "frp_circle", D: 300, qty: 1 },
  { type: "frp_circle", D: 700, qty: 1 },
  { type: "frp_circle", D: 1500, qty: 3 },
  { type: "frp_rect", W: 1000, H: 1200, qty: 2 },
  { type: "frp_rect", W: 2000, H: 2000, qty: 1 },
  { type: "frp_rect", W: 300, H: 300, qty: 1 },
  { type: "integ", W: 800, H: 1000, drive: "manual", qty: 1 },
  { type: "integ", W: 1200, H: 1800, drive: "motor", qty: 3 },
  { type: "lift", W: 1200, H: 1500, qty: 1 },
  { type: "lift", W: 3000, H: 3000, qty: 2 },
];

const label = (raw: RawDesignForm) =>
  `${raw.type} ${raw.type === "frp_circle" ? `Ø${raw.D}` : `${raw.W}×${raw.H}`}${raw.bays ? ` ${raw.bays}련` : ""}${raw.drive && raw.type === "integ" ? ` ${raw.drive}` : ""} ×${raw.qty}`;

describe("buildModel3D — 모든 BOM 줄이 3D 에 있고 수량이 같다", () => {
  for (const raw of CASES) {
    it(label(raw), () => {
      const r = design(raw);
      const parts = partsOf(r);
      const bomParts = parts.filter((p) => p.bomKey);

      for (const line of r.lines) {
        const matched = bomParts.filter((p) => line.name.startsWith(p.bomKey!));
        expect(matched.length, `3D 에 없음: ${line.name}`).toBeGreaterThan(0);
        if (line.unit === "m") {
          // 수밀고무 등 길이 산정 부재: 3D 총길이를 BOM 과 같은 방식(올림)으로 비교
          const mm = matched.reduce((s, p) => s + (p.lengthMm ?? 0), 0);
          expect(Math.ceil(mm / 1000), line.name).toBe(line.qty / r.Q);
        } else {
          expect(matched.length, line.name).toBe(line.qty / r.Q);
        }
      }
      // 반대로, BOM 키를 가진 3D 부재는 모두 BOM 줄과 연결된다
      for (const p of bomParts) {
        expect(r.lines.some((l) => l.name.startsWith(p.bomKey!)), `BOM 에 없음: ${p.bomKey}`).toBe(true);
      }
    });
  }
});

describe("buildModel3D — 형상 검사", () => {
  it("id 가 모두 다르고, 크기가 모두 양수다", () => {
    for (const raw of CASES) {
      const parts = partsOf(design(raw));
      expect(new Set(parts.map((p) => p.id)).size, label(raw)).toBe(parts.length);
      for (const p of parts) for (const v of extentOf(p)) expect(v, `${label(raw)} ${p.id}`).toBeGreaterThan(0);
      for (const p of parts.filter((x) => x.hole)) {
        expect(p.hole![0], p.id).toBeLessThan(p.size[0]);
        expect(p.hole![1], p.id).toBeLessThan(p.size[1]);
      }
    }
  });

  it("롤러게이트: 스킨 두께·크기가 BOM 규격과 같다", () => {
    const skins = partsOf(design({ type: "roller", W: 3500, H: 4000, bays: 3, qty: 1 })).filter((p) => p.bomKey === "GATE LEAF (문비)");
    for (const s of skins) expect(s.size).toEqual([3500, 4000, 12]);
    expect(partsOf(design({ type: "roller", W: 3500, H: 3000, bays: 1, qty: 1 })).find((p) => p.bomKey === "GATE LEAF (문비)")!.size[2]).toBe(9);
  });

  it("롤러게이트: 레일·랙바 길이 = H + 1500, 련끼리 겹치지 않는다", () => {
    const parts = partsOf(design({ type: "roller", W: 3000, H: 2500, bays: 3, qty: 1 }));
    for (const p of parts.filter((x) => x.bomKey === "GUIDE RAIL (EMBED)" || x.bomKey === "RACK BAR")) expect(p.size[1]).toBe(4000);
    const xs = parts.filter((p) => p.bomKey === "GATE LEAF (문비)").map((p) => [p.pos[0] - p.size[0] / 2, p.pos[0] + p.size[0] / 2]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < xs.length; i++) expect(xs[i][0]).toBeGreaterThan(xs[i - 1][1]);
  });

  it("FRP 원형: 문틀 구멍 = 개구 D, SEAL PLATE 외경 = D − 10", () => {
    const parts = partsOf(design({ type: "frp_circle", D: 700, qty: 1 }));
    expect(parts.find((p) => p.id === "frame")!.hole).toEqual([700, 700]);
    expect(parts.find((p) => p.id === "seal-plate")!.size[0]).toBe(690);
  });

  it("FRP 사각: SUPPORT BEAM 길이 = W, SKIN 보강 PL 은 Cut List 전용 표시", () => {
    const parts = partsOf(design({ type: "frp_rect", W: 2000, H: 2000, qty: 1 }));
    for (const b of parts.filter((p) => p.bomKey === "SUPPORT BEAM")) expect(b.size[0]).toBe(2000);
    const reinf = parts.find((p) => p.id === "skin-reinf")!;
    expect(reinf.cutOnly).toBe(true);
    expect(reinf.bomKey).toBeNull();
  });

  it("일체식: 스핀들 길이 = H + 1300, 구동 방식에 따라 기어박스/액추에이터", () => {
    const manual = partsOf(design({ type: "integ", W: 800, H: 1000, drive: "manual", qty: 1 }));
    expect(manual.find((p) => p.id === "spindle")!.size[1]).toBe(2300);
    expect(manual.some((p) => p.id === "gearbox")).toBe(true);
    expect(manual.some((p) => p.id === "actuator")).toBe(false);
    const motor = partsOf(design({ type: "integ", W: 800, H: 1000, drive: "motor", qty: 1 }));
    expect(motor.some((p) => p.id === "actuator")).toBe(true);
  });

  it("일체식·인양식: 보강 RIB 수 = Cut List 수량", () => {
    for (const raw of [{ type: "integ", W: 800, H: 1000, drive: "manual", qty: 2 }, { type: "lift", W: 1200, H: 1500, qty: 1 }] as RawDesignForm[]) {
      const r = design(raw);
      const ribCut = r.cuts.find((c) => c.name === "보강 RIB")!;
      expect(partsOf(r).filter((p) => p.id.startsWith("rib-")).length).toBe(ribCut.ea / r.Q);
    }
  });

  it("입력을 바꾸면 형상이 바뀐다", () => {
    const n = (raw: RawDesignForm, key: string) => partsOf(design(raw)).filter((p) => p.bomKey === key).length;
    expect(n({ type: "roller", W: 3500, H: 6000, bays: 1, qty: 1 }, "수평/수직 보강거더"))
      .toBeGreaterThan(n({ type: "roller", W: 3500, H: 4000, bays: 1, qty: 1 }, "수평/수직 보강거더"));
    expect(n({ type: "frp_circle", D: 1500, qty: 1 }, "BOLT/NUT (앵커)"))
      .toBeGreaterThan(n({ type: "frp_circle", D: 500, qty: 1 }, "BOLT/NUT (앵커)"));
  });
});
