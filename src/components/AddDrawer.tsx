import { useEffect, useRef, useState } from "react";
import { Check, PenLine, Sparkles, TriangleAlert } from "lucide-react";
import type { RecognizeResult } from "@/lib/gunCodes";
import { Drawer } from "./Modal";

/**
 * 添加改枪码（抽屉）
 *
 * 交互与 v1.1.0 一致：粘贴 → 250ms 防抖识别 → 可手动修正 → 保存后学习指纹。
 * 只是从「常驻面板」改为「抽屉」，不再占用列表版面。
 */
export function AddDrawer({
  open,
  onClose,
  onRecognize,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onRecognize: (code: string) => Promise<RecognizeResult>;
  onSave: (weaponName: string, code: string, note: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [weapon, setWeapon] = useState("");
  const [note, setNote] = useState("");
  const [recog, setRecog] = useState<RecognizeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);

  // 关闭时重置
  useEffect(() => {
    if (!open) {
      setCode("");
      setWeapon("");
      setNote("");
      setRecog(null);
      if (timer.current) window.clearTimeout(timer.current);
    }
  }, [open]);

  const handleCode = (v: string) => {
    setCode(v);
    const clean = v.replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length < 6) {
      setRecog(null);
      setWeapon("");
      setNote("");
      return;
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        const r = await onRecognize(v);
        setRecog(r);
        if (r.recognized) {
          setWeapon(r.weapon_name);
          setNote(r.note || "");
        } else {
          setNote("");
        }
      } catch {
        /* 忽略识别失败 */
      }
    }, 250);
  };

  const save = async () => {
    if (!code.trim()) return;
    setSaving(true);
    try {
      await onSave(weapon, code, note);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = code.trim().length > 0;

  return (
    <Drawer
      open={open}
      title="添加改枪码"
      icon={<PenLine size={16} />}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn" onClick={save} disabled={!canSave || saving}>
            <Check size={15} />
            {saving ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
        <div>
          <label
            style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-dim)", display: "block", marginBottom: 6 }}
          >
            改枪码（粘贴后自动识别枪名）
          </label>
          <textarea
            value={code}
            onChange={(e) => handleCode(e.target.value)}
            placeholder="例如 6KFCC1K08QMG6NRUK6UQC"
            rows={3}
            autoFocus
            aria-label="改枪码"
          />
          {recog && (
            <div className={"recog " + (recog.recognized ? "ok" : "unknown")}>
              {recog.recognized ? (
                <>
                  <Sparkles size={13} />
                  <span>
                    已识别：<b>{recog.weapon_name}</b>
                  </span>
                  {recog.confidence > 0 && (
                    <span className="dim">置信度 {Math.round(recog.confidence * 100)}%</span>
                  )}
                  {recog.reason && <span className="dim">· {recog.reason}</span>}
                </>
              ) : (
                <>
                  <TriangleAlert size={13} />
                  <span>未识别出枪名，可手动输入后保存（保存后会学习该指纹）</span>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <label
            style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-dim)", display: "block", marginBottom: 6 }}
          >
            枪名
          </label>
          <input
            value={weapon}
            onChange={(e) => setWeapon(e.target.value)}
            placeholder="枪名"
            aria-label="枪名"
          />
        </div>

        <div>
          <label
            style={{ fontSize: "var(--fs-sm)", color: "var(--c-text-dim)", display: "block", marginBottom: 6 }}
          >
            备注
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如 20W青春版 / 55W满改红点"
            aria-label="备注"
          />
        </div>
      </div>
    </Drawer>
  );
}
