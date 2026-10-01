/* 설계+산출 시간 절감 지표 상수. 출처: 데모 FlowCADDemo.jsx:134-135
 *
 * TODO(PRD 7장 4): 근거 없는 추정식이다. 실측값(4단계 현장 검증)으로 바꾸기 전까지
 * 화면에 "추정" 라벨을 붙여서만 보여 준다. 식 자체는 이번 이관에서 바꾸지 않는다.
 */
export const EXIST_H_MIN = 6;
export const EXIST_H_MAX = 40;
export const EXIST_H_BASE = 6;
export const EXIST_H_PER_M2 = 2.5;
export const EXIST_H_PER_PART = 0.5;
export const EXIST_H_ROLLER_EXTRA = 12;
/** 자동 산출 소요 시간(h). saveRate = 1 − AUTO_H / existH */
export const AUTO_H = 0.03;
