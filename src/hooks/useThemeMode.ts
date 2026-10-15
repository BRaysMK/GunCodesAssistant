import { useCallback, useEffect, useState } from "react";
import type { Theme } from "@fluentui/react-components";
import { appDarkTheme, appLightTheme, type ResolvedThemeMode, type ThemeMode } from "@/theme/theme";

/** localStorage 键：沿用 v1.2.0 的键名，老用户的主题选择不丢 */
const STORAGE_KEY = "gca_theme_mode";

function systemPrefers(): ResolvedThemeMode {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* localStorage 不可用时静默降级 */
  }
  return "system";
}

/**
 * 主题解析：显式选择 → 系统偏好 → 深色。
 *
 * 返回 Fluent 的 `Theme` 对象给 `FluentProvider`，同时把解析结果写到
 * `<html data-theme>` 与 `color-scheme`，让浏览器原生控件（滚动条、输入框
 * 自动填充）与首屏背景色跟上主题。
 */
export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>(() => readStored());
  const [system, setSystem] = useState<ResolvedThemeMode>(() => systemPrefers());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystem(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedThemeMode = mode === "system" ? system : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 忽略 */
    }
  }, []);

  const theme: Theme = resolved === "dark" ? appDarkTheme : appLightTheme;

  /** 在深/浅之间直接切换（写为显式选择，脱离「跟随系统」） */
  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark");
  }, [resolved, setTheme]);

  return { mode, resolved, theme, setTheme, toggle };
}
