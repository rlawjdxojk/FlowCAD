/* 화면 스모크 테스트 — 새 의존성(jsdom 등) 없이 react-dom/server 로 첫 렌더만 확인한다.
   초기 입력(롤러게이트 3500×4000 3련)은 모든 판재가 시트 초과이므로 경고·"추정" 라벨이 보여야 한다. */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "../src/App";

describe("App 첫 화면", () => {
  const html = renderToStaticMarkup(<App />);

  it("시간 절감·자재비에 추정 라벨이 붙는다", () => {
    expect(html).toContain("설계+산출 시간 절감<span class=\"est\">추정</span>");
    expect(html).toContain("예상 자재비<span class=\"est\">추정</span>");
  });

  it("시트 초과 경고와 로스율 미산출을 표시한다", () => {
    expect(html).toContain("시트 초과 경고 2건");
    expect(html).toContain("전 판재 시트 초과 · 최소 14매");
  });

  it("초기 입력은 오류가 없다", () => {
    expect(html).not.toContain("입력 오류");
  });
});
