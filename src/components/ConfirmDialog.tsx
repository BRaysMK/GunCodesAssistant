import {
  Button, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, DialogTrigger, makeStyles, tokens,
} from "@fluentui/react-components";
import { DismissRegular, WarningRegular } from "@fluentui/react-icons";
import type { ReactNode } from "react";

const useStyles = makeStyles({
  detail: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    paddingBlock: tokens.spacingVerticalS,
    paddingInline: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    maxHeight: "160px",
    overflowY: "auto",
  },
  line: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: tokens.colorNeutralForeground2,
  },
});

/**
 * 危险操作确认（Fluent Dialog，`modalType="alert"`）
 *
 * 用 alert 类型而非普通 modal：删除不可撤销，不应该因为点了遮罩就消失，
 * 必须显式选择「取消」或「删除」。
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "删除",
  details,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  /** 待删内容的摘要行（例如「RM277 · 20W青春版 · 6KFCC…」） */
  details?: string[];
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const styles = useStyles();
  const shown = details?.slice(0, 8) ?? [];

  return (
    <Dialog
      open={open}
      modalType="alert"
      onOpenChange={(_e, data) => {
        if (!data.open) onCancel();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" icon={<DismissRegular />} aria-label="关闭" />
              </DialogTrigger>
            }
          >
            {title}
          </DialogTitle>

          <DialogContent>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <WarningRegular
                fontSize={20}
                style={{ color: tokens.colorPaletteYellowForeground1, flexShrink: 0 }}
              />
              <div>{message}</div>
            </div>

            {shown.length > 0 && (
              <div className={styles.detail}>
                {shown.map((d, i) => (
                  <span className={styles.line} key={i} title={d}>
                    {d}
                  </span>
                ))}
                {details && details.length > shown.length && (
                  <span className={styles.line}>
                    …另有 {details.length - shown.length} 条
                  </span>
                )}
              </div>
            )}

            {children}
          </DialogContent>

          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={onCancel}>
                取消
              </Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
