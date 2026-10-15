import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ListFilter, Search } from "lucide-react";
import { norm } from "@/lib/gunCodes";

/**
 * 枪名筛选：可搜索多选浮层
 *
 * 取代旧版「60+ 按钮平铺」；与分类筛选**可组合**（不再互斥重置）。
 */
export function GunFilter({
  candidates,
  selected,
  onToggle,
  onSetAll,
  onClear,
}: {
  candidates: [string, number][];
  selected: string[];
  onToggle: (gun: string) => void;
  onSetAll: (guns: string[]) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selSet = useMemo(() => new Set(selected.map(norm)), [selected]);
  const shown = useMemo(
    () => candidates.filter(([g]) => !q || norm(g).includes(norm(q))),
    [candidates, q],
  );

  const allOn = shown.length > 0 && shown.every(([g]) => selSet.has(norm(g)));

  return (
    <div className="gun-filter-wrap" ref={wrapRef}>
      <button
        className={"pill" + (selected.length ? " active" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <ListFilter size={13} />
        枪名{selected.length > 0 && <span className="cnt">{selected.length}</span>}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="gun-pop" role="listbox">
          <div className="search-wrap">
            <Search size={13} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索枪名"
              autoFocus
            />
          </div>

          <div className="gun-pop-actions">
            <button
              className="btn ghost small"
              onClick={() => onSetAll(allOn ? [] : shown.map(([g]) => g))}
            >
              {allOn ? "取消全选" : "全选"}
            </button>
            <button className="btn ghost small" onClick={onClear}>
              清空
            </button>
          </div>

          <div className="gun-pop-list">
            {shown.length === 0 ? (
              <div className="empty" style={{ padding: "18px 0" }}>
                无匹配枪名
              </div>
            ) : (
              shown.map(([g, n]) => (
                <label className="gun-pop-row" key={g}>
                  <input
                    type="checkbox"
                    checked={selSet.has(norm(g))}
                    onChange={() => onToggle(g)}
                  />
                  <span className="gun-pop-name">{g}</span>
                  <span className="faint" style={{ fontSize: "var(--fs-xs)" }}>
                    {n}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
