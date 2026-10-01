/* FlowCAD 소개 페이지 (intro.html).
   첫 화면은 설명 대신 실제 엔진으로 계산한 롤러게이트 3D — 수위표를 끌어 문비 높이를 바꾸면 형상과 수치가 다시 계산된다. */
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { buildModel3D, kg, runDesign, type DesignResult } from "./engine";
import { INPUT_RANGES } from "./engine/rules";
import { Viewer3D } from "./ui/Viewer3D";
import { StaffGauge } from "./ui/StaffGauge";
import "./ui/styles.css";
import "./ui/intro.css";

const W = 3500, BAYS = 2;
const H_MIN = 1500, H_MAX = 6000, H_START = 4000;

function design(H: number): DesignResult {
  const run = runDesign({ type: "roller", W, H, bays: BAYS, qty: 1 });
  if (!run.ok) throw new Error("hero input out of range");
  return run.result;
}

function Hero() {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // 처음 한 번, 수위가 차오르듯 낮은 높이에서 시작해 기본 높이로 올라간다
  const [H, setH] = useState(reduce ? H_START : H_MIN);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setH(H_START), 450);
    return () => clearTimeout(t);
  }, [reduce]);

  const r = useMemo(() => design(H), [H]);
  const model = useMemo(() => buildModel3D(r), [r]);
  const fit = useMemo(() => {
    const m = buildModel3D(design(H_MAX));
    return m.supported ? m.bounds : undefined;
  }, []);
  const qty = (prefix: string) => r.lines.find((l) => l.name.startsWith(prefix))?.qty ?? 0;

  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>규격을 넣으면<br />수문이 선다</h1>
        <p className="lead">
          폭·높이·련 수를 입력하면 협업 제조사의 설계 규칙으로 3D 형상, 부품표, 절단 목록, 발주서를 한 번에 계산합니다.
        </p>
        <div className="cta">
          <a className="btn" href="./index.html">설계 화면 열기</a>
          <a className="btn-ghost" href="#how">작동 방식 보기</a>
        </div>
      </div>

      <figure className="hero-stage">
        <div className="view">
          <Viewer3D
            model={model}
            lines={r.lines}
            compact
            fitBounds={fit}
            side={
              <StaffGauge
                heightMm={H}
                label="문비 높이 H"
                drag={{ scaleMaxM: 7, min: H_MIN, max: H_MAX, step: 100, onChange: setH }}
              />
            }
          />
        </div>
        <figcaption>
          <span className="hint">오른쪽 수위표를 끌어 문비 높이를 바꿔 보세요</span>
          <span className="live">
            롤러게이트 {W}×{H} · {BAYS}련 — 보강거더 {qty("수평/수직 보강거더")}조 · 메인 롤러 {qty("MAIN ROLLER ASS'Y")}개 · 강판 {kg(r.plateKg)} kg
          </span>
        </figcaption>
      </figure>
    </section>
  );
}

const STEPS = [
  ["규격 입력", "형식을 고르고 폭·높이(원형은 지름), 련 수, 수량을 넣습니다. 허용 범위를 벗어나면 그 칸에서 바로 알려 줍니다."],
  ["제조사 규칙 적용", "스킨 두께, 보강거더 간격, 롤러 수, 레일 길이처럼 제작 도면에서 가져온 규칙으로 부재 하나하나를 정합니다."],
  ["산출물", "3D 형상, 2D 도면, 부품표, 판재 절단 목록과 네스팅, 발주서가 같은 계산에서 나옵니다. 그래서 3D 부재 수와 부품표 수량이 늘 같습니다."],
] as const;

const range = (t: keyof typeof INPUT_RANGES) => {
  const g = INPUT_RANGES[t];
  if (g.D) return `Ø${g.D.min}–${g.D.max}`;
  return `${g.W!.min}–${g.W!.max} mm`;
};

const TYPES = [
  { t: "frp_circle", name: "FRP 자동수문 · 원형", input: "지름 D", parts: "FRP 문틀·문짝, SEAL PLATE, 힌지, 앵커 볼트" },
  { t: "frp_rect", name: "FRP 자동수문 · 사각", input: "폭 W × 높이 H", parts: "FRP 문틀·문짝, SUPPORT BEAM, LINK 플레이트, 힌지" },
  { t: "integ", name: "일체식 수문", input: "W × H, 수동·전동", parts: "가이드 프레임, 스핀들, 스템 커버, 기어박스·액추에이터" },
  { t: "lift", name: "인양식 수문", input: "W × H", parts: "가이드 프레임, 문짝, 보강 RIB, 인양봉" },
  { t: "roller", name: "롤러게이트", input: "W × H, 1–5련", parts: "스킨, 보강거더, 메인·사이드 롤러, 레일, 랙바, 권양기" },
] as const;

function Intro() {
  return (
    <div className="fc intro">
      <header className="intro-top">
        <span className="logo">FlowCAD</span>
        <span className="brand-sub">수문 제조 설계</span>
        <a className="intro-open" href="./index.html">설계 화면 열기</a>
      </header>

      <Hero />

      <section className="how" id="how">
        <h2>작동 방식</h2>
        <ol>
          {STEPS.map(([h, p], i) => (
            <li key={h}>
              <span className="how-n">{i + 1}</span>
              <h3>{h}</h3>
              <p>{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="kinds">
        <h2>지원하는 수문 형식</h2>
        <p className="kinds-note">입력 범위는 업체 도면으로 확정하기 전의 잠정값입니다.</p>
        <table>
          <thead><tr><th>형식</th><th>입력</th><th className="num">범위</th><th>3D로 보이는 주요 부재</th><th></th></tr></thead>
          <tbody>
            {TYPES.map((k) => (
              <tr key={k.t}>
                <td className="kinds-name">{k.name}</td>
                <td>{k.input}</td>
                <td className="num">{range(k.t)}</td>
                <td className="kinds-parts">{k.parts}</td>
                <td><a href={`./index.html?type=${k.t}`}>열기</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="status">
        <h2>지금 상태</h2>
        <ul>
          <li>설계 규칙은 협업 제조사 제작 도면에서 가져왔고, 도면 번호별 확인을 진행하고 있습니다.</li>
          <li>단가는 데모 표준값(추정)입니다. 구조 검토는 별도로 해야 합니다.</li>
          <li>롤러 지름·교각 폭처럼 도면에 없는 일부 형상 치수는 추정값으로 그립니다.</li>
          <li>다음 단계는 DXF 도면 내보내기입니다.</li>
        </ul>
      </section>

      <footer className="intro-foot">FlowCAD · 수문 제조 설계 자동화 · 시험판</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Intro />
  </React.StrictMode>,
);
