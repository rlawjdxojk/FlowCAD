/* 롤러게이트 규칙 상수.
   출처: 데모 FlowCADDemo.jsx:112-126 (computeBOM 의 isRoller 분기) */

/** SKIN 두께: H ≥ THRESHOLD 이면 THICK, 아니면 THIN. 출처: 데모 FlowCADDemo.jsx:113 */
export const SKIN_THK_THRESHOLD_H = 3500;
export const SKIN_THK_THICK = 12;
export const SKIN_THK_THIN = 9;
/** 수평 보강거더: 개수 = max(MIN, round(H / PITCH)) × 련, 폭 250, 단가 = W × KG_PER_MM × SS400 kg단가.
    출처: 데모 FlowCADDemo.jsx:116-118 */
export const GIRDER_PITCH = 600;
export const GIRDER_MIN = 3;
export const GIRDER_W = 250;
export const GIRDER_KG_PER_MM = 0.02;
/** 롤러 개수 = max(MIN, round(H / PITCH) × 2) × 련. 출처: 데모 FlowCADDemo.jsx:119 */
export const ROLLER_PITCH = 800;
export const ROLLER_MIN = 4;
export const MAIN_ROLLER_PRICE = 185000;
export const SIDE_ROLLER_PRICE = 95000;
/** 매립 레일·랙바 길이 = H + 이 값. 출처: 데모 FlowCADDemo.jsx:122-123 */
export const RAIL_EXTRA = 1500;
export const RAIL_KG_PER_MM = 0.03;
export const RACK_KG_PER_MM = 0.025;
export const RACK_EXTRA_PRICE = 120000;
/** 구매품 단가(원). 출처: 데모 FlowCADDemo.jsx:124-126 */
export const HOIST_PRICE = 3500000;
export const SEAL_RUBBER_PRICE_M = 14000;
export const ANCHOR_SET_PRICE = 180000;
