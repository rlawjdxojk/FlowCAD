/* 일체식·인양식 수문 규칙 상수.
   출처: 데모 FlowCADDemo.jsx:92-111 (computeBOM 의 isInteg || isLift 분기) */

/** 문짝 SKIN·보강 RIB 두께(STS304). 출처: 데모 FlowCADDemo.jsx:93 */
export const LEAF_THK = 5;
/** 보강 RIB: 폭 40, 개수 = max(MIN, round(H / PITCH)), 길이 W. 출처: 데모 FlowCADDemo.jsx:97-98 */
export const RIB_W = 40;
export const RIB_PITCH = 250;
export const RIB_MIN = 2;
/** 스핀들 길이 = H + 이 값. 출처: 데모 FlowCADDemo.jsx:100 */
export const STEM_EXTRA = 1300;
/** 스핀들 단가 = 길이 × KG_PER_MM × STS304 kg단가 + 가공비. 출처: 데모 FlowCADDemo.jsx:101 */
export const SPINDLE_KG_PER_MM = 0.0063;
export const SPINDLE_EXTRA_PRICE = 30000;
/** 스템 커버 단가 = 길이 × KG_PER_MM × STS304 kg단가. 출처: 데모 FlowCADDemo.jsx:102 */
export const STEM_COVER_KG_PER_MM = 0.018;
/** 구매품 단가(원). 출처: 데모 FlowCADDemo.jsx:103-107 */
export const MOTOR_ACTUATOR_PRICE = 1450000;
export const GEARBOX_PRICE = 120000;
export const HINGE_BRACKET_PRICE = 28000;
export const LIFT_ROD_PRICE = 65000;
/** CLAMP PLATE 4 EA × 9000원. 출처: 데모 FlowCADDemo.jsx:110 */
export const CLAMP_QTY = 4;
export const CLAMP_PRICE = 9000;
/** 앵커 볼트 개수 = round(2 × (W + H + BOLT_OFFSET) / BOLT_PITCH). 출처: 데모 FlowCADDemo.jsx:111 */
export const BOLT_OFFSET = 400;
export const BOLT_PITCH = 150;
export const BOLT_PRICE = 1300;
