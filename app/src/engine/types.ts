/* =========================================================================
   FlowCAD 규칙 엔진 — 입력·출력 타입 정의
   단위: 길이 mm, 무게 kg, 금액 원 (PRD 6장 데이터 규칙)
   ========================================================================= */

/** 설계 결과(설계 모델) 스키마 버전. 올릴 때는 이전 버전 변환 함수를 함께 만든다(PRD 6장). */
export const DESIGN_SCHEMA_VERSION = 1 as const;

export type GateType = "frp_circle" | "frp_rect" | "integ" | "roller" | "lift";
export type DriveType = "manual" | "motor";
export type MaterialKey = "FRP" | "STS304" | "SS400" | "EPDM";

/**
 * 화면 폼에서 그대로 들어오는 원시 입력.
 * 빈칸("")이나 숫자가 아닌 문자열이 들어올 수 있으므로 검증(validateInput)을 거쳐야 한다.
 */
export interface RawDesignForm {
  type: string;
  D?: number | string;
  W?: number | string;
  H?: number | string;
  drive?: string;
  bays?: number | string;
  qty?: number | string;
}

/**
 * 검증을 통과한 입력. 형식마다 필요한 항목만 갖는 판별 유니온이다.
 * (데모는 모든 필드를 늘 들고 다니며 빈 값이면 `|| 800` 같은 기본값으로 조용히 바꿨다 — PRD 7장 6)
 */
export type DesignInput =
  | { type: "frp_circle"; D: number; qty: number }
  | { type: "frp_rect"; W: number; H: number; qty: number }
  | { type: "integ"; W: number; H: number; drive: DriveType; qty: number }
  | { type: "lift"; W: number; H: number; qty: number }
  | { type: "roller"; W: number; H: number; bays: number; qty: number };

export type ValidationCode =
  | "required"
  | "not_number"
  | "not_integer"
  | "out_of_range"
  | "invalid_option";

export interface ValidationError {
  field: keyof RawDesignForm;
  code: ValidationCode;
  message: string;
  min?: number;
  max?: number;
}

export type ValidationResult =
  | { ok: true; input: DesignInput; errors: [] }
  | { ok: false; errors: ValidationError[] };

/** BOM 한 줄. qty 는 이미 수량(SET) Q 가 곱해진 값. price 는 단가(원). */
export interface BomLine {
  name: string;
  spec: string;
  qty: number;
  unit: string;
  price: number;
  sup: string;
  mat: string;
}

export type CutKind = "plate" | "bar";

/** 절단 부품(네스팅 전). ea 는 수량(SET) Q 가 곱해진 값. */
export interface CutItem {
  name: string;
  mat: MaterialKey;
  thk: number;
  w: number;
  l: number;
  ea: number;
  kind: CutKind;
}

/** 네스팅을 거친 절단 부품. */
export interface NestedCut extends CutItem {
  /** 부품 1개 중량(kg) */
  kgEach: number;
  /**
   * 필요한 시트 매수. 판재가 아니면 null.
   * oversize 이면 "면적 기반 하한"(실제 이음 설계 전 최소값)이다.
   */
  sheets: number | null;
  /** 정척 시트 규격 표기("1524×3048") 또는 "정척봉" */
  sheet: string;
  /** 부품이 표준 시트보다 커서 어느 방향으로도 들어가지 않음 (PRD 7장 1) */
  oversize: boolean;
}

export interface NestResult {
  detail: NestedCut[];
  /** 시트에 들어가는 부품의 시트 매수 합 (oversize 제외) */
  sheets: number;
  /** oversize 부품의 면적 기반 최소 시트 매수 합 (이음 규칙 미반영 하한) */
  oversizeSheetsMin: number;
  /** 로스율(0~1). oversize 부품은 제외하고 계산. 계산 대상 판재가 없으면 null */
  scrapRate: number | null;
  /** 절단 부품 전체 중량(kg) — oversize 포함 */
  plateKg: number;
}

export type DesignWarningCode = "oversize_plate";

export interface DesignWarning {
  code: DesignWarningCode;
  message: string;
  part?: string;
}

/** 시간 절감 지표. 근거 없는 추정식이다(PRD 7장 4) — 화면에 반드시 "추정" 표시. */
export interface TimeEstimate {
  /** 기존 설계+산출 추정 시간(h) */
  existH: number;
  /** 절감률(0~1) */
  saveRate: number;
  basis: "추정";
}

/** 규칙 엔진 출력(설계 결과). */
export interface DesignResult {
  schemaVersion: typeof DESIGN_SCHEMA_VERSION;
  input: DesignInput;
  /** 표준 정척 일치/보간 안내 문구 */
  match: string;
  lines: BomLine[];
  cuts: NestedCut[];
  sheets: number;
  oversizeSheetsMin: number;
  scrapRate: number | null;
  plateKg: number;
  hasPlates: boolean;
  /** BOM 단가 합 + 절단 부품 kg 단가 합 (원) */
  totalCost: number;
  partKinds: number;
  estimate: TimeEstimate;
  warnings: DesignWarning[];
  /** 수량(SET) */
  Q: number;
  /** 연동 수(련). 롤러게이트 외에는 1 */
  B: number;
}

export type RunResult =
  | { ok: true; result: DesignResult; errors: [] }
  | { ok: false; errors: ValidationError[] };
