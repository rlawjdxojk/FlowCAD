import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // 설계 화면(index.html)과 소개 페이지(intro.html) 두 페이지를 함께 빌드 (app/ 에서 실행 기준 경로)
      input: { main: "index.html", intro: "intro.html" },
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
