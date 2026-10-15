import { useMemo, useState } from "react";
import {
  Check, FileSearch, RefreshCw, ShieldCheck, TriangleAlert, Upload,
} from "lucide-react";
import { computePreviewStats, type PreviewResult } from "@/lib/gunCodes";
import { Modal } from "./Modal";

/**
 * 批量导入预览流
 *
 * 两阶段：① 粘贴文本 → 解析预览（**不写库**）→ ② 逐条勾选后确认入库。
 * 预览行展示枪名 / 配置 / 码 / **识别依据** / 重复标记。
 */
export function ImportPreview({
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
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText("");
    setPreview(null);
    setDeselected(new Set());
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const parse = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setPreview(await onParse(text));
      setDeselected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    const rows = preview.rows
      .filter((r) => !r.duplicate && !deselected.has(r.code))
      .map((r) => ({ gun: r.gun, config: r.config, code: r.code }));
    if (rows.length === 0) return;
    setBusy(true);
    try {
      await onConfirm(rows);
      close();
    } finally {
      setBusy(false);
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
    <Modal
      open={open}
      wide
      title="批量导入改枪码"
      icon={<Upload size={16} />}
      onClose={close}
      footer={
        preview ? (
          <>
            <button className="btn ghost" onClick={() => setPreview(null)}>
              <RefreshCw size={14} />
              返回重贴
            </button>
            <button
              className="btn"
              onClick={confirm}
              disabled={busy || stats.sel === 0}
            >
              <Check size={15} />
              {busy ? "导入中…" : `确认导入（${stats.sel}）`}
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={close}>
              取消
            </button>
            <button className="btn" onClick={parse} disabled={busy || !text.trim()}>
              <FileSearch size={15} />
              {busy ? "解析中…" : "解析并预览"}
            </button>
          </>
        )
      }
    >
      {!preview ? (
        <>
          <p className="modal-hint">
            从在线文档或表格复制整块内容粘贴到下面（支持制表符分隔的表格）。
            <b>解析后先预览，确认无误再入库。</b>
            <br />
            仅收录「烽火地带」模式的改枪码；全面战场 / 黑潮爆破会按分区标题自动跳过。
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "例如：\nRM277 20W青春版 6KFCC1K08QMG6NRUK6UQC\nMK47突击步枪-烽火地带-6HN54R808PBNCS3LFEE0A"
            }
            rows={12}
            aria-label="待导入文档内容"
          />
        </>
      ) : (
        <>
          <div className="preview-stats">
            <span className="pill">共 {preview.total} 条</span>
            <span className="pill tag ok" style={{ borderColor: "var(--c-ok-border)", color: "var(--c-ok)" }}>
              <ShieldCheck size={12} />
              已识别 {preview.recognized}
            </span>
            {preview.unrecognized > 0 && (
              <span className="pill tag warn" style={{ borderColor: "var(--c-warn-border)", color: "var(--c-warn)" }}>
                <TriangleAlert size={12} />
                未识别 {preview.unrecognized}
              </span>
            )}
            {stats.dup > 0 && <span className="pill">重复 {stats.dup}</span>}
            <span className="faint" style={{ fontSize: "var(--fs-sm)" }}>
              将导入 <b style={{ color: "var(--c-accent)" }}>{stats.sel}</b> 条
            </span>
            {importable.length > 0 && (
              <button
                className="btn ghost small"
                style={{ marginLeft: "auto" }}
                onClick={() =>
                  setDeselected(allOn ? new Set(importable.map((r) => r.code)) : new Set())
                }
              >
                {allOn ? "取消全选" : "全选"}
              </button>
            )}
          </div>

          {preview.unrecognized > 0 && (
            <p className="modal-hint" style={{ color: "var(--c-warn)" }}>
              <TriangleAlert size={12} style={{ verticalAlign: -2 }} /> 未识别的条目会以「未知枪械」
              导入，可稍后手动修正（修正后会自动学习）
            </p>
          )}

          <div className="preview-list">
            {preview.rows.map((r) => {
              const off = r.duplicate || deselected.has(r.code);
              return (
                <label className={"preview-row" + (off ? " off" : "")} key={r.code}>
                  <input
                    type="checkbox"
                    checked={!off}
                    disabled={r.duplicate}
                    onChange={() => toggleRow(r.code)}
                  />
                  <div className="preview-info">
                    <div className="preview-line">
                      <b>{r.recognized ? r.gun : "未知枪械"}</b>
                      {r.config && <span className="muted">· {r.config}</span>}
                      {r.duplicate && <span className="tag">已存在</span>}
                      {!r.recognized && <span className="tag warn">未识别</span>}
                    </div>
                    <code className="preview-code">{r.code}</code>
                    <div className="preview-reason">{r.reason}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
