import { useMemo, useState } from "react";
import {
  Badge, Button, Checkbox, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, DialogTrigger, Divider, MessageBar, MessageBarBody,
  MessageBarTitle, Spinner, Tag, Text, Textarea, Tooltip, makeStyles, tokens,
} from "@fluentui/react-components";
import {
  ArrowSyncRegular, CheckmarkCircleRegular, DismissRegular, DocumentTableRegular,
  WarningRegular,
} from "@fluentui/react-icons";
import { computePreviewStats, type PreviewResult } from "@/lib/gunCodes";

const useStyles = makeStyles({
  surface: { maxWidth: "920px", width: "92vw" },
  step: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
    minHeight: 0,
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXXS,
    maxHeight: "46vh",
    overflowY: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    columnGap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalXS,
    paddingInline: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusSmall,
    cursor: "pointer",
    ":hover": { backgroundColor: tokens.colorNeutralBackground2Hover },
  },
  rowOff: { opacity: 0.5 },
  info: { display: "flex", flexDirection: "column", rowGap: "2px", minWidth: 0, flex: 1 },
  line: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground2,
    userSelect: "text",
  },
  reason: {
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  footerNote: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    marginRight: "auto",
  },
});

/**
 * 批量导入（Fluent Dialog，两步流）
 *
 * 第一步只收文本，**不写库**；第二步展示解析结果，逐条可勾选、能看到识别依据与
 * 重复标记，确认后才入库。把「解析」和「入库」做成两个明确步骤，是为了让用户
 * 在污染数据之前有机会发现解析错误 —— 这是 v1.1.0 就确立的核心交互，予以保留。
 */
export function ImportDialog({
  open,
  onClose,
  onParse,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onParse: (text: string) => Promise<PreviewResult>;
  onConfirm: (rows: { gun: string; config: string; code: string }[]) => Promise<{
    imported: number;
    updated: number;
    skipped: number;
  }>;
}) {
  const styles = useStyles();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setText("");
    setPreview(null);
    setDeselected(new Set());
    setParsing(false);
    setImporting(false);
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const parse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setError("");
    try {
      setPreview(await onParse(text));
      setDeselected(new Set());
    } catch (e) {
      setError("解析失败：" + String(e));
    } finally {
      setParsing(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => !r.duplicate && !deselected.has(r.code))
      .map((r) => ({ gun: r.gun, config: r.config, code: r.code }));
    if (rows.length === 0) return;
    setImporting(true);
    setError("");
    try {
      await onConfirm(rows);
      close();
    } catch (e) {
      setError("导入失败：" + String(e));
    } finally {
      setImporting(false);
    }
  };

  const stats = useMemo(() => computePreviewStats(preview, deselected), [preview, deselected]);
  const importable = useMemo(
    () => (preview ? preview.rows.filter((r) => !r.duplicate) : []),
    [preview],
  );
  const allOn = importable.length > 0 && importable.every((r) => !deselected.has(r.code));

  const toggleRow = (code: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      modalType="modal"
      onOpenChange={(_e, data) => {
        if (!data.open) close();
      }}
    >
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" icon={<DismissRegular />} aria-label="关闭" />
              </DialogTrigger>
            }
          >
            {preview ? "预览导入内容" : "批量导入改枪码"}
          </DialogTitle>

          <DialogContent>
            {!preview ? (
              <div className={styles.step}>
                <MessageBar intent="info">
                  <MessageBarBody>
                    <MessageBarTitle>从在线文档或表格整段复制粘贴</MessageBarTitle>
                    支持制表符表格与「枪名-烽火地带-代码」格式。<b>解析后先预览，确认无误再入库。</b>
                    <br />
                    仅收录「烽火地带」模式的改枪码；全面战场 / 黑潮爆破会按分区标题自动跳过。
                  </MessageBarBody>
                </MessageBar>

                <Textarea
                  value={text}
                  onChange={(_e, data) => setText(data.value)}
                  placeholder={
                    "例如：\nRM277 20W青春版 6KFCC1K08QMG6NRUK6UQC\nMK47突击步枪-烽火地带-6HN54R808PBNCS3LFEE0A"
                  }
                  rows={12}
                  resize="vertical"
                  aria-label="待导入的文档内容"
                />
              </div>
            ) : (
              <div className={styles.step}>
                <div className={styles.statsRow}>
                  <Tag size="extra-small" appearance="outline" shape="rounded">
                    共 {preview.total} 条
                  </Tag>
                  <Tag
                    size="extra-small"
                    appearance="brand"
                    shape="rounded"
                    icon={<CheckmarkCircleRegular />}
                  >
                    已识别 {preview.recognized}
                  </Tag>
                  {preview.unrecognized > 0 && (
                    <Tag
                      size="extra-small"
                      appearance="outline"
                      shape="rounded"
                      icon={<WarningRegular />}
                    >
                      未识别 {preview.unrecognized}
                    </Tag>
                  )}
                  {stats.dup > 0 && (
                    <Tag size="extra-small" appearance="outline" shape="rounded">
                      重复 {stats.dup}
                    </Tag>
                  )}
                  <Text size={200} style={{ marginLeft: "4px" }}>
                    将导入 <b style={{ color: tokens.colorBrandForeground1 }}>{stats.sel}</b> 条
                  </Text>
                  {importable.length > 0 && (
                    <Button
                      appearance="subtle"
                      size="small"
                      style={{ marginLeft: "auto" }}
                      onClick={() =>
                        setDeselected(allOn ? new Set(importable.map((r) => r.code)) : new Set())
                      }
                    >
                      {allOn ? "取消全选" : "全选"}
                    </Button>
                  )}
                </div>

                <Divider />

                <div className={styles.list}>
                  {preview.rows.map((r) => {
                    const off = r.duplicate || deselected.has(r.code);
                    return (
                      <label
                        key={r.code}
                        className={styles.row + (off ? " " + styles.rowOff : "")}
                      >
                        <Checkbox
                          checked={!off}
                          disabled={r.duplicate}
                          onChange={() => toggleRow(r.code)}
                          aria-label={`选择 ${r.code}`}
                        />
                        <span className={styles.info}>
                          <span className={styles.line}>
                            <Text weight="semibold" size={300}>
                              {r.recognized ? r.gun : "未知枪械"}
                            </Text>
                            {r.config && (
                              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                · {r.config}
                              </Text>
                            )}
                            {r.duplicate && (
                              <Badge appearance="tint" size="small">
                                已存在
                              </Badge>
                            )}
                            {!r.recognized && (
                              <Badge appearance="tint" color="warning" size="small">
                                未识别
                              </Badge>
                            )}
                          </span>
                          <code className={styles.code} data-selectable="true">
                            {r.code}
                          </code>
                          <span className={styles.reason} title={r.reason}>
                            {r.reason}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {preview.unrecognized > 0 && (
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      未识别的条目会以「未知枪械」导入，之后可在列表里手动修正（修正后会自动学习）。
                    </MessageBarBody>
                  </MessageBar>
                )}
              </div>
            )}

            {error && (
              <MessageBar intent="error" style={{ marginTop: "8px" }}>
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            )}
          </DialogContent>

          <DialogActions>
            {preview ? (
              <>
                <div className={styles.footerNote}>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowSyncRegular />}
                    onClick={() => setPreview(null)}
                  >
                    返回重贴
                  </Button>
                </div>
                <Button appearance="primary" disabled={importing || stats.sel === 0} onClick={confirm}>
                  {importing ? "导入中…" : `确认导入（${stats.sel}）`}
                </Button>
              </>
            ) : (
              <>
                <div className={styles.footerNote}>
                  <Tooltip content="解析只读，不会改动已有数据" relationship="description" withArrow>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <DocumentTableRegular />
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                        解析不写库
                      </Text>
                    </span>
                  </Tooltip>
                </div>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary" onClick={close}>
                    取消
                  </Button>
                </DialogTrigger>
                <Button
                  appearance="primary"
                  disabled={parsing || !text.trim()}
                  onClick={parse}
                  icon={parsing ? <Spinner size="tiny" /> : undefined}
                >
                  {parsing ? "解析中…" : "解析并预览"}
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
