import { Caption1, Text, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { rulesTooltip, type RulesMeta } from "@/lib/gunCodes";

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXXS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    /** 状态栏是最低一层：用 background2 + 顶部分隔线，与内容区拉开层次 */
    backgroundColor: tokens.colorNeutralBackground2,
    borderTopStyle: "solid",
    borderTopWidth: tokens.strokeWidthThin,
    borderTopColor: tokens.colorNeutralStroke2,
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  num: { fontVariantNumeric: "tabular-nums", color: tokens.colorNeutralForeground2 },
  spacer: { flex: "1 1 auto" },
  item: { display: "inline-flex", alignItems: "center", columnGap: tokens.spacingHorizontalXS },
});

/**
 * 底部状态栏
 *
 * 承载「全局只读信息」：统计、筛选状态、词库版本。
 * 放这里而不是塞进侧栏底部，是因为这些信息随时可读但不常变，
 * 属于典型的状态栏内容；也让侧栏空出来专心做导航。
 */
export function StatusBar({
  total,
  shown,
  guns,
  meta,
  hasActiveFilter,
  filterSummary,
}: {
  total: number;
  shown: number;
  guns: number;
  meta: RulesMeta | null;
  hasActiveFilter: boolean;
  filterSummary: string;
}) {
  const styles = useStyles();

  return (
    <div className={styles.bar} data-testid="status-bar" role="status" aria-live="polite">
      <span className={styles.item}>
        <Caption1>
          共 <b className={styles.num}>{total}</b> 条记录 ·{" "}
          <b className={styles.num}>{guns}</b> 把枪
        </Caption1>
      </span>

      {hasActiveFilter && (
        <span className={styles.item}>
          <Caption1>
            当前筛选：<b className={styles.num}>{shown}</b> / {total} 条
            {filterSummary ? ` · ${filterSummary}` : ""}
          </Caption1>
        </span>
      )}

      <span className={styles.spacer} />

      {/* 状态栏也只显示版本号，详情进 Tooltip（与线上版本对比用） */}
      <Tooltip content={rulesTooltip(meta)} relationship="description" withArrow>
        <span className={styles.item}>
          <Caption1>{meta ? `v${meta.version}` : "读取中…"}</Caption1>
        </span>
      </Tooltip>

      <span className={styles.item}>
        <Text size={200} style={{ color: tokens.colorNeutralForeground4 }}>
          仅收录烽火地带
        </Text>
      </span>
    </div>
  );
}
