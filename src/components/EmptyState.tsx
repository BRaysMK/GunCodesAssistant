import { Button, Card, Text, makeStyles, tokens } from "@fluentui/react-components";
import { AddRegular, SearchInfoRegular, FolderOpenRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  wrap: {
    display: "grid",
    placeItems: "center",
    minHeight: "320px",
    padding: tokens.spacingVerticalXXXL,
  },
  card: {
    maxWidth: "460px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    rowGap: tokens.spacingVerticalMNudge,
    padding: tokens.spacingVerticalXXL,
  },
  icon: {
    color: tokens.colorBrandForeground1,
    fontSize: "48px",
    lineHeight: "48px",
    display: "block",
  },
  hint: {
    color: tokens.colorNeutralForeground3,
    maxWidth: "360px",
  },
});

/**
 * 空状态。
 *
 * 两种语义刻意分开：库为空（引导添加/导入）与筛选无果（引导清除筛选），
 * 后者不应出现「添加」按钮——用户此时需要的不是新数据。
 */
export function EmptyState({
  variant,
  onPrimary,
  onSecondary,
}: {
  variant: "empty" | "nomatch";
  /** 主操作：库为空 → 添加；筛选无果 → 清除筛选 */
  onPrimary: () => void;
  /** 次要操作：库为空 → 批量导入 */
  onSecondary?: () => void;
}) {
  const styles = useStyles();
  const isEmpty = variant === "empty";

  return (
    <div className={styles.wrap}>
      <Card className={styles.card} appearance="outline" size="large">
        <span className={styles.icon}>
          {isEmpty ? <FolderOpenRegular /> : <SearchInfoRegular />}
        </span>
        <Text size={500} weight="semibold">
          {isEmpty ? "还没有记录" : "没有匹配的结果"}
        </Text>
        <Text className={styles.hint} size={300}>
          {isEmpty
            ? "点「添加改枪码」粘贴一条改枪码，会自动识别枪名与配置；也可以「批量导入」整份文档。"
            : "当前分类 / 枪名 / 搜索的组合下没有找到记录，试试放宽筛选条件。"}
        </Text>
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <Button
            appearance="primary"
            icon={isEmpty ? <AddRegular /> : undefined}
            onClick={onPrimary}
          >
            {isEmpty ? "添加改枪码" : "清除筛选"}
          </Button>
          {isEmpty && onSecondary && (
            <Button appearance="secondary" onClick={onSecondary}>
              批量导入
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
