import { useState } from "react";
import { Check, ChevronRight, Copy, Pencil, Trash2, X } from "lucide-react";
import { fmtTime, type GunCode } from "@/lib/gunCodes";
import { Highlight } from "./Highlight";

/** 单个分组（一把枪的若干配置），支持展开/收起动画 */
export function GunGroup({
  gun,
  cat,
  items,
  collapsed,
  onToggleCollapse,
  query,
  onCopy,
  onDelete,
  onUpdate,
  staggerIndex = 0,
}: {
  gun: string;
  cat: string;
  items: GunCode[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  query: string;
  onCopy: (code: string) => void;
  onDelete: (item: GunCode) => void;
  onUpdate: (id: string, weaponName: string, code: string, note: string) => Promise<void>;
  staggerIndex?: number;
}) {
  return (
    <div
      className="gun-group"
      style={{ animationDelay: `${Math.min(staggerIndex, 12) * 22}ms` }}
    >
      <div
        className="gun-group-head"
        onClick={onToggleCollapse}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleCollapse();
          }
        }}
      >
        <span className={"gg-arrow" + (collapsed ? " collapsed" : "")}>
          <ChevronRight size={15} />
        </span>
        <span className="gg-name">
          <Highlight text={gun} query={query} />
        </span>
        {cat && cat !== "其他" && <span className="tag">{cat}</span>}
        <span className="gg-count">{items.length} 条配置</span>
      </div>

      <div className={"gg-body" + (collapsed ? "" : " open")}>
        <div className="gg-inner">
          <div className="gg-items">
            {items.map((item) => (
              <GunCard
                key={item.id}
                item={item}
                query={query}
                onCopy={onCopy}
                onDelete={onDelete}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 单条改枪码卡片 */
function GunCard({
  item,
  query,
  onCopy,
  onDelete,
  onUpdate,
}: {
  item: GunCode;
  query: string;
  onCopy: (code: string) => void;
  onDelete: (item: GunCode) => void;
  onUpdate: (id: string, weaponName: string, code: string, note: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [weapon, setWeapon] = useState(item.weapon_name);
  const [note, setNote] = useState(item.note);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setWeapon(item.weapon_name);
    setNote(item.note);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(item.id, weapon || item.weapon_name, item.code, note);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="gun-card">
        <div className="gun-card-edit">
          <input
            value={weapon}
            onChange={(e) => setWeapon(e.target.value)}
            placeholder="枪名"
            aria-label="枪名"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="备注"
            aria-label="备注"
          />
          <div className="gun-card-actions">
            <button className="btn small" onClick={save} disabled={saving}>
              <Check size={13} />
              {saving ? "保存中…" : "保存"}
            </button>
            <button className="btn ghost small" onClick={() => setEditing(false)}>
              <X size={13} />
              取消
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gun-card">
      <div className="gun-card-top">
        <span className="gun-card-note">
          {item.note ? <Highlight text={item.note} query={query} /> : <span className="faint">无备注</span>}
        </span>
        <span className="gun-card-time">{fmtTime(item.created_at)}</span>
      </div>

      <code
        className="guncode"
        onClick={() => onCopy(item.code)}
        title="点击复制"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCopy(item.code);
        }}
      >
        <Highlight text={item.code} query={query} />
      </code>

      <div className="gun-card-actions">
        <button className="btn ghost small" onClick={() => onCopy(item.code)} title="复制">
          <Copy size={13} />
          复制
        </button>
        <button className="btn ghost small" onClick={startEdit} title="编辑">
          <Pencil size={13} />
          编辑
        </button>
        <button className="btn danger small" onClick={() => onDelete(item)} title="删除">
          <Trash2 size={13} />
          删除
        </button>
      </div>
    </div>
  );
}
