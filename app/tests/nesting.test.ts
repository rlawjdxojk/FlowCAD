/* 네스팅 단위 테스트 — 직사각형 격자 배치, 시트 초과(oversize) 처리 (PRD 7장 1). */
import { describe, expect, it } from "vitest";
import { nestPlates, oversizeSheetsLowerBound, partsPerSheet, type CutItem } from "../src/engine";

const SS = { w: 1524, h: 3048 };
const plate = (o: Partial<CutItem>): CutItem => ({ name: "P", mat: "SS400", thk: 10, w: 100, l: 100, ea: 1, kind: "plate", ...o });

describe("partsPerSheet", () => {
  it("0도·90도 배치 중 많이 들어가는 쪽을 쓴다", () => {
    // 0도: floor(1524/700)·floor(3048/1600) = 2·1 = 2, 90도: floor(1524/1600)=0 → 2
    expect(partsPerSheet(SS, 700, 1600)).toBe(2);
    // 0도: floor(1524/1600)=0, 90도: floor(1524/700)·floor(3048/1600) = 2 → 2
    expect(partsPerSheet(SS, 1600, 700)).toBe(2);
    expect(partsPerSheet(SS, 500, 1000)).toBe(3 * 3);
  });

  it("시트와 같은 크기는 1개", () => {
    expect(partsPerSheet(SS, 1524, 3048)).toBe(1);
    expect(partsPerSheet(SS, 3048, 1524)).toBe(1);
  });

  it("어느 방향으로도 안 들어가면 0", () => {
    expect(partsPerSheet(SS, 1525, 3049)).toBe(0);
    expect(partsPerSheet(SS, 250, 3500)).toBe(0);
  });
});

describe("oversizeSheetsLowerBound", () => {
  it("부품 면적 합 / 시트 면적 을 올림", () => {
    expect(oversizeSheetsLowerBound(SS, 3500, 4000, 1)).toBe(Math.ceil(14_000_000 / 4_645_152)); // 4
    expect(oversizeSheetsLowerBound(SS, 3500, 4000, 3)).toBe(10);
  });
});

describe("nestPlates", () => {
  it("수량이 시트당 개수를 넘으면 시트를 더 쓴다", () => {
    const r = nestPlates([plate({ w: 700, l: 1600, ea: 5 })]); // 시트당 2개 → 3매
    expect(r.detail[0].sheets).toBe(3);
    expect(r.sheets).toBe(3);
    expect(r.scrapRate).toBeCloseTo(1 - (700 * 1600 * 5) / (3 * 1524 * 3048), 12);
    expect(r.detail[0].oversize).toBe(false);
  });

  it("시트 초과 판재는 1매로 세지 않고 oversize + 면적 하한, 로스율에서 제외", () => {
    const r = nestPlates([
      plate({ name: "fit", w: 700, l: 1600, ea: 2 }), // 1매, 정상
      plate({ name: "big", w: 3500, l: 4000, ea: 3 }), // 초과
    ]);
    const [fit, big] = r.detail;
    expect(fit.oversize).toBe(false);
    expect(big.oversize).toBe(true);
    expect(big.sheets).toBe(10);
    expect(r.sheets).toBe(1);
    expect(r.oversizeSheetsMin).toBe(10);
    // 로스율은 fit 부품만으로 계산
    expect(r.scrapRate).toBeCloseTo(1 - (700 * 1600 * 2) / (1524 * 3048), 12);
  });

  it("모든 판재가 시트 초과면 로스율은 null (0% 로 보이지 않게)", () => {
    const r = nestPlates([plate({ w: 3500, l: 4000 })]);
    expect(r.scrapRate).toBeNull();
    expect(r.sheets).toBe(0);
  });

  it("중량은 시트 초과 판재도 포함한다", () => {
    const r = nestPlates([plate({ w: 3500, l: 4000, thk: 12, ea: 2 })]);
    const kgEach = 3500 * 4000 * 12 * 7.85e-6;
    expect(r.detail[0].kgEach).toBeCloseTo(kgEach, 9);
    expect(r.plateKg).toBeCloseTo(kgEach * 2, 9);
  });

  it("재질별 시트 규격을 쓴다 (STS304 1219×2438)", () => {
    const r = nestPlates([plate({ mat: "STS304", w: 1219, l: 2438 })]);
    expect(r.detail[0].sheet).toBe("1219×2438");
    expect(r.detail[0].sheets).toBe(1);
    expect(r.scrapRate).toBe(0);
    // SS400 시트에는 들어가는 1300×2500 도 STS304 시트에는 초과
    expect(nestPlates([plate({ mat: "STS304", w: 1300, l: 2500 })]).detail[0].oversize).toBe(true);
  });

  it("판재가 아닌 부품(봉재)은 매수·로스율 계산에서 빠진다", () => {
    const r = nestPlates([{ ...plate({}), kind: "bar" }]);
    expect(r.detail[0]).toMatchObject({ sheets: null, sheet: "정척봉", oversize: false });
    expect(r.sheets).toBe(0);
    expect(r.scrapRate).toBeNull();
  });

  it("빈 목록", () => {
    expect(nestPlates([])).toEqual({ detail: [], sheets: 0, oversizeSheetsMin: 0, scrapRate: null, plateKg: 0 });
  });
});
