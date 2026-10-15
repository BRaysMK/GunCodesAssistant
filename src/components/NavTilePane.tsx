import { useMemo } from "react";
import {
  Button, Caption1, Divider, Text, makeStyles, mergeClasses, tokens,
} from "@fluentui/react-components";
import { DismissRegular, FilterDismissRegular } from "@fluentui/react-icons";
import { canonicalOf, catOf, type GunCode } from "@/lib/gunCodes";
import { GunTile } from "./GunTile";

const useStyles = makeStyles({
  pane: {
    display: "grid",
    gridTemplateRows: "auto auto auto minmax(0, 1fr)",
    minWidth: 0,
    height: "100%",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRightStyle: "solid",
    borderRightWidth: tokens.strokeWidthThin,
    borderRightColor: tokens.colorNeutralStroke2,
  },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
  },
  headText: { minWidth: 0 },
  /** 分类选择器：横向自动换行的紧凑按钮组，比竖排列表省近一半高度 */
  catRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalS,
  },
  catChip: {
    minWidth: "auto",
    borderRadius: tokens.borderRadiusMedium,
    fontVariantNumeric: "tabular-nums",
  },
  /**
   * 两列磁贴网格。
   * 单列在 320px 宽下每块磁贴过宽、扫读路径变长；两列刚好放下
   * 「RM277 / M4A1」这类 5–6 字符枪名而不截断。
   */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalXS,
  },
  empty: {
    display: "grid",
    placeItems: "center",
    paddingTop: tokens.spacingVerticalXXXL,
    color: tokens.colorNeutralForeground4,
    textAlign: "center",
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  },
  clearRow: { marginBottom: tokens.spacingVerticalXS },
});

/**
 * 左侧「分类 + 磁贴」导航面板
 *
 * 取代原先的 NavDrawer：把分类导航与枪名列表合并进一栏，
 * 全局因此只剩两栏（导航 + 内容），让出宽度给真正要扫读 555 条记录的表格。
 *
 * 磁贴只渲染**当前分类**下的枪（避免 ~70 块磁贴一次全铺出来造成滚动疲劳），
 * 并为每把枪标出配置条数；搜索时只留下有命中的枪，磁贴数与列表严格一致。
 */
export function NavTilePane({
  items,
  filteredItems,
  catCounts,
  catOrder,
  catFilter,
  gunFilter,
  query,
  onSelectCat,
  onSelectGun,
  onClearGunFilter,
  onDismiss,
  dismissible = false,
}: {
  items: GunCode[];
  /** 当前筛选结果，用于让磁贴计数与列表保持一致 */
  filteredItems: GunCode[];
  catCounts: Map<string, number>;
  catOrder: string[];
  catFilter: string;
  gunFilter: string[];
  query: string;
  onSelectCat: (cat: string) => void;
  onSelectGun: (gun: string, additive: boolean) => void;
  onClearGunFilter: () => void;
  onDismiss?: () => void;
  dismissible?: boolean;
}) {
  const styles = useStyles();

  const guns = useMemo(() => {
    const scoped =
      catFilter === "all" ? items : items.filter((i) => catOf(i.weapon_name) === catFilter);
    const counts = new Map<string, number>();
    for (const it of scoped) {
      const gun = canonicalOf(it.weapon_name);
      counts.set(gun, (counts.get(gun) ?? 0) + 1);
    }
    // 搜索时：只显示当前筛选结果里出现过的枪，磁贴数与列表严格一致
    const visible = new Set(filteredItems.map((i) => canonicalOf(i.weapon_name)));
    const entries = [...counts.entries()].filter(([gun]) => (query ? visible.has(gun) : true));
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"));
    return entries;
  }, [items, filteredItems, catFilter, query]);

  const selectedGuns = useMemo(() => new Set(gunFilter), [gunFilter]);
  const isSelected = (gun: string) => selectedGuns.has(gun);

  return (
    <div className={styles.pane} data-testid="nav-tile-pane">
      <div className={styles.head}>
        <div className={styles.headText}>
          <Text weight="semibold" size={400} block>
            枪械库
          </Text>
          <Caption1 className={styles.meta}>
            {guns.length} 把枪 · {catFilter === "all" ? "全部分类" : catFilter}
          </Caption1>
        </div>
        {dismissible && onDismiss && (
          <Button
            appearance="subtle"
            icon={<DismissRegular />}
            aria-label="关闭导航"
            onClick={onDismiss}
          />
        )}
      </div>

      <div className={styles.catRow}>
        <Button
          className={styles.catChip}
          data-testid="cat-chip"
          size="small"
          appearance={catFilter === "all" ? "primary" : "subtle"}
          onClick={() => onSelectCat("all")}
        >
          全部 {items.length}
        </Button>
        {catOrder.map((cat) => (
          <Button
            key={cat}
            className={styles.catChip}
            data-testid="cat-chip"
            size="small"
            appearance={catFilter === cat ? "primary" : "subtle"}
            onClick={() => onSelectCat(cat)}
          >
            {cat} {catCounts.get(cat) ?? 0}
          </Button>
        ))}
      </div>

      <Divider />

      <div style={{ padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`, minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0,1fr)", height: "100%" }}>
        {selectedGuns.size > 0 && (
          <Button
            className={styles.clearRow}
            appearance="subtle"
            size="small"
            icon={<FilterDismissRegular />}
            onClick={onClearGunFilter}
          >
            {selectedGuns.size === 1
              ? `取消选中「${gunFilter[0]}」`
              : `取消选中 ${selectedGuns.size} 把枪`}
          </Button>
        )}

        <div style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
          {guns.length === 0 ? (
            <div className={styles.empty}>
              <Caption1>该分类下没有匹配的枪</Caption1>
            </div>
          ) : (
            <div className={mergeClasses(styles.grid)}>
              {guns.map(([gun, count]) => (
                <GunTile
                  key={gun}
                  gun={gun}
                  count={count}
                  selected={isSelected(gun)}
                  query={query}
                  onSelect={onSelectGun}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
