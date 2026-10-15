/**
 * Fluent 2 主题
 *
 * 品牌色阶锚定应用图标（`app-icon.svg`）的蓝→紫渐变：
 * 品牌主色取图标起点的蓝 `#4f9cf9`，深色主题下取更亮的 `#6cb2ff` 以保证对比度。
 *
 * 这里也是**全项目唯一允许出现颜色字面量的地方**——其余所有组件一律引用
 * Fluent 的 `tokens.*`，由 FluentProvider 在运行时注入 CSS 变量。
 */
import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

/** 品牌色阶 10→160（Fluent 要求完整 16 档；未列出的档位由 createXTheme 推导） */
const brand: BrandVariants = {
  10: "#020409",
  20: "#0B1526",
  30: "#112444",
  40: "#163063",
  50: "#193C82",
  60: "#1A48A1",
  70: "#1A54C0",
  80: "#1760DE",
  90: "#166EF5",
  100: "#2F80FF",
  110: "#4F9CF9",
  120: "#6EAFFF",
  130: "#8CC0FF",
  140: "#A9D0FF",
  150: "#C6E0FF",
  160: "#E2EFFF",
};

/** 中文优先的字体栈：Fluent 默认栈没有中文字形，需覆盖，否则中文回退到衬线体 */
const fontFamilyBase =
  "'Segoe UI Variable Text', 'Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', system-ui, -apple-system, sans-serif";
const fontFamilyMonospace =
  "'Cascadia Mono', 'Consolas', 'Microsoft YaHei Mono', ui-monospace, monospace";

const shared: Partial<Theme> = { fontFamilyBase, fontFamilyMonospace };

/** 浅色主题（Fluent 2 light） */
export const appLightTheme: Theme = { ...createLightTheme(brand), ...shared };

/** 深色主题（Fluent 2 dark） */
export const appDarkTheme: Theme = { ...createDarkTheme(brand), ...shared };

export type ResolvedThemeMode = "light" | "dark";
export type ThemeMode = ResolvedThemeMode | "system";
