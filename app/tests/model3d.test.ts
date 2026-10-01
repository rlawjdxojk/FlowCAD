/* 3D 형상 모델 테스트 — PRD v2.2 9장 2단계 통과 조건 "3D 부재 수 = BOM 수량(1 SET 기준)" */
import { describe, expect, it } from "vitest";
import { buildModel3D, runDesign, type DesignResult, type Part3D, type RawDesignForm } from "../src/engine";

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

const ROLLER_CASES: RawDesignForm[] = [
  { type: "roller", W: 3500, H: 4000, bays: 3, qty: 1 },
  { type: "roller", W: 2000, H: 3000, bays: 1, qty: 1 },
  { type: "roller", W: 5000, H: 1000, bays: 5, qty: 1 },
  { type: "roller", W: 1500, H: 6200, bays: 2, qty: 4 },
];

describe("buildModel3D — 롤러게이트", () => {
  for (const raw of ROLLER_CASES) {
    it(`부재 수 = BOM 수량 / SET (${raw.W}×${raw.H} ${raw.bays}련 ×${raw.qty})`, () => {
      const r = design(raw);
      const parts = partsOf(r);
      const countLine = (prefix: string) => {
        const line = r.lines.find((l) => l.name.startsWith(prefix));
        expect(line, prefix).toBeDefined();
        return line!.qty / r.Q;
      };
      const count3d = (key: string) => parts.filter((p) => p.bomKey === key).length;

      for (const key of [
        "GATE LEAF (문비)",
        "수평/수직 보강거더",
        "MAIN ROLLER ASS'Y",
        "SIDE / GUIDE ROLLER",
        "GUIDE RAIL (EMBED)",
        "RACK BAR",
        "전동 권양기 (HOIST)",
        "ANCHOR / EMBED",
      ]) {
        expect(count3d(key), key).toBe(countLine(key));
      }

      // 수밀고무는 BOM 이 m 단위(올림) — 3D 총길이로 비교
      const sealMm = parts.filter((p) => p.bomKey === "SEAL RUBBER").reduce((s, p) => s + (p.lengthMm ?? 0), 0);
      expect(Math.ceil(sealMm / 1000)).toBe(countLine("SEAL RUBBER"));
    });
  }

  it("스킨 두께·크기가 BOM 규격과 같다", () => {
    const r = design({ type: "roller", W: 3500, H: 4000, bays: 3, qty: 1 });
    const skins = partsOf(r).filter((p) => p.bomKey === "GATE LEAF (문비)");
    for (const s of skins) expect(s.size).toEqual([3500, 4000, 12]);
    const r2 = design({ type: "roller", W: 3500, H: 3000, bays: 1, qty: 1 });
    expect(partsOf(r2).find((p) => p.bomKey === "GATE LEAF (문비)")!.size[2]).toBe(9);
  });

  it("레일·랙바 길이 = H + 1500", () => {
    const parts = partsOf(design({ type: "roller", W: 3000, H: 2500, bays: 1, qty: 1 }));
    for (const p of parts.filter((x) => x.bomKey === "GUIDE RAIL (EMBED)" || x.bomKey === "RACK BAR")) {
      expect(p.size[1]).toBe(4000);
    }
  });

  it("련이 서로 겹치지 않는다 (스킨 X 범위)", () => {
    const skins = partsOf(design({ type: "roller", W: 3500, H: 4000, bays: 3, qty: 1 }))
      .filter((p) => p.bomKey === "GATE LEAF (문비)")
      .map((p) => [p.pos[0] - p.size[0] / 2, p.pos[0] + p.size[0] / 2])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < skins.length; i++) expect(skins[i][0]).toBeGreaterThan(skins[i - 1][1]);
  });

  it("입력을 바꾸면 형상이 바뀐다 (H 4000 → 6000)", () => {
    const a = partsOf(design({ type: "roller", W: 3500, H: 4000, bays: 1, qty: 1 }));
    const b = partsOf(design({ type: "roller", W: 3500, H: 6000, bays: 1, qty: 1 }));
    expect(b.filter((p) => p.bomKey === "수평/수직 보강거더").length)
      .toBeGreaterThan(a.filter((p) => p.bomKey === "수평/수직 보강거더").length);
  });

  it("id 가 모두 다르다", () => {
    const parts = partsOf(design({ type: "roller", W: 3500, H: 4000, bays: 5, qty: 1 }));
    expect(new Set(parts.map((p) => p.id)).size).toBe(parts.length);
  });
});

describe("buildModel3D — 미지원 형식", () => {
  it("롤러게이트 외에는 supported:false", () => {
    for (const raw of [
      { type: "frp_circle", D: 700, qty: 1 },
      { type: "frp_rect", W: 1000, H: 1000, qty: 1 },
      { type: "integ", W: 800, H: 1000, drive: "manual", qty: 1 },
      { type: "lift", W: 1200, H: 1500, qty: 1 },
    ] as RawDesignForm[]) {
      expect(buildModel3D(design(raw)).supported).toBe(false);
    }
  });
});
