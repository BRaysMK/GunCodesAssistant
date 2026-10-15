import { useCallback, useRef, useState } from "react";
import { catOf, CATEGORY_FALLBACK, type GunCode } from "@/lib/gunCodes";
import { useTheme } from "@/hooks/useTheme";
import { useFilters } from "@/hooks/useFilters";
import { useGunCodes } from "@/hooks/useGunCodes";
import { Sidebar } from "@/components/Sidebar";
import { Toolbar } from "@/components/Toolbar";
import { GunGroup } from "@/components/GunGroup";
import { AddDrawer } from "@/components/AddDrawer";
import { ImportPreview } from "@/components/ImportPreview";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ToastHost, type ToastItem, type ToastKind } from "@/components/Toast";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

/** 复制到剪贴板（带降级方案） */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 降级到 execCommand */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default function App() {
  // ── Toast ──
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const pushToast = useCallback((msg: string, kind: ToastKind = "ok") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  // ── 数据 / 筛选 / 主题 ──
  const data = useGunCodes((msg) => pushToast(msg, "error"));
  const filters = useFilters(data.items);
  const theme = useTheme();

  // ── 本地 UI 状态 ──
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GunCode | null>(null);

  // ── 操作回调 ──
  const handleCopy = useCallback(
    async (code: string) => {
      const ok = await copyText(code);
      pushToast(ok ? "已复制" : "复制失败", ok ? "ok" : "error");
    },
    [pushToast],
  );

  const handleDelete = useCallback(async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    try {
      await data.remove(item.id);
      pushToast("已删除");
    } catch (e) {
      pushToast("删除失败: " + e, "error");
    }
  }, [pendingDelete, data, pushToast]);

  const handleSave = useCallback(
    async (weaponName: string, code: string, note: string) => {
      try {
        await data.add(weaponName, code, note);
        pushToast("已保存");
      } catch (e) {
        pushToast("保存失败: " + e, "error");
        throw e;
      }
    },
    [data, pushToast],
  );

  const handleUpdate = useCallback(
    async (id: string, weaponName: string, code: string, note: string) => {
      try {
        await data.update(id, weaponName, code, note);
        pushToast("已更新");
      } catch (e) {
        pushToast("更新失败: " + e, "error");
        throw e;
      }
    },
    [data, pushToast],
  );

  const handleExport = useCallback(async () => {
    try {
      const n = await data.exportJson();
      if (n !== null) pushToast(`已导出 ${n} 条`);
    } catch (e) {
      pushToast("导出失败: " + e, "error");
    }
  }, [data, pushToast]);

  const handleImportJson = useCallback(async () => {
    try {
      const n = await data.importJson();
      if (n !== null) pushToast(`已导入 ${n} 条`);
    } catch (e) {
      pushToast("导入失败: " + e, "error");
    }
  }, [data, pushToast]);

  const handleRefreshRules = useCallback(async () => {
    try {
      await data.refreshRules();
      pushToast("词库已刷新");
    } catch (e) {
      pushToast("刷新失败: " + e, "error");
    }
  }, [data, pushToast]);

  // ── 渲染 ──
  return (
    <div className="app">
      <Sidebar
        stats={filters.stats}
        meta={data.meta}
        catCounts={filters.catCounts}
        catOrder={filters.catOrder}
        catFilter={filters.catFilter}
        onSelectCat={filters.selectCat}
        onRefreshRules={handleRefreshRules}
        themeMode={theme.mode}
        onSetTheme={theme.setTheme}
      />

      <main className="main">
        <Toolbar
          search={filters.search}
          onSearch={filters.setSearch}
          gunCandidates={filters.gunCandidates}
          gunFilter={filters.gunFilter}
          onToggleGun={filters.toggleGun}
          onSetGuns={filters.setGuns}
          onClearGuns={() => filters.setGuns([])}
          sortKey={filters.sortKey}
          onSort={filters.setSortKey}
          hasActiveFilter={filters.hasActiveFilter}
          onClearFilters={filters.clearFilters}
          onAdd={() => setAddOpen(true)}
          onImportDoc={() => setImportOpen(true)}
          onExport={handleExport}
          onImportJson={handleImportJson}
        />

        <div className="content">
          {data.loading ? (
            <SkeletonList rows={4} />
          ) : filters.filtered.length === 0 ? (
            data.items.length === 0 ? (
              <EmptyState
                variant="empty"
                title="还没有记录"
                hint="点「添加」粘贴一条改枪码，自动识别枪名与配置；也可以「批量导入」整份文档。"
                action={{ label: "添加改枪码", onClick: () => setAddOpen(true), withPlus: true }}
              />
            ) : (
              <EmptyState
                variant="nomatch"
                title="没有匹配的结果"
                hint="当前筛选条件下没有找到记录。"
                action={{ label: "清除筛选", onClick: filters.clearFilters }}
              />
            )
          ) : (
            <div className="gun-groups">
              {filters.grouped.map(([gun, list], i) => (
                <GunGroup
                  key={gun}
                  gun={gun}
                  cat={catLabel(gun)}
                  items={list}
                  collapsed={filters.collapsed.has(gun)}
                  onToggleCollapse={() => filters.toggleCollapse(gun)}
                  query={filters.search}
                  onCopy={handleCopy}
                  onDelete={(it) => setPendingDelete(it)}
                  onUpdate={handleUpdate}
                  staggerIndex={i}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AddDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onRecognize={data.recognize}
        onSave={handleSave}
      />

      <ImportPreview
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onParse={data.preview}
        onConfirm={async (rows) => {
          const res = await data.importRows(rows);
          pushToast(
            `导入完成：新增 ${res.imported}，更新 ${res.updated}，跳过 ${res.skipped}`,
          );
          return res;
        }}
      />

      <ConfirmDelete
        item={pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />

      <ToastHost toasts={toasts} />
    </div>
  );
}

/** 分组头部显示的分类标签；「其他」不显示标签（避免视觉噪音） */
function catLabel(gun: string): string {
  const c = catOf(gun);
  return c === CATEGORY_FALLBACK ? "" : c;
}
