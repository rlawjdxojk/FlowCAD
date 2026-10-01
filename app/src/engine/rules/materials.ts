/* 재질 상수 — 밀도(kg/mm³), kg 단가(원), 표준 시트 규격(mm).
   단가는 데모 표준값이다(PRD 5장: 화면에 "추정" 표시, 3단계에서 업체 실매입가 단가 DB로 교체). */
import type { MaterialKey } from "../types";

export interface SheetSize {
  w: number;
  h: number;
}

export interface MaterialRule {
  name?: string;
  density?: number;
  priceKg?: number;
  areaPrice?: number;
  perM?: number;
  sheet?: SheetSize;
}

// 출처: 데모 FlowCADDemo.jsx:13-18 (MAT)
export const MAT: Record<MaterialKey, MaterialRule> = {
  FRP: { name: "F.R.P", density: 1.7e-6, areaPrice: 135000 },
  STS304: { name: "STS304", density: 7.93e-6, priceKg: 4600, sheet: { w: 1219, h: 2438 } },
  SS400: { name: "SS400", density: 7.85e-6, priceKg: 1300, sheet: { w: 1524, h: 3048 } },
  EPDM: { perM: 9000 },
};

/** 시트 규격이 없는 재질의 대체 시트. 출처: 데모 FlowCADDemo.jsx:44 */
export const DEFAULT_SHEET: SheetSize = { w: 1524, h: 3048 };

/** 재질 정보가 없을 때 쓰는 대체 재질. 출처: 데모 FlowCADDemo.jsx:40 (`MAT[c.mat] || MAT.SS400`) */
export const FALLBACK_MATERIAL: MaterialKey = "SS400";

/** 절단 부품 원가 계산 시 kg 단가가 없을 때의 대체값(원/kg). 출처: 데모 FlowCADDemo.jsx:132 */
export const FALLBACK_PRICE_KG = 1300;
