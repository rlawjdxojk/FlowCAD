/* 입력 검증 테스트 (PRD 7장 6) — 빈 값·범위 밖 값은 조용한 기본값 대신 오류 목록이 나와야 한다. */
import { describe, expect, it } from "vitest";
import { INPUT_RANGES, QTY_RANGE } from "../src/engine/rules";
import { runDesign, validateInput, type RawDesignForm } from "../src/engine";

const roller: RawDesignForm = { type: "roller", D: 700, W: 3500, H: 4000, drive: "manual", bays: 3, qty: 1 };

function codes(form: RawDesignForm) {
  const v = validateInput(form);
  return v.ok ? [] : v.errors.map((e) => `${e.field}:${e.code}`);
}

describe("validateInput", () => {
  it("정상 입력은 형식에 맞는 판별 유니온으로 정리된다", () => {
    const v = validateInput(roller);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.input).toEqual({ type: "roller", W: 3500, H: 4000, bays: 3, qty: 1 });

    const c = validateInput({ ...roller, type: "frp_circle" });
    if (c.ok) expect(c.input).toEqual({ type: "frp_circle", D: 700, qty: 1 });
    else throw new Error("원형 정상 입력이 실패");

    const i = validateInput({ ...roller, type: "integ", W: 800, H: 1000, drive: "motor" });
    if (i.ok) expect(i.input).toEqual({ type: "integ", W: 800, H: 1000, drive: "motor", qty: 1 });
    else throw new Error("일체식 정상 입력이 실패");
  });

  it("폼에서 온 숫자 문자열도 받는다", () => {
    const v = validateInput({ type: "lift", W: "1200", H: " 1500 ", qty: "2" });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.input).toEqual({ type: "lift", W: 1200, H: 1500, qty: 2 });
  });

  it("빈 값은 기본값으로 바꾸지 않고 required 오류", () => {
    expect(codes({ ...roller, type: "integ", W: "", H: 1000 })).toEqual(["W:required"]);
    expect(codes({ ...roller, type: "roller", H: undefined })).toEqual(["H:required"]);
    expect(codes({ ...roller, qty: "" })).toEqual(["qty:required"]);
    expect(codes({ ...roller, type: "frp_circle", D: "" })).toEqual(["D:required"]);
  });

  it("숫자가 아니면 not_number", () => {
    expect(codes({ ...roller, W: "abc" })).toEqual(["W:not_number"]);
    expect(codes({ ...roller, H: Number.NaN })).toEqual(["H:not_number"]);
    expect(codes({ ...roller, H: Number.POSITIVE_INFINITY })).toEqual(["H:not_number"]);
  });

  it("범위 밖이면 out_of_range 와 허용 범위를 함께 돌려준다", () => {
    const v = validateInput({ ...roller, type: "frp_circle", D: 1600 });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors).toHaveLength(1);
      expect(v.errors[0]).toMatchObject({ field: "D", code: "out_of_range", min: 300, max: 1500 });
      expect(v.errors[0].message).toContain("300~1500");
    }
    expect(codes({ ...roller, bays: 6 })).toEqual(["bays:out_of_range"]);
    expect(codes({ ...roller, qty: 0 })).toEqual(["qty:out_of_range"]);
    expect(codes({ ...roller, W: -10 })).toEqual(["W:out_of_range"]);
  });

  it("련 수·수량은 정수여야 한다", () => {
    expect(codes({ ...roller, bays: 2.5 })).toEqual(["bays:not_integer"]);
    expect(codes({ ...roller, qty: 1.5 })).toEqual(["qty:not_integer"]);
  });

  it("경계값(최소·최대)은 통과한다", () => {
    for (const [type, ranges] of Object.entries(INPUT_RANGES)) {
      for (const pick of ["min", "max"] as const) {
        const form: RawDesignForm = {
          type,
          D: ranges.D?.[pick],
          W: ranges.W?.[pick],
          H: ranges.H?.[pick],
          bays: ranges.bays?.[pick],
          drive: "manual",
          qty: QTY_RANGE[pick],
        };
        expect(codes(form), `${type} ${pick}`).toEqual([]);
      }
    }
  });

  it("형식과 무관한 항목은 검사하지 않는다", () => {
    expect(codes({ type: "frp_circle", D: 700, W: "", H: "abc", bays: 99, qty: 1 })).toEqual([]);
    expect(codes({ type: "lift", W: 1000, H: 1000, D: "", drive: "", bays: 0, qty: 1 })).toEqual([]);
  });

  it("일체식은 구동 방식이 필요하다", () => {
    expect(codes({ type: "integ", W: 800, H: 1000, qty: 1 })).toEqual(["drive:invalid_option"]);
    expect(codes({ type: "integ", W: 800, H: 1000, drive: "hydraulic", qty: 1 })).toEqual(["drive:invalid_option"]);
  });

  it("알 수 없는 형식은 invalid_option", () => {
    expect(codes({ type: "slide", W: 800, H: 1000, qty: 1 })).toEqual(["type:invalid_option"]);
  });

  it("오류는 한 번에 모두 모아서 돌려준다", () => {
    expect(codes({ type: "roller", W: "", H: 99999, bays: 0, qty: "x" })).toEqual([
      "qty:not_number",
      "W:required",
      "H:out_of_range",
      "bays:out_of_range",
    ]);
  });
});

describe("runDesign", () => {
  it("입력 오류가 있으면 계산하지 않는다", () => {
    const r = runDesign({ ...roller, W: "" });
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("result");
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("정상 입력이면 결과를 돌려준다", () => {
    const r = runDesign(roller);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.lines.length).toBeGreaterThan(0);
  });
});
