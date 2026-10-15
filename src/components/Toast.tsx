import { CheckCircle2, AlertCircle, Info } from "lucide-react";

export type ToastKind = "ok" | "error" | "info";

export interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}

const ICONS = {
  ok: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

/** Toast 堆叠容器（固定在底部居中） */
export function ToastHost({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={"toast " + t.kind}>
            <Icon size={15} />
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}
