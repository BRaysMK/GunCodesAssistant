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
 *
 * 此外把主题同步给**窗口**（`setTheme`），让原生标题栏与应用内配色一致 ——
 * 详见下方该 effect 的注释。
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

  /**
   * 同步窗口主题 —— 让**原生标题栏**跟随应用内主题。
   *
   * 不加这一步时：tao 的 `try_window_theme` 在 `preferred_theme` 为 `None` 时
   * 走 `should_use_dark_mode()`，即**只读 Windows 系统「应用模式」，完全无视
   * 应用内主题**。表现为「应用切浅色、标题栏仍一片纯黑」的割裂感。
   * 链路：setTheme → invoke('plugin:window|set_theme') → tauri →
   * tauri-runtime-wry → tao → DwmSetWindowAttribute(IMMERSIVE_DARK_MODE)。
   *
   * 传 `mode` 而非 `resolved` 是刻意的：用户选「跟随系统」时传 `null`，
   * 让 tao 自己跟随系统；若传 `resolved` 会把结果钉死，系统换主题时标题栏不再跟。
   *
   * 需要 `core:window:allow-set-theme` 权限（见 capabilities/default.json）——
   * `core:window:default` 只含 `allow-theme`（读），不含写入权限。
   */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        if (!alive) return;
        await getCurrentWindow().setTheme(mode === "system" ? null : mode);
      } catch {
        /* 浏览器预览（VITE_GCA_MOCK=1）无 Tauri 运行时，或权限缺失时静默降级，
           应用内主题不受影响 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

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
