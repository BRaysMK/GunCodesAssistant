import { useEffect } from "react";
import { X } from "lucide-react";

/** 模态框（居中）。`wide` 用于导入预览这类宽内容。 */
export function Modal({
  open,
  title,
  icon,
  onClose,
  footer,
  wide,
  children,
}: {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={"modal" + (wide ? " wide" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            {icon}
            {title}
            <button
              className="btn ghost icon"
              onClick={onClose}
              aria-label="关闭"
              style={{ marginLeft: "auto" }}
            >
              <X size={15} />
            </button>
          </h2>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** 抽屉（右侧滑出）。用于「添加改枪码」——可边看列表边填。 */
export function Drawer({
  open,
  title,
  icon,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>
            {icon}
            {title}
            <button
              className="btn ghost icon"
              onClick={onClose}
              aria-label="关闭"
              style={{ marginLeft: "auto" }}
            >
              <X size={15} />
            </button>
          </h2>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
