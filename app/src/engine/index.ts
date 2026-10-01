/* FlowCAD 규칙 엔진 공개 API. UI(React)에 의존하지 않는 순수 함수만 둔다(PRD 6장). */
import type { RawDesignForm, RunResult } from "./types";
import { validateInput } from "./validate";
import { computeDesign } from "./bom";

export * from "./types";
export { validateInput } from "./validate";
export { computeDesign, matchCatalog, estimateTime } from "./bom";
export { nestPlates, partsPerSheet, oversizeSheetsLowerBound } from "./nesting";
export { won, kg } from "./format";

/** 폼 입력 → 검증 → 설계. 입력 오류가 있으면 계산하지 않고 오류 목록만 돌려준다. */
export function runDesign(raw: RawDesignForm): RunResult {
  const v = validateInput(raw);
  if (!v.ok) return { ok: false, errors: v.errors };
  return { ok: true, result: computeDesign(v.input), errors: [] };
}
