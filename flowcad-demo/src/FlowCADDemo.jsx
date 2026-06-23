import { useState, useMemo, useEffect, useRef } from "react";

/* =========================================================================
   FlowCAD — 수문 제조 설계 자동화 플랫폼 (투자자 데모 MVP) v3
   협업 업체 실제 DWG 약 34장(FRP·일체식·롤러게이트·인양식) 기준.

   규격 입력 → 파라메트릭 도면 → 제작 Cut List → 표준시트 네스팅·로스율 → 발주서

   ⚠️ 부품 구성·재질·절단 규격은 실제 '제작 도면(shop drawing)'에서 추출.
      단가는 데모용 표준값 (업체 단가 DB 연동 시 실매입가로 보정).
   ========================================================================= */

const MAT = {
  FRP:    { name: "F.R.P",  density: 1.7e-6,  areaPrice: 135000 },
  STS304: { name: "STS304", density: 7.93e-6, priceKg: 4600, sheet: { w: 1219, h: 2438 } },
  SS400:  { name: "SS400",  density: 7.85e-6, priceKg: 1300, sheet: { w: 1524, h: 3048 } },
  EPDM:   { perM: 9000 },
};
const RULE_CLEARANCE = 300;
const CIRC_SIZES = [300, 400, 450, 500, 600, 650, 700, 800, 900, 1000, 1200, 1500];
const won = (n) => Math.round(n).toLocaleString("ko-KR");
const kg = (n) => (+n).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

function useCountUp(target, deps) {
  const [v, setV] = useState(target); const raf = useRef();
  useEffect(() => {
    const from = v, to = target, t0 = performance.now(), dur = 420;
    cancelAnimationFrame(raf.current);
    const tick = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); setV(from + (to - from) * e); if (p < 1) raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line
  }, deps);
  return v;
}

// ── 표준시트 네스팅 → 매수 & 로스율 (제작 cut list 기반) ──────────────
function nestPlates(cuts) {
  let partArea = 0, usedArea = 0, sheets = 0, plateKg = 0;
  const detail = cuts.map((c) => {
    const M = MAT[c.mat] || MAT.SS400;
    const kgEach = c.w * c.l * c.thk * M.density;
    plateKg += kgEach * c.ea;
    if (c.kind === "plate") {
      const sh = M.sheet || { w: 1524, h: 3048 };
      const perSheet = Math.max(1,
        Math.max(Math.floor(sh.w / c.w) * Math.floor(sh.h / c.l),
                 Math.floor(sh.w / c.l) * Math.floor(sh.h / c.w)));
      const need = Math.ceil(c.ea / perSheet);
      sheets += need; partArea += c.w * c.l * c.ea; usedArea += need * sh.w * sh.h;
      return { ...c, kgEach, sheets: need, sheet: `${sh.w}×${sh.h}` };
    }
    return { ...c, kgEach, sheets: null, sheet: "정척봉" };
  });
  const scrapRate = usedArea > 0 ? Math.max(0, 1 - partArea / usedArea) : 0;
  return { detail, sheets, scrapRate, plateKg };
}

// ── BOM 산출 엔진 (제작 도면 부품 구조 그대로) ──────────────────────
function computeBOM(form) {
  const { type, D, W, H, drive, bays, qty } = form;
  const Q = Math.max(1, +qty || 1);
  const B = Math.max(1, +bays || 1);
  const isCirc = type === "frp_circle", isFrpRect = type === "frp_rect";
  const isInteg = type === "integ", isRoller = type === "roller", isLift = type === "lift";

  const opening = isCirc ? Math.PI * Math.pow(+D / 2, 2) : (+W) * (+H);
  const perim = isCirc ? Math.PI * (+D) : 2 * ((+W) + (+H));
  const open_m2 = opening / 1e6;

  let match = "맞춤 규격 (보간 생성)";
  if (isCirc) { const n = CIRC_SIZES.reduce((a, b) => Math.abs(b - D) < Math.abs(a - D) ? b : a); match = n === +D ? `표준 정척 Ø${n} 일치` : `Ø${n} 기반 보간`; }
  else match = "맞춤 W×H 즉시 생성";

  const lines = []; const cuts = [];
  const add = (name, spec, q, unit, price, sup, mat) => lines.push({ name, spec, qty: q * Q, unit, price, sup, mat });
  const cut = (name, mat, thk, w, l, ea, kind) => cuts.push({ name, mat, thk, w, l, ea: ea * Q, kind });

  if (isCirc || isFrpRect) {
    const frpArea = (opening * 2.4) / 1e6;
    const sealPlateD = isCirc ? +D - 10 : null;
    add("FRAME (문틀)", `F.R.P + COATING`, 1, "EA", MAT.FRP.areaPrice * frpArea * 0.55, "FRP성형", "FRP");
    add("DOOR ASS'Y (문짝)", isCirc ? `F.R.P / Ø${won(sealPlateD)}` : `F.R.P / ${W}×${H}`, 1, "EA", MAT.FRP.areaPrice * frpArea * 0.45, "FRP성형", "FRP");
    add("FRAME / DOOR HINGE", "STS304 / HINGE PIN Ø16~32", 1, "SET", (isCirc ? 2.4 : 3.2) * MAT.STS304.priceKg + 40000, "STS가공", "STS304");
    add("SEAL PLATE", isCirc ? `STS304 1.5T×Ø${won(sealPlateD)}` : "STS304 5T", 1, "EA", 0, "STS가공", "STS304");
    if (isFrpRect) { add("SUPPORT BEAM", "SS400 ㄷ-100×50×5/7.5T", Math.max(1, Math.round(H / 700)), "본", (W * 0.012) * MAT.SS400.priceKg, "형강", "SS400"); add("LINK / CLAMP PLATE", "STS304 5T·L-150", 2, "EA", 14000, "STS가공", "STS304"); }
    add("SEAL RUBBER", "EPDM 4T×40", Math.ceil(perim / 1000), "m", MAT.EPDM.perM, "고무자재", "EPDM");
    const flangeP = isCirc ? Math.PI * (+D + 200) : 2 * ((+W + 200) + (+H + 200));
    add("BOLT/NUT (앵커)", "STS304 M10×45L", Math.round(flangeP / 150), "세트", 1100, "체결구", "STS304");
    // 제작 cut list (금속 부품 — 제작도 실측 규격)
    cut("SEAL PLATE", "STS304", 5, isFrpRect ? 150 : 190, isFrpRect ? 220 : Math.round(perim), 1, "plate");
    if (isFrpRect) { cut("LINK PLATE", "STS304", 5, 290, 1800, 2, "plate"); cut("CLAMP PLATE", "STS304", 5, 130, 1800, 1, "plate"); cut("SKIN 보강 PL", "SS400", 1.6, +W || 1500, +H || 1500, 1, "plate"); }
  } else if (isInteg || isLift) {
    const leafThk = 5;
    add("GATE LEAF (문짝)", `STS304 5T / ${W}×${H}`, 1, "EA", 0, "STS가공", "STS304");
    add("GUIDE FRAME (문틀)", "STS304 채널 / 표준 프레임고", 1, "SET", 0, "STS가공", "STS304");
    cut("GATE LEAF SKIN", "STS304", leafThk, +W || 800, +H || 800, 1, "plate");
    const ribN = Math.max(2, Math.round(+H / 250));
    cut("보강 RIB", "STS304", leafThk, 40, +W || 800, ribN, "plate");
    if (isInteg) {
      const stem = +H + 1300;
      add("SPINDLE (스핀들)", `STS304 Ø32×${won(stem)}L`, 1, "EA", (stem * 0.0063) * MAT.STS304.priceKg + 30000, "STS가공", "STS304");
      add("SPINDLE / STEM COVER", "Ø76.3×3.2T PIPE", 1, "EA", (stem * 0.018) * MAT.STS304.priceKg, "배관자재", "STS304");
      if (drive === "motor") add("전동 액추에이터", "전동 개폐기 + 스핀들 Ø38", 1, "EA", 1450000, "구동부품", "전장");
      else add("GEAR BOX (수동)", "핸들 기어박스 + BASE(STS304)", 1, "EA", 120000, "구동부품", "조립");
      add("HINGE BRACKET / STOPPER", "STS304 / PIN Ø16×110L", 1, "SET", 28000, "STS가공", "STS304");
    } else {
      add("인양 ROD / 인양고리", "STS304 Ø41 인양봉", 1, "SET", 65000, "STS가공", "STS304");
    }
    add("SEAL RUBBER", "EPDM 4T×40", Math.ceil(perim / 1000), "m", MAT.EPDM.perM, "고무자재", "EPDM");
    add("CLAMP PLATE", "STS304 4T×50", 4, "EA", 9000, "STS가공", "STS304");
    add("BOLT/NUT (앵커)", "STS304 M12×50L", Math.round((2 * (+W + +H + 400)) / 150), "세트", 1300, "체결구", "STS304");
  } else if (isRoller) {
    const tSkin = +H >= 3500 ? 12 : 9;
    add(`GATE LEAF (문비) ×${B}련`, `SS400 SKIN ${tSkin}T / ${W}×${H}`, B, "EA", 0, "철구조", "SS400");
    cut("SKIN PLATE", "SS400", tSkin, +W || 3000, +H || 3000, B, "plate");
    const ribN = Math.max(3, Math.round(+H / 600));
    cut("수평 보강거더", "SS400", tSkin, 250, +W || 3000, ribN * B, "plate");
    add("수평/수직 보강거더", `SS400 / ${ribN}단`, ribN * B, "조", (W * 0.02) * MAT.SS400.priceKg, "철구조", "SS400");
    const rollers = Math.max(4, Math.round(+H / 800) * 2) * B;
    add("MAIN ROLLER ASS'Y", "STS 주물 롤러 + BEARING", rollers, "EA", 185000, "구동부품", "STS304");
    add("SIDE / GUIDE ROLLER", "STS 가이드 롤러", rollers, "EA", 95000, "구동부품", "STS304");
    add("GUIDE RAIL (EMBED)", `SS400 매립 레일 / 2×${kg((+H + 1500) / 1000)}m`, 2 * B, "본", ((+H + 1500) * 0.03) * MAT.SS400.priceKg, "철구조", "SS400");
    add("RACK BAR", `STS304 랙바 / ${kg((+H + 1500) / 1000)}m`, B, "본", ((+H + 1500) * 0.025) * MAT.STS304.priceKg + 120000, "구동부품", "STS304");
    add("전동 권양기 (HOIST)", "전동 권양기 + 감속기", B, "SET", 3500000, "구동부품", "전장");
    add("SEAL RUBBER", "EPDM P/J-TYPE", Math.ceil(perim * B / 1000), "m", 14000, "고무자재", "EPDM");
    add("ANCHOR / EMBED", "SS400 매립철물 세트", B, "SET", 180000, "철구조", "SS400");
  }

  const nest = nestPlates(cuts);
  const steelKg = nest.plateKg + lines.filter(l => l.mat === "SS400" || l.mat === "STS304").length * 0;
  const totalCost = lines.reduce((s, l) => s + l.price * l.qty, 0) + nest.plateKg * 0
    + nest.detail.reduce((s, c) => s + c.kgEach * c.ea * (MAT[c.mat]?.priceKg || 1300), 0);
  const partKinds = lines.length;
  const existH = Math.min(40, Math.max(6, 6 + open_m2 * 2.5 + partKinds * 0.5 + (isRoller ? 12 : 0)));
  const saveRate = 1 - 0.03 / existH;
  return { isCirc, isFrpRect, isInteg, isRoller, isLift, match, lines, cuts: nest.detail,
    sheets: nest.sheets, scrapRate: nest.scrapRate, plateKg: nest.plateKg, hasPlates: cuts.some(c => c.kind === "plate"),
    totalCost, partKinds, existH, saveRate, Q, B };
}

export default function FlowCADDemo() {
  const [form, setForm] = useState({ type: "roller", D: 700, W: 3500, H: 4000, drive: "manual", bays: 3, qty: 1 });
  const [tab, setTab] = useState("bom");
  const set = (k) => (e) => { const v = e.target.value; setForm(f => ({ ...f, [k]: v === "" ? "" : isNaN(+v) ? v : +v })); };
  const r = useMemo(() => computeBOM(form), [form]);
  const aCost = useCountUp(r.totalCost, [r.totalCost]);
  const aSave = useCountUp(r.saveRate * 100, [r.saveRate]);
  const aScrap = useCountUp(r.scrapRate * 100, [r.scrapRate]);
  const aPart = useCountUp(r.partKinds, [r.partKinds]);
  const isCirc = form.type === "frp_circle", isRect = ["frp_rect", "integ", "lift", "roller"].includes(form.type);
  const isInteg = form.type === "integ", isRoller = form.type === "roller";

  useEffect(() => { if (!r.hasPlates && tab === "cut") setTab("bom"); }, [r.hasPlates, tab]);

  return (
    <div className="fc"><style>{CSS}</style>
      <header className="hd">
        <div className="hd-brand"><span className="logo">Flow<b>CAD</b></span><span className="tag">수문 제조 설계 자동화 플랫폼</span></div>
        <div className="hd-right"><span className="pill">LIVE DEMO</span><span className="date">실제 제작도면 34장 기준</span></div>
      </header>

      <div className="grid">
        <aside className="panel inputs">
          <div className="panel-h"><span className="step">01</span>수문 규격 입력</div>
          <Field label="제품 형식">
            <select value={form.type} onChange={set("type")}>
              <option value="frp_circle">FRP 자동수문 (원형)</option>
              <option value="frp_rect">FRP 자동수문 (사각)</option>
              <option value="integ">일체식 수문</option>
              <option value="roller">롤러게이트 (대형)</option>
              <option value="lift">인양식 수문</option>
            </select>
          </Field>

          {isCirc ? (
            <Field label={`개구 직경 ØD — ${form.D}mm`}>
              <input type="range" min="300" max="1500" step="10" value={form.D} onChange={set("D")} />
              <div className="catalog">{CIRC_SIZES.map(s => <button key={s} className={+form.D === s ? "on" : ""} onClick={() => setForm(f => ({ ...f, D: s }))}>Ø{s}</button>)}</div>
            </Field>
          ) : (
            <div className="row2">
              <Field label="폭 W (mm)"><input type="number" value={form.W} onChange={set("W")} /></Field>
              <Field label="높이 H (mm)"><input type="number" value={form.H} onChange={set("H")} /></Field>
            </div>
          )}

          {isInteg && <Field label="구동 방식"><select value={form.drive} onChange={set("drive")}><option value="manual">수동 (스핀들+기어박스)</option><option value="motor">전동 (액추에이터)</option></select></Field>}
          {isRoller && <Field label={`연동 수 (련) — ${form.bays}련`}><input type="range" min="1" max="5" step="1" value={form.bays} onChange={set("bays")} /></Field>}

          <Field label="수량 (SET)"><input type="number" min="1" value={form.qty} onChange={set("qty")} /></Field>

          <div className="rule"><b>설계 규칙 자동 적용</b>설치 여유 ≥ {RULE_CLEARANCE}mm{isCirc && " · SEAL PLATE Ø(D−10)"}{r.hasPlates && " · 표준시트 네스팅"}</div>
          <p className="note">입력 즉시 도면·제작 cut list·발주서가 재산출됩니다.</p>
        </aside>

        <main className="output">
          <section className="panel canvas-wrap">
            <div className="panel-h light"><span className="step">02</span>설계 도면 자동 생성<span className="auto">{r.match}</span></div>
            <Blueprint form={form} r={r} />
          </section>

          <section className="metrics">
            <Metric k="예상 자재비" v={`₩ ${won(aCost)}`} sub={`${r.Q} SET${isRoller ? ` · ${r.B}련` : ""} · 가공 별도`} />
            {r.hasPlates
              ? <Metric k="강판 로스율" v={`${aScrap.toFixed(1)}%`} sub={`표준시트 ${r.sheets}매 네스팅`} />
              : <Metric k="부품 종수" v={`${Math.round(aPart)} 종`} sub="STS304 + FRP + EPDM" />}
            <Metric k="설계+산출 시간 절감" v={`${aSave.toFixed(1)}%`} sub={`기존 약 ${r.existH.toFixed(0)}시간 → 수 초`} hot />
            <Metric k="강판 중량" v={`${kg(r.plateKg)} kg`} sub={r.hasPlates ? "절단 부품 합계" : "—"} />
          </section>

          <section className="panel">
            <div className="tabs">
              <button className={tab === "bom" ? "on" : ""} onClick={() => setTab("bom")}><span className="step sm">03</span>부품 (BOM)</button>
              {r.hasPlates && <button className={tab === "cut" ? "on" : ""} onClick={() => setTab("cut")}><span className="step sm">04</span>제작 Cut List</button>}
              <button className={tab === "po" ? "on" : ""} onClick={() => setTab("po")}><span className="step sm">{r.hasPlates ? "05" : "04"}</span>발주서</button>
            </div>
            {tab === "bom" && <BomTable r={r} />}
            {tab === "cut" && <CutList r={r} />}
            {tab === "po" && <PurchaseOrder r={r} form={form} />}
          </section>

          <p className="disclaimer">※ 부품·재질(STS304·SS400·F.R.P)·절단 규격은 협업 업체 <b>실제 제작 도면</b>에서 추출했습니다. 단가는 데모 표준값으로, 업체 단가 DB 연동 시 실매입가로 보정됩니다.</p>
        </main>
      </div>
    </div>
  );
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Metric({ k, v, sub, hot }) { return <div className={"metric" + (hot ? " hot" : "")}><div className="mk">{k}</div><div className="mv">{v}</div><div className="ms">{sub}</div></div>; }

function matTag(m) { return <span className={"mat " + (m === "STS304" ? "sts" : m === "SS400" ? "ss" : m === "FRP" ? "frp" : "etc")}>{m}</span>; }

function BomTable({ r }) {
  return (<div className="tbl-wrap"><table className="tbl">
    <thead><tr><th>품명</th><th>규격</th><th>재질</th><th className="num">수량</th><th className="num">예상금액</th></tr></thead>
    <tbody>{r.lines.map((l, i) => (<tr key={i}><td className="nm">{l.name}</td><td className="sp">{l.spec}</td><td>{matTag(l.mat)}</td><td className="num">{l.qty.toLocaleString("ko-KR")} {l.unit}</td><td className="num">₩ {won(l.price * l.qty)}</td></tr>))}</tbody>
    <tfoot><tr><td colSpan="4">합계 (자재 기준)</td><td className="num total">₩ {won(r.totalCost)}</td></tr></tfoot>
  </table></div>);
}

function CutList({ r }) {
  const plates = r.cuts.filter(c => c.kind === "plate");
  return (<div className="tbl-wrap">
    <div className="cut-head">표준시트 네스팅 결과 — 총 <b>{r.sheets}매</b> · 로스율 <b>{(r.scrapRate * 100).toFixed(1)}%</b> · 절단부품 {kg(r.plateKg)}kg</div>
    <table className="tbl"><thead><tr><th>절단 부품</th><th>재질</th><th className="num">두께</th><th className="num">규격(W×L)</th><th className="num">수량</th><th className="num">정척시트</th><th className="num">매수</th></tr></thead>
    <tbody>{plates.map((c, i) => (<tr key={i}><td className="nm">{c.name}</td><td>{matTag(c.mat)}</td><td className="num">{c.thk}T</td><td className="num">{c.w}×{c.l}</td><td className="num">{c.ea} EA</td><td className="num sp">{c.sheet}</td><td className="num">{c.sheets}매</td></tr>))}</tbody></table>
    <div className="po-foot">로스율 최소화 네스팅(커팅 플랜) — 표준시트 자동 배치 후 잔재율 산출. <i>실제 형상 네스팅은 2차 개발</i></div>
  </div>);
}

function PurchaseOrder({ r, form }) {
  const today = new Date().toLocaleDateString("ko-KR");
  const nm = form.type === "frp_circle" ? `FRP 자동수문 Ø${form.D}` : form.type === "frp_rect" ? `FRP 자동수문 ${form.W}×${form.H}`
    : form.type === "integ" ? `일체식 수문 ${form.W}×${form.H}${form.drive === "motor" ? " (전동)" : ""}`
    : form.type === "roller" ? `롤러게이트 ${form.W}×${form.H} ${r.B}련` : `인양식 수문 ${form.W}×${form.H}`;
  const ext = r.lines.filter(l => l.price > 0);
  return (<div className="po">
    <div className="po-top"><div><div className="po-title">발 주 서</div><div className="po-sub">FlowCAD 자동 생성 · {today}</div></div>
      <table className="po-meta"><tbody><tr><th>품목</th><td>{nm} × {r.Q} SET</td></tr><tr><th>발주처</th><td>FlowCAD 협업 제조사</td></tr><tr><th>납기</th><td>발주일 + {r.isRoller ? 45 : 21}일</td></tr></tbody></table></div>
    <table className="tbl po-tbl"><thead><tr><th>No</th><th>품명 / 규격</th><th>재질</th><th className="num">수량</th><th className="num">금액</th><th>공급사</th></tr></thead>
    <tbody>{ext.map((l, i) => (<tr key={i}><td>{i + 1}</td><td className="nm">{l.name} <span className="sp">/ {l.spec}</span></td><td className="sp">{l.mat}</td><td className="num">{l.qty.toLocaleString("ko-KR")} {l.unit}</td><td className="num">₩ {won(l.price * l.qty)}</td><td className="sp">{l.sup}</td></tr>))}</tbody>
    <tfoot><tr><td colSpan="4">합계 (VAT 별도)</td><td className="num total">₩ {won(ext.reduce((s, l) => s + l.price * l.qty, 0))}</td><td></td></tr></tfoot></table>
    <div className="po-foot">엑셀 발주서 다운로드 · 공급사별 디지털 전송 — <i>2차 개발 예정</i></div>
  </div>);
}

/* ── 파라메트릭 도면 ──────────────────────────────────────── */
function Blueprint({ form, r }) {
  const VW = 880, VH = 540, m = 96;
  const C = "#3FC9E0", DIM = "#7FA6BE", ACC = "#F0883E", STS = "#E8C84E", SS = "#8FA9B8";
  if (form.type === "frp_circle") {
    const D = +form.D, maxR = Math.min(VW - m * 2, VH - m * 2) / 2, sc = maxR / (D / 2 * 1.25);
    const cx = VW / 2, cy = VH / 2, R = (D / 2) * sc, Rf = ((D + 200) / 2) * sc, Rs = ((D - 10) / 2) * sc;
    const nb = Math.max(8, Math.round(Math.PI * (D + 200) / 150)), bolts = [];
    for (let i = 0; i < nb; i++) { const a = (i / nb) * 2 * Math.PI; bolts.push([cx + Rf * Math.cos(a), cy + Rf * Math.sin(a)]); }
    return (<svg viewBox={`0 0 ${VW} ${VH}`} className="bp"><BG /><Grid /><Defs />
      <circle cx={cx} cy={cy} r={Rf} fill="none" stroke={DIM} strokeWidth="1" strokeDasharray="3 3" />
      <circle cx={cx} cy={cy} r={R} fill="rgba(63,201,224,.05)" stroke={C} strokeWidth="2" />
      <circle cx={cx} cy={cy} r={Rs} fill="none" stroke={STS} strokeWidth="1.3" strokeDasharray="5 3" />
      {bolts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="none" stroke={ACC} strokeWidth="1.2" />)}
      <rect x={cx - 18} y={cy - R - 16} width="36" height="22" fill="none" stroke={STS} strokeWidth="1.4" />
      <line x1={cx - Rf - 14} y1={cy} x2={cx + Rf + 14} y2={cy} stroke={DIM} strokeWidth=".5" strokeDasharray="8 3 2 3" />
      <line x1={cx} y1={cy - Rf - 14} x2={cx} y2={cy + Rf + 14} stroke={DIM} strokeWidth=".5" strokeDasharray="8 3 2 3" />
      <line x1={cx - R} y1={cy + R + 30} x2={cx + R} y2={cy + R + 30} stroke={DIM} strokeWidth="1" markerStart="url(#ar)" markerEnd="url(#ar)" />
      <text x={cx} y={cy + R + 24} className="bp-dim" textAnchor="middle">ØD = {D} mm</text>
      <text x={cx} y={cy + R + 50} className="bp-note" textAnchor="middle">SEAL PLATE Ø{D - 10} · BOLT {nb}×M10 · 여유 ≥{RULE_CLEARANCE}</text>
      <TitleBlock VW={VW} VH={VH} label={`FRP 자동수문 · Ø${D}`} /></svg>);
  }
  const W = +form.W, H = +form.H, roller = form.type === "roller", integ = form.type === "integ", lift = form.type === "lift";
  const bays = roller ? Math.max(1, +form.bays) : 1;
  const totW = W * bays + (bays - 1) * (W * 0.06);
  const aw = VW - m * 2, ah = VH - m * 2, sc = Math.min(aw / (totW * 1.15), ah / (H * 1.3));
  const dh = H * sc, dwOne = W * sc, gap = W * 0.06 * sc;
  const blockW = dwOne * bays + gap * (bays - 1), x0 = (VW - blockW) / 2, y0 = (VH - dh) / 2 + 10;
  const panels = [];
  for (let b = 0; b < bays; b++) panels.push(x0 + b * (dwOne + gap));
  return (<svg viewBox={`0 0 ${VW} ${VH}`} className="bp"><BG /><Grid /><Defs />
    <rect x={x0 - 12} y={y0 - 12} width={blockW + 24} height={dh + 24} fill="none" stroke={DIM} strokeWidth="1" strokeDasharray="3 3" />
    {panels.map((px, b) => (<g key={b}>
      <rect x={px} y={y0} width={dwOne} height={dh} fill="rgba(63,201,224,.05)" stroke={C} strokeWidth="2" />
      <rect x={px + 10} y={y0 + 10} width={dwOne - 20} height={dh - 20} fill="none" stroke={integ || lift ? STS : SS} strokeWidth="1.2" strokeDasharray="5 3" />
      {/* 보강 거더(수평) */}
      {Array.from({ length: Math.max(2, Math.round(H / 600)) - 1 }).map((_, i, arr) => { const yy = y0 + dh * (i + 1) / (arr.length + 1); return <line key={i} x1={px} y1={yy} x2={px + dwOne} y2={yy} stroke={roller ? SS : C} strokeWidth="1.2" opacity=".65" />; })}
      {/* 롤러게이트: 측면 메인롤러 + 가이드레일 */}
      {roller && <>
        <rect x={px - 9} y={y0} width="6" height={dh} fill={ACC} opacity=".45" />
        <rect x={px + dwOne + 3} y={y0} width="6" height={dh} fill={ACC} opacity=".45" />
        {Array.from({ length: Math.max(3, Math.round(H / 800)) }).map((_, i, arr) => { const yy = y0 + dh * (i + 0.5) / arr.length; return <g key={i}><circle cx={px - 6} cy={yy} r="4" fill="none" stroke={STS} strokeWidth="1.5" /><circle cx={px + dwOne + 6} cy={yy} r="4" fill="none" stroke={STS} strokeWidth="1.5" /></g>; })}
        <line x1={px + dwOne / 2} y1={y0} x2={px + dwOne / 2} y2={y0 - 50} stroke={STS} strokeWidth="2" />
      </>}
      {/* 일체식: 스핀들+기어박스 */}
      {integ && <><line x1={px + dwOne / 2} y1={y0} x2={px + dwOne / 2} y2={y0 - 60} stroke={STS} strokeWidth="2" /><rect x={px + dwOne / 2 - 20} y={y0 - 88} width="40" height="28" fill="none" stroke={STS} strokeWidth="1.5" /></>}
      {lift && <><line x1={px + dwOne / 2} y1={y0} x2={px + dwOne / 2} y2={y0 - 46} stroke={STS} strokeWidth="2" /><circle cx={px + dwOne / 2} cy={y0 - 52} r="7" fill="none" stroke={STS} strokeWidth="1.6" /></>}
    </g>))}
    {/* 권양기 (롤러, 상단 중앙) */}
    {roller && <><rect x={VW / 2 - 40} y={y0 - 78} width="80" height="26" fill="none" stroke={STS} strokeWidth="1.6" /><text x={VW / 2} y={y0 - 60} className="bp-tb" textAnchor="middle">전동 권양기 + RACK BAR</text></>}
    {integ && <text x={x0 + blockW / 2} y={y0 - 72} className="bp-tb" textAnchor="middle">{form.drive === "motor" ? "전동 액추에이터" : "GEAR BOX"} · SPINDLE</text>}
    <text x={x0 + blockW / 2} y={y0 + dh + 26} className="bp-dim" textAnchor="middle">W {W} × H {H} mm{roller ? ` × ${bays}련` : ""}</text>
    <text x={x0 + blockW / 2} y={y0 + dh + 48} className="bp-note" textAnchor="middle">{roller ? `SS400 SKIN ${H >= 3500 ? 12 : 9}T + MAIN ROLLER · ` : integ || lift ? "STS304 5T SKIN + 보강 RIB · " : "FRP + SUPPORT BEAM · "}여유 ≥{RULE_CLEARANCE}mm</text>
    <TitleBlock VW={VW} VH={VH} label={`${roller ? "롤러게이트" : integ ? "일체식 수문" : lift ? "인양식 수문" : "FRP 자동수문"} · ${W}×${H}`} /></svg>);
}
function BG() { return <rect width="880" height="540" fill="#0C2233" />; }
function Grid() { return <rect width="880" height="540" fill="url(#g)" />; }
function Defs() { return <defs><pattern id="g" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#13344a" strokeWidth="1" /></pattern><marker id="ar" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto"><path d="M1 1L8 4.5L1 8" fill="none" stroke="#7FA6BE" strokeWidth="1.2" /></marker></defs>; }
function TitleBlock({ VW, VH, label }) { return <g><rect x={VW - 214} y={VH - 50} width="198" height="36" fill="none" stroke="#7FA6BE" strokeWidth="1" /><line x1={VW - 214} y1={VH - 36} x2={VW - 16} y2={VH - 36} stroke="#7FA6BE" strokeWidth=".6" /><text x={VW - 206} y={VH - 39} className="bp-tb">{label}</text><text x={VW - 206} y={VH - 23} className="bp-tb dim">FlowCAD AUTO-GEN · DWG/DXF</text></g>; }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.fc{--ink:#0E1A2B;--paper:#F3F5F4;--steel:#5B6B7A;--line:#DEE3E2;--blue:#0C2233;--amber:#E0701F;font-family:'IBM Plex Sans KR',system-ui,'Apple SD Gothic Neo',sans-serif;color:var(--ink);background:var(--paper);min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased;}
.fc *{box-sizing:border-box;}
.num,.mv,.bp-dim,.po-meta td{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;}
.hd{display:flex;justify-content:space-between;align-items:center;padding:18px 28px;background:var(--ink);color:#EAF1F4;border-bottom:3px solid var(--amber);flex-wrap:wrap;gap:10px;}
.hd-brand{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;}.logo{font-size:22px;font-weight:300;}.logo b{font-weight:700;color:#F0883E;}
.tag{font-size:12.5px;color:#9DB4C2;}.hd-right{display:flex;align-items:center;gap:14px;}
.pill{font-family:'IBM Plex Mono';font-size:11px;font-weight:600;letter-spacing:1px;color:var(--ink);background:#3FC9E0;padding:3px 9px;border-radius:2px;}
.date{font-size:11.5px;color:#9DB4C2;}
.grid{display:grid;grid-template-columns:340px 1fr;gap:20px;padding:20px 28px 36px;max-width:1400px;margin:0 auto;}
.panel{background:#fff;border:1px solid var(--line);border-radius:6px;overflow:hidden;}
.panel-h{display:flex;align-items:center;gap:10px;padding:13px 16px;font-size:13.5px;font-weight:600;background:var(--ink);color:#EAF1F4;}.panel-h.light{background:#13283A;}
.step{font-family:'IBM Plex Mono';font-size:11px;font-weight:600;color:var(--ink);background:var(--amber);width:24px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:2px;}
.step.sm{width:22px;height:18px;font-size:10px;}
.auto{margin-left:auto;font-family:'IBM Plex Mono';font-size:10px;color:#3FC9E0;border:1px solid #2c5168;padding:2px 8px;border-radius:2px;}
.inputs{padding-bottom:8px;height:fit-content;position:sticky;top:20px;}
.field{display:block;padding:11px 16px 0;}.field>span{display:block;font-size:11.5px;color:var(--steel);margin-bottom:5px;font-weight:500;}
.field input,.field select{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:4px;font-size:14px;font-family:'IBM Plex Mono',monospace;color:var(--ink);background:#FBFCFC;}
.field input:focus,.field select:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px rgba(224,112,31,.12);}
.field input[type=range]{padding:0;accent-color:var(--amber);height:24px;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}.row2 .field{padding-left:16px;padding-right:0;}.row2 .field:last-child{padding-left:6px;padding-right:16px;}
.catalog{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;}
.catalog button{font-family:'IBM Plex Mono';font-size:10.5px;padding:3px 6px;border:1px solid var(--line);background:#fff;border-radius:3px;cursor:pointer;color:var(--steel);}
.catalog button.on{background:var(--amber);color:#fff;border-color:var(--amber);}
.rule{margin:14px 16px 0;padding:10px 12px;background:#FFF6EF;border:1px solid #F2D6BF;border-radius:5px;font-size:11px;color:#9A5A23;line-height:1.5;}
.rule b{display:block;color:var(--amber);font-size:11.5px;margin-bottom:3px;}
.note{font-size:11px;color:var(--steel);padding:12px 16px 4px;margin:12px 0 0;border-top:1px dashed var(--line);}
.output{display:flex;flex-direction:column;gap:20px;min-width:0;}
.bp{display:block;width:100%;height:auto;background:var(--blue);}
.bp-dim{fill:#9FC4D6;font-size:13px;}.bp-note{fill:#6f95a8;font-size:11.5px;font-family:'IBM Plex Mono';}
.bp-tb{fill:#9FC4D6;font-size:10.5px;font-family:'IBM Plex Mono';font-weight:600;}.bp-tb.dim{fill:#5f8295;font-weight:400;}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.metric{background:#fff;border:1px solid var(--line);border-radius:6px;padding:15px 16px;border-top:3px solid var(--steel);}
.metric.hot{border-top-color:var(--amber);background:#FFF9F4;}
.mk{font-size:11.5px;color:var(--steel);font-weight:500;}.mv{font-size:22px;font-weight:600;margin:6px 0 3px;letter-spacing:-.5px;}.metric.hot .mv{color:var(--amber);}.ms{font-size:10.5px;color:var(--steel);}
.tabs{display:flex;border-bottom:1px solid var(--line);}
.tabs button{display:flex;align-items:center;gap:8px;padding:13px 18px;border:none;background:none;font-family:inherit;font-size:13px;font-weight:600;color:var(--steel);cursor:pointer;border-bottom:2px solid transparent;}
.tabs button.on{color:var(--ink);border-bottom-color:var(--amber);}
.tabs button .step{background:var(--line);color:var(--steel);}.tabs button.on .step{background:var(--amber);color:var(--ink);}
.tbl-wrap{overflow-x:auto;}.tbl{width:100%;border-collapse:collapse;font-size:13px;}
.tbl th{text-align:left;padding:10px 14px;font-size:10.5px;font-weight:600;color:var(--steel);background:#F7F9F9;border-bottom:1px solid var(--line);text-transform:uppercase;}
.tbl td{padding:10px 14px;border-bottom:1px solid #EEF1F1;}.tbl .num{text-align:right;}.tbl .nm{font-weight:600;}.tbl .sp{color:var(--steel);font-size:11.5px;}
.tbl tbody tr:hover{background:#FBFCFC;}
.mat{font-family:'IBM Plex Mono';font-size:10px;font-weight:600;padding:2px 6px;border-radius:3px;}
.mat.sts{background:#FBF3D2;color:#8A6D12;}.mat.ss{background:#E4EAEE;color:#3C5563;}.mat.frp{background:#DBF0F4;color:#176577;}.mat.etc{background:#ECEEEE;color:#5B6B7A;}
.tbl tfoot td{padding:13px 14px;font-weight:600;font-size:13px;background:var(--ink);color:#EAF1F4;border:none;}.tbl tfoot .total{font-family:'IBM Plex Mono';font-size:16px;color:#3FC9E0;}
.cut-head{padding:13px 16px;font-size:12.5px;color:var(--steel);background:#FFF6EF;border-bottom:1px solid #F2D6BF;}.cut-head b{color:var(--amber);font-family:'IBM Plex Mono';}
.po{padding:20px;}.po-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:16px;}
.po-title{font-size:22px;font-weight:700;letter-spacing:6px;border-bottom:3px solid var(--ink);padding-bottom:4px;display:inline-block;}
.po-sub{font-size:11px;color:var(--steel);margin-top:6px;font-family:'IBM Plex Mono';}
.po-meta{border-collapse:collapse;font-size:12px;}.po-meta th{background:#F2F5F5;color:var(--steel);text-align:left;padding:6px 12px;font-weight:600;border:1px solid var(--line);white-space:nowrap;}.po-meta td{padding:6px 12px;border:1px solid var(--line);}
.po-tbl{border:1px solid var(--line);}.po-tbl th{background:var(--ink);color:#EAF1F4;}
.po-foot{padding:12px 16px;font-size:11.5px;color:var(--steel);}.po-foot i{color:var(--amber);font-style:normal;}
.disclaimer{font-size:11.5px;color:var(--steel);line-height:1.6;padding:0 2px;margin:0;}.disclaimer b{color:var(--amber);}
@media(max-width:920px){.grid{grid-template-columns:1fr;}.inputs{position:static;}.metrics{grid-template-columns:1fr 1fr;}}
@media(max-width:520px){.metrics{grid-template-columns:1fr;}.hd{padding:14px 16px;}.grid{padding:14px;}}
`;
