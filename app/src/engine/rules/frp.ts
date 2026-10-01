/* FRP 자동수문(원형·사각) 규칙 상수.
   출처: 데모 FlowCADDemo.jsx:78-91 (computeBOM 의 isCirc || isFrpRect 분기) */

/** FRP 성형 면적 = 개구 면적 × 이 계수. 출처: 데모 FlowCADDemo.jsx:79 */
export const FRP_AREA_FACTOR = 2.4;
/** FRAME / DOOR 가 FRP 성형비를 나누는 비율. 출처: 데모 FlowCADDemo.jsx:81-82 */
export const FRP_FRAME_SHARE = 0.55;
export const FRP_DOOR_SHARE = 0.45;
/** SEAL PLATE Ø = D − 이 값. 출처: 데모 FlowCADDemo.jsx:80 */
export const SEAL_PLATE_D_OFFSET = 10;
/** HINGE 세트 STS304 중량(kg)·가공비(원). 출처: 데모 FlowCADDemo.jsx:83 */
export const HINGE_KG_CIRCLE = 2.4;
export const HINGE_KG_RECT = 3.2;
export const HINGE_EXTRA_PRICE = 40000;
/** SUPPORT BEAM(사각): 개수 = max(MIN, round(H / PITCH)), 단가 = W × KG_PER_MM × SS400 kg단가.
    출처: 데모 FlowCADDemo.jsx:85 */
export const SUPPORT_BEAM_PITCH = 700;
export const SUPPORT_BEAM_MIN = 1;
export const SUPPORT_BEAM_KG_PER_MM = 0.012;
/** LINK / CLAMP PLATE(사각) 2 EA × 14000원. 출처: 데모 FlowCADDemo.jsx:85 */
export const LINK_CLAMP_QTY = 2;
export const LINK_CLAMP_PRICE = 14000;
/** 앵커 볼트: 플랜지 = 개구 + FLANGE_OFFSET, 개수 = round(플랜지 둘레 / BOLT_PITCH). 출처: 데모 FlowCADDemo.jsx:87-88 */
export const FLANGE_OFFSET = 200;
export const BOLT_PITCH = 150;
export const BOLT_PRICE = 1100;

/**
 * 절단 부품(Cut list). 출처: 데모 FlowCADDemo.jsx:90-91
 *
 * TODO(PRD 7장 2): 원형 SEAL PLATE 를 "폭 190 × 둘레 길이" 띠판 1장으로 절단한다고 계산한다.
 * 실제 제작 방식(원판 가공인지, 분할 띠판인지)을 도면에서 확인하기 전까지 데모 규칙 그대로 둔다.
 */
export const SEAL_PLATE_THK = 5;
export const SEAL_PLATE_W_CIRCLE = 190;
export const SEAL_PLATE_W_RECT = 150;
export const SEAL_PLATE_L_RECT = 220;
export const LINK_PLATE = { thk: 5, w: 290, l: 1800, ea: 2 } as const;
export const CLAMP_PLATE = { thk: 5, w: 130, l: 1800, ea: 1 } as const;
/** SKIN 보강 PL(SS400) 두께. 치수는 W×H. 출처: 데모 FlowCADDemo.jsx:91 */
export const SKIN_REINF_THK = 1.6;
