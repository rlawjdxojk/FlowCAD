/* 수위표(staff gauge) — 3D 뷰 옆에 세우는 높이 눈금.
   수문 현장의 빨강 E자 눈금판 모양으로, 현재 문비 높이 H(원형은 지름 D)를 눈금 위에 표시한다.
   장식이 아니라 입력 치수를 그대로 보여 주는 장치라서, 값이 바뀌면 표시선이 눈금을 따라 움직인다. */
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

const BAND = 0.1; // E자 하나 = 0.1 m

/** 눈금 상한(m): H 의 1.25배를 0.5 m 단위로 올림, 최소 1 m */
function scaleTop(hM: number): number {
  return Math.max(1, Math.ceil((hM * 1.25) / 0.5) * 0.5);
}

interface Drag {
  /** 눈금 상한(m) 고정 — 끄는 동안 눈금이 흔들리지 않게 */
  scaleMaxM: number;
  min: number;
  max: number;
  step: number;
  onChange: (mm: number) => void;
}

/** drag 를 주면 수위표를 끌거나 화살표 키로 높이를 바꿀 수 있다(소개 페이지). */
export function StaffGauge({ heightMm, label, drag }: { heightMm: number; label: string; drag?: Drag }) {
  const box = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(480);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPx(Math.max(160, e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hM = heightMm / 1000;
  const top = drag ? drag.scaleMaxM : scaleTop(hM);
  const pad = 14;
  const usable = px - pad * 2;
  const yOf = (m: number) => pad + usable * (1 - m / top);
  const bandPx = (usable * BAND) / top;
  const nBands = Math.round(top / BAND);
  const drawE = bandPx >= 12; // 칸이 너무 작으면 E자 대신 단순 눈금
  const W = 64;
  const markY = yOf(Math.min(hM, top));

  const marks = [];
  for (let i = 0; i < nBands; i++) {
    const y0 = yOf((i + 1) * BAND); // 칸 위쪽
    const color = Math.floor(i / 10) % 2 === 0 ? "var(--gauge)" : "var(--ink)";
    if (drawE) {
      // 실제 수위표처럼 0.1 m 칸의 위쪽 절반(5 cm)에 E자, 아래 절반은 비움. 가로획 3개 = 1 cm 두께
      const eh = bandPx / 2, t = eh / 5;
      marks.push(
        <g key={i} fill={color}>
          <rect x={8} y={y0} width={Math.max(2, t * 1.2)} height={eh} />
          <rect x={8} y={y0} width={18} height={t} />
          <rect x={8} y={y0 + 2 * t} width={14} height={t} />
          <rect x={8} y={y0 + 4 * t} width={18} height={t} />
        </g>,
      );
    } else {
      marks.push(<rect key={i} x={8} y={y0} width={i % 5 === 4 ? 18 : 10} height={Math.max(1, bandPx * 0.35)} fill={color} />);
    }
  }
  const meters = [];
  const step = top > 8 ? 2 : 1;
  for (let m = 0; m <= top + 1e-9; m += step) {
    meters.push(<text key={m} x={36} y={yOf(m) + 4} className="sg-num">{m}</text>);
  }

  const clamp = (mm: number) => drag ? Math.min(drag.max, Math.max(drag.min, Math.round(mm / drag.step) * drag.step)) : mm;
  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || !box.current) return;
    const y = e.clientY - box.current.getBoundingClientRect().top;
    drag.onChange(clamp(((1 - (y - pad) / usable) * top) * 1000));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!drag) return;
    const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
    if (d) { e.preventDefault(); drag.onChange(clamp(heightMm + d * drag.step)); }
  };
  const a11y = drag
    ? {
        role: "slider", tabIndex: 0, "aria-label": label, "aria-valuemin": drag.min, "aria-valuemax": drag.max,
        "aria-valuenow": heightMm, "aria-valuetext": `${hM.toFixed(2)} m`,
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) fromPointer(e); },
        onKeyDown: onKey,
      }
    : { role: "img", "aria-label": `${label} ${hM.toFixed(2)} m` };

  return (
    <div className={"sg" + (drag ? " sg-drag" : "")} ref={box} {...a11y}>
      <svg width={W} height={px} viewBox={`0 0 ${W} ${px}`}>
        <rect x={4} y={pad} width={W - 8} height={usable} rx={2} className="sg-board" />
        {marks}
        {meters}
        <g className="sg-mark" style={{ transform: `translateY(${markY}px)` }}>
          <line x1={2} x2={W - 2} y1={0} y2={0} />
          <path d={`M${W - 2} 0 l-7 -5 v10 z`} />
        </g>
      </svg>
      <div className="sg-read" style={{ transform: `translateY(${markY}px)` }}>
        <span className="sg-read-k">{label}</span>
        <span className="sg-read-v">{hM.toFixed(2)}<small>m</small></span>
      </div>
    </div>
  );
}
