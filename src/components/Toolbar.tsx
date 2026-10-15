import { ArrowUpDown, Download, Plus, Search, Upload, X } from "lucide-react";
import type { SortKey } from "@/lib/gunCodes";
import { GunFilter } from "./GunFilter";

const SORT_LABELS: Record<SortKey, string> = {
  count: "按条数",
  name: "按名称",
  recent: "按最近",
};

/** 工具栏：搜索 / 枪名多选 / 排序 / 导入导出 / 添加 */
export function Toolbar({
  search,
  onSearch,
  gunCandidates,
  gunFilter,
  onToggleGun,
  onSetGuns,
  onClearGuns,
  sortKey,
  onSort,
  hasActiveFilter,
  onClearFilters,
  onAdd,
  onImportDoc,
  onExport,
  onImportJson,
}: {
  search: string;
  onSearch: (v: string) => void;
  gunCandidates: [string, number][];
  gunFilter: string[];
  onToggleGun: (g: string) => void;
  onSetGuns: (guns: string[]) => void;
  onClearGuns: () => void;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onAdd: () => void;
  onImportDoc: () => void;
  onExport: () => void;
  onImportJson: () => void;
}) {
  return (
    <div className="toolbar">
      <div className="search-wrap">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="搜索 枪名 / 代码 / 备注…"
          aria-label="搜索"
        />
      </div>

      <GunFilter
        candidates={gunCandidates}
        selected={gunFilter}
        onToggle={onToggleGun}
        onSetAll={onSetGuns}
        onClear={onClearGuns}
      />

      <button
        className="pill"
        onClick={() => {
          const order: SortKey[] = ["count", "name", "recent"];
          const i = order.indexOf(sortKey);
          onSort(order[(i + 1) % order.length]);
        }}
        title="切换排序方式"
      >
        <ArrowUpDown size={13} />
        {SORT_LABELS[sortKey]}
      </button>

      {hasActiveFilter && (
        <button className="btn ghost small" onClick={onClearFilters}>
          <X size={13} />
          清除筛选
        </button>
      )}

      <div className="btn-row" style={{ marginLeft: "auto" }}>
        <button className="btn ghost small" onClick={onImportDoc} title="批量导入改枪码文档">
          <Upload size={14} />
          批量导入
        </button>
        <button className="btn ghost small icon" onClick={onExport} title="导出 JSON 备份">
          <Download size={14} />
        </button>
        <button className="btn ghost small icon" onClick={onImportJson} title="导入 JSON 备份">
          <Upload size={14} />
        </button>
        <button className="btn" onClick={onAdd}>
          <Plus size={15} />
          添加
        </button>
      </div>
    </div>
  );
}
