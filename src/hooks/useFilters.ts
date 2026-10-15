import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCatOrder,
  canonicalOf,
  catOf,
  countByCategory,
  healCatFilter,
  healGunFilter,
  matchesQuery,
  norm,
  type GunCode,
  type SortKey,
} from "@/lib/gunCodes";

const FILTER_KEY = "gca_filters";

/** 列表呈现方式：表格（平铺全字段）/ 分组（按枪折叠） */
export type ViewMode = "table" | "grouped";

interface PersistedFilters {
  search?: string;
  catFilter?: string;
  gunFilter?: string[];
  sortKey?: SortKey;
  viewMode?: ViewMode;
}

function readPersisted(): PersistedFilters {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (!raw) return {};
    const v = JSON.parse(raw) as PersistedFilters;
    return {
      search: typeof v.search === "string" ? v.search : "",
      catFilter: typeof v.catFilter === "string" ? v.catFilter : "all",
      gunFilter: Array.isArray(v.gunFilter) ? v.gunFilter.filter((x) => typeof x === "string") : [],
      sortKey:
        v.sortKey === "name" || v.sortKey === "recent" || v.sortKey === "count"
          ? v.sortKey
          : "count",
      // v1.2.0 的持久化数据里没有 viewMode，缺失时按 'table' 兜底（老用户默认看到新表格视图）
      viewMode: v.viewMode === "grouped" ? "grouped" : "table",
    };
  } catch {
    return {};
  }
}

/**
 * 筛选 / 排序 / 分组 / 持久化 / 失效自愈
 *
 * 行为与 v1.1.0 完全一致（有 11 项单测锁定 `lib/gunCodes.ts` 的纯逻辑部分）：
 *  - 分类与枪名都按归一化比较（`AK-12` ≡ `AK12`）
 *  - 分类兜底「其他」始终可见
 *  - 切换分类会清空枪名筛选（修复过的缺陷）
 *  - 失效枪名 / 空分类自动回滚
 *
 * v1.3.0 新增：`viewMode`（表格/分组）与由 `grouped` 展平而来的 `rows`。
 * 排序只实现一次（在 `grouped`），平铺视图直接按分组顺序展平，避免表格与
 * 分组两个视图出现「排序不一致」的双真源问题。
 */
export function useFilters(items: GunCode[]) {
  const initial = useMemo(() => readPersisted(), []);

  const [search, setSearch] = useState(initial.search ?? "");
  const [catFilter, setCatFilter] = useState(initial.catFilter ?? "all");
  const [gunFilter, setGunFilter] = useState<string[]>(initial.gunFilter ?? []);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey ?? "count");
  const [viewMode, setViewMode] = useState<ViewMode>(initial.viewMode ?? "table");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 持久化
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTER_KEY,
        JSON.stringify({ search, catFilter, gunFilter, sortKey, viewMode }),
      );
    } catch {
      /* 忽略 */
    }
  }, [search, catFilter, gunFilter, sortKey, viewMode]);

  // ── 失效筛选自愈 ──
  // ① 枪名：剔除库中已不存在的
  useEffect(() => {
    const kept = healGunFilter(items, gunFilter);
    if (kept.length !== gunFilter.length) setGunFilter(kept);
  }, [items, gunFilter]);

  // ② 分类：已无条目时回退 all
  useEffect(() => {
    const healed = healCatFilter(items, catFilter);
    if (healed !== catFilter) setCatFilter(healed);
  }, [items, catFilter]);

  // ── 过滤 ──
  const filtered = useMemo(() => {
    const gunSet = new Set(gunFilter.map(norm));
    return items.filter((i) => {
      if (catFilter !== "all" && catOf(i.weapon_name) !== catFilter) return false;
      if (gunSet.size > 0 && !gunSet.has(norm(canonicalOf(i.weapon_name)))) return false;
      return matchesQuery(i, search);
    });
  }, [items, search, gunFilter, catFilter]);

  // ── 分组 + 排序 ──
  const grouped = useMemo(() => {
    const g = new Map<string, GunCode[]>();
    for (const it of filtered) {
      const key = canonicalOf(it.weapon_name);
      const arr = g.get(key) ?? [];
      arr.push(it);
      g.set(key, arr);
    }
    const entries = [...g.entries()];
    switch (sortKey) {
      case "name":
        entries.sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"));
        break;
      case "recent":
        entries.sort(
          (a, b) =>
            Math.max(...b[1].map((x) => x.created_at)) -
            Math.max(...a[1].map((x) => x.created_at)),
        );
        break;
      default:
        entries.sort((a, b) => b[1].length - a[1].length);
    }
    return entries;
  }, [filtered, sortKey]);

  /**
   * 平铺行：按 `grouped` 的顺序（分组已排好序、组内按时间新→旧）展平。
   * 同一把枪的多条配置因此天然相邻，表格视图不会出现「同名枪分散各处」。
   */
  const rows = useMemo(() => {
    const out: GunCode[] = [];
    for (const [, list] of grouped) {
      out.push(...[...list].sort((a, b) => b.created_at - a.created_at));
    }
    return out;
  }, [grouped]);

  const catCounts = useMemo(() => countByCategory(items), [items]);
  const catOrder = useMemo(() => buildCatOrder(catCounts), [catCounts]);

  const stats = useMemo(
    () => ({
      count: items.length,
      guns: new Set(items.map((i) => canonicalOf(i.weapon_name))).size,
    }),
    [items],
  );

  // ── 操作（均会按需重置折叠，避免「有结果却看不到」）──

  const selectCat = useCallback((cat: string) => {
    // 切分类必须清空枪名筛选，否则若原选中的枪不属于新分类会得到空列表
    setCatFilter(cat);
    setGunFilter([]);
    setCollapsed(new Set());
  }, []);

  const toggleGun = useCallback((gun: string) => {
    setGunFilter((prev) =>
      prev.includes(gun) ? prev.filter((g) => g !== gun) : [...prev, gun],
    );
    setCollapsed(new Set());
  }, []);

  const setGuns = useCallback((guns: string[]) => {
    setGunFilter(guns);
    setCollapsed(new Set());
  }, []);

  /**
   * 从侧边导航点某把枪：**必须原子地**同时设置分类与枪名。
   * 若分两次调用 `selectCat` + `setGuns`，`selectCat` 会先把枪名清空，
   * 第二次写入又依赖旧闭包，最终表现为「点了枪却没反应」。
   */
  const selectGunInCat = useCallback((cat: string, gun: string) => {
    setCatFilter(cat);
    setGunFilter([gun]);
    setCollapsed(new Set());
  }, []);

  /**
   * 磁贴点击：
   *  - 普通点击 → 只筛选该枪；再点同一块 → 取消（回到该分类全部）
   *  - Ctrl/Cmd + 点击 → 累加/移除该枪（保留旧版「枪名多选」的能力，
   *    但不额外占用界面空间，走桌面端通用修饰键惯例）
   * **不改分类**：磁贴本身就限定在当前分类内，改分类会让浏览上下文跳走。
   */
  const toggleTileGun = useCallback((gun: string, additive = false) => {
    setGunFilter((prev) => {
      if (additive) {
        return prev.includes(gun) ? prev.filter((g) => g !== gun) : [...prev, gun];
      }
      return prev.length === 1 && prev[0] === gun ? [] : [gun];
    });
    setCollapsed(new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setCatFilter("all");
    setGunFilter([]);
    setCollapsed(new Set());
  }, []);

  const toggleCollapse = useCallback((gun: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(gun)) next.delete(gun);
      else next.add(gun);
      return next;
    });
  }, []);

  const hasActiveFilter = search !== "" || catFilter !== "all" || gunFilter.length > 0;

  /** 状态栏用的一句话筛选说明 */
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    if (catFilter !== "all") parts.push(catFilter);
    if (gunFilter.length === 1) parts.push(gunFilter[0]);
    else if (gunFilter.length > 1) parts.push(`${gunFilter.length} 把枪`);
    if (search.trim()) parts.push(`“${search.trim()}”`);
    return parts.join(" · ");
  }, [catFilter, gunFilter, search]);

  /** 分组视图默认展开的枪：筛选到具体枪时自动展开，否则全收起 */
  const defaultOpenGuns = useMemo(
    () => (gunFilter.length > 0 ? grouped.map(([gun]) => gun) : []),
    [gunFilter.length, grouped],
  );

  return {
    // 状态
    search, catFilter, gunFilter, sortKey, viewMode, collapsed,
    // 派生
    filtered, grouped, rows, catCounts, catOrder, stats,
    hasActiveFilter, defaultOpenGuns, filterSummary,
    // 操作
    setSearch, setSortKey, setViewMode, selectCat, selectGunInCat, toggleTileGun,
    toggleGun, setGuns, clearFilters, toggleCollapse,
  };
}
