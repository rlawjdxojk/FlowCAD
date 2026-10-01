/* 규격 문자열(spec)에 쓰는 숫자 표기. BOM 스펙 문구가 데모와 글자 단위로 같아야 하므로 엔진에 둔다.
   출처: 데모 FlowCADDemo.jsx:21-22 */

/** 원 단위 반올림 + 천 단위 구분 */
export const won = (n: number): string => Math.round(n).toLocaleString("ko-KR");

/** 소수 첫째 자리까지 + 천 단위 구분 */
export const kg = (n: number): string => (+n).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
