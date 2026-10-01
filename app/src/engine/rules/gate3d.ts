/* FRP 자동수문·일체식·인양식 3D 형상 상수 (mm).
   데모·업체 도면에 없는 형상 치수는 화면 표시용 [추정] 값이다. 업체 도면을 받으면 교체한다.
   개수·길이·두께는 rules/frp.ts, rules/integLift.ts 와 같은 규칙을 쓴다. */

/* ── 공통: 설치 벽체(배경) ─────────────────────────── */
/** 벽체 두께·여유. [추정] */
export const WALL_THK = 400;
export const WALL_MARGIN = 500;

/* ── FRP 자동수문(원형·사각) ───────────────────────── */
/** 문틀 플랜지 폭: 외곽 = 개구 + 2 × 이 값. 볼트 원(개구+FLANGE_OFFSET)이 플랜지 위에 오도록 잡음. [추정] */
export const FRP_FRAME_FLANGE = 150;
/** 문틀 두께(흐름 방향). [추정] */
export const FRP_FRAME_THK = 60;
/** 문짝이 개구보다 각 변으로 덮는 길이. [추정] — W·H 정의 미정(N10) */
export const FRP_DOOR_OVERLAP = 60;
/** 문짝 두께. [추정] */
export const FRP_DOOR_THK = 40;
/** 수밀고무 단면 폭·두께. 데모 BOM 규격 "EPDM 4T×40" */
export const SEAL_W = 40;
export const SEAL_T = 4;
/** 힌지 세트 외형 (폭 × 높이 × 깊이). [추정] */
export const HINGE_SIZE: [number, number, number] = [220, 120, 160];
/** SUPPORT BEAM ㄷ-100×50 단면(높이 × 깊이). 데모 BOM 규격 */
export const SUPPORT_BEAM_H = 100;
export const SUPPORT_BEAM_D = 50;
/** LINK / CLAMP PLATE 길이 상한(데모 절단 규격 1800)과 폭(BOM "L-150"). */
export const LINK_PLATE_L = 1800;
export const LINK_PLATE_W = 150;
/** 볼트 머리 표시 지름·길이. M10×45L / M12×50L */
export const BOLT_D_M10 = 10;
export const BOLT_L_M10 = 45;
export const BOLT_D_M12 = 12;
export const BOLT_L_M12 = 50;
/** 볼트 표시 배율 — 실제 지름으로는 화면에서 거의 안 보여 와셔 크기로 키워 그림 */
export const BOLT_VIS_SCALE = 2.2;

/* ── 일체식·인양식 ───────────────────────────────── */
/** 가이드 프레임 채널 폭(좌우)·상하 보 높이·깊이. [추정] */
export const GUIDE_CHANNEL_W = 150;
export const GUIDE_BEAM_H = 150;
export const GUIDE_DEPTH = 90;
/** 가이드 프레임 높이 = 문짝이 완전히 열릴 높이(2H) + 상하 보. [추정] */
export const GUIDE_TRAVEL_FACTOR = 2;
/** 스핀들 Ø32 (BOM 규격), 스템 커버 Ø76.3 파이프 */
export const SPINDLE_D = 32;
export const STEM_COVER_D = 76.3;
/** 수동 기어박스 / 전동 액추에이터 외형. [추정] */
export const GEARBOX_SIZE: [number, number, number] = [360, 260, 300];
export const ACTUATOR_SIZE: [number, number, number] = [480, 520, 420];
/** 힌지 브래킷 / 스토퍼 외형. [추정] — 일체식에 힌지가 왜 있는지 불명(N24) */
export const HINGE_BRACKET_SIZE: [number, number, number] = [120, 160, 80];
/** 인양봉 Ø41 (BOM 규격), 길이. [추정] — 인양 방식 미정(N25) */
export const LIFT_ROD_D = 41;
export const LIFT_ROD_L = 900;
/** CLAMP PLATE 4T×50 (BOM 규격), 길이. [추정] — 길이 없음(N15) */
export const CLAMP_W = 50;
export const CLAMP_L = 300;
export const CLAMP_T = 4;
