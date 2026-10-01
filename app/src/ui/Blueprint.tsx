/* 파라메트릭 도면 미리보기(SVG). 출처: 데모 FlowCADDemo.jsx:268-326
   검증을 통과한 입력(DesignInput)만 받는다 — 빈 값·범위 밖 값으로 도면을 그리지 않기 위해.
   도면 표현용 계수(거더 줄 수, 롤러 표시 개수 등)는 화면 장식이라 엔진 규칙과 별개로 여기 둔다.
   2단계(도면 생성)에서 설계 모델 기반 SVG·DXF 로 교체 예정. */
import type { DesignInput } from "../engine";
import { RULE_CLEARANCE } from "../engine/rules";

const VW = 880, VH = 540, m = 96;
const C = "#3FC9E0", DIM = "#7FA6BE", ACC = "#F0883E", STS = "#E8C84E", SS = "#8FA9B8";

export function Blueprint({ input }: { input: DesignInput }) {
  if (input.type === "frp_circle") {
    const D = input.D, maxR = Math.min(VW - m * 2, VH - m * 2) / 2, sc = maxR / (D / 2 * 1.25);
    const cx = VW / 2, cy = VH / 2, R = (D / 2) * sc, Rf = ((D + 200) / 2) * sc, Rs = ((D - 10) / 2) * sc;
    const nb = Math.max(8, Math.round(Math.PI * (D + 200) / 150));
    const bolts: [number, number][] = [];
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
      <TitleBlock label={`FRP 자동수문 · Ø${D}`} /></svg>);
  }

  const { W, H } = input;
  const roller = input.type === "roller", integ = input.type === "integ", lift = input.type === "lift";
  const bays = input.type === "roller" ? input.bays : 1;
  const totW = W * bays + (bays - 1) * (W * 0.06);
  const aw = VW - m * 2, ah = VH - m * 2, sc = Math.min(aw / (totW * 1.15), ah / (H * 1.3));
  const dh = H * sc, dwOne = W * sc, gap = W * 0.06 * sc;
  const blockW = dwOne * bays + gap * (bays - 1), x0 = (VW - blockW) / 2, y0 = (VH - dh) / 2 + 10;
  const panels: number[] = [];
  for (let b = 0; b < bays; b++) panels.push(x0 + b * (dwOne + gap));
  const driveLabel = input.type === "integ" && input.drive === "motor" ? "전동 액추에이터" : "GEAR BOX";

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
    {integ && <text x={x0 + blockW / 2} y={y0 - 72} className="bp-tb" textAnchor="middle">{driveLabel} · SPINDLE</text>}
    <text x={x0 + blockW / 2} y={y0 + dh + 26} className="bp-dim" textAnchor="middle">W {W} × H {H} mm{roller ? ` × ${bays}련` : ""}</text>
    <text x={x0 + blockW / 2} y={y0 + dh + 48} className="bp-note" textAnchor="middle">{roller ? `SS400 SKIN ${H >= 3500 ? 12 : 9}T + MAIN ROLLER · ` : integ || lift ? "STS304 5T SKIN + 보강 RIB · " : "FRP + SUPPORT BEAM · "}여유 ≥{RULE_CLEARANCE}mm</text>
    <TitleBlock label={`${roller ? "롤러게이트" : integ ? "일체식 수문" : lift ? "인양식 수문" : "FRP 자동수문"} · ${W}×${H}`} /></svg>);
}

function BG() { return <rect width="880" height="540" fill="#0C2233" />; }
function Grid() { return <rect width="880" height="540" fill="url(#g)" />; }
function Defs() { return <defs><pattern id="g" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#13344a" strokeWidth="1" /></pattern><marker id="ar" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto"><path d="M1 1L8 4.5L1 8" fill="none" stroke="#7FA6BE" strokeWidth="1.2" /></marker></defs>; }
function TitleBlock({ label }: { label: string }) { return <g><rect x={VW - 214} y={VH - 50} width="198" height="36" fill="none" stroke="#7FA6BE" strokeWidth="1" /><line x1={VW - 214} y1={VH - 36} x2={VW - 16} y2={VH - 36} stroke="#7FA6BE" strokeWidth=".6" /><text x={VW - 206} y={VH - 39} className="bp-tb">{label}</text><text x={VW - 206} y={VH - 23} className="bp-tb dim">FlowCAD AUTO-GEN · DWG/DXF</text></g>; }
