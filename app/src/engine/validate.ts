/* 입력 검증 (PRD 7장 6).
   데모는 빈칸·이상값을 형식마다 다른 기본값(`|| 800`, `|| 3000`, `Math.max(1, …)`)으로 조용히 바꿨다.
   여기서는 형식별 허용 범위(rules/inputRanges.ts)를 기준으로 검사하고, 문제가 있으면 계산하지 않고
   오류 목록을 돌려준다. 형식에 필요 없는 항목(예: 원형의 W·H)은 검사하지 않는다. */
import type {
  DesignInput,
  DriveType,
  GateType,
  RawDesignForm,
  ValidationError,
  ValidationResult,
} from "./types";
import { DRIVE_TYPES, GATE_TYPES, INPUT_RANGES, QTY_RANGE, type NumRange } from "./rules";

const FIELD_LABEL: Record<keyof RawDesignForm, string> = {
  type: "제품 형식",
  D: "개구 직경 ØD",
  W: "폭 W",
  H: "높이 H",
  drive: "구동 방식",
  bays: "연동 수(련)",
  qty: "수량(SET)",
};

/** 숫자 항목 하나를 검사. 통과하면 숫자, 아니면 errors 에 추가하고 null. */
function checkNumber(
  field: keyof RawDesignForm,
  raw: unknown,
  range: NumRange,
  errors: ValidationError[],
): number | null {
  const label = FIELD_LABEL[field];
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    errors.push({ field, code: "required", message: `${label}을(를) 입력하세요.` });
    return null;
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) {
    errors.push({ field, code: "not_number", message: `${label}은(는) 숫자여야 합니다.` });
    return null;
  }
  if (range.integer && !Number.isInteger(n)) {
    errors.push({ field, code: "not_integer", message: `${label}은(는) 정수여야 합니다.` });
    return null;
  }
  if (n < range.min || n > range.max) {
    errors.push({
      field,
      code: "out_of_range",
      message: `${label}은(는) ${range.min}~${range.max} 범위여야 합니다. (입력값 ${n})`,
      min: range.min,
      max: range.max,
    });
    return null;
  }
  return n;
}

export function validateInput(raw: RawDesignForm): ValidationResult {
  const errors: ValidationError[] = [];

  if (!GATE_TYPES.includes(raw.type as GateType)) {
    errors.push({ field: "type", code: "invalid_option", message: `알 수 없는 제품 형식입니다: ${String(raw.type)}` });
    return { ok: false, errors };
  }
  const type = raw.type as GateType;
  const ranges = INPUT_RANGES[type];
  const qty = checkNumber("qty", raw.qty, QTY_RANGE, errors);

  let input: DesignInput | null = null;
  if (type === "frp_circle") {
    const D = checkNumber("D", raw.D, ranges.D!, errors);
    if (D !== null && qty !== null) input = { type, D, qty };
  } else {
    const W = checkNumber("W", raw.W, ranges.W!, errors);
    const H = checkNumber("H", raw.H, ranges.H!, errors);
    if (type === "integ") {
      let drive: DriveType | null = null;
      if (DRIVE_TYPES.includes(raw.drive as DriveType)) drive = raw.drive as DriveType;
      else errors.push({ field: "drive", code: "invalid_option", message: `구동 방식을 선택하세요(수동/전동).` });
      if (W !== null && H !== null && qty !== null && drive !== null) input = { type, W, H, drive, qty };
    } else if (type === "roller") {
      const bays = checkNumber("bays", raw.bays, ranges.bays!, errors);
      if (W !== null && H !== null && qty !== null && bays !== null) input = { type, W, H, bays, qty };
    } else if (W !== null && H !== null && qty !== null) {
      input = { type, W, H, qty };
    }
  }

  if (errors.length > 0 || input === null) return { ok: false, errors };
  return { ok: true, input, errors: [] };
}
