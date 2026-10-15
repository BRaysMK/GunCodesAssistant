import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const STORAGE_KEY = "gca_theme_mode";

/** 读取系统偏好 */
function systemPrefers(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** 读取用户显式选择（无则 system） */
function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* 忽略 */
  }
  return "system";
}

/**
 * 主题解析：用户显式选择 → 系统偏好 → 深色。
 * 结果写入 `<html data-theme="...">`，由 CSS 变量切换。
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => readStored());
  const [system, setSystem] = useState<ResolvedTheme>(() => systemPrefers());

  // 跟随系统变化（仅在 mode === "system" 时生效于解析结果）
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystem(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = mode === "system" ? system : mode;

  // 应用到 DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略 */
    }
  }, []);

  /** 在 深/浅 间直接切换（写为显式选择，脱离 system 跟随） */
  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return { mode, resolved, setTheme, toggle };
}
