import { useEffect, useState } from "react";

/**
 * `matchMedia` 订阅（无第三方依赖）。
 *
 * 除订阅 `change` 事件外，还会监听 `resize`：Tauri 桌面窗口在拖动缩放、
 * 或从最大化还原时，WebView2 并不总会在跨过断点的那一刻派发 `change`，
 * 只靠事件会导致布局卡在旧状态。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [query]);

  return matches;
}
