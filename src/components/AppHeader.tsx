import {
  Button, Menu, MenuButton, MenuDivider, MenuItem, MenuList, MenuPopover, MenuTrigger,
  SearchBox, Text, Toolbar, ToolbarButton, ToolbarDivider, ToolbarGroup,
  ToolbarRadioButton, ToolbarRadioGroup, Tooltip, makeStyles, mergeClasses, tokens,
} from "@fluentui/react-components";
import {
  AddRegular, ArrowDownloadRegular, ArrowSortRegular, ArrowSyncRegular,
  DatabaseRegular, DocumentArrowUpRegular, FilterDismissRegular, GroupListRegular,
  NavigationRegular, SaveRegular, TableRegular, WeatherMoonRegular, WeatherSunnyRegular,
} from "@fluentui/react-icons";
import type { SortKey } from "@/lib/gunCodes";
import type { ViewMode } from "@/hooks/useFilters";
import type { ThemeMode } from "@/theme/theme";

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    rowGap: tokens.spacingVerticalXS,
    columnGap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    /** 顶栏是应用最高一层表面：用最亮的 background1 + 底部描边分层 */
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottomStyle: "solid",
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomColor: tokens.colorNeutralStroke2,
    flexShrink: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    flexShrink: 0,
  },
  brandMark: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForegroundOnBrand,
    backgroundColor: tokens.colorBrandBackground,
    fontSize: "16px",
    flexShrink: 0,
  },
  brandText: {
    display: "flex",
    flexDirection: "column",
    lineHeight: tokens.lineHeightBase200,
    /**
     * 实测校准（`check-gca-sizes.mjs`）：默认窗口 1080×760 下，
     * 完整品牌文字会把首行撑爆、顶栏换行到 89px。
     * 1080 的可用宽度 ≈ 1048px，控件实际占位合计约 1120px（超 72px）。
     * 因此 1120px 以下就收起副标题行，只留主标题；1040px 以下整体隐藏。
     */
    "@media (max-width: 1120px)": { display: "none" },
  },
  /**
   * 搜索框宽度直接决定顶栏是否换行。
   * 1080px 下必须压到 160px 才能与「批量导入 / 备份 / 添加 / 词库」同排。
   */
  search: {
    flex: "0 1 auto",
    width: "260px",
    minWidth: "120px",
    "@media (max-width: 1280px)": { width: "160px" },
    "@media (max-width: 1000px)": { width: "140px" },
  },
  spacer: { flex: "1 1 auto" },
  actions: { flexShrink: 0 },
  /**
   * 窄窗（≤1080px）取舍：低频控件让位，而不是让顶栏换行 ——
   * 换行会把内容区高度再吃掉 40–70px，而 900×600 本就是纵向最紧张的场景。
   *
   * 让位的都**有替代入口**：
   *  - 主题切换 → 「备份」菜单里有同名菜单项
   *  - 刷新词库 → 词库随包分发，只在替换 rules.json 后才需要
   *  - 批量导入 → 空状态与「添加」抽屉里都有引导
   */
  hideOnNarrow: {
    "@media (max-width: 1080px)": { display: "none" },
  },
  /**
   * 「清除筛选」在窄窗收回图标形态：它的文字是撑破 900px 首行的主因，
   * 但它又不能简单隐藏（用户需要一键复位筛选），收成图标 + Tooltip 是折中。
   * Fluent 的文字在 root 里，故直接对 root 收窄。
   */
  clearFilters: {
    "@media (max-width: 1080px)": {
      minWidth: "auto",
      paddingLeft: tokens.spacingHorizontalXS,
      paddingRight: tokens.spacingHorizontalXS,
      fontSize: "0",
    },
  },
});

const SORT_LABEL: Record<SortKey, string> = {
  count: "条数",
  name: "名称",
  recent: "最近",
};

/**
 * 顶部命令条
 *
 * 相对上一版的三处修正（都来自视觉评审）：
 *  1. **消除图标撞车**：原来「批量导入」与「导入 JSON 备份」共用了同一个
 *     `ArrowImportRegular`，紧挨着还多一个导出图标，三个图标语义重叠。
 *     现在备份两项收进一个 `MenuButton`，菜单里带文字说明，各用独立图标。
 *  2. **排序不再平铺三个全称按钮**：改为「排序」前缀 + 三选一短标签，
 *     当前项由 Toolbar 的 checkedValues 托管（单一真源）。
 *  3. **顶栏加品牌**：原来品牌挤在左侧窄栏底部，现在回到顶栏左侧，
 *     符合桌面应用惯例，也让顶栏不至于成为一条「纯按钮带」。
 */
export function AppHeader({
  search,
  onSearch,
  sortKey,
  onSort,
  viewMode,
  onViewMode,
  onAdd,
  onImportDoc,
  onExport,
  onImportJson,
  onRefreshRules,
  themeMode,
  onToggleTheme,
  hasActiveFilter,
  onClearFilters,
  narrow,
  onToggleNav,
}: {
  search: string;
  onSearch: (v: string) => void;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  onAdd: () => void;
  onImportDoc: () => void;
  onExport: () => void;
  onImportJson: () => void;
  onRefreshRules: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  narrow: boolean;
  onToggleNav: () => void;
}) {
  const styles = useStyles();

  return (
    <Toolbar
      className={styles.bar}
      size="medium"
      aria-label="改枪码工具栏"
      checkedValues={{ sort: [sortKey], view: [viewMode] }}
      onCheckedValueChange={(_e, data) => {
        if (data.name === "sort") {
          const v = data.checkedItems[0];
          if (v === "count" || v === "name" || v === "recent") onSort(v);
        }
        if (data.name === "view") {
          const v = data.checkedItems[0];
          if (v === "table" || v === "grouped") onViewMode(v);
        }
      }}
    >
      {narrow && (
        <Button
          appearance="subtle"
          icon={<NavigationRegular />}
          aria-label="展开导航"
          onClick={onToggleNav}
        />
      )}

      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden>
          <DatabaseRegular />
        </span>
        <span className={styles.brandText}>
          <Text weight="semibold" size={300}>
            本地改枪码
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            三角洲行动 · 本地库
          </Text>
        </span>
      </div>

      <ToolbarDivider />

      <SearchBox
        className={styles.search}
        size="medium"
        appearance="outline"
        placeholder="搜索 枪名 / 代码 / 备注"
        aria-label="搜索改枪码"
        value={search}
        onChange={(_e, data) => onSearch(data.value)}
      />

      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <MenuButton size="medium" appearance="subtle" icon={<ArrowSortRegular />}>
            排序：{SORT_LABEL[sortKey]}
          </MenuButton>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            <MenuItem onClick={() => onSort("count")}>按配置条数</MenuItem>
            <MenuItem onClick={() => onSort("name")}>按枪名</MenuItem>
            <MenuItem onClick={() => onSort("recent")}>按最近添加</MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>

      <ToolbarRadioGroup aria-label="列表视图">
        <Tooltip content="表格：平铺所有配置" relationship="description" withArrow>
          <ToolbarRadioButton name="view" value="table" icon={<TableRegular />}>
            表格
          </ToolbarRadioButton>
        </Tooltip>
        <Tooltip content="分组：按枪折叠" relationship="description" withArrow>
          <ToolbarRadioButton name="view" value="grouped" icon={<GroupListRegular />}>
            分组
          </ToolbarRadioButton>
        </Tooltip>
      </ToolbarRadioGroup>

      <span className={styles.spacer} />

      {/* 有筛选时才出现的「清除筛选」：此前这个入口在旧工具栏里，
          重做顶栏时漏掉了，导致用户只能逐个分类/磁贴点回去。 */}
      {hasActiveFilter && (
        <Tooltip content="清除搜索、分类与枪名筛选" relationship="description" withArrow>
          <ToolbarButton
            className={styles.clearFilters}
            icon={<FilterDismissRegular />}
            onClick={onClearFilters}
          >
            清除筛选
          </ToolbarButton>
        </Tooltip>
      )}

      <ToolbarGroup className={styles.actions} aria-label="数据操作">
        {/* 文档 → 库：整段文档解析入库，用 DocumentArrowUp 表达「文档进入」 */}
        <ToolbarButton
          className={styles.hideOnNarrow}
          icon={<DocumentArrowUpRegular />}
          onClick={onImportDoc}
        >
          批量导入
        </ToolbarButton>

        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <MenuButton size="medium" appearance="subtle" icon={<SaveRegular />}>
              备份
            </MenuButton>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              {/* 库 → 文件（写出）/ 文件 → 库（读入）：两个方向用不同箭头，不再撞车 */}
              <MenuItem icon={<ArrowDownloadRegular />} onClick={onExport}>
                导出 JSON 备份
              </MenuItem>
              <MenuItem icon={<DocumentArrowUpRegular />} onClick={onImportJson}>
                从 JSON 备份导入
              </MenuItem>
              <MenuDivider />
              {/* 窄窗下顶栏的主题按钮会被隐藏，这里保证它始终可达 */}
              <MenuItem
                icon={themeMode === "dark" ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
                onClick={onToggleTheme}
              >
                切换到{themeMode === "dark" ? "浅色" : "深色"}主题
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>

        <ToolbarDivider />

        <ToolbarButton appearance="primary" icon={<AddRegular />} onClick={onAdd}>
          添加改枪码
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarDivider />

      <Tooltip
        content={themeMode === "dark" ? "切换到浅色" : "切换到深色"}
        relationship="description"
        withArrow
      >
        <ToolbarButton
          className={styles.hideOnNarrow}
          icon={themeMode === "dark" ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
          aria-label="切换主题"
          onClick={onToggleTheme}
        />
      </Tooltip>
      <Tooltip content="重新读取 rules.json（词库可热更）" relationship="description" withArrow>
        <ToolbarButton
          className={styles.hideOnNarrow}
          icon={<ArrowSyncRegular />}
          aria-label="刷新词库"
          onClick={onRefreshRules}
        />
      </Tooltip>
    </Toolbar>
  );
}
