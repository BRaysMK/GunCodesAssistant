import { useMemo } from "react";
import {
  Button, Caption1, DataGrid, DataGridBody, DataGridCell, DataGridHeader,
  DataGridHeaderCell, DataGridRow, Menu, MenuItem, MenuList, MenuPopover,
  MenuTrigger, TableCellLayout, Text, Tooltip,
  makeStyles, tokens,
  createTableColumn, type OnSelectionChangeData, type TableColumnDefinition,
} from "@fluentui/react-components";
import { CopyRegular, DeleteRegular, EditRegular, MoreHorizontalRegular } from "@fluentui/react-icons";
import { catOf, CATEGORY_FALLBACK, fmtTime, type GunCode } from "@/lib/gunCodes";
import { Highlight } from "./Highlight";
import { categoryAccentOf } from "./GunTile";

const useStyles = makeStyles({
  grid: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow2,
    overflow: "hidden",
  },
  /** 表头：次级底色 + 底部描边，与数据行明确分层（原来是同色 + 一条细线） */
  headerRow: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomStyle: "solid",
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  /** 数据行最小高度 44px：满足扫读与触达，也让 555 条记录不至于密不透风 */
  row: {
    minHeight: "44px",
    ":hover": { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  gun: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  /** 分类色条：替代「每行一个彩色徽标」，同样表达分类但不制造噪音 */
  catBar: {
    width: "3px",
    alignSelf: "stretch",
    minHeight: "18px",
    borderRadius: tokens.borderRadiusSmall,
    flexShrink: 0,
  },
  gunName: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: tokens.fontWeightSemibold,
  },
  muted: { color: tokens.colorNeutralForeground4 },
  note: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  /**
   * 行操作收进**一个**「⋯」菜单，而不是常驻三个图标。
   * 555 行 × 3 图标 = 满屏图标，是「像论坛」的主要来源；
   * 但完全藏起来又会让「操作」列在静止态显得是空的 ——
   * 折中是每行一个弱化的溢出菜单：始终可见、语义明确、噪声只有原来的 1/3。
   */
  more: {
    color: tokens.colorNeutralForeground3,
    ":hover": { color: tokens.colorNeutralForeground1 },
  },
  time: {
    fontVariantNumeric: "tabular-nums",
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    letterSpacing: "0.02em",
    color: tokens.colorBrandForeground2,
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
    minWidth: 0,
    userSelect: "text",
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    transitionProperty: "background-color, color",
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorBrandForeground1,
    },
    ":focus-visible": {
      outlineWidth: tokens.strokeWidthThick,
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "2px",
    },
  },
});

/**
 * 表格视图（Fluent DataGrid）
 *
 * 面向「按代码找东西」：一行一条配置，所有字段平铺，列可拖拽调宽。
 *
 * 排序**不**使用表头排序（`sortable`），而是完全由顶栏的 `sortKey` 驱动 ——
 * 排序只有一处真源，避免表头点击与顶栏选择互相覆盖。
 *
 * 行顺序由 `useFilters.rows` 给出：按分组顺序展平，因此同一把枪的多条配置
 * 天然相邻，不会散落在表格各处。
 */
export function GunDataGrid({
  rows,
  query,
  selectedIds,
  onSelectionChange,
  onCopy,
  onEdit,
  onDelete,
}: {
  rows: GunCode[];
  query: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onCopy: (code: string) => void;
  onEdit: (item: GunCode) => void;
  onDelete: (item: GunCode) => void;
}) {
  const styles = useStyles();

  const columns: TableColumnDefinition<GunCode>[] = useMemo(
    () => [
      createTableColumn<GunCode>({
        columnId: "weapon",
        renderHeaderCell: () => "枪名",
        renderCell: (item) => {
          const accent = categoryAccentOf(item.weapon_name);
          return (
            <TableCellLayout>
              <span className={styles.gun}>
                <span
                  className={styles.catBar}
                  style={{ backgroundColor: accent ?? tokens.colorNeutralStroke1 }}
                  aria-hidden
                />
                <span className={styles.gunName}>
                  <Highlight text={item.weapon_name} query={query} />
                </span>
              </span>
            </TableCellLayout>
          );
        },
      }),
      createTableColumn<GunCode>({
        columnId: "note",
        renderHeaderCell: () => "配置 / 备注",
        renderCell: (item) => (
          <TableCellLayout>
            <span className={styles.note} title={item.note || undefined}>
              {item.note ? (
                <Highlight text={item.note} query={query} />
              ) : (
                <span className={styles.muted}>无备注</span>
              )}
            </span>
          </TableCellLayout>
        ),
      }),
      createTableColumn<GunCode>({
        columnId: "code",
        renderHeaderCell: () => "改枪码",
        renderCell: (item) => (
          <TableCellLayout>
            {/* 代码本体不做 chip 装饰：等宽 + 可点击即可，避免每行一个色块 */}
            <Tooltip content={`点击复制 · ${item.code}`} relationship="description" withArrow>
              <code
                className={styles.code}
                role="button"
                tabIndex={0}
                title={item.code}
                onClick={() => onCopy(item.code)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCopy(item.code);
                  }
                }}
              >
                <Highlight text={item.code} query={query} />
              </code>
            </Tooltip>
          </TableCellLayout>
        ),
      }),
      createTableColumn<GunCode>({
        columnId: "created",
        renderHeaderCell: () => "创建时间",
        renderCell: (item) => (
          <TableCellLayout>
            <Caption1 className={styles.time}>{fmtTime(item.created_at)}</Caption1>
          </TableCellLayout>
        ),
      }),
      createTableColumn<GunCode>({
        columnId: "actions",
        renderHeaderCell: () => (
          <span style={{ display: "block", textAlign: "right" }}>操作</span>
        ),
        renderCell: (item) => (
          <div className={styles.actions}>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  className={styles.more}
                  appearance="subtle"
                  size="small"
                  icon={<MoreHorizontalRegular />}
                  aria-label={`${item.weapon_name} ${item.note || item.code} 的操作`}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem icon={<CopyRegular />} onClick={() => onCopy(item.code)}>
                    复制改枪码
                  </MenuItem>
                  <MenuItem icon={<EditRegular />} onClick={() => onEdit(item)}>
                    编辑枪名 / 备注
                  </MenuItem>
                  <MenuItem icon={<DeleteRegular />} onClick={() => onDelete(item)}>
                    删除这条
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        ),
      }),
    ],
    [query, onCopy, onEdit, onDelete, styles],
  );

  return (
    <DataGrid
      className={styles.grid}
      items={rows}
      columns={columns}
      getRowId={(item) => item.id}
      focusMode="composite"
      selectionMode="multiselect"
      subtleSelection
      resizableColumns
      /**
       * 列宽显式给定：改枪码是 20+ 字符的等宽文本，必须拿到最宽的配额。
       *
       * 1080px 窗口下表格可用宽度 ≈ 770px（扣除 260px 磁贴面板与内边距）。
       * 之前给 code 列 270px 但实际可用不足，导致改枪码溢出、视觉上压到
       * 「创建时间」列。现在按实际预算收窄：选择列(44) + 枪名(150) + 备注(130)
       * + 改枪码(240) + 时间(120) + 操作(88) ≈ 772px，刚好落在预算内。
       */
      columnSizingOptions={{
        weapon: { idealWidth: 150, minWidth: 110 },
        note: { idealWidth: 130, minWidth: 90 },
        code: { idealWidth: 240, minWidth: 160 },
        created: { idealWidth: 120, minWidth: 110 },
        actions: { idealWidth: 88, minWidth: 80 },
      }}
      selectedItems={selectedIds}
      onSelectionChange={(_e, data: OnSelectionChangeData) =>
        onSelectionChange(new Set([...data.selectedItems].map(String)))
      }
      aria-label="改枪码表格"
    >
      <DataGridHeader>
        <DataGridRow
          className={styles.headerRow}
          selectionCell={{ "aria-label": "全选当前列表" }}
        >
          {({ renderHeaderCell }) => (
            <DataGridHeaderCell>
              <Text weight="semibold" size={300}>
                {renderHeaderCell()}
              </Text>
            </DataGridHeaderCell>
          )}
        </DataGridRow>
      </DataGridHeader>
      <DataGridBody<GunCode>>
        {({ item, rowId }) => (
          <DataGridRow<GunCode>
            key={rowId}
            className={styles.row}
            selectionCell={{ "aria-label": `选择 ${item.weapon_name} ${item.note || item.code}` }}
          >
            {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
          </DataGridRow>
        )}
      </DataGridBody>
    </DataGrid>
  );
}

/** 导出供分组视图复用，保证两个视图对「分类是否展示」判断一致 */
export { CATEGORY_FALLBACK, catOf };
