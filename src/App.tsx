import { useCallback, useMemo, useState } from "react";
import {
  Button, FluentProvider, OverlayDrawer, DrawerBody, Skeleton, SkeletonItem,
  Toaster, Toast, ToastBody, ToastTitle, ToastTrigger,
  makeStyles, tokens, useId, useToastController,
} from "@fluentui/react-components";
import type { ToastIntent } from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import type { GunCode } from "@/lib/gunCodes";
import { copyText } from "@/lib/clipboard";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useFilters } from "@/hooks/useFilters";
import { useGunCodes } from "@/hooks/useGunCodes";
import { AppHeader } from "@/components/AppHeader";
import { NavTilePane } from "@/components/NavTilePane";
import { StatusBar } from "@/components/StatusBar";
import { GunDataGrid } from "@/components/GunDataGrid";
import { GunTreeView } from "@/components/GunTreeView";
import { GunCodeEditor } from "@/components/GunCodeEditor";
import { ImportDialog } from "@/components/ImportDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RulesManagerDialog } from "@/components/RulesManagerDialog";
import { AppContextMenu } from "@/components/AppContextMenu";
import { SelectionBar } from "@/components/SelectionBar";
import { EmptyState } from "@/components/EmptyState";

const useStyles = makeStyles({
  provider: { height: "100%" },
  /**
   * 应用外壳：三行（顶栏 / 主区 / 状态栏）。
   *
   * ⚠️ 这里用内联 style 承载 grid 模板，而不是 className ——
   * FluentProvider 的 `applyStylesToPortals` 会把 className 复制到每个 portal
   * 挂载节点（那些节点是不透明的全屏层），曾导致 22 个 Tooltip 把界面盖没。
   * 详见 README「两个务必注意的 FluentUI 坑」。
   */
  shell: {
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    height: "100%",
    overflow: "hidden",
    /** 画布：三层表面里最暗的一层，衬托内容卡片 */
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
  },
  /** 主区两栏：磁贴导航 + 内容 */
  body: {
    display: "grid",
    minHeight: 0,
    overflow: "hidden",
  },
  content: {
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
  scroller: {
    overflowY: "auto",
    overflowX: "hidden",
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    minHeight: 0,
  },
  skeletonWrap: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXL,
  },
  skeletonCard: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
  },
  navDrawerBody: { padding: 0 },
});

export default function App() {
  const styles = useStyles();

  // ── Toast：交给 Fluent 的 Toaster 统一托管（不再自建 toast 数组与定时器）──
  const toasterId = useId("gca-toaster");
  const { dispatchToast } = useToastController(toasterId);
  const notify = useCallback(
    (title: string, intent: ToastIntent = "success", body?: string) => {
      dispatchToast(
        <Toast>
          <ToastTitle
            action={
              <ToastTrigger>
                <Button
                  appearance="transparent"
                  size="small"
                  icon={<DismissRegular />}
                  aria-label="关闭通知"
                />
              </ToastTrigger>
            }
          >
            {title}
          </ToastTitle>
          {body ? <ToastBody>{body}</ToastBody> : null}
        </Toast>,
        { intent, timeout: intent === "error" ? 6000 : 2800, position: "bottom-end" },
      );
    },
    [dispatchToast],
  );

  // ── 数据 / 筛选 / 主题 ──
  const data = useGunCodes((msg) => notify(msg, "error"));
  const filters = useFilters(data.items);
  const theme = useThemeMode();
  /**
   * 断点按**窗口最小宽度**定，不按「看起来窄不窄」定。
   *
   * tauri.conf.json 的窗口是 1080×760、minWidth 900。早期把浮层断点设在 1100px，
   * 结果**应用自己的默认尺寸就把磁贴面板收起来了**（1080 < 1100），
   * 打开应用看到的是一栏布局 —— 已在真机截图上抓到。
   * 现在：<980px 才收为浮层（低于默认窗口，只有用户手动缩小才会触发），
   * <1240px 用较窄的导航栏，保证默认 1080px 下表格仍有足够宽度。
   */
  const narrow = useMediaQuery("(max-width: 980px)");
  const narrowNavWidth = useMediaQuery("(max-width: 1240px)");

  // ── 本地 UI 状态 ──
  const [navOpen, setNavOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<GunCode | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GunCode | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  // v1.7.0：一键删除（筛选结果 / 全部）
  const [deleteFilteredOpen, setDeleteFilteredOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── 选中集剪枝 ──
  // 列表变化后（增删改、筛选切换）把已不在当前结果里的 id 丢弃，
  // 否则「删除选中」会误删用户此刻根本看不见的行。
  const visibleIds = useMemo(() => new Set(filters.filtered.map((i) => i.id)), [filters.filtered]);
  const effectiveSelected = useMemo(() => {
    const kept = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) kept.add(id);
    return kept;
  }, [selectedIds, visibleIds]);

  const selectedItems = useMemo(
    () => filters.filtered.filter((i) => effectiveSelected.has(i.id)),
    [filters.filtered, effectiveSelected],
  );

  // ── 操作回调 ──
  const handleCopy = useCallback(
    async (code: string) => {
      const ok = await copyText(code);
      notify(ok ? "已复制改枪码" : "复制失败", ok ? "success" : "error", ok ? undefined : code);
    },
    [notify],
  );

  const handleCopySelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    const text = selectedItems.map((i) => i.code).join("\n");
    const ok = await copyText(text);
    notify(
      ok ? `已复制 ${selectedItems.length} 条改枪码` : "复制失败",
      ok ? "success" : "error",
      ok ? undefined : text,
    );
  }, [selectedItems, notify]);

  const handleDeleteOne = useCallback(async () => {
    const item = pendingDelete;
    setPendingDelete(null);
    if (!item) return;
    try {
      await data.remove(item.id);
      notify("已删除 1 条");
    } catch (e) {
      notify("删除失败", "error", String(e));
    }
  }, [pendingDelete, data, notify]);

  const handleDeleteSelected = useCallback(async () => {
    setBulkDeleteOpen(false);
    const ids = selectedItems.map((i) => i.id);
    if (ids.length === 0) return;
    try {
      const n = await data.removeMany(ids);
      setSelectedIds(new Set());
      notify(`已删除 ${n} 条`);
    } catch (e) {
      setSelectedIds(new Set());
      notify("批量删除未全部完成", "error", String(e));
    }
  }, [selectedItems, data, notify]);

  // ── v1.7.0：一键删除（筛选结果 / 全部）──

  /** 删除当前筛选出的全部条目 */
  const handleDeleteFiltered = useCallback(async () => {
    setDeleteFilteredOpen(false);
    const ids = filters.filtered.map((i) => i.id);
    if (ids.length === 0) return;
    try {
      const n = await data.removeMany(ids);
      setSelectedIds(new Set());
      notify(`已删除 ${n} 条（当前筛选结果）`);
    } catch (e) {
      notify("删除未全部完成", "error", String(e));
    }
  }, [filters.filtered, data, notify]);

  /** 清空全部改枪码 */
  const handleClearAll = useCallback(async () => {
    setClearAllOpen(false);
    try {
      const r = await data.clearAll();
      setSelectedIds(new Set());
      notify(r.deleted > 0 ? `已清空全部 ${r.deleted} 条改枪码` : "没有可删除的记录");
    } catch (e) {
      notify("清空失败", "error", String(e));
    }
  }, [data, notify]);

  const handleSave = useCallback(
    async (weaponName: string, code: string, note: string) => {
      try {
        await data.add(weaponName, code, note);
        notify("已保存");
      } catch (e) {
        notify("保存失败", "error", String(e));
        throw e;
      }
    },
    [data, notify],
  );

  const handleUpdate = useCallback(
    async (id: string, weaponName: string, code: string, note: string) => {
      try {
        await data.update(id, weaponName, code, note);
        notify("已更新");
      } catch (e) {
        notify("更新失败", "error", String(e));
        throw e;
      }
    },
    [data, notify],
  );

  const handleExport = useCallback(async () => {
    try {
      const n = await data.exportJson();
      if (n !== null) notify(`已导出 ${n} 条到备份文件`);
    } catch (e) {
      notify("导出失败", "error", String(e));
    }
  }, [data, notify]);

  const handleImportJson = useCallback(async () => {
    try {
      const n = await data.importJson();
      if (n !== null) notify(`已合并导入 ${n} 条`);
    } catch (e) {
      notify("导入失败", "error", String(e));
    }
  }, [data, notify]);

  // ── 词库管理（在线更新 + 学习表纠错）──
  const handleNotify = useCallback(
    (msg: string, kind: "success" | "error" | "warning" = "success") => {
      notify(msg, kind);
    },
    [notify],
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((item: GunCode) => {
    setEditing(item);
    setEditorOpen(true);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── 渲染 ──
  /** 窄窗时磁贴面板收为浮层；宽窗常驻，窗口偏窄时用较窄的一档 */
  const wide = !narrow;
  const navWidth = narrowNavWidth ? 260 : 320;

  const navPane = (
    <NavTilePane
      items={data.items}
      filteredItems={filters.filtered}
      catCounts={filters.catCounts}
      catOrder={filters.catOrder}
      catFilter={filters.catFilter}
      gunFilter={filters.gunFilter}
      query={filters.search}
      onSelectCat={filters.selectCat}
      onSelectGun={filters.toggleTileGun}
      onClearGunFilter={() => filters.setGuns([])}
      dismissible={!wide}
      onDismiss={() => setNavOpen(false)}
      meta={data.meta}
      onOpenRulesManager={() => setRulesOpen(true)}
    />
  );

  return (
    <FluentProvider theme={theme.theme} style={{ height: "100%" }}>
      <div className={styles.shell}>
        <AppHeader
          search={filters.search}
          onSearch={filters.setSearch}
          sortKey={filters.sortKey}
          onSort={filters.setSortKey}
          viewMode={filters.viewMode}
          onViewMode={filters.setViewMode}
          onAdd={openAdd}
          onImportDoc={() => setImportOpen(true)}
          onExport={handleExport}
          onImportJson={handleImportJson}
          onOpenRulesManager={() => setRulesOpen(true)}
          onDeleteFiltered={() => setDeleteFilteredOpen(true)}
          onClearAll={() => setClearAllOpen(true)}
          filteredCount={filters.filtered.length}
          hasFilter={filters.filtered.length !== data.items.length}
          themeMode={theme.mode}
          onToggleTheme={theme.toggle}
          hasActiveFilter={filters.hasActiveFilter}
          onClearFilters={filters.clearFilters}
          narrow={narrow}
          onToggleNav={() => setNavOpen(true)}
        />

        <div
          className={styles.body}
          style={{ gridTemplateColumns: wide ? `${navWidth}px minmax(0, 1fr)` : "minmax(0, 1fr)" }}
        >
          {wide && navPane}

          <div className={styles.content}>
            <SelectionBar
              count={effectiveSelected.size}
              onCopyAll={handleCopySelected}
              onDeleteAll={() => setBulkDeleteOpen(true)}
              onClear={() => setSelectedIds(new Set())}
            />

            <div className={styles.scroller}>
              {data.loading ? (
                <div className={styles.skeletonWrap} aria-busy="true" aria-label="正在加载本地数据">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div className={styles.skeletonCard} key={i}>
                      <Skeleton>
                        <SkeletonItem size={24} style={{ width: "30%" }} />
                      </Skeleton>
                      <Skeleton>
                        <SkeletonItem size={16} />
                        <SkeletonItem size={16} style={{ width: "80%" }} />
                        <SkeletonItem size={16} style={{ width: "60%" }} />
                      </Skeleton>
                    </div>
                  ))}
                </div>
              ) : filters.filtered.length === 0 ? (
                data.items.length === 0 ? (
                  <EmptyState
                    variant="empty"
                    onPrimary={openAdd}
                    onSecondary={() => setImportOpen(true)}
                  />
                ) : (
                  <EmptyState variant="nomatch" onPrimary={filters.clearFilters} />
                )
              ) : filters.viewMode === "table" ? (
                <GunDataGrid
                  rows={filters.rows}
                  query={filters.search}
                  selectedIds={effectiveSelected}
                  onSelectionChange={setSelectedIds}
                  onCopy={handleCopy}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              ) : (
                <GunTreeView
                  grouped={filters.grouped}
                  query={filters.search}
                  collapsed={filters.collapsed}
                  onToggleCollapse={filters.toggleCollapse}
                  selectedIds={effectiveSelected}
                  onToggleSelect={toggleSelect}
                  onCopy={handleCopy}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              )}
            </div>
          </div>
        </div>

        <StatusBar
          total={data.items.length}
          shown={filters.filtered.length}
          guns={filters.stats.guns}
          meta={data.meta}
          hasActiveFilter={filters.hasActiveFilter}
          filterSummary={filters.filterSummary}
        />
      </div>

      {/* 窄窗：磁贴导航收进浮层抽屉，由顶栏汉堡按钮唤起 */}
      {!wide && (
        <OverlayDrawer
          open={navOpen}
          onOpenChange={(_e, d) => setNavOpen(d.open)}
          position="start"
          size="small"
          modalType="modal"
          aria-label="枪械库导航"
        >
          <DrawerBody className={styles.navDrawerBody}>{navPane}</DrawerBody>
        </OverlayDrawer>
      )}

      <GunCodeEditor
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onRecognize={data.recognize}
        onSave={handleSave}
        onUpdate={handleUpdate}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onParse={data.preview}
        onConfirm={async (rows) => {
          const res = await data.importRows(rows);
          notify(
            `导入完成：新增 ${res.imported} · 更新 ${res.updated} · 跳过 ${res.skipped}`,
            "success",
          );
          return res;
        }}
      />

      <RulesManagerDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        meta={data.meta}
        onCheckUpdate={data.checkRulesUpdate}
        onApplyUpdate={data.updateRules}
        onResetRules={data.resetRules}
        onListLearned={data.listLearned}
        onDeleteLearned={data.deleteLearned}
        onClearLearned={data.clearLearned}
        onClearNotes={data.clearLearnedNotes}
        onNotify={handleNotify}
        onListRules={data.listRuleFingerprints}
        onDeleteRule={data.deleteRuleFingerprint}
        onUpdateRule={data.updateRuleFingerprint}
        onClearOnlineRules={data.clearOnlineRules}
        onClearRuleOverrides={data.clearRuleOverrides}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条改枪码？"
        message="此操作不可撤销。"
        details={
          pendingDelete
            ? [
                `${pendingDelete.weapon_name} · ${pendingDelete.note || "无备注"}`,
                pendingDelete.code,
              ]
            : []
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDeleteOne}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`删除选中的 ${selectedItems.length} 条改枪码？`}
        message="此操作不可撤销，且会一次性移除多条记录。"
        confirmLabel={`删除 ${selectedItems.length} 条`}
        details={selectedItems.map(
          (i) => `${i.weapon_name} · ${i.note || "无备注"} · ${i.code}`,
        )}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleDeleteSelected}
      />

      {/* v1.7.0：删除当前筛选结果 */}
      <ConfirmDialog
        open={deleteFilteredOpen}
        title={`删除当前筛选结果的 ${filters.filtered.length} 条改枪码？`}
        message="只删除当前筛选出的条目，其它记录不受影响。此操作不可撤销。"
        confirmLabel={`删除 ${filters.filtered.length} 条`}
        details={filters.filtered.slice(0, 8).map(
          (i) => `${i.weapon_name} · ${i.note || "无备注"} · ${i.code}`,
        )}
        onCancel={() => setDeleteFilteredOpen(false)}
        onConfirm={handleDeleteFiltered}
      />

      {/* v1.7.0：清空全部 */}
      <ConfirmDialog
        open={clearAllOpen}
        title={`清空全部 ${data.items.length} 条改枪码？`}
        message={
          <>
            这会删除<b>所有</b>改枪码记录，且不可撤销。
            <br />
            学习表与词库<b>不受影响</b>，但记录本身无法找回 —— 建议先「导出 JSON 备份」。
          </>
        }
        confirmLabel={`清空全部 ${data.items.length} 条`}
        onCancel={() => setClearAllOpen(false)}
        onConfirm={handleClearAll}
      />

      {/* 应用内右键菜单：替代 WebView2 的「刷新/另存为/打印」 */}
      <AppContextMenu />

      <Toaster toasterId={toasterId} position="bottom-end" />
    </FluentProvider>
  );
}
