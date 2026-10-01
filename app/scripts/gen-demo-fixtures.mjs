// 데모 원본 로직의 출력을 기준 파일(fixture)로 저장한다.
//
// 왜: PRD 9장 0단계 통과 조건 "기존 데모와 같은 입력에서 같은 BOM(수정 항목 제외)"을 검증하려면
// 데모 원본이 실제로 낸 값이 필요하다. 손으로 옮겨 적은 값이 아니라 원본 함수를 그대로 실행한 결과여야
// 재생성 근거가 남는다.
//
// 방법: flowcad-demo/src/FlowCADDemo.jsx 소스에서 `const MAT = {` 부터
// `export default function FlowCADDemo` 직전까지(= MAT·RULE_CLEARANCE·CIRC_SIZES·won·kg·useCountUp·
// nestPlates·computeBOM)를 글자 그대로 잘라 new Function 으로 실행한다. 수정·복사 없음.
// (useCountUp 은 React 훅이라 정의만 되고 호출되지 않는다.)
//
// 실행: app/ 에서 `npm run gen:fixtures` (= node scripts/gen-demo-fixtures.mjs)
// 주의: 기준 파일은 테스트를 통과시키려고 손으로 고치지 않는다. 데모가 바뀌었을 때만 재생성한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..");
const demoPath = join(appDir, "..", "flowcad-demo", "src", "FlowCADDemo.jsx");
const outDir = join(appDir, "tests", "fixtures", "demo-baseline");

const src = readFileSync(demoPath, "utf8");
const START = "const MAT = {";
const END = "export default function FlowCADDemo";
const s = src.indexOf(START);
const e = src.indexOf(END);
if (s < 0 || e < 0 || e <= s) throw new Error("데모 소스에서 엔진 구간을 찾지 못했습니다. 마커를 확인하세요.");
const engineSrc = src.slice(s, e);
const startLine = src.slice(0, s).split("\n").length;
const endLine = src.slice(0, e).split("\n").length - 1;

// eslint-disable-next-line no-new-func
const demo = new Function(`${engineSrc}\nreturn { computeBOM, nestPlates };`)();

// 데모 화면의 form 구조 그대로(FlowCADDemo.jsx:142). 형식과 무관한 필드도 데모 기본값으로 채워 둔다.
const base = { type: "roller", D: 700, W: 3500, H: 4000, drive: "manual", bays: 3, qty: 1 };
const CASES = [
  // ── 5개 형식 대표 입력 ──
  { id: "frp_circle_700", primary: true, desc: "FRP 원형 Ø700 표준 정척, 1 SET", form: { ...base, type: "frp_circle", D: 700 } },
  { id: "frp_rect_1000x1200_q2", primary: true, desc: "FRP 사각 1000×1200, 2 SET", form: { ...base, type: "frp_rect", W: 1000, H: 1200, qty: 2 } },
  { id: "integ_800x1000_manual", primary: true, desc: "일체식 수동 800×1000, 1 SET", form: { ...base, type: "integ", W: 800, H: 1000, drive: "manual" } },
  { id: "roller_3500x4000_b3", primary: true, desc: "롤러게이트 3500×4000 3련 (PRD 대표 시나리오, 시트 초과 판재 포함)", form: { ...base, type: "roller", W: 3500, H: 4000, bays: 3 } },
  { id: "lift_1200x1500", primary: true, desc: "인양식 1200×1500, 1 SET", form: { ...base, type: "lift", W: 1200, H: 1500 } },
  // ── 추가 경계 사례 ──
  { id: "frp_circle_750_interp", primary: false, desc: "FRP 원형 Ø750 (정척 사이 보간 문구)", form: { ...base, type: "frp_circle", D: 750 } },
  { id: "frp_circle_1500", primary: false, desc: "FRP 원형 Ø1500 (SEAL PLATE 띠판 190×4712 시트 초과)", form: { ...base, type: "frp_circle", D: 1500 } },
  { id: "frp_rect_2000x2000", primary: false, desc: "FRP 사각 2000×2000 (SKIN 보강 PL 시트 초과)", form: { ...base, type: "frp_rect", W: 2000, H: 2000 } },
  { id: "integ_1200x1800_motor_q3", primary: false, desc: "일체식 전동 1200×1800, 3 SET", form: { ...base, type: "integ", W: 1200, H: 1800, drive: "motor", qty: 3 } },
  { id: "roller_2000x3000_b1", primary: false, desc: "롤러게이트 2000×3000 1련 (SKIN 9T, 시트 내 판재 혼재)", form: { ...base, type: "roller", W: 2000, H: 3000, bays: 1 } },
];

mkdirSync(outDir, { recursive: true });
const sha256 = createHash("sha256").update(src).digest("hex");
for (const c of CASES) {
  const output = demo.computeBOM(c.form);
  const fixture = {
    id: c.id,
    primary: c.primary,
    description: c.desc,
    source: {
      file: relative(appDir, demoPath).replaceAll("\\", "/"),
      lines: `${startLine}-${endLine}`,
      sha256,
      generator: "scripts/gen-demo-fixtures.mjs",
    },
    form: c.form,
    demoOutput: output,
  };
  writeFileSync(join(outDir, `${c.id}.json`), JSON.stringify(fixture, null, 2) + "\n", "utf8");
  console.log(`wrote ${c.id}.json  (sheets=${output.sheets}, scrap=${(output.scrapRate * 100).toFixed(1)}%, cost=${Math.round(output.totalCost)})`);
}
