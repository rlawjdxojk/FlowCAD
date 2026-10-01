/* BOM 산출 엔진 — 검증된 입력 → 설계 결과(BOM·Cut list·네스팅·원가·추정 지표).
   출처: 데모 FlowCADDemo.jsx:58-139 (computeBOM)

   이관 원칙: 같은 입력에서 데모와 같은 BOM 이 나와야 한다(PRD 9장 0단계 통과 조건).
   그래서 계산식의 연산 순서까지 데모와 같게 두었다(부동소수 결과를 비트 단위로 맞추기 위해).
   상수만 rules/ 로 옮겼다.

   데모와 달라진 점:
   - 입력은 validateInput 을 거친 DesignInput 만 받는다 → `+W || 800` 같은 조용한 기본값 제거 (PRD 7장 6)
   - 시트 초과 판재는 oversize 경고 + 면적 하한 매수, 로스율에서 제외 (PRD 7장 1, nesting.ts)
   - 죽은 계산 `steelKg`, `nest.plateKg * 0`, `.length * 0` 삭제 (PRD 7장 5)
   - 결과에 schemaVersion·input·warnings 추가, 형식 플래그(isCirc 등)는 input.type 으로 대체

   TODO(PRD 7장 7): 문비·GATE LEAF·SEAL PLATE·GUIDE FRAME 은 BOM 단가 0원이고, 그 판재 비용은
   Cut list 쪽(kg 단가 × 중량)에서만 합산된다. 그래서 BOM 표·발주서 합계에는 빠지고 totalCost 에만 들어간다.
   어느 쪽에서 합산할지 정해지기 전까지 데모 방식 그대로 둔다. */
import type { BomLine, CutItem, DesignInput, DesignResult, DesignWarning, MaterialKey, TimeEstimate } from "./types";
import { DESIGN_SCHEMA_VERSION } from "./types";
import { won, kg } from "./format";
import { nestPlates } from "./nesting";
import {
  CIRC_SIZES,
  ESTIMATE_RULES as E,
  FALLBACK_PRICE_KG,
  FRP_RULES as F,
  INTEG_LIFT_RULES as I,
  MAT,
  MM_PER_M,
  ROLLER_RULES as R,
} from "./rules";

const STS_PRICE_KG = MAT.STS304.priceKg!;
const SS_PRICE_KG = MAT.SS400.priceKg!;
const FRP_AREA_PRICE = MAT.FRP.areaPrice!;
const EPDM_PER_M = MAT.EPDM.perM!;

/** 원형 직경에 가장 가까운 표준 정척과 일치/보간 문구. 출처: 데모 FlowCADDemo.jsx:70-72 */
export function matchCatalog(input: DesignInput): string {
  if (input.type !== "frp_circle") return "맞춤 W×H 즉시 생성";
  const D = input.D;
  const n = CIRC_SIZES.reduce((a, b) => (Math.abs(b - D) < Math.abs(a - D) ? b : a));
  return n === D ? `표준 정척 Ø${n} 일치` : `Ø${n} 기반 보간`;
}

/** 시간 절감 추정. 출처: 데모 FlowCADDemo.jsx:134-135 — TODO(PRD 7장 4) 근거 없는 추정식 */
export function estimateTime(open_m2: number, partKinds: number, isRoller: boolean): TimeEstimate {
  const existH = Math.min(
    E.EXIST_H_MAX,
    Math.max(
      E.EXIST_H_MIN,
      E.EXIST_H_BASE + open_m2 * E.EXIST_H_PER_M2 + partKinds * E.EXIST_H_PER_PART + (isRoller ? E.EXIST_H_ROLLER_EXTRA : 0),
    ),
  );
  const saveRate = 1 - E.AUTO_H / existH;
  return { existH, saveRate, basis: "추정" };
}

export function computeDesign(input: DesignInput): DesignResult {
  const Q = input.qty;
  const B = input.type === "roller" ? input.bays : 1;
  const isCirc = input.type === "frp_circle";

  const opening = input.type === "frp_circle" ? Math.PI * Math.pow(input.D / 2, 2) : input.W * input.H;
  const perim = input.type === "frp_circle" ? Math.PI * input.D : 2 * (input.W + input.H);
  const open_m2 = opening / 1e6;
  const match = matchCatalog(input);

  const lines: BomLine[] = [];
  const cuts: CutItem[] = [];
  const add = (name: string, spec: string, q: number, unit: string, price: number, sup: string, mat: string) =>
    lines.push({ name, spec, qty: q * Q, unit, price, sup, mat });
  const cut = (name: string, mat: MaterialKey, thk: number, w: number, l: number, ea: number, kind: CutItem["kind"]) =>
    cuts.push({ name, mat, thk, w, l, ea: ea * Q, kind });

  if (input.type === "frp_circle" || input.type === "frp_rect") {
    // 출처: 데모 FlowCADDemo.jsx:78-91
    const isFrpRect = input.type === "frp_rect";
    const frpArea = (opening * F.FRP_AREA_FACTOR) / 1e6;
    const sealPlateD = input.type === "frp_circle" ? input.D - F.SEAL_PLATE_D_OFFSET : 0;
    add("FRAME (문틀)", `F.R.P + COATING`, 1, "EA", FRP_AREA_PRICE * frpArea * F.FRP_FRAME_SHARE, "FRP성형", "FRP");
    add("DOOR ASS'Y (문짝)", input.type === "frp_circle" ? `F.R.P / Ø${won(sealPlateD)}` : `F.R.P / ${input.W}×${input.H}`, 1, "EA", FRP_AREA_PRICE * frpArea * F.FRP_DOOR_SHARE, "FRP성형", "FRP");
    add("FRAME / DOOR HINGE", "STS304 / HINGE PIN Ø16~32", 1, "SET", (isCirc ? F.HINGE_KG_CIRCLE : F.HINGE_KG_RECT) * STS_PRICE_KG + F.HINGE_EXTRA_PRICE, "STS가공", "STS304");
    add("SEAL PLATE", isCirc ? `STS304 1.5T×Ø${won(sealPlateD)}` : "STS304 5T", 1, "EA", 0, "STS가공", "STS304");
    if (input.type === "frp_rect") {
      add("SUPPORT BEAM", "SS400 ㄷ-100×50×5/7.5T", Math.max(F.SUPPORT_BEAM_MIN, Math.round(input.H / F.SUPPORT_BEAM_PITCH)), "본", (input.W * F.SUPPORT_BEAM_KG_PER_MM) * SS_PRICE_KG, "형강", "SS400");
      add("LINK / CLAMP PLATE", "STS304 5T·L-150", F.LINK_CLAMP_QTY, "EA", F.LINK_CLAMP_PRICE, "STS가공", "STS304");
    }
    add("SEAL RUBBER", "EPDM 4T×40", Math.ceil(perim / MM_PER_M), "m", EPDM_PER_M, "고무자재", "EPDM");
    const flangeP = input.type === "frp_circle"
      ? Math.PI * (input.D + F.FLANGE_OFFSET)
      : 2 * ((input.W + F.FLANGE_OFFSET) + (input.H + F.FLANGE_OFFSET));
    add("BOLT/NUT (앵커)", "STS304 M10×45L", Math.round(flangeP / F.BOLT_PITCH), "세트", F.BOLT_PRICE, "체결구", "STS304");
    // 제작 cut list (금속 부품 — 제작도 실측 규격)
    cut("SEAL PLATE", "STS304", F.SEAL_PLATE_THK, isFrpRect ? F.SEAL_PLATE_W_RECT : F.SEAL_PLATE_W_CIRCLE, isFrpRect ? F.SEAL_PLATE_L_RECT : Math.round(perim), 1, "plate");
    if (input.type === "frp_rect") {
      cut("LINK PLATE", "STS304", F.LINK_PLATE.thk, F.LINK_PLATE.w, F.LINK_PLATE.l, F.LINK_PLATE.ea, "plate");
      cut("CLAMP PLATE", "STS304", F.CLAMP_PLATE.thk, F.CLAMP_PLATE.w, F.CLAMP_PLATE.l, F.CLAMP_PLATE.ea, "plate");
      cut("SKIN 보강 PL", "SS400", F.SKIN_REINF_THK, input.W, input.H, 1, "plate");
    }
  } else if (input.type === "integ" || input.type === "lift") {
    // 출처: 데모 FlowCADDemo.jsx:92-111
    const { W, H } = input;
    add("GATE LEAF (문짝)", `STS304 5T / ${W}×${H}`, 1, "EA", 0, "STS가공", "STS304");
    add("GUIDE FRAME (문틀)", "STS304 채널 / 표준 프레임고", 1, "SET", 0, "STS가공", "STS304");
    cut("GATE LEAF SKIN", "STS304", I.LEAF_THK, W, H, 1, "plate");
    const ribN = Math.max(I.RIB_MIN, Math.round(H / I.RIB_PITCH));
    cut("보강 RIB", "STS304", I.LEAF_THK, I.RIB_W, W, ribN, "plate");
    if (input.type === "integ") {
      const stem = H + I.STEM_EXTRA;
      add("SPINDLE (스핀들)", `STS304 Ø32×${won(stem)}L`, 1, "EA", (stem * I.SPINDLE_KG_PER_MM) * STS_PRICE_KG + I.SPINDLE_EXTRA_PRICE, "STS가공", "STS304");
      add("SPINDLE / STEM COVER", "Ø76.3×3.2T PIPE", 1, "EA", (stem * I.STEM_COVER_KG_PER_MM) * STS_PRICE_KG, "배관자재", "STS304");
      if (input.drive === "motor") add("전동 액추에이터", "전동 개폐기 + 스핀들 Ø38", 1, "EA", I.MOTOR_ACTUATOR_PRICE, "구동부품", "전장");
      else add("GEAR BOX (수동)", "핸들 기어박스 + BASE(STS304)", 1, "EA", I.GEARBOX_PRICE, "구동부품", "조립");
      add("HINGE BRACKET / STOPPER", "STS304 / PIN Ø16×110L", 1, "SET", I.HINGE_BRACKET_PRICE, "STS가공", "STS304");
    } else {
      add("인양 ROD / 인양고리", "STS304 Ø41 인양봉", 1, "SET", I.LIFT_ROD_PRICE, "STS가공", "STS304");
    }
    add("SEAL RUBBER", "EPDM 4T×40", Math.ceil(perim / MM_PER_M), "m", EPDM_PER_M, "고무자재", "EPDM");
    add("CLAMP PLATE", "STS304 4T×50", I.CLAMP_QTY, "EA", I.CLAMP_PRICE, "STS가공", "STS304");
    add("BOLT/NUT (앵커)", "STS304 M12×50L", Math.round((2 * (W + H + I.BOLT_OFFSET)) / I.BOLT_PITCH), "세트", I.BOLT_PRICE, "체결구", "STS304");
  } else {
    // roller. 출처: 데모 FlowCADDemo.jsx:112-126
    const { W, H } = input;
    const tSkin = H >= R.SKIN_THK_THRESHOLD_H ? R.SKIN_THK_THICK : R.SKIN_THK_THIN;
    add(`GATE LEAF (문비) ×${B}련`, `SS400 SKIN ${tSkin}T / ${W}×${H}`, B, "EA", 0, "철구조", "SS400");
    cut("SKIN PLATE", "SS400", tSkin, W, H, B, "plate");
    const ribN = Math.max(R.GIRDER_MIN, Math.round(H / R.GIRDER_PITCH));
    cut("수평 보강거더", "SS400", tSkin, R.GIRDER_W, W, ribN * B, "plate");
    add("수평/수직 보강거더", `SS400 / ${ribN}단`, ribN * B, "조", (W * R.GIRDER_KG_PER_MM) * SS_PRICE_KG, "철구조", "SS400");
    const rollers = Math.max(R.ROLLER_MIN, Math.round(H / R.ROLLER_PITCH) * 2) * B;
    add("MAIN ROLLER ASS'Y", "STS 주물 롤러 + BEARING", rollers, "EA", R.MAIN_ROLLER_PRICE, "구동부품", "STS304");
    add("SIDE / GUIDE ROLLER", "STS 가이드 롤러", rollers, "EA", R.SIDE_ROLLER_PRICE, "구동부품", "STS304");
    add("GUIDE RAIL (EMBED)", `SS400 매립 레일 / 2×${kg((H + R.RAIL_EXTRA) / MM_PER_M)}m`, 2 * B, "본", ((H + R.RAIL_EXTRA) * R.RAIL_KG_PER_MM) * SS_PRICE_KG, "철구조", "SS400");
    add("RACK BAR", `STS304 랙바 / ${kg((H + R.RAIL_EXTRA) / MM_PER_M)}m`, B, "본", ((H + R.RAIL_EXTRA) * R.RACK_KG_PER_MM) * STS_PRICE_KG + R.RACK_EXTRA_PRICE, "구동부품", "STS304");
    add("전동 권양기 (HOIST)", "전동 권양기 + 감속기", B, "SET", R.HOIST_PRICE, "구동부품", "전장");
    add("SEAL RUBBER", "EPDM P/J-TYPE", Math.ceil(perim * B / MM_PER_M), "m", R.SEAL_RUBBER_PRICE_M, "고무자재", "EPDM");
    add("ANCHOR / EMBED", "SS400 매립철물 세트", B, "SET", R.ANCHOR_SET_PRICE, "철구조", "SS400");
  }

  const nest = nestPlates(cuts);
  const totalCost = lines.reduce((s, l) => s + l.price * l.qty, 0)
    + nest.detail.reduce((s, c) => s + c.kgEach * c.ea * (MAT[c.mat]?.priceKg || FALLBACK_PRICE_KG), 0);
  const partKinds = lines.length;

  const warnings: DesignWarning[] = nest.detail
    .filter((c) => c.oversize)
    .map((c) => ({
      code: "oversize_plate" as const,
      part: c.name,
      message: `${c.name} ${c.w}×${c.l} 이(가) 표준 시트 ${c.sheet} 보다 큽니다. 이음(splice) 규칙 미반영 — 매수는 면적 기준 최소 ${c.sheets}매(하한)이며 로스율 계산에서 제외했습니다.`,
    }));

  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    input,
    match,
    lines,
    cuts: nest.detail,
    sheets: nest.sheets,
    oversizeSheetsMin: nest.oversizeSheetsMin,
    scrapRate: nest.scrapRate,
    plateKg: nest.plateKg,
    hasPlates: cuts.some((c) => c.kind === "plate"),
    totalCost,
    partKinds,
    estimate: estimateTime(open_m2, partKinds, input.type === "roller"),
    warnings,
    Q,
    B,
  };
}
