import { Button, Caption1, Tag, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { ClipboardPasteRegular, DeleteRegular, DismissRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  bar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
    paddingBlock: tokens.spacingVerticalXS,
    paddingInline: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorBrandBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  text: { color: tokens.colorBrandForeground2 },
  spacer: { flex: "1 1 auto" },
});

/**
 * 选中态操作条
 *
 * 只在真有选中时出现，把「批量复制 / 批量删除 / 清除选择」收在一处，
 * 避免把批量动作塞进工具栏常驻按钮里（那会让两个删除入口语义重叠）。
 */
export function SelectionBar({
  count,
  onCopyAll,
  onDeleteAll,
  onClear,
}: {
  count: number;
  onCopyAll: () => void;
  onDeleteAll: () => void;
  onClear: () => void;
}) {
  const styles = useStyles();
  if (count === 0) return null;

  return (
    <div className={styles.bar} role="status">
      <Tag appearance="brand" size="small" shape="rounded">
        已选 {count} 条
      </Tag>
      <Caption1 className={styles.text}>批量操作只作用于当前选中的条目</Caption1>
      <span className={styles.spacer} />
      <Tooltip content="把选中条目的改枪码逐行复制到剪贴板" relationship="description" withArrow>
        <Button
          appearance="secondary"
          size="small"
          icon={<ClipboardPasteRegular />}
          onClick={onCopyAll}
        >
          复制选中代码
        </Button>
      </Tooltip>
      <Button
        appearance="secondary"
        size="small"
        icon={<DeleteRegular />}
        onClick={onDeleteAll}
      >
        删除选中
      </Button>
      <Tooltip content="清除选择" relationship="label" withArrow>
        <Button
          appearance="subtle"
          size="small"
          icon={<DismissRegular />}
          aria-label="清除选择"
          onClick={onClear}
        />
      </Tooltip>
    </div>
  );
}
