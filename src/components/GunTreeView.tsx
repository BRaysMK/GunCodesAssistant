import {
  Button, Caption1, Checkbox, Menu, MenuItem, MenuList, MenuPopover, MenuTrigger,
  Text, Tree, TreeItem, TreeItemLayout,
  makeStyles, tokens, type TreeItemValue, type TreeOpenChangeData,
} from "@fluentui/react-components";
import { DeleteRegular, EditRegular, MoreHorizontalRegular } from "@fluentui/react-icons";
import { catOf, CATEGORY_FALLBACK, fmtTime, type GunCode } from "@/lib/gunCodes";
import { Highlight } from "./Highlight";
import { GunCodeText } from "./GunCodeText";
import { categoryAccentOf } from "./GunTile";
import type { ViewMode } from "@/hooks/useFilters";

const useStyles = makeStyles({
  wrap: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow2,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    /**
     * Fluent 的 `TreeItemLayout__main` 只有 padding、没有 flex-grow，
     * 而 `__aside` 带 `margin-left:auto`。结果是 main 只按内容宽度收缩、
     * aside 被推到最右，中间留出一大片空白，长改枪码也因此被挤到截断。
     * 这里从容器侧把 main 撑满剩余空间（唯一能改到该 slot 的位置）。
     */
    "& .fui-TreeItemLayout__main": {
      flex: "1 1 auto",
      minWidth: 0,
    },
    /** 叶子行最小高度对齐表格的 44px */
    "& .fui-TreeItemLayout": {
      minHeight: "44px",
    },
  },
  gunHead: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    minWidth: 0,
    width: "100%",
  },
  /** 分类色条：与表格视图同一套语义，替代每行一个彩色徽标 */
  catBar: {
    width: "3px",
    alignSelf: "stretch",
    minHeight: "18px",
    borderRadius: tokens.borderRadiusSmall,
    flexShrink: 0,
  },
  gunName: {
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  leaf: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
    minWidth: 0,
    width: "100%",
  },
  /** 备注占固定配额，改枪码吃掉剩余空间，二者都不会把对方挤没 */
  note: {
    color: tokens.colorNeutralForeground2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: "0 1 190px",
    minWidth: 0,
  },
  muted: {
    color: tokens.colorNeutralForeground4,
  },
  time: {
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  more: {
    color: tokens.colorNeutralForeground3,
    ":hover": { color: tokens.colorNeutralForeground1 },
  },
});

/**
 * 分组视图（Fluent Tree）
 *
 * 面向「按枪浏览」：一把枪一个可折叠分支，分支标题带分类徽标与条数，叶子是一条配置。
 * 展开状态由 `useFilters.collapsed` 托管（与 v1.2.0 的折叠语义一致），因此切换视图
 * 或增删数据后展开状态不会莫名丢失。
 */
export function GunTreeView({
  grouped,
  query,
  collapsed,
  onToggleCollapse,
  selectedIds,
  onToggleSelect,
  onCopy,
  onEdit,
  onDelete,
}: {
  grouped: [string, GunCode[]][];
  query: string;
  collapsed: Set<string>;
  onToggleCollapse: (gun: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onCopy: (code: string) => void;
  onEdit: (item: GunCode) => void;
  onDelete: (item: GunCode) => void;
}) {
  const styles = useStyles();

  const openItems: TreeItemValue[] = grouped
    .filter(([gun]) => !collapsed.has(gun))
    .map(([gun]) => gun);

  const handleOpenChange = (_e: unknown, data: TreeOpenChangeData) => {
    const next = new Set([...data.openItems].map(String));
    for (const [gun] of grouped) {
      const shouldOpen = next.has(gun);
      const isOpen = !collapsed.has(gun);
      if (shouldOpen !== isOpen) onToggleCollapse(gun);
    }
  };

  return (
    <div className={styles.wrap}>
      <Tree
        aria-label="按枪分组的改枪码"
        openItems={openItems}
        onOpenChange={handleOpenChange}
      >
        {grouped.map(([gun, list]) => {
          const cat = catOf(gun);
          const accent = categoryAccentOf(gun);
          return (
            <TreeItem key={gun} itemType="branch" value={gun}>
              <TreeItemLayout
                aside={
                  <Caption1 className={styles.time}>{list.length} 条配置</Caption1>
                }
              >
                <span className={styles.gunHead}>
                  <span
                    className={styles.catBar}
                    style={{ backgroundColor: accent ?? tokens.colorNeutralStroke1 }}
                    aria-hidden
                  />
                  <Text weight="semibold" size={300} className={styles.gunName}>
                    <Highlight text={gun} query={query} />
                  </Text>
                  {cat !== CATEGORY_FALLBACK && (
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      {cat}
                    </Caption1>
                  )}
                </span>
              </TreeItemLayout>

              <Tree aria-label={`${gun} 的配置`}>
                {list.map((item) => (
                  <TreeItem key={item.id} itemType="leaf" value={item.id}>
                    <TreeItemLayout
                      iconBefore={
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onChange={() => onToggleSelect(item.id)}
                          aria-label={`选择 ${item.weapon_name} ${item.note || item.code}`}
                          title="选中后可批量复制或删除"
                        />
                      }
                      aside={
                        <span className={styles.actions}>
                          <Caption1 className={styles.time}>{fmtTime(item.created_at)}</Caption1>
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
                                <MenuItem icon={<EditRegular />} onClick={() => onEdit(item)}>
                                  编辑枪名 / 备注
                                </MenuItem>
                                <MenuItem icon={<DeleteRegular />} onClick={() => onDelete(item)}>
                                  删除这条
                                </MenuItem>
                              </MenuList>
                            </MenuPopover>
                          </Menu>
                        </span>
                      }
                    >
                      <span className={styles.leaf}>
                        <span className={styles.note} title={item.note || undefined}>
                          {item.note ? (
                            <Highlight text={item.note} query={query} />
                          ) : (
                            <span className={styles.muted}>无备注</span>
                          )}
                        </span>
                        <GunCodeText code={item.code} query={query} onCopy={onCopy} />
                      </span>
                    </TreeItemLayout>
                  </TreeItem>
                ))}
              </Tree>
            </TreeItem>
          );
        })}
      </Tree>
    </div>
  );
}

export type { ViewMode };
