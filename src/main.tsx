import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

/**
 * 浏览器预览通道。
 *
 * 只有在 `VITE_GCA_MOCK=1` 时才动态引入假后端；正式构建里该条件恒假，
 * Rollup 会把整个分支与 `dev/mockTauri.ts` 一起摇掉（可用
 * `grep __GCA_MOCK__ dist/assets/*.js` 验证）。
 */
async function boot() {
  if (import.meta.env.VITE_GCA_MOCK === "1") {
    const { installMockTauri } = await import("./dev/mockTauri");
    installMockTauri();
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void boot();
