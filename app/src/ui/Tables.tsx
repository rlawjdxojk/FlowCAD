/* BOM · Cut list · 발주서 표. 출처: 데모 FlowCADDemo.jsx:229-266
   이관 시 추가: Cut list 에 시트 초과(oversize) 표시, 로스율 미산출(null) 처리. */
import type { ReactNode } from "react";
import { kg, won, type DesignInput, type DesignResult } from "../engine";
import { LEAD_DAYS_DEFAULT, LEAD_DAYS_ROLLER } from "../engine/rules";

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <span className="field-err">{error}</span>}
    </label>
  );
}

export function Metric({ k, v, sub, hot }: { k: ReactNode; v: string; sub: string; hot?: boolean }) {
  return <div className={"metric" + (hot ? " hot" : "")}><div className="mk">{k}</div><div className="mv">{v}</div><div className="ms">{sub}</div></div>;
}

function matTag(m: string) {
  return <span className={"mat " + (m === "STS304" ? "sts" : m === "SS400" ? "ss" : m === "FRP" ? "frp" : "etc")}>{m}</span>;
}

export function BomTable({ r }: { r: DesignResult }) {
  return (<div className="tbl-wrap"><table className="tbl">
    <thead><tr><th>품명</th><th>규격</th><th>재질</th><th className="num">수량</th><th className="num">예상금액</th></tr></thead>
    <tbody>{r.lines.map((l, i) => (<tr key={i}><td className="nm">{l.name}</td><td className="sp">{l.spec}</td><td>{matTag(l.mat)}</td><td className="num">{l.qty.toLocaleString("ko-KR")} {l.unit}</td><td className="num">₩ {won(l.price * l.qty)}</td></tr>))}</tbody>
    <tfoot><tr><td colSpan={4}>합계 (자재 기준)</td><td className="num total">₩ {won(r.totalCost)}</td></tr></tfoot>
  </table></div>);
}

export function CutList({ r }: { r: DesignResult }) {
  const plates = r.cuts.filter((c) => c.kind === "plate");
  return (<div className="tbl-wrap">
    <div className="cut-head">
      표준시트 네스팅 결과 — 총 <b>{r.sheets}매</b>
      {r.oversizeSheetsMin > 0 && <> + 시트 초과 부품 최소 <b>{r.oversizeSheetsMin}매</b>(이음 미반영 하한)</>}
      {" "}· 로스율 <b>{r.scrapRate === null ? "산출 불가" : `${(r.scrapRate * 100).toFixed(1)}%`}</b>
      {r.oversizeSheetsMin > 0 && " (시트 초과 부품 제외)"} · 절단부품 {kg(r.plateKg)}kg
    </div>
    <table className="tbl"><thead><tr><th>절단 부품</th><th>재질</th><th className="num">두께</th><th className="num">규격(W×L)</th><th className="num">수량</th><th className="num">정척시트</th><th className="num">매수</th></tr></thead>
      <tbody>{plates.map((c, i) => (<tr key={i} className={c.oversize ? "over" : undefined}>
        <td className="nm">{c.name}{c.oversize && <span className="badge-over">시트 초과</span>}</td>
        <td>{matTag(c.mat)}</td><td className="num">{c.thk}T</td><td className="num">{c.w}×{c.l}</td><td className="num">{c.ea} EA</td><td className="num sp">{c.sheet}</td>
        <td className="num">{c.oversize ? `≥${c.sheets}매` : `${c.sheets}매`}</td>
      </tr>))}</tbody></table>
    <div className="po-foot">로스율 최소화 네스팅(커팅 플랜) — 표준시트 자동 배치 후 잔재율 산출. <i>시트 초과 부품의 이음 규칙·실제 형상 네스팅은 이후 단계</i></div>
  </div>);
}

export function gateLabel(input: DesignInput, B: number): string {
  switch (input.type) {
    case "frp_circle": return `FRP 자동수문 Ø${input.D}`;
    case "frp_rect": return `FRP 자동수문 ${input.W}×${input.H}`;
    case "integ": return `일체식 수문 ${input.W}×${input.H}${input.drive === "motor" ? " (전동)" : ""}`;
    case "roller": return `롤러게이트 ${input.W}×${input.H} ${B}련`;
    case "lift": return `인양식 수문 ${input.W}×${input.H}`;
  }
}

export function PurchaseOrder({ r }: { r: DesignResult }) {
  const today = new Date().toLocaleDateString("ko-KR");
  const nm = gateLabel(r.input, r.B);
  // TODO(PRD 7장 7): 단가 0원 줄(문비·SEAL PLATE 등)은 발주서에서 빠지고 판재 비용은 Cut list 에서만 잡힌다.
  const ext = r.lines.filter((l) => l.price > 0);
  return (<div className="po">
    <div className="po-top"><div><div className="po-title">발 주 서</div><div className="po-sub">FlowCAD 자동 생성 · {today}</div></div>
      <table className="po-meta"><tbody><tr><th>품목</th><td>{nm} × {r.Q} SET</td></tr><tr><th>발주처</th><td>FlowCAD 협업 제조사</td></tr><tr><th>납기</th><td>발주일 + {r.input.type === "roller" ? LEAD_DAYS_ROLLER : LEAD_DAYS_DEFAULT}일</td></tr></tbody></table></div>
    <table className="tbl po-tbl"><thead><tr><th>No</th><th>품명 / 규격</th><th>재질</th><th className="num">수량</th><th className="num">금액</th><th>공급사</th></tr></thead>
      <tbody>{ext.map((l, i) => (<tr key={i}><td>{i + 1}</td><td className="nm">{l.name} <span className="sp">/ {l.spec}</span></td><td className="sp">{l.mat}</td><td className="num">{l.qty.toLocaleString("ko-KR")} {l.unit}</td><td className="num">₩ {won(l.price * l.qty)}</td><td className="sp">{l.sup}</td></tr>))}</tbody>
      <tfoot><tr><td colSpan={4}>합계 (VAT 별도)</td><td className="num total">₩ {won(ext.reduce((s, l) => s + l.price * l.qty, 0))}</td><td></td></tr></tfoot></table>
    <div className="po-foot">엑셀 발주서 다운로드 · 공급사별 디지털 전송 — <i>2차 개발 예정</i></div>
  </div>);
}
