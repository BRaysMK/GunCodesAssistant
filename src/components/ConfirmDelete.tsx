import { Trash2 } from "lucide-react";
import { Modal } from "./Modal";

/** 删除确认（应用内弹窗，替代 window.confirm） */
export function ConfirmDelete({
  item,
  onCancel,
  onConfirm,
}: {
  item: { weapon_name: string; code: string; note: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={!!item}
      title="删除改枪码"
      icon={<Trash2 size={16} />}
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn danger" onClick={onConfirm}>
            <Trash2 size={15} />
            删除
          </button>
        </>
      }
    >
      <p className="modal-hint">确定删除这条改枪码？此操作不可撤销。</p>
      {item && (
        <div
          style={{
            background: "var(--c-surface)",
            border: "1px solid var(--c-border)",
            borderRadius: "var(--r-md)",
            padding: "var(--sp-3)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.weapon_name}</div>
          <code className="preview-code">{item.code}</code>
          {item.note && (
            <div className="faint" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>
              {item.note}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
