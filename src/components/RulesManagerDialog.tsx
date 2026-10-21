import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge, Button, Caption1, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, DialogTrigger, Divider, MessageBar, MessageBarBody,
  MessageBarTitle, Spinner, Table, TableBody, TableCell, TableCellLayout,
  TableHeader, TableHeaderCell, TableRow, Text, Tooltip,
  makeStyles, tokens,
} from "@fluentui/react-components";
import {
  ArrowSyncRegular, CheckmarkCircleRegular, DeleteRegular, DismissRegular, EraserRegular,
  DocumentQuestionMarkRegular, ErrorCircleRegular, WarningRegular,
} from "@fluentui/react-icons";
import type { LearnedFingerprint, RulesMeta } from "@/lib/gunCodes";
import { RuleLibrarySection } from "./RuleLibrarySection";

const useStyles = makeStyles({
  surface: { maxWidth: "900px", width: "94vw" },
  body: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalL },
  section: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  sectionHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalS,
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
  },
  learnedList: {
    maxHeight: "300px",
    overflowY: "auto",
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground2,
    userSelect: "text",
  },
  conflict: { color: tokens.colorPaletteYellowForeground1 },
  muted: { color: tokens.colorNeutralForeground4 },
});

/**
 * 词库管理面板
 *
 * 两个独立能力，刻意放在一起，因为它们回答的是同一个问题
 * 「为什么这个码识别错了，我该怎么修」：
 *
 *  1. **在线热更新**：从 GitHub raw / jsDelivr 拉最新规则库。
 *     策略是「本地优先」——远程只补本地没有的指纹，绝不覆盖已有条目。
 *     原因：本地数据是用户自己确认过的，而远程库也可能有解析错误。
 *
 *  2. **学习表管理**：列出所有已学习的指纹，可单条删除或全部清空。
 *     学习表优先级高于规则库，一旦某条学错了，它就会一直认错 ——
 *     早期版本只增不减，用户毫无办法。这里补上纠错入口。
 */
export function RulesManagerDialog({
  open,
  onClose,
  meta,
  onCheckUpdate,
  onApplyUpdate,
  onResetRules,
  onListLearned,
  onDeleteLearned,
  onClearLearned,
  onClearNotes,
  onNotify,
  onListRules,
  onDeleteRule,
  onUpdateRule,
  onClearOnlineRules,
  onClearRuleOverrides,
}: {
  open: boolean;
  onClose: () => void;
  meta: RulesMeta | null;
  onCheckUpdate: () => Promise<{ ok: boolean; error?: string; source?: string; remoteVersion?: number; wouldAdd?: number; hasUpdate?: boolean; remoteFingerprints?: number }>;
  onApplyUpdate: () => Promise<{ ok: boolean; error?: string; added?: number; after?: number; source?: string }>;
  onResetRules: () => Promise<{ ok: boolean; error?: string; removed?: boolean }>;
  onListLearned: () => Promise<{ ok: boolean; count: number; conflicts: number; items: LearnedFingerprint[] }>;
  onDeleteLearned: (fp: string) => Promise<{ ok: boolean; error?: string }>;
  onClearLearned: () => Promise<{ ok: boolean; cleared: number }>;
  /** 只清学习表里遗留的备注，保留枪名 */
  onClearNotes: () => Promise<{ ok: boolean; cleaned: number }>;
  onNotify: (msg: string, kind?: "success" | "error" | "warning") => void;
  /** v1.6.0：规则库条目管理 */
  onListRules: (query: string, page: number, pageSize: number) => Promise<{
    ok: boolean; total: number; page: number; pageSize: number;
    items: import("@/lib/gunCodes").RuleFingerprintRow[];
    removedCount: number; patchedCount: number;
  }>;
  onDeleteRule: (fp: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateRule: (fp: string, gun: string) => Promise<{ ok: boolean; error?: string }>;
  onClearOnlineRules: () => Promise<{ ok: boolean; error?: string; removed?: boolean }>;
  onClearRuleOverrides: () => Promise<{ ok: boolean; error?: string; removed?: boolean }>;
}) {
  const styles = useStyles();

  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    ok: boolean; error?: string; source?: string; remoteVersion?: number;
    wouldAdd?: number; hasUpdate?: boolean; remoteFingerprints?: number;
  } | null>(null);

  const [learned, setLearned] = useState<LearnedFingerprint[]>([]);
  const [conflicts, setConflicts] = useState(0);
  const [loadingLearned, setLoadingLearned] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadLearned = useCallback(async () => {
    setLoadingLearned(true);
    try {
      const r = await onListLearned();
      setLearned(r.items ?? []);
      setConflicts(r.conflicts ?? 0);
    } catch (e) {
      onNotify("读取学习表失败: " + String(e), "error");
    } finally {
      setLoadingLearned(false);
    }
  }, [onListLearned, onNotify]);

  useEffect(() => {
    if (open) {
      setCheckResult(null);
      void loadLearned();
    }
  }, [open, loadLearned]);

  const check = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const r = await onCheckUpdate();
      setCheckResult(r);
      if (!r.ok) onNotify("检查更新失败", "error");
    } catch (e) {
      setCheckResult({ ok: false, error: String(e) });
    } finally {
      setChecking(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const r = await onApplyUpdate();
      if (r.ok) {
        onNotify(
          r.added ? `词库已更新，新增 ${r.added} 条指纹` : "词库已是最新，没有新增条目",
          "success",
        );
        await loadLearned();
        setCheckResult(null);
      } else {
        onNotify("更新失败: " + (r.error ?? "未知错误"), "error");
      }
    } catch (e) {
      onNotify("更新失败: " + String(e), "error");
    } finally {
      setApplying(false);
    }
  };

  const reset = async () => {
    try {
      const r = await onResetRules();
      if (r.ok) {
        onNotify(r.removed ? "已回到随包词库" : "当前已是随包词库", "success");
        await loadLearned();
      } else {
        onNotify("重置失败: " + (r.error ?? "未知错误"), "error");
      }
    } catch (e) {
      onNotify("重置失败: " + String(e), "error");
    }
  };

  const removeOne = async (fp: string) => {
    const r = await onDeleteLearned(fp);
    if (r.ok) {
      onNotify(`已删除指纹 ${fp}`);
      await loadLearned();
    } else {
      onNotify("删除失败: " + (r.error ?? "未知错误"), "error");
    }
  };

  const clearAll = async () => {
    setConfirmClear(false);
    const r = await onClearLearned();
    if (r.ok) {
      onNotify(`已清空 ${r.cleared} 条学习记录`);
      await loadLearned();
    } else {
      onNotify("清空失败", "error");
    }
  };

  /** 只清除学习表里遗留的备注，保留枪名 */
  const clearNotes = async () => {
    try {
      const r = await onClearNotes();
      if (r.ok) {
        onNotify(r.cleaned ? `已清除 ${r.cleaned} 条遗留备注` : "没有需要清除的备注");
        await loadLearned();
      } else {
        onNotify("清除失败", "error");
      }
    } catch (e) {
      onNotify("清除失败: " + String(e), "error");
    }
  };

  const sortedLearned = useMemo(
    () => [...learned].sort((a, b) => {
      // 冲突项排最前，方便用户先处理有问题的
      const ac = a.conflictWith ? 0 : 1;
      const bc = b.conflictWith ? 0 : 1;
      return ac - bc || a.fingerprint.localeCompare(b.fingerprint);
    }),
    [learned],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(_e, d) => { if (!d.open) onClose(); }} modalType="modal">
        <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" icon={<DismissRegular />} aria-label="关闭" />
              </DialogTrigger>
            }
          >
            词库管理
          </DialogTitle>

          <DialogContent>
            <div className={styles.body}>
              {/* ── 当前词库状态 ── */}
              <div className={styles.section}>
                <div className={styles.metaRow}>
                  <Text weight="semibold">当前词库</Text>
                  {meta ? (
                    <>
                      <Badge appearance="tint" color="brand" size="small">v{meta.version}</Badge>
                      <Caption1 className={styles.muted}>
                        {meta.gunCount} 枪 · {meta.fingerprintCount} 指纹 · 已学 {meta.learnedCount}
                      </Caption1>
                      {meta.generated && (
                        <Caption1 className={styles.muted}>生成于 {meta.generated}</Caption1>
                      )}
                    </>
                  ) : (
                    <Spinner size="tiny" label="读取中…" />
                  )}
                </div>
              </div>

              <Divider />

              {/* ── 在线热更新 ── */}
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <Text weight="semibold">在线更新</Text>
                  <div className={styles.metaRow}>
                    <Button
                      size="small"
                      appearance="secondary"
                      icon={<ArrowSyncRegular />}
                      disabled={checking || applying}
                      onClick={check}
                    >
                      {checking ? "检查中…" : "检查更新"}
                    </Button>
                    <Tooltip content="清除合并结果，回到随包分发的词库" relationship="description" withArrow>
                      <Button size="small" appearance="subtle" onClick={reset} disabled={applying}>
                        重置为随包词库
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <Caption1 className={styles.muted}>
                  仅在点击「检查更新」时联网。来源按顺序尝试：GitHub raw → jsDelivr。
                  更新采用<b>本地优先</b>策略 —— 只补充本地未收录的指纹，不会覆盖你已有的识别结果。
                </Caption1>

                {checkResult && !checkResult.ok && (
                  <MessageBar intent="error">
                    <MessageBarBody>
                      <MessageBarTitle>检查失败</MessageBarTitle>
                      {checkResult.error}
                    </MessageBarBody>
                  </MessageBar>
                )}

                {checkResult && checkResult.ok && (
                  <MessageBar intent={checkResult.hasUpdate ? "success" : "info"}>
                    <MessageBarBody>
                      <MessageBarTitle>
                        {checkResult.hasUpdate
                          ? `发现 ${checkResult.wouldAdd} 条新指纹（远程 v${checkResult.remoteVersion}）`
                          : "已是最新"}
                      </MessageBarTitle>
                      来源 {checkResult.source} · 远程共 {checkResult.remoteFingerprints} 条指纹
                    </MessageBarBody>
                  </MessageBar>
                )}

                {checkResult?.ok && checkResult.hasUpdate && (
                  <Button
                    appearance="primary"
                    icon={applying ? <Spinner size="tiny" /> : <CheckmarkCircleRegular />}
                    disabled={applying}
                    onClick={apply}
                  >
                    {applying ? "更新中…" : `应用更新（新增 ${checkResult.wouldAdd} 条）`}
                  </Button>
                )}
              </div>

              <Divider />

              {/* ── 规则库条目（v1.6.0 新增）── */}
              <RuleLibrarySection
                onList={onListRules}
                onDelete={onDeleteRule}
                onUpdate={onUpdateRule}
                onClearOnline={onClearOnlineRules}
                onClearOverrides={onClearRuleOverrides}
                onNotify={onNotify}
              />

              <Divider />

              {/* ── 学习表管理 ── */}
              <div className={styles.section}>
                <div className={styles.sectionHead}>
                  <div className={styles.metaRow}>
                    <Text weight="semibold">已学习的指纹</Text>
                    <Badge appearance="tint" size="small">{learned.length}</Badge>
                    {conflicts > 0 && (
                      <Tooltip
                        content="这些指纹的学习结果与规则库不一致，可能是之前输错了枪名"
                        relationship="description"
                        withArrow
                      >
                        <Badge appearance="tint" color="warning" size="small" icon={<WarningRegular />}>
                          {conflicts} 条与词库冲突
                        </Badge>
                      </Tooltip>
                    )}
                  </div>
                  <div className={styles.metaRow}>
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<ArrowSyncRegular />}
                      onClick={loadLearned}
                      disabled={loadingLearned}
                    >
                      刷新
                    </Button>
                    {/* 早期版本把备注一起存进了学习表，这里提供一次性清理 */}
                    {learned.some((x) => x.config) && (
                      <Tooltip
                        content="抹掉学习表里遗留的备注，保留枪名（不用重新学习）"
                        relationship="description"
                        withArrow
                      >
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<EraserRegular />}
                          onClick={clearNotes}
                        >
                          清除遗留备注
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={<DeleteRegular />}
                      onClick={() => setConfirmClear(true)}
                      disabled={learned.length === 0}
                    >
                      全部清空
                    </Button>
                  </div>
                </div>

                <Caption1 className={styles.muted}>
                  学习表的优先级<b>高于</b>词库：保存或编辑时填的枪名会被记住，之后同指纹的码都按它识别。
                  若之前输错了，在这里删掉对应指纹即可恢复按词库识别。
                  <b>清空学习表不会删除你保存的改枪码记录。</b>
                </Caption1>

                {loadingLearned ? (
                  <Spinner size="small" label="读取学习表…" />
                ) : learned.length === 0 ? (
                  <MessageBar intent="info">
                    <MessageBarBody>
                      <MessageBarTitle>还没有学习记录</MessageBarTitle>
                      保存或编辑改枪码后，识别出的指纹会自动记在这里。
                    </MessageBarBody>
                  </MessageBar>
                ) : (
                  <div className={styles.learnedList}>
                    <Table size="small" aria-label="已学习指纹">
                      <TableHeader>
                        <TableRow>
                          <TableHeaderCell>指纹</TableHeaderCell>
                          <TableHeaderCell>学习为</TableHeaderCell>
                          <TableHeaderCell>词库认为</TableHeaderCell>
                          <TableHeaderCell style={{ width: 60 }}>操作</TableHeaderCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedLearned.map((it) => (
                          <TableRow key={it.fingerprint}>
                            <TableCell>
                              <code className={styles.code}>{it.fingerprint}</code>
                            </TableCell>
                            <TableCell>
                              <TableCellLayout>
                                <Text size={200}>{it.gun || "(空)"}</Text>
                                {it.config && (
                                  <Caption1 className={styles.muted}>· {it.config}</Caption1>
                                )}
                              </TableCellLayout>
                            </TableCell>
                            <TableCell>
                              {it.conflictWith ? (
                                <Tooltip
                                  content="与学习结果不一致，建议删除学习记录后按词库识别"
                                  relationship="description"
                                  withArrow
                                >
                                  <Caption1 className={styles.conflict}>
                                    <ErrorCircleRegular /> {it.conflictWith}
                                  </Caption1>
                                </Tooltip>
                              ) : it.inLibrary ? (
                                <Caption1 className={styles.muted}>{it.fromRules ?? "—"}</Caption1>
                              ) : (
                                <Tooltip content="词库里没有这个指纹" relationship="description" withArrow>
                                  <Caption1 className={styles.muted}>
                                    <DocumentQuestionMarkRegular /> 未收录
                                  </Caption1>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip content="删除这条学习记录" relationship="label" withArrow>
                                <Button
                                  size="small"
                                  appearance="subtle"
                                  icon={<DeleteRegular />}
                                  aria-label={`删除指纹 ${it.fingerprint}`}
                                  onClick={() => removeOne(it.fingerprint)}
                                />
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>

          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={onClose}>
                关闭
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 清空确认框：作为**兄弟节点**渲染，绝不嵌套进上面的 Dialog */}
      <ClearLearnedDialog
        open={confirmClear}
        count={learned.length}
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearAll}
      />
    </>
  );
}

/**
 * 清空确认框（**独立组件**）
 *
 * ⚠️ 必须与主面板是**兄弟节点**，不能嵌在 `<Dialog>` 里面。
 * Fluent 的 Dialog 内部用 Portal + 焦点陷阱管理开合状态；
 * 把第二个 Dialog 嵌套进第一个 Dialog 的 JSX 子树里，
 * 会导致外层 Dialog 的 open 状态更新丢失 ——
 * 表现为「两个关闭按钮都点了但面板不关」。
 * （这个 bug 在真机上复现过：点击 X 与底部「关闭」均无效。）
 */
function ClearLearnedDialog({
  open,
  count,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = useStyles();
  return (
    <Dialog open={open} modalType="alert" onOpenChange={(_e, d) => { if (!d.open) onCancel(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>清空全部学习记录？</DialogTitle>
          <DialogContent>
            <Text>
              将删除 <b>{count}</b> 条已学习的指纹，之后这些码会按词库规则识别。
            </Text>
            <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalM }}>
              <MessageBarBody>
                不会删除你保存的改枪码记录，只影响「新粘贴的码如何被识别」。
              </MessageBarBody>
            </MessageBar>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="secondary" onClick={onCancel}>
                取消
              </Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={onConfirm}>
              清空
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
