/* 데모 원본 출력(기준 파일)과 엔진 출력 비교 — PRD 9장 0단계 통과 조건
   "기존 데모와 같은 입력에서 같은 BOM(수정 항목 제외)".

   - 수정하지 않은 항목(BOM 줄, 원가, 중량, 부품 치수·수량·kg, 추정 지표)은 데모와 정확히 같아야 한다.
   - 의도적으로 고친 항목(PRD 7장 1: 시트 초과 판재)은 "어떻게 달라야 하는지"를 명시적으로 검증한다.
   기준 파일은 scripts/gen-demo-fixtures.mjs 로 데모 원본 함수를 실행해 만든 것이며 손으로 고치지 않는다. */
import { describe, expect, it } from "vitest";
import { runDesign, DESIGN_SCHEMA_VERSION, type DesignResult, type RawDesignForm } from "../src/engine";

interface DemoCut {
  name: string; mat: string; thk: number; w: number; l: number; ea: number; kind: string;
  kgEach: number; sheets: number | null; sheet: string;
}
interface DemoOutput {
  match: string;
  lines: DesignResult["lines"];
  cuts: DemoCut[];
  sheets: number;
  scrapRate: number;
  plateKg: number;
  hasPlates: boolean;
  totalCost: number;
  partKinds: number;
  existH: number;
  saveRate: number;
  Q: number;
  B: number;
}
interface Fixture {
  id: string;
  primary: boolean;
  description: string;
  form: RawDesignForm;
  demoOutput: DemoOutput;
}

const modules = import.meta.glob<Fixture>("./fixtures/demo-baseline/*.json", { eager: true, import: "default" });
const fixtures = Object.values(modules);

/** 시트 초과로 판정돼야 하는 부품(사람이 시트 규격과 대조해 적은 기대값 — 엔진 판정을 그대로 믿지 않기 위해) */
const EXPECTED_OVERSIZE: Record<string, string[]> = {
  frp_circle_700: [],
  frp_rect_1000x1200_q2: [],
  integ_800x1000_manual: [],
  roller_3500x4000_b3: ["SKIN PLATE", "수평 보강거더"], // 3500×4000, 250×3500 > SS400 1524×3048
  lift_1200x1500: [],
  frp_circle_750_interp: [],
  frp_circle_1500: ["SEAL PLATE"], // 190×4712 > STS304 1219×2438
  frp_rect_2000x2000: ["SKIN 보강 PL"], // 2000×2000 > SS400 1524×3048
  integ_1200x1800_motor_q3: [],
  roller_2000x3000_b1: ["SKIN PLATE"], // 2000×3000 > 1524×3048
};

const SHEET_AREA: Record<string, number> = { STS304: 1219 * 2438, SS400: 1524 * 3048 };

function run(form: RawDesignForm): DesignResult {
  const r = runDesign(form);
  if (!r.ok) throw new Error(`기준 입력이 검증에 실패: ${JSON.stringify(r.errors)}`);
  return r.result;
}

describe("기준 파일 구성", () => {
  it("5개 형식 대표 입력이 모두 있다", () => {
    const types = new Set(fixtures.filter((f) => f.primary).map((f) => f.form.type));
    expect([...types].sort()).toEqual(["frp_circle", "frp_rect", "integ", "lift", "roller"]);
  });
  it("모든 기준 파일에 시트 초과 기대값이 적혀 있다", () => {
    for (const f of fixtures) expect(EXPECTED_OVERSIZE[f.id], f.id).toBeDefined();
  });
});

describe.each(fixtures.map((f) => [f.id, f] as const))("데모 기준 비교: %s", (_id, fx) => {
  const demo = fx.demoOutput;
  const r = run(fx.form);
  const oversizeNames = EXPECTED_OVERSIZE[fx.id];

  it("schemaVersion 과 검증된 입력을 담는다", () => {
    expect(r.schemaVersion).toBe(DESIGN_SCHEMA_VERSION);
    expect(r.input.type).toBe(fx.form.type);
  });

  it("BOM 줄이 데모와 완전히 같다 (품명·규격·수량·단가·공급·재질)", () => {
    expect(r.lines).toEqual(demo.lines);
  });

  it("수정하지 않은 집계값이 데모와 같다", () => {
    expect(r.match).toBe(demo.match);
    expect(r.totalCost).toBe(demo.totalCost);
    expect(r.plateKg).toBe(demo.plateKg);
    expect(r.hasPlates).toBe(demo.hasPlates);
    expect(r.partKinds).toBe(demo.partKinds);
    expect(r.Q).toBe(demo.Q);
    // B(련 수): 데모는 형식과 무관하게 폼의 bays 값을 그대로 돌려줬다(롤러가 아니면 어디에도 안 쓰이는 잔여값).
    // 엔진은 롤러게이트만 bays 를 받고 그 외 형식은 1 — 의도된 표현 차이(BOM 에는 영향 없음).
    if (fx.form.type === "roller") expect(r.B).toBe(demo.B);
    else expect(r.B).toBe(1);
    // 시간 절감은 식을 바꾸지 않았다(PRD 7장 4는 라벨만) — 값은 같고 "추정" 표식이 붙는다
    expect(r.estimate.existH).toBe(demo.existH);
    expect(r.estimate.saveRate).toBe(demo.saveRate);
    expect(r.estimate.basis).toBe("추정");
  });

  it("절단 부품의 치수·수량·중량은 데모와 같다", () => {
    expect(r.cuts.length).toBe(demo.cuts.length);
    r.cuts.forEach((c, i) => {
      const d = demo.cuts[i];
      expect({ name: c.name, mat: c.mat, thk: c.thk, w: c.w, l: c.l, ea: c.ea, kind: c.kind, kgEach: c.kgEach, sheet: c.sheet })
        .toEqual({ name: d.name, mat: d.mat, thk: d.thk, w: d.w, l: d.l, ea: d.ea, kind: d.kind, kgEach: d.kgEach, sheet: d.sheet });
    });
  });

  it("시트 초과 판재 판정이 기대값과 같다 (PRD 7장 1)", () => {
    expect(r.cuts.filter((c) => c.oversize).map((c) => c.name)).toEqual(oversizeNames);
    expect(r.warnings.map((w) => w.part)).toEqual(oversizeNames);
    expect(r.warnings.every((w) => w.code === "oversize_plate")).toBe(true);
  });

  it("시트 안에 들어가는 판재의 매수는 데모와 같고, 초과 판재만 의도적으로 다르다", () => {
    r.cuts.forEach((c, i) => {
      const d = demo.cuts[i];
      if (!c.oversize) {
        expect(c.sheets, c.name).toBe(d.sheets);
        return;
      }
      // 데모 동작(버그): Math.max(1, 0) 때문에 "시트 1장에 1개" → 매수 = 수량
      expect(d.sheets, `데모 ${c.name}`).toBe(d.ea);
      // 엔진: 면적 기반 하한
      expect(c.sheets, c.name).toBe(Math.ceil((d.w * d.l * d.ea) / SHEET_AREA[d.mat]));
    });

    const fitDemo = demo.cuts.filter((d, i) => d.kind === "plate" && !r.cuts[i].oversize);
    const overDemo = demo.cuts.filter((_d, i) => r.cuts[i].oversize);
    expect(r.sheets).toBe(fitDemo.reduce((s, d) => s + (d.sheets ?? 0), 0));
    expect(r.oversizeSheetsMin).toBe(overDemo.reduce((s, d) => s + Math.ceil((d.w * d.l * d.ea) / SHEET_AREA[d.mat]), 0));
  });

  it("로스율: 초과 판재가 없으면 데모와 같고, 있으면 초과 판재를 빼고 다시 계산한다", () => {
    if (oversizeNames.length === 0) {
      expect(r.scrapRate).toBe(demo.scrapRate);
      return;
    }
    let partArea = 0, usedArea = 0;
    demo.cuts.forEach((d, i) => {
      if (d.kind !== "plate" || r.cuts[i].oversize) return;
      partArea += d.w * d.l * d.ea;
      usedArea += (d.sheets ?? 0) * SHEET_AREA[d.mat];
    });
    const expected = usedArea > 0 ? Math.max(0, 1 - partArea / usedArea) : null;
    if (expected === null) expect(r.scrapRate).toBeNull();
    else expect(r.scrapRate).toBeCloseTo(expected, 12);
    expect(r.scrapRate).not.toBe(demo.scrapRate);
  });
});

describe("PRD 대표 시나리오(롤러게이트 3500×4000 3련) 수정 내용 고정", () => {
  const fx = fixtures.find((f) => f.id === "roller_3500x4000_b3")!;
  const r = run(fx.form);

  it("데모는 24매·로스율 45.8% 로 잘못 산출했다", () => {
    expect(fx.demoOutput.sheets).toBe(24);
    expect(fx.demoOutput.scrapRate).toBeCloseTo(0.458, 3);
  });

  it("엔진은 모든 판재를 시트 초과로 표시하고 로스율을 산출하지 않는다", () => {
    expect(r.sheets).toBe(0);
    // SKIN 3500×4000×3 → ceil(42,000,000 / 4,645,152) = 10, 거더 250×3500×21 → ceil(18,375,000 / 4,645,152) = 4
    expect(r.cuts.map((c) => c.sheets)).toEqual([10, 4]);
    expect(r.oversizeSheetsMin).toBe(14);
    expect(r.scrapRate).toBeNull();
    expect(r.warnings).toHaveLength(2);
  });
});

describe("죽은 계산 삭제 (PRD 7장 5)", () => {
  it("결과에 steelKg 가 없다", () => {
    const r = run(fixtures[0].form);
    expect(r).not.toHaveProperty("steelKg");
  });
});
