/* 롤러게이트 3D 형상 상수 (mm).
   데모·업체 도면에 없는 형상 치수는 화면 표시용 [추정] 값이다. 업체 도면을 받으면 교체한다
   (ANY 규칙 스펙 v0 N11·N19, 업체 질문 2·8). 개수·길이·두께는 rules/roller.ts 와 같은 규칙을 쓴다. */

/** 교각(콘크리트 피어) 폭. [추정] — 데모는 화면용 0.06W 간격만 있음(N11) */
export const PIER_W = 800;
/** 교각·문틀 깊이(흐름 방향). [추정] */
export const PIER_DEPTH = 1600;
/** 바닥 슬래브(문턱) 두께. [추정] */
export const SILL_THK = 400;

/** 문비 각 변이 개구보다 레일 홈 안으로 물리는 길이. [추정] — W·H 정의 미정(N10) */
export const LEAF_OVERLAP = 0;

/** 매립 가이드 레일 단면 (폭 × 깊이). [추정] */
export const RAIL_SECTION = 150;
/** 메인 롤러 지름·폭. [추정] */
export const MAIN_ROLLER_D = 260;
export const MAIN_ROLLER_W = 90;
/** 사이드(가이드) 롤러 지름·폭. [추정] */
export const SIDE_ROLLER_D = 140;
export const SIDE_ROLLER_W = 60;

/** 랙바 단면. [추정] */
export const RACK_SECTION = 90;
/** 권양기 외형 (폭 × 높이 × 깊이). [추정] */
export const HOIST_SIZE: [number, number, number] = [900, 600, 700];
/** 권양기 받침 데크 두께. [추정] */
export const DECK_THK = 250;

/** 수밀고무 단면. 데모 BOM 은 둘레(4면) 길이로 산정 — 3D 도 4면으로 표시(N16) */
export const SEAL_SECTION = 40;

/** 앵커(매립철물) 판 폭·두께. [추정] */
export const ANCHOR_W = 300;
export const ANCHOR_THK = 20;
