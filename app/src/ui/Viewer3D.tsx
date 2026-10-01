/* 3D 뷰어 (PRD v2.2 4장 "3D 뷰어" P0).
   규칙 엔진의 3D 형상 모델(buildModel3D)을 Three.js 로 그린다. 형상 계산은 엔진에만 있고, 여기서는 표시·조작만 한다. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, GizmoHelper, GizmoViewport, Grid, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ExtrudeGeometry, Path, Shape, type PerspectiveCamera } from "three";
import type { BomLine, Model3D, Part3D, Vec3 } from "../engine";

const MM = 0.001; // 화면 단위 m
const WATER = "#0e3b43"; // 뷰 배경 — styles.css --water 와 같은 값

const MAT_COLOR: Record<string, string> = {
  SS400: "#7d93a3",
  STS304: "#d9c27a",
  EPDM: "#1d2228",
  전장: "#e0701f",
  CONCRETE: "#b9c0c4",
};

type View = "iso" | "front" | "side" | "top";
const VIEW_DIR: Record<View, Vec3> = {
  iso: [1, 0.75, 1.25],
  front: [0, 0.05, -1],
  side: [1, 0.05, 0],
  top: [0, 1, 0.001],
};

/** compact: 시점 버튼·안내·주석을 숨긴 소개 페이지용 */
/** fitBounds: 카메라를 맞출 범위를 고정(값을 끄는 동안 카메라가 튀지 않게) */
export function Viewer3D({ model, lines, side, compact, fitBounds }: {
  model: Model3D; lines: BomLine[]; side?: ReactNode; compact?: boolean; fitBounds?: { min: Vec3; max: Vec3 };
}) {
  const [view, setView] = useState<View>("iso");
  const [viewNonce, setViewNonce] = useState(0);
  const [showContext, setShowContext] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  if (!model.supported) {
    return <div className="v3d-empty">{model.reason}</div>;
  }

  const sel = model.parts.find((p) => p.id === selected) ?? null;
  const selLine = sel?.bomKey ? lines.find((l) => l.name.startsWith(sel.bomKey!)) : undefined;
  const nBom = model.parts.filter((p) => !p.context).length;
  const pick = (v: View) => { setView(v); setViewNonce((n) => n + 1); };

  return (
    <div className={"v3d" + (compact ? " v3d-compact" : "")}>
      {!compact && <div className="v3d-bar">
        {(["iso", "front", "side", "top"] as View[]).map((v) => (
          <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => pick(v)}>
            {{ iso: "아이소", front: "정면(상류)", side: "측면", top: "평면" }[v]}
          </button>
        ))}
        <label className="v3d-chk"><input type="checkbox" checked={showContext} onChange={(e) => setShowContext(e.target.checked)} />콘크리트 표시</label>
        <span className="v3d-count">부재 {nBom}개 · 1 SET</span>
      </div>}

      <div className="v3d-row">
      <div className="v3d-canvas">
        <Canvas camera={{ fov: 35, near: 0.05, far: 500 }} shadows dpr={[1, 2]} onPointerMissed={() => setSelected(null)}>
          <color attach="background" args={[WATER]} />
          <hemisphereLight args={["#dfefff", "#22313c", 0.9]} />
          <directionalLight position={[8, 14, 10]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-10, 6, -8]} intensity={0.5} />
          <Scene
            parts={model.parts}
            showContext={showContext}
            selected={selected}
            hover={hover}
            onSelect={setSelected}
            onHover={setHover}
          />
          <Grid
            position={[0, (model.bounds.min[1] * MM) - 0.001, 0]}
            args={[60, 60]} cellSize={0.5} sectionSize={2.5}
            cellColor="#1a5560" sectionColor="#2b7a82" fadeDistance={45} infiniteGrid
          />
          <CameraRig bounds={fitBounds ?? model.bounds} view={view} nonce={viewNonce} zoom={!compact} />
          <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
            <GizmoViewport axisColors={["#e05a4f", "#5fbf6a", "#4f8fe0"]} labelColor={WATER} />
          </GizmoHelper>
        </Canvas>

        {(sel || !compact) && <div className="v3d-info">
          {sel ? (
            <>
              <div className="v3d-info-h">{sel.label}</div>
              <div className="v3d-info-r"><span>규격</span>{sel.spec}</div>
              <div className="v3d-info-r"><span>재질</span>{sel.mat}</div>
              <div className="v3d-info-r"><span>형상</span>{sel.kind === "cyl" ? `Ø${sel.size[0]} × ${sel.size[1]}` : sel.size.join(" × ")} mm</div>
              {selLine
                ? <div className="v3d-info-r"><span>BOM</span>{selLine.name} · {selLine.qty} {selLine.unit}</div>
                : <div className="v3d-info-r dim"><span>BOM</span>{sel.cutOnly ? "BOM 줄 없음 — Cut List 부재" : "배경 요소(산출 제외)"}</div>}
            </>
          ) : (
            <div className="v3d-info-hint">부재를 클릭하면 품명·규격이 표시됩니다 · 드래그 회전 · 우클릭 드래그 이동 · 휠 확대</div>
          )}
        </div>}
      </div>
      {side}
      </div>
      {!compact && <p className="v3d-note">{model.notes.join(" · ")}</p>}
    </div>
  );
}

function Scene(props: {
  parts: Part3D[]; showContext: boolean; selected: string | null; hover: string | null;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
}) {
  const { parts, showContext, selected, hover, onSelect, onHover } = props;
  const visible = useMemo(() => parts.filter((p) => showContext || !p.context), [parts, showContext]);
  return (
    <group scale={MM}>
      {visible.map((p) => (
        <PartMesh
          key={p.id} part={p}
          selected={selected === p.id} hovered={hover === p.id}
          onSelect={onSelect} onHover={onHover}
        />
      ))}
    </group>
  );
}

function PartMesh({ part, selected, hovered, onSelect, onHover }: {
  part: Part3D; selected: boolean; hovered: boolean;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
}) {
  const base = MAT_COLOR[part.mat] ?? "#9aa";
  const color = selected ? "#3fc9e0" : hovered ? "#f6b26b" : base;
  const rot: Vec3 = part.kind === "cyl"
    ? part.axis === "x" ? [0, 0, Math.PI / 2] : part.axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0]
    : [0, 0, 0];
  const stop = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();

  return (
    // 배경(콘크리트)은 반투명이라 뒤의 부재를 가리지 않도록 클릭·호버 대상에서 뺀다
    <mesh
      position={part.pos} rotation={rot} castShadow={!part.context} receiveShadow
      raycast={part.context ? () => null : undefined}
      onClick={part.context ? undefined : (e) => { stop(e); onSelect(part.id); }}
      onPointerOver={part.context ? undefined : (e) => { stop(e); onHover(part.id); }}
      onPointerOut={part.context ? undefined : () => onHover(null)}
    >
      {part.kind === "box" && <boxGeometry args={part.size} />}
      {part.kind === "cyl" && <cylinderGeometry args={[part.size[0] / 2, part.size[0] / 2, part.size[1], 48]} />}
      {(part.kind === "ring" || part.kind === "rframe") && <HoledPlate part={part} />}
      <meshStandardMaterial
        color={color}
        metalness={part.mat === "CONCRETE" || part.mat === "EPDM" ? 0 : 0.55}
        roughness={part.mat === "CONCRETE" ? 0.95 : 0.45}
        transparent={part.context} opacity={part.context ? 0.28 : 1} depthWrite={!part.context}
      />
      {!part.context && <Edges threshold={20} color={selected ? "#ffffff" : "#0c1a26"} />}
    </mesh>
  );
}

/** 모델 크기에 맞춰 카메라 위치·대상을 잡는다. 시점 버튼을 누르거나 모델 크기가 바뀌면 다시 맞춘다. */
/** zoom=false: 휠을 페이지 스크롤에 양보(소개 페이지) */
function CameraRig({ bounds, view, nonce, zoom = true }: { bounds: { min: Vec3; max: Vec3 }; view: View; nonce: number; zoom?: boolean }) {
  const { camera, size: viewport } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const key = `${bounds.min.join()}|${bounds.max.join()}`;

  useEffect(() => {
    const c: Vec3 = [0, 1, 2].map((i) => ((bounds.min[i] + bounds.max[i]) / 2) * MM) as Vec3;
    // 모델을 감싸는 구(반지름 = 대각선/2)가 화면 세로·가로 시야각 안에 다 들어오는 거리
    const radius = Math.hypot(...[0, 1, 2].map((i) => (bounds.max[i] - bounds.min[i]) * MM)) / 2;
    const cam = camera as PerspectiveCamera;
    const vHalf = (cam.fov * Math.PI) / 360;
    const hHalf = Math.atan(Math.tan(vHalf) * cam.aspect);
    const dist = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.02;
    const d = VIEW_DIR[view];
    const len = Math.hypot(...d);
    camera.position.set(c[0] + (d[0] / len) * dist, c[1] + (d[1] / len) * dist, c[2] + (d[2] / len) * dist);
    camera.lookAt(...c);
    if (controls.current) {
      controls.current.target.set(...c);
      controls.current.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, view, nonce, viewport.width, viewport.height]);

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12} enableZoom={zoom} enablePan={zoom} />;
}


/** 가운데가 뚫린 판(원형 고리·사각 테). XY 평면 모양을 Z 방향으로 두께만큼 밀어 만든다. */
function HoledPlate({ part }: { part: Part3D }) {
  const geom = useMemo(() => {
    const [w, h, t] = part.size;
    const [hw, hh] = part.hole ?? [0, 0];
    const shape = new Shape();
    const hole = new Path();
    if (part.kind === "ring") {
      shape.absarc(0, 0, w / 2, 0, Math.PI * 2, false);
      hole.absarc(0, 0, hw / 2, 0, Math.PI * 2, true);
    } else {
      shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
      hole.moveTo(-hw / 2, -hh / 2); hole.lineTo(-hw / 2, hh / 2); hole.lineTo(hw / 2, hh / 2); hole.lineTo(hw / 2, -hh / 2); hole.closePath();
    }
    shape.holes.push(hole);
    const g = new ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 64 });
    g.translate(0, 0, -t / 2);
    return g;
  }, [part.kind, part.size[0], part.size[1], part.size[2], part.hole?.[0], part.hole?.[1]]);
  useEffect(() => () => geom.dispose(), [geom]);
  return <primitive object={geom} attach="geometry" />;
}
