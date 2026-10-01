/* 형식별 입력 허용 범위 (PRD 4장 "규격 입력: 허용 범위 검사", 7장 6).
 *
 * ⚠ 잠정값: 데모에는 범위 규정이 없었다(빈 값이면 `|| 800` 등으로 조용히 대체 — 데모 FlowCADDemo.jsx:61-62, 91, 96, 98, 115, 117).
 * 근거가 있는 것은 출처를 달았고, 나머지는 기준 도면 규격대를 덮을 만큼 넓게 잡은 임시값이다.
 * 1단계(규칙 스펙화)에서 업체 도면 규격 범위로 확정해야 한다.
 */
import type { GateType } from "../types";

export interface NumRange {
  min: number;
  max: number;
  integer?: boolean;
}

export interface GateInputRanges {
  D?: NumRange;
  W?: NumRange;
  H?: NumRange;
  bays?: NumRange;
}

export const INPUT_RANGES: Record<GateType, GateInputRanges> = {
  // 출처: PRD 3장(표준 정척 Ø300~1500), 데모 FlowCADDemo.jsx:177 (슬라이더 300~1500)
  frp_circle: { D: { min: 300, max: 1500 } },
  // 잠정값
  frp_rect: { W: { min: 300, max: 3000 }, H: { min: 300, max: 3000 } },
  // 잠정값
  integ: { W: { min: 300, max: 3000 }, H: { min: 300, max: 3000 } },
  // 잠정값
  lift: { W: { min: 300, max: 3000 }, H: { min: 300, max: 3000 } },
  // W·H 잠정값. 련 수 출처: PRD 3장(1~5련), 데모 FlowCADDemo.jsx:188 (슬라이더 1~5)
  roller: {
    W: { min: 1000, max: 10000 },
    H: { min: 1000, max: 10000 },
    bays: { min: 1, max: 5, integer: true },
  },
};

/** 수량(SET). 잠정값 — 데모는 `Math.max(1, +qty || 1)` (FlowCADDemo.jsx:61)로 하한만 있었다. */
export const QTY_RANGE: NumRange = { min: 1, max: 999, integer: true };

export const GATE_TYPES: readonly GateType[] = ["frp_circle", "frp_rect", "integ", "roller", "lift"];

export const DRIVE_TYPES = ["manual", "motor"] as const;
