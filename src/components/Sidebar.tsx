import {
  Crosshair, LayoutGrid, Layers, RefreshCw, Sun, Moon, MonitorSmartphone, Copy,
} from "lucide-react";
import type { RulesMeta } from "@/lib/gunCodes";
import { CATEGORY_FALLBACK } from "@/lib/gunCodes";
import type { ThemeMode } from "@/hooks/useTheme";

/** 侧边栏：品牌 / 统计 / 分类导航 / 词库 / 主题 */
export function Sidebar({
  stats,
  meta,
  catCounts,
  catOrder,
  catFilter,
  onSelectCat,
  onRefreshRules,
  themeMode,
  onSetTheme,
}: {
  stats: { count: number; guns: number };
  meta: RulesMeta | null;
  catCounts: Map<string, number>;
  catOrder: string[];
  catFilter: string;
  onSelectCat: (cat: string) => void;
  onRefreshRules: () => void;
  themeMode: ThemeMode;
  onSetTheme: (m: ThemeMode) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Crosshair size={22} />
        </div>
        <div className="brand-text">
          <h1>改枪码记事本</h1>
          <p>三角洲行动 · 本地库</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <b>{stats.count}</b>
          <span>条记录</span>
        </div>
        <div className="stat-card">
          <b>{stats.guns}</b>
          <span>把枪</span>
        </div>
      </div>

      <div className="side-section">
        <div className="side-label">
          <span>枪械类别</span>
          <Layers size={12} />
        </div>
        <button
          className={"nav-item" + (catFilter === "all" ? " active" : "")}
          onClick={() => onSelectCat("all")}
        >
          <LayoutGrid size={14} />
          <span className="nav-name">全部</span>
          <span className="nav-cnt">{stats.count}</span>
        </button>
        {catOrder.map((cat) => (
          <button
            key={cat}
            className={"nav-item" + (catFilter === cat ? " active" : "")}
            onClick={() => onSelectCat(cat)}
            title={cat === CATEGORY_FALLBACK ? "未收录到分类表的枪" : cat}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 4,
                flexShrink: 0,
                background:
                  cat === CATEGORY_FALLBACK
                    ? "var(--c-border-strong)"
                    : "var(--c-accent-soft)",
                border: "1px solid var(--c-border)",
              }}
            />
            <span className="nav-name">{cat}</span>
            <span className="nav-cnt">{catCounts.get(cat) ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="side-foot">
        <div className="side-label">
          <span>词库</span>
          <button
            className="btn ghost icon"
            onClick={onRefreshRules}
            title="重新读取 rules.json（可热更）"
            aria-label="刷新词库"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <div className="rules-meta">
          {meta ? (
            <>
              v{meta.version} · {meta.gunCount} 枪
              <br />
              {meta.fingerprintCount} 指纹 · 已学 {meta.learnedCount}
              <br />
              <span title="仅收录烽火地带模式">模式：烽火地带</span>
            </>
          ) : (
            "读取中…"
          )}
        </div>

        <div className="side-label">
          <span>主题</span>
        </div>
        <div className="btn-row">
          {(
            [
              ["light", Sun, "浅色"],
              ["dark", Moon, "深色"],
              ["system", MonitorSmartphone, "跟随系统"],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              className={"pill" + (themeMode === mode ? " active" : "")}
              onClick={() => onSetTheme(mode)}
              title={label}
              aria-label={label}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>

        {stats.count > 0 && (
          <div className="rules-meta" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <Copy size={11} />
            点代码即可复制
          </div>
        )}
      </div>
    </aside>
  );
}
