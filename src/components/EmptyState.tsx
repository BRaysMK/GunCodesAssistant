import { Inbox, SearchX, Plus } from "lucide-react";

/** 空状态：图标 + 主文案 + 提示 + 可选引导按钮 */
export function EmptyState({
  variant,
  title,
  hint,
  action,
}: {
  variant: "empty" | "nomatch";
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void; withPlus?: boolean };
}) {
  const Icon = variant === "empty" ? Inbox : SearchX;
  return (
    <div className="empty">
      <Icon size={40} strokeWidth={1.5} />
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {action && (
        <button className="btn" onClick={action.onClick}>
          {action.withPlus && <Plus size={15} />}
          {action.label}
        </button>
      )}
    </div>
  );
}
