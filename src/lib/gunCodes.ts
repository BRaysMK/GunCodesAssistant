/**
 * 改枪码纯逻辑层
 *
 * 从 App.tsx 原样提取，**只搬迁不重写**，便于单测锁定行为。
 * 这些函数与后端 `local_gun_codes.rs` 的规则保持一致：
 *   - `norm()`       ↔ Rust `normalize()`
 *   - `canonicalOf()`↔ Rust 的别名索引（rules.json 的 guns[].aliases）
 *   - `catOf()`      ↔ rules.json 的 guns[].category
 */

// ── 枪械类别映射（与后端 rules.json 的 guns[].category 对齐）──
export const CATEGORY_MAP: Record<string, string> = {
  RM277: "步枪", AR57: "步枪", MCX: "步枪", MK47: "步枪", KC17: "步枪",
  K437: "步枪", 腾龙: "步枪", "AS Val": "步枪", "CAR-15": "步枪", "PTR-32": "步枪",
  G3: "步枪", "SCAR-H": "步枪", "AK-12": "步枪", SG552: "步枪", M7: "步枪",
  AUG: "步枪", M16A4: "步枪", K416: "步枪", "ASH-12": "步枪", "AKS-74U": "步枪",
  "QBZ-95": "步枪", AKM: "步枪", M4A1: "步枪", MDR: "步枪",
  QCQ171: "冲锋枪", MP7: "冲锋枪", 勇士: "冲锋枪", "SR-3M": "冲锋枪", SMG45: "冲锋枪",
  野牛: "冲锋枪", UZI: "冲锋枪", Vector: "冲锋枪", P90: "冲锋枪", MP5: "冲锋枪",
  MK4: "冲锋枪", 汤姆逊: "冲锋枪", MP9: "冲锋枪",
  SVCH: "射手步枪", M14: "射手步枪", M700: "射手步枪", "PSG-1": "射手步枪", SVD: "射手步枪",
  MINI14: "射手步枪", VSS: "射手步枪", SR25: "射手步枪", R93: "射手步枪", "SV-98": "射手步枪",
  AWM: "射手步枪", SKS: "射手步枪", 杠杆步枪: "射手步枪", 巴雷特: "射手步枪", M82: "射手步枪",
  M250: "机枪", PKM: "机枪", QJB: "机枪", M249: "机枪",
  S12K: "霰弹枪", M1014: "霰弹枪", 725: "霰弹枪", M870: "霰弹枪", "FS-12": "霰弹枪",
  DP12: "霰弹枪", KSG: "霰弹枪",
  "93R": "手枪", G18: "手枪", 沙鹰: "手枪", 左轮: "手枪", M1911: "手枪",
  P226: "手枪", M9: "手枪",
  弓: "弓",
};

/** 分类固定展示顺序（其余分类——含「其他」——动态追加） */
export const CATEGORY_ORDER = [
  "步枪", "冲锋枪", "射手步枪", "机枪", "霰弹枪", "手枪", "弓",
];

/** 未收录枪的兜底分类。**必须是界面上可见的分类**（旧版曾因它不在
 *  CATEGORY_ORDER 里导致按钮不渲染、用户筛不到）。 */
export const CATEGORY_FALLBACK = "其他";

/**
 * 归一化：去空格 / 连字符 / 下划线，转大写。
 * 与后端 Rust `normalize()` 逐字符等价，用于解决「同一把枪分裂成多个筛选项」。
 * `AK-12` 与 `AK12` 归一后相同；`M7` 与 `M700` 保持不同。
 */
export function norm(s: string): string {
  return s.replace(/[\s\-_]/g, "").toUpperCase();
}

/** 常见变体 → 规范枪名（与 rules.json 的 aliases 对齐） */
export const ALIAS_TO_CANON: Record<string, string> = {
  AK12: "AK-12",
  SR3M: "SR-3M",
  QJB201: "QJB",
  M16: "M16A4",
  ASVAL: "AS Val",
  M4: "M4A1",
  M7A1: "M7",
  M250A: "M250",
  PKMA: "PKM",
  M14A: "M14",
  AKM74: "AKM",
};

/** 把任意写法归一到规范枪名（`AS VAL`/`ASVal`/`AS-VAL` → `AS Val`） */
export function canonicalOf(raw: string): string {
  return ALIAS_TO_CANON[norm(raw)] ?? raw;
}

/** 查询枪械分类；未收录归入「其他」 */
export function catOf(gun: string): string {
  return CATEGORY_MAP[canonicalOf(gun)] ?? CATEGORY_FALLBACK;
}

/** 格式化时间戳（秒 → `YYYY-MM-DD HH:mm`） */
export function fmtTime(sec: number): string {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 判断某个码是否命中筛选关键词（归一化匹配，搜 `ak12` 能命中 `AK-12`） */
export function matchesQuery(
  item: { weapon_name: string; code: string; note: string },
  query: string,
): boolean {
  const q = norm(query);
  if (!q) return true;
  return (
    norm(item.weapon_name).includes(q) ||
    item.code.toUpperCase().includes(q) ||
    norm(item.note).includes(q)
  );
}

// ═══════════════ 类型 ═══════════════

export interface GunCode {
  id: string;
  weapon_name: string;
  code: string;
  note: string;
  created_at: number;
}

/** 后端 recognize_gun_name 的返回（v1.1.0 起含可解释字段） */
export interface RecognizeResult {
  weapon_name: string;
  note: string;
  recognized: boolean;
  confidence: number;
  reason: string;
  source: string;
}

/** 后端 preview_import_gun_codes 的单行 */
export interface PreviewRow {
  code: string;
  gun: string;
  config: string;
  recognized: boolean;
  confidence: number;
  reason: string;
  source: string;
  duplicate: boolean;
}

export interface PreviewResult {
  total: number;
  recognized: number;
  unrecognized: number;
  rows: PreviewRow[];
}

/** 后端 get_gun_rules_meta 的返回 */
export interface RulesMeta {
  version: number;
  generated: string;
  source: string;
  gunCount: number;
  fingerprintCount: number;
  learnedCount: number;
  categories: Record<string, number>;
}

export type SortKey = "count" | "name" | "recent";

export interface PreviewStats {
  sel: number;
  dup: number;
  unrecog: number;
}

/**
 * 计算预览勾选统计。
 * `duplicate` 恒为不可导入（后端按码去重），故不计入 `sel`。
 */
export function computePreviewStats(
  preview: PreviewResult | null,
  deselected: Set<string>,
): PreviewStats {
  if (!preview) return { sel: 0, dup: 0, unrecog: 0 };
  let sel = 0;
  let dup = 0;
  let unrecog = 0;
  for (const r of preview.rows) {
    if (r.duplicate) {
      dup++;
    } else if (!deselected.has(r.code)) {
      sel++;
      if (!r.recognized) unrecog++;
    }
  }
  return { sel, dup, unrecog };
}

/**
 * 失效筛选自愈：剔除库中已不存在的枪名。
 * 覆盖场景：① 持久化恢复的枪名已不在库中；② 删除了筛选中的最后一条；③ 更名后旧枪名残留。
 */
export function healGunFilter(items: GunCode[], gunFilter: string[]): string[] {
  if (items.length === 0 || gunFilter.length === 0) return gunFilter;
  const alive = new Set(items.map((i) => norm(canonicalOf(i.weapon_name))));
  return gunFilter.filter((g) => alive.has(norm(g)));
}

/**
 * 失效分类自愈：该分类已无任何条目时回退到 `all`。
 * 覆盖场景：删空某分类后，其按钮不再渲染（`catOrder` 已过滤空分类），
 * 但 `catFilter` 仍指向它 → 列表恒空且无按钮可点回。
 */
export function healCatFilter(items: GunCode[], catFilter: string): string {
  if (catFilter === "all" || items.length === 0) return catFilter;
  return items.some((i) => catOf(i.weapon_name) === catFilter) ? catFilter : "all";
}

/** 分类计数字典 */
export function countByCategory(items: GunCode[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) {
    const c = catOf(i.weapon_name);
    m.set(c, (m.get(c) ?? 0) + 1);
  }
  return m;
}

/** 动态分类顺序：固定顺序在前，其余（含「其他」）按数量降序追加，空分类剔除 */
export function buildCatOrder(counts: Map<string, number>): string[] {
  const rest = [...counts.keys()].filter(
    (c) => !CATEGORY_ORDER.includes(c) && (counts.get(c) ?? 0) > 0,
  );
  rest.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  return [...CATEGORY_ORDER, ...rest].filter((c) => (counts.get(c) ?? 0) > 0);
}

/** 枪名候选（受分类筛选影响），按条数降序 */
export function buildGunCandidates(
  items: GunCode[],
  catFilter: string,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (catFilter !== "all" && catOf(i.weapon_name) !== catFilter) continue;
    const gun = canonicalOf(i.weapon_name);
    counts.set(gun, (counts.get(gun) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
