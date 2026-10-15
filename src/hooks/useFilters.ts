import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildCatOrder,
  buildGunCandidates,
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

interface PersistedFilters {
  search?: string;
  catFilter?: string;
  gunFilter?: string[];
  sortKey?: SortKey;
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
 */
export function useFilters(items: GunCode[]) {
  const initial = useMemo(() => readPersisted(), []);

  const [search, setSearch] = useState(initial.search ?? "");
  const [catFilter, setCatFilter] = useState(initial.catFilter ?? "all");
  const [gunFilter, setGunFilter] = useState<string[]>(initial.gunFilter ?? []);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey ?? "count");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // 持久化
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTER_KEY,
        JSON.stringify({ search, catFilter, gunFilter, sortKey }),
      );
    } catch {
      /* 忽略 */
    }
  }, [search, catFilter, gunFilter, sortKey]);

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

  const catCounts = useMemo(() => countByCategory(items), [items]);
  const catOrder = useMemo(() => buildCatOrder(catCounts), [catCounts]);
  const gunCandidates = useMemo(
    () => buildGunCandidates(items, catFilter),
    [items, catFilter],
  );

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

  return {
    // 状态
    search, catFilter, gunFilter, sortKey, collapsed,
    // 派生
    filtered, grouped, catCounts, catOrder, gunCandidates, stats, hasActiveFilter,
    // 操作
    setSearch, setSortKey, selectCat, toggleGun, setGuns, clearFilters, toggleCollapse,
  };
}
