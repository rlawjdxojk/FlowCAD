/* 표준 시트 네스팅 → 시트 매수·로스율 (직사각형 기준, 회전 2방향만 고려).
   출처: 데모 FlowCADDemo.jsx:36-56 (nestPlates)

   데모와 달라진 점(PRD 7장 1):
   - 데모는 `Math.max(1, …)` 때문에 시트보다 큰 판재도 "시트 1장에 1개"로 세어 로스율이 0%에 가깝게 나왔다.
   - 여기서는 그런 부품을 oversize 로 표시하고, 매수는 면적 기반 하한(ceil(부품면적×수량 / 시트면적))만 따로 낸다.
     이음(splice) 규칙이 없으므로 실제 매수는 이보다 많을 수 있다 → 3단계(네스팅 개선)에서 이음 규칙 적용.
   - oversize 부품은 로스율 계산에서 뺀다. 계산 대상이 하나도 없으면 로스율은 null.
   - 중량(plateKg)은 데모와 같게 oversize 포함 전체 합계. */
import type { CutItem, NestResult, NestedCut } from "./types";
import { DEFAULT_SHEET, FALLBACK_MATERIAL, MAT, type SheetSize } from "./rules";

/** 한 시트에 부품이 몇 개 들어가는지(격자 배치, 0도/90도 중 큰 쪽). 0 이면 시트보다 크다. */
export function partsPerSheet(sheet: SheetSize, w: number, l: number): number {
  return Math.max(
    Math.floor(sheet.w / w) * Math.floor(sheet.h / l),
    Math.floor(sheet.w / l) * Math.floor(sheet.h / w),
  );
}

/** 시트보다 큰 부품의 면적 기반 최소 시트 매수(이음 손실 미반영 하한). */
export function oversizeSheetsLowerBound(sheet: SheetSize, w: number, l: number, ea: number): number {
  return Math.ceil((w * l * ea) / (sheet.w * sheet.h));
}

export function nestPlates(cuts: CutItem[]): NestResult {
  let partArea = 0;
  let usedArea = 0;
  let sheets = 0;
  let oversizeSheetsMin = 0;
  let plateKg = 0;

  const detail: NestedCut[] = cuts.map((c) => {
    const M = MAT[c.mat] ?? MAT[FALLBACK_MATERIAL];
    const kgEach = c.w * c.l * c.thk * (M.density ?? 0);
    plateKg += kgEach * c.ea;

    if (c.kind !== "plate") {
      return { ...c, kgEach, sheets: null, sheet: "정척봉", oversize: false };
    }

    const sh = M.sheet ?? DEFAULT_SHEET;
    const sheetLabel = `${sh.w}×${sh.h}`;
    const perSheet = partsPerSheet(sh, c.w, c.l);

    if (perSheet === 0) {
      const need = oversizeSheetsLowerBound(sh, c.w, c.l, c.ea);
      oversizeSheetsMin += need;
      return { ...c, kgEach, sheets: need, sheet: sheetLabel, oversize: true };
    }

    const need = Math.ceil(c.ea / perSheet);
    sheets += need;
    partArea += c.w * c.l * c.ea;
    usedArea += need * sh.w * sh.h;
    return { ...c, kgEach, sheets: need, sheet: sheetLabel, oversize: false };
  });

  const scrapRate = usedArea > 0 ? Math.max(0, 1 - partArea / usedArea) : null;
  return { detail, sheets, oversizeSheetsMin, scrapRate, plateKg };
}
