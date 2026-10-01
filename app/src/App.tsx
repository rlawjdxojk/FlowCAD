/* FlowCAD 화면. 출처: 데모 FlowCADDemo.jsx:141-227 (FlowCADDemo 컴포넌트)
   계산은 전부 규칙 엔진(src/engine)에 맡기고, 여기서는 입력 상태·표시만 다룬다.

   이관 시 바뀐 화면 동작:
   - 입력 오류(빈 값·범위 밖)는 칸 아래와 입력 패널에 표시하고, 결과는 "마지막으로 유효했던 입력" 기준으로 유지한다
     (입력 도중 잠깐 범위를 벗어날 때마다 결과가 사라지지 않게 하기 위함). 이때 결과 위에 안내를 띄운다.
   - 시트 초과 판재 경고를 결과 상단과 Cut list 에 표시한다.
   - 시간 절감 지표·자재비에 "추정" 라벨을 붙인다(PRD 5장, 7장 4). */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { buildModel3D, runDesign, kg, won, type DesignResult, type RawDesignForm, type ValidationError } from "./engine";
import { CIRC_SIZES, INPUT_RANGES, RULE_CLEARANCE } from "./engine/rules";
import { Blueprint } from "./ui/Blueprint";
import { Viewer3D } from "./ui/Viewer3D";
import { BomTable, CutList, Field, Metric, PurchaseOrder } from "./ui/Tables";
import { useCountUp } from "./ui/useCountUp";

type Tab = "bom" | "cut" | "po";
type ViewTab = "3d" | "2d";

// 초기 입력: 데모 FlowCADDemo.jsx:142 와 같음 (PRD 대표 시나리오)
const INITIAL_FORM: RawDesignForm = { type: "roller", D: 700, W: 3500, H: 4000, drive: "manual", bays: 3, qty: 1 };

// 형식을 바꿀 때 넣어 줄 형식별 기본 규격(화면용). 데모는 모든 형식이 롤러용 3500×4000 을 같이 써서
// 형식을 바꾸면 허용 범위를 벗어났다(ANY 스펙 N12). 값은 기준 테스트 입력과 업체 공개 호칭 범위에서 골랐다.
const TYPE_DEFAULTS: Record<string, Partial<RawDesignForm>> = {
  frp_circle: { D: 700 },
  frp_rect: { W: 1500, H: 1500 },
  integ: { W: 800, H: 1000 },
  lift: { W: 1200, H: 1500 },
  roller: { W: 3500, H: 4000, bays: 3 },
};

export default function App() {
  const [form, setForm] = useState<RawDesignForm>(INITIAL_FORM);
  const [tab, setTab] = useState<Tab>("bom");
  const [viewTab, setViewTab] = useState<ViewTab>("3d");
  // 데모와 같은 변환: 빈칸은 "" 로 두고(검증에서 오류 처리), 숫자로 읽히면 숫자로 저장
  const set = (k: keyof RawDesignForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v === "" ? "" : isNaN(+v) ? v : +v }));
  };

  const run = useMemo(() => runDesign(form), [form]);
  const lastValid = useRef<DesignResult | null>(null);
  if (run.ok) lastValid.current = run.result;
  const r = lastValid.current;
  const model3d = useMemo(() => (r ? buildModel3D(r) : null), [r]);
  const errors: ValidationError[] = run.ok ? [] : run.errors;
  const errOf = (field: keyof RawDesignForm) => errors.find((e) => e.field === field)?.message;

  const aCost = useCountUp(r?.totalCost ?? 0);
  const aSave = useCountUp((r?.estimate.saveRate ?? 0) * 100);
  const aScrap = useCountUp((r?.scrapRate ?? 0) * 100);
  const aPart = useCountUp(r?.partKinds ?? 0);

  const isCirc = form.type === "frp_circle";
  const isInteg = form.type === "integ", isRoller = form.type === "roller";
  const hasPlates = r?.hasPlates ?? false;

  useEffect(() => { if (!hasPlates && tab === "cut") setTab("bom"); }, [hasPlates, tab]);

  const dRange = INPUT_RANGES.frp_circle.D!;
  const bRange = INPUT_RANGES.roller.bays!;

  return (
    <div className="fc">
      <header className="hd">
        <div className="hd-brand"><span className="logo">Flow<b>CAD</b></span><span className="tag">수문 제조 설계 자동화 플랫폼</span></div>
        <div className="hd-right"><span className="pill">LIVE DEMO</span><span className="date">실제 제작도면 34장 기준</span></div>
      </header>

      <div className="grid">
        <aside className="panel inputs">
          <div className="panel-h"><span className="step">01</span>수문 규격 입력</div>
          <Field label="제품 형식" error={errOf("type")}>
            <select value={form.type} onChange={(e) => { const t = e.target.value; setForm((f) => ({ ...f, type: t, ...TYPE_DEFAULTS[t] })); }}>
              <option value="frp_circle">FRP 자동수문 (원형)</option>
              <option value="frp_rect">FRP 자동수문 (사각)</option>
              <option value="integ">일체식 수문</option>
              <option value="roller">롤러게이트 (대형)</option>
              <option value="lift">인양식 수문</option>
            </select>
          </Field>

          {isCirc ? (
            <Field label={`개구 직경 ØD — ${form.D}mm`} error={errOf("D")}>
              <input type="range" min={dRange.min} max={dRange.max} step="10" value={form.D ?? ""} onChange={set("D")} />
              <div className="catalog">{CIRC_SIZES.map((s) => <button key={s} type="button" className={+(form.D ?? 0) === s ? "on" : ""} onClick={() => setForm((f) => ({ ...f, D: s }))}>Ø{s}</button>)}</div>
            </Field>
          ) : (
            <div className="row2">
              <Field label="폭 W (mm)" error={errOf("W")}><input type="number" className={errOf("W") ? "invalid" : undefined} value={form.W ?? ""} onChange={set("W")} /></Field>
              <Field label="높이 H (mm)" error={errOf("H")}><input type="number" className={errOf("H") ? "invalid" : undefined} value={form.H ?? ""} onChange={set("H")} /></Field>
            </div>
          )}

          {isInteg && <Field label="구동 방식" error={errOf("drive")}><select value={form.drive} onChange={set("drive")}><option value="manual">수동 (스핀들+기어박스)</option><option value="motor">전동 (액추에이터)</option></select></Field>}
          {isRoller && <Field label={`연동 수 (련) — ${form.bays}련`} error={errOf("bays")}><input type="range" min={bRange.min} max={bRange.max} step="1" value={form.bays ?? ""} onChange={set("bays")} /></Field>}

          <Field label="수량 (SET)" error={errOf("qty")}><input type="number" min="1" className={errOf("qty") ? "invalid" : undefined} value={form.qty ?? ""} onChange={set("qty")} /></Field>

          {errors.length > 0 && (
            <div className="errbox" role="alert">
              <b>입력 오류 {errors.length}건 — 계산하지 않았습니다</b>
              <ul>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>
            </div>
          )}

          <div className="rule"><b>설계 규칙 자동 적용</b>설치 여유 ≥ {RULE_CLEARANCE}mm{isCirc && " · SEAL PLATE Ø(D−10)"}{hasPlates && " · 표준시트 네스팅"}</div>
          <p className="note">입력 즉시 도면·제작 cut list·발주서가 재산출됩니다. 허용 범위 밖 값은 오류로 표시합니다.</p>
        </aside>

        {r && (
          <main className="output">
            {!run.ok && <div className="stale">입력 오류가 있어 아래 결과는 마지막으로 유효했던 입력 기준입니다.</div>}

            <section className="panel canvas-wrap">
              <div className="panel-h light">
                <span className="step">02</span>설계 형상 자동 생성
                <span className="vtabs">
                  <button type="button" className={viewTab === "3d" ? "on" : ""} onClick={() => setViewTab("3d")}>3D 뷰</button>
                  <button type="button" className={viewTab === "2d" ? "on" : ""} onClick={() => setViewTab("2d")}>2D 도면</button>
                </span>
                <span className="auto">{r.match}</span>
              </div>
              {viewTab === "3d" && model3d ? <Viewer3D model={model3d} lines={r.lines} /> : <Blueprint input={r.input} />}
            </section>

            <section className="metrics">
              <Metric k={<>예상 자재비<span className="est">추정</span></>} v={`₩ ${won(aCost)}`} sub={`${r.Q} SET${r.input.type === "roller" ? ` · ${r.B}련` : ""} · 데모 표준단가 · 가공 별도`} />
              {r.hasPlates
                ? <Metric k="강판 로스율"
                    v={r.scrapRate === null ? "—" : `${aScrap.toFixed(1)}%`}
                    sub={r.scrapRate === null
                      ? `전 판재 시트 초과 · 최소 ${r.oversizeSheetsMin}매`
                      : `표준시트 ${r.sheets}매 네스팅${r.oversizeSheetsMin > 0 ? ` + 초과 부품 최소 ${r.oversizeSheetsMin}매` : ""}`} />
                : <Metric k="부품 종수" v={`${Math.round(aPart)} 종`} sub="STS304 + FRP + EPDM" />}
              <Metric k={<>설계+산출 시간 절감<span className="est">추정</span></>} v={`${aSave.toFixed(1)}%`} sub={`기존 약 ${r.estimate.existH.toFixed(0)}시간(추정식, 실측 전) → 수 초`} hot />
              <Metric k="강판 중량" v={`${kg(r.plateKg)} kg`} sub={r.hasPlates ? "절단 부품 합계" : "—"} />
            </section>

            {r.warnings.length > 0 && (
              <div className="warnbox">
                <b>시트 초과 경고 {r.warnings.length}건</b>
                <ul>{r.warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
              </div>
            )}

            <section className="panel">
              <div className="tabs">
                <button className={tab === "bom" ? "on" : ""} onClick={() => setTab("bom")}><span className="step sm">03</span>부품 (BOM)</button>
                {r.hasPlates && <button className={tab === "cut" ? "on" : ""} onClick={() => setTab("cut")}><span className="step sm">04</span>제작 Cut List</button>}
                <button className={tab === "po" ? "on" : ""} onClick={() => setTab("po")}><span className="step sm">{r.hasPlates ? "05" : "04"}</span>발주서</button>
              </div>
              {tab === "bom" && <BomTable r={r} />}
              {tab === "cut" && <CutList r={r} />}
              {tab === "po" && <PurchaseOrder r={r} />}
            </section>

            <p className="disclaimer">※ 부품·재질(STS304·SS400·F.R.P)·절단 규격은 협업 업체 <b>실제 제작 도면</b>에서 추출했습니다. 단가는 데모 표준값(추정)으로, 업체 단가 DB 연동 시 실매입가로 보정됩니다. 구조 검토는 별도입니다.</p>
          </main>
        )}
      </div>
    </div>
  );
}
