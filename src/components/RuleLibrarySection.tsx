import { useCallback, useEffect, useState } from "react";
import {
  Badge, Button, Caption1, Dialog, DialogActions, DialogBody, DialogContent,
  DialogSurface, DialogTitle, Field, Input, MessageBar, MessageBarBody,
  Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
  Text, Tooltip, makeStyles, shorthands, tokens,
} from "@fluentui/react-components";
import {
  ArrowSyncRegular, DeleteRegular, DismissRegular, EditRegular, SearchRegular,
} from "@fluentui/react-icons";
import type { RuleFingerprintRow } from "@/lib/gunCodes";

const useStyles = makeStyles({
  wrap: { display: "flex", flexDirection: "column", rowGap: tokens.spacingVerticalS },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
  },
  tools: { display: "flex", alignItems: "center", columnGap: tokens.spacingHorizontalS },
  search: { width: "200px" },
  list: {
    maxHeight: "260px",
    overflow: "auto",
    ...shorthands.border(tokens.strokeWidthThin, "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForeground2,
    userSelect: "text",
  },
  pager: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalS,
  },
  muted: { color: tokens.colorNeutralForeground4 },
});

/**
 * 规则库条目管理（v1.6.0）
 *
 * 支持：搜索 / 分页浏览 / 改单条枪名 / 删单条 / 清空线上库。
 *
 * **为什么需要**：规则库是「指纹 → 枪名」的查表。一旦某条认错，
 * 用户以前只能靠学习表覆盖，而学习表是另一层数据、容易混乱。
 * 这里直接改规则库本身：删除的进黑名单，修改的进覆盖层，
 * 与随包库、线上库**分开存储**（见 `rules.overrides.json`）。
 */
export function RuleLibrarySection({
  onList,
  onDelete,
  onUpdate,
  onClearOnline,
  onClearOverrides,
  onNotify,
}: {
  onList: (query: string, page: number, pageSize: number) => Promise<{
    ok: boolean;
    total: number;
    page: number;
    pageSize: number;
    items: RuleFingerprintRow[];
    removedCount: number;
    patchedCount: number;
  }>;
  onDelete: (fp: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdate: (fp: string, gun: string) => Promise<{ ok: boolean; error?: string }>;
  onClearOnline: () => Promise<{ ok: boolean; error?: string; removed?: boolean }>;
  onClearOverrides: () => Promise<{ ok: boolean; error?: string; removed?: boolean }>;
  onNotify: (msg: string, kind?: "success" | "error" | "warning") => void;
}) {
  const styles = useStyles();

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RuleFingerprintRow[]>([]);
  const [total, setTotal] = useState(0);
  const [removedCount, setRemovedCount] = useState(0);
  const [patchedCount, setPatchedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageSize] = useState(50);

  const [editing, setEditing] = useState<RuleFingerprintRow | null>(null);
  const [editGun, setEditGun] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (q: string, p: number) => {
      setLoading(true);
      try {
        const r = await onList(q, p, pageSize);
        setRows(r.items ?? []);
        setTotal(r.total ?? 0);
        setRemovedCount(r.removedCount ?? 0);
        setPatchedCount(r.patchedCount ?? 0);
      } catch (e) {
        onNotify("读取规则库失败: " + String(e), "error");
      } finally {
        setLoading(false);
      }
    },
    [onList, onNotify, pageSize],
  );

  // 打开或换页/换搜索时加载
  useEffect(() => {
    void load(query, page);
    // 搜索输入防抖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 搜索防抖
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPage(1);
      void load(query, 1);
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const doDelete = async (fp: string) => {
    const r = await onDelete(fp);
    if (r.ok) {
      onNotify(`已删除规则 ${fp}`);
      await load(query, page);
    } else {
      onNotify("删除失败: " + (r.error ?? "未知错误"), "error");
    }
  };

  const openEdit = (row: RuleFingerprintRow) => {
    setEditing(row);
    setEditGun(row.gun);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const g = editGun.trim();
    if (!g) return;
    setSaving(true);
    try {
      const r = await onUpdate(editing.fingerprint, g);
      if (r.ok) {
        onNotify(`已把 ${editing.fingerprint} 改为 ${g}`);
        setEditing(null);
        await load(query, page);
      } else {
        onNotify("修改失败: " + (r.error ?? "未知错误"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.tools}>
          <Text weight="semibold">规则库条目</Text>
          <Badge appearance="tint" size="small">{total}</Badge>
          {removedCount > 0 && (
            <Tooltip content="你删除的条目（不再参与识别）" relationship="description" withArrow>
              <Badge appearance="tint" color="danger" size="small">删 {removedCount}</Badge>
            </Tooltip>
          )}
          {patchedCount > 0 && (
            <Tooltip content="你改过枪名的条目" relationship="description" withArrow>
              <Badge appearance="tint" color="warning" size="small">改 {patchedCount}</Badge>
            </Tooltip>
          )}
        </div>
        <div className={styles.tools}>
          <Input
            className={styles.search}
            size="small"
            placeholder="搜指纹 / 枪名"
            value={query}
            onChange={(_e, d) => setQuery(d.value)}
            contentBefore={<SearchRegular fontSize={12} />}
          />
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowSyncRegular />}
            onClick={() => load(query, page)}
            disabled={loading}
          >
            刷新
          </Button>
        </div>
      </div>

      <Caption1 className={styles.muted}>
        删除的条目进黑名单、修改的条目进覆盖层，与随包库和线上库<b>分开存储</b>；
        改动立即生效，重启后保留。「清空我的改动」可一键恢复原样。
      </Caption1>

      {(removedCount > 0 || patchedCount > 0) && (
        <div className={styles.tools}>
          <Button
            size="small"
            appearance="subtle"
            icon={<DismissRegular />}
            onClick={async () => {
              const r = await onClearOverrides();
              if (r.ok) {
                onNotify("已清除全部改动，规则库恢复原样");
                await load(query, page);
              } else {
                onNotify("清除失败: " + (r.error ?? "未知错误"), "error");
              }
            }}
          >
            清空我的改动
          </Button>
        </div>
      )}

      {loading ? (
        <Spinner size="small" label="读取规则库…" />
      ) : rows.length === 0 ? (
        <MessageBar intent="info">
          <MessageBarBody>没有匹配的条目</MessageBarBody>
        </MessageBar>
      ) : (
        <div className={styles.list}>
          <Table size="small" aria-label="规则库条目">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>指纹</TableHeaderCell>
                <TableHeaderCell>枪名</TableHeaderCell>
                <TableHeaderCell>来源</TableHeaderCell>
                <TableHeaderCell style={{ width: 80 }}>操作</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.fingerprint}>
                  <TableCell>
                    <code className={styles.code}>{row.fingerprint}</code>
                  </TableCell>
                  <TableCell>
                    <Text size={200}>{row.gun || "—"}</Text>
                  </TableCell>
                  <TableCell>
                    {row.removed ? (
                      <Badge appearance="tint" color="danger" size="small">已删除</Badge>
                    ) : row.patched ? (
                      <Badge appearance="tint" color="warning" size="small">已修改</Badge>
                    ) : (
                      <Caption1 className={styles.muted}>库内</Caption1>
                    )}
                  </TableCell>
                  <TableCell>
                    <div style={{ display: "flex", gap: 2 }}>
                      <Tooltip content="修改枪名" relationship="label" withArrow>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<EditRegular />}
                          aria-label={`修改 ${row.fingerprint}`}
                          onClick={() => openEdit(row)}
                        />
                      </Tooltip>
                      <Tooltip content="删除这条规则" relationship="label" withArrow>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<DeleteRegular />}
                          aria-label={`删除 ${row.fingerprint}`}
                          onClick={() => doDelete(row.fingerprint)}
                        />
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className={styles.pager}>
        <Caption1 className={styles.muted}>
          第 {page} / {totalPages} 页 · 共 {total} 条
        </Caption1>
        <div className={styles.tools}>
          <Button size="small" appearance="subtle" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button
            size="small"
            appearance="subtle"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
          <Tooltip content="删除下载的线上库，回到随包本地库" relationship="description" withArrow>
            <Button
              size="small"
              appearance="subtle"
              onClick={async () => {
                const r = await onClearOnline();
                if (r.ok) {
                  onNotify(r.removed ? "已清空线上库" : "当前没有线上库");
                  await load(query, page);
                } else {
                  onNotify("清空线上库失败: " + (r.error ?? "未知错误"), "error");
                }
              }}
            >
              清空线上库
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 修改枪名对话框 */}
      <Dialog
        open={editing !== null}
        onOpenChange={(_e, d) => {
          if (!d.open) setEditing(null);
        }}
        modalType="modal"
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <Button appearance="subtle" icon={<DismissRegular />} aria-label="关闭" onClick={() => setEditing(null)} />
              }
            >
              修改规则枪名
            </DialogTitle>
            <DialogContent>
              <Field label="指纹">
                <Input value={editing?.fingerprint ?? ""} readOnly />
              </Field>
              <Field label="枪名" required hint="改后该指纹的码都会识别成这个枪名">
                <Input value={editGun} onChange={(_e, d) => setEditGun(d.value)} autoFocus />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setEditing(null)}>
                取消
              </Button>
              <Button appearance="primary" disabled={saving || !editGun.trim()} onClick={saveEdit}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
