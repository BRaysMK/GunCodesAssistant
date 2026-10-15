import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

// ═══════════════════════ 类型 ═══════════════════════

interface GunCode {
  id: string;
  weapon_name: string;
  code: string;
  note: string;
  created_at: number;
}

/** 后端 recognize_gun_name 的返回（v1.1.0 起含可解释字段） */
interface RecognizeResult {
  weapon_name: string;
  note: string;
  recognized: boolean;
  confidence: number;
  reason: string;
  source: string;
}

/** 后端 preview_import_gun_codes 的单行 */
interface PreviewRow {
  code: string;
  gun: string;
  config: string;
  recognized: boolean;
  confidence: number;
  reason: string;
  source: string;
  duplicate: boolean;
}

interface PreviewResult {
  total: number;
  recognized: number;
  unrecognized: number;
  rows: PreviewRow[];
}

interface RulesMeta {
  version: number;
  generated: string;
  source: string;
  gunCount: number;
  fingerprintCount: number;
  learnedCount: number;
  categories: Record<string, number>;
}

type SortKey = "count" | "name" | "recent";

// ── 枪械类别映射（与后端 rules.json 的 guns[].category 对齐）──
const CATEGORY_MAP: Record<string, string> = {
  "RM277": "步枪", "AR57": "步枪", "MCX": "步枪", "MK47": "步枪", "KC17": "步枪",
  "K437": "步枪", "腾龙": "步枪", "AS Val": "步枪", "CAR-15": "步枪", "PTR-32": "步枪",
  "G3": "步枪", "SCAR-H": "步枪", "AK-12": "步枪", "SG552": "步枪", "M7": "步枪",
  "AUG": "步枪", "M16A4": "步枪", "K416": "步枪", "ASH-12": "步枪", "AKS-74U": "步枪",
  "QBZ-95": "步枪", "AKM": "步枪", "M4A1": "步枪", "MDR": "步枪",
  "QCQ171": "冲锋枪", "MP7": "冲锋枪", "勇士": "冲锋枪", "SR-3M": "冲锋枪", "SMG45": "冲锋枪",
  "野牛": "冲锋枪", "UZI": "冲锋枪", "Vector": "冲锋枪", "P90": "冲锋枪", "MP5": "冲锋枪",
  "MK4": "冲锋枪", "汤姆逊": "冲锋枪", "MP9": "冲锋枪",
  "SVCH": "射手步枪", "M14": "射手步枪", "M700": "射手步枪", "PSG-1": "射手步枪", "SVD": "射手步枪",
  "MINI14": "射手步枪", "VSS": "射手步枪", "SR25": "射手步枪", "R93": "射手步枪", "SV-98": "射手步枪",
  "AWM": "射手步枪", "SKS": "射手步枪", "杠杆步枪": "射手步枪", "巴雷特": "射手步枪", "M82": "射手步枪",
  "M250": "机枪", "PKM": "机枪", "QJB": "机枪", "M249": "机枪",
  "S12K": "霰弹枪", "M1014": "霰弹枪", "725": "霰弹枪", "M870": "霰弹枪", "FS-12": "霰弹枪",
  "DP12": "霰弹枪", "KSG": "霰弹枪",
  "93R": "手枪", "G18": "手枪", "沙鹰": "手枪", "左轮": "手枪", "M1911": "手枪",
  "P226": "手枪", "M9": "手枪",
  "弓": "弓",
};
const CATEGORY_ORDER = ["步枪", "冲锋枪", "射手步枪", "机枪", "霰弹枪", "手枪", "弓"];

// ── 归一化（与后端 normalize() 一致）──
function norm(s: string): string {
  return s.replace(/[\s\-_]/g, "").toUpperCase();
}

/** 常见变体 → 规范枪名（与 rules.json 的 aliases 对齐） */
const ALIAS_TO_CANON: Record<string, string> = {
  AK12: "AK-12", SR3M: "SR-3M", QJB201: "QJB", M16: "M16A4",
  ASVAL: "AS Val", M4: "M4A1", M7A1: "M7", M250A: "M250",
  PKMA: "PKM", M14A: "M14", AKM74: "AKM",
};

function canonicalOf(raw: string): string {
  return ALIAS_TO_CANON[norm(raw)] ?? raw;
}

function catOf(gun: string): string {
  return CATEGORY_MAP[canonicalOf(gun)] ?? "其他";
}

// ── 小工具 ─────────────────────────────
function fmtTime(sec: number): string {
  if (!sec) return "";
  const d = new Date(sec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) { /* fallthrough */ }
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
  } catch (_) {
    return false;
  }
}

// ═══════════════════════ 状态 ═══════════════════════

interface State {
  items: GunCode[];
  loading: boolean;
  search: string;
  catFilter: string;
  gunFilter: string[];      // 多选
  sortKey: SortKey;
  collapsed: Set<string>;
  code: string;
  weapon: string;
  note: string;
  recog: RecognizeResult | null;
  busy: boolean;
  editingId: string | null;
  editWeapon: string;
  editNote: string;
  showImport: boolean;
  importText: string;
  preview: PreviewResult | null;
  deselected: Set<string>;
  importing: boolean;
  confirmDelete: string | null;   // 待删除的 id（应用内确认，不用 window.confirm）
}

type Action =
  | { type: "set"; patch: Partial<State> }
  | { type: "items"; items: GunCode[] }
  | { type: "toggleGun"; gun: string }
  | { type: "toggleCollapse"; gun: string }
  | { type: "toggleDeselect"; code: string }
  | { type: "deselectAll"; codes: string[]; on: boolean };

const initialState: State = {
  items: [],
  loading: true,
  search: "",
  catFilter: "all",
  gunFilter: [],
  sortKey: "count",
  collapsed: new Set(),
  code: "",
  weapon: "",
  note: "",
  recog: null,
  busy: false,
  editingId: null,
  editWeapon: "",
  editNote: "",
  showImport: false,
  importText: "",
  preview: null,
  deselected: new Set(),
  importing: false,
  confirmDelete: null,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "set":
      return { ...s, ...a.patch };
    case "items":
      return { ...s, items: a.items, loading: false };
    case "toggleGun": {
      const next = new Set(s.gunFilter);
      if (next.has(a.gun)) next.delete(a.gun);
      else next.add(a.gun);
      return { ...s, gunFilter: [...next], collapsed: new Set() };
    }
    case "toggleCollapse": {
      const next = new Set(s.collapsed);
      if (next.has(a.gun)) next.delete(a.gun);
      else next.add(a.gun);
      return { ...s, collapsed: next };
    }
    case "toggleDeselect": {
      const next = new Set(s.deselected);
      if (next.has(a.code)) next.delete(a.code);
      else next.add(a.code);
      return { ...s, deselected: next };
    }
    case "deselectAll": {
      const next = new Set(s.deselected);
      for (const c of a.codes) {
        if (a.on) next.add(c);
        else next.delete(c);
      }
      return { ...s, deselected: next };
    }
    default:
      return s;
  }
}

// ═══════════════════════ 主组件 ═══════════════════════

export default function App() {
  const [s, dispatch] = useReducer(reducer, initialState);
  const set = useCallback((patch: Partial<State>) => dispatch({ type: "set", patch }), []);

  const [toast, setToast] = useState("");
  const [meta, setMeta] = useState<RulesMeta | null>(null);
  const recogTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  // ── 加载列表 ──
  const refresh = useCallback(async () => {
    try {
      const items = await invoke<GunCode[]>("get_local_gun_codes");
      dispatch({ type: "items", items });
    } catch (e) {
      showToast("加载失败: " + e);
    }
  }, [showToast]);

  useEffect(() => { void refresh(); }, [refresh]);

  // ── 规则库元信息 ──
  const loadMeta = useCallback(async () => {
    try {
      setMeta(await invoke<RulesMeta>("get_gun_rules_meta"));
    } catch { /* 忽略 */ }
  }, []);
  useEffect(() => { void loadMeta(); }, [loadMeta]);

  // ── 筛选状态持久化（localStorage，无 plugin-store 依赖）──
  const FILTER_KEY = "nexbox_gun_codes_filter";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        set({
          search: v.search ?? "",
          catFilter: v.catFilter ?? "all",
          gunFilter: Array.isArray(v.gunFilter) ? v.gunFilter : [],
          sortKey: v.sortKey ?? "count",
        });
      }
    } catch { /* 忽略 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify({
        search: s.search, catFilter: s.catFilter, gunFilter: s.gunFilter, sortKey: s.sortKey,
      }));
    } catch { /* 忽略 */ }
  }, [s.search, s.catFilter, s.gunFilter, s.sortKey]);

  // ── 过滤 ──
  const filtered = useMemo(() => {
    const q = norm(s.search);
    const gunSet = new Set(s.gunFilter.map(norm));
    return s.items.filter((i) => {
      if (s.catFilter !== "all" && catOf(i.weapon_name) !== s.catFilter) return false;
      if (gunSet.size > 0 && !gunSet.has(norm(canonicalOf(i.weapon_name)))) return false;
      if (!q) return true;
      return (
        norm(i.weapon_name).includes(q) ||
        i.code.toUpperCase().includes(q) ||
        norm(i.note).includes(q)
      );
    });
  }, [s.items, s.search, s.gunFilter, s.catFilter]);

  // ── 失效筛选自愈（枪名 + 分类）──
  useEffect(() => {
    if (s.items.length === 0) return;
    if (s.gunFilter.length > 0) {
      const alive = new Set(s.items.map((i) => norm(canonicalOf(i.weapon_name))));
      const kept = s.gunFilter.filter((g) => alive.has(norm(g)));
      if (kept.length !== s.gunFilter.length) {
        dispatch({ type: "set", patch: { gunFilter: kept } });
        return;
      }
    }
    if (s.catFilter !== "all") {
      const hasAny = s.items.some((i) => catOf(i.weapon_name) === s.catFilter);
      if (!hasAny) dispatch({ type: "set", patch: { catFilter: "all" } });
    }
  }, [s.items, s.gunFilter, s.catFilter]);

  // ── 分组 + 排序 ──
  const grouped = useMemo(() => {
    const g = new Map<string, GunCode[]>();
    for (const it of filtered) {
      const key = canonicalOf(it.weapon_name);
      const arr = g.get(key) ?? [];
      arr.push(it);
      g.set(key, arr);
    }
    const entries = [...g.entries()];
    switch (s.sortKey) {
      case "name":
        entries.sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"));
        break;
      case "recent":
        entries.sort((a, b) =>
          Math.max(...b[1].map((x) => x.created_at)) - Math.max(...a[1].map((x) => x.created_at)));
        break;
      default:
        entries.sort((a, b) => b[1].length - a[1].length);
    }
    return entries;
  }, [filtered, s.sortKey]);

  // ── 枪名候选（受分类筛选影响）──
  const gunCandidates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of s.items) {
      if (s.catFilter !== "all" && catOf(i.weapon_name) !== s.catFilter) continue;
      const gun = canonicalOf(i.weapon_name);
      counts.set(gun, (counts.get(gun) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [s.items, s.catFilter]);

  // ── 分类计数 + 动态顺序（含可见的「其他」）──
  const catCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of s.items) {
      const c = catOf(i.weapon_name);
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return m;
  }, [s.items]);

  const catOrder = useMemo(() => {
    const rest = [...catCounts.keys()].filter((c) => !CATEGORY_ORDER.includes(c) && catCounts.get(c));
    rest.sort((a, b) => (catCounts.get(b) ?? 0) - (catCounts.get(a) ?? 0));
    return [...CATEGORY_ORDER, ...rest].filter((c) => (catCounts.get(c) ?? 0) > 0);
  }, [catCounts]);

  const stats = useMemo(
    () => ({ count: s.items.length, guns: new Set(s.items.map((i) => canonicalOf(i.weapon_name))).size }),
    [s.items],
  );

  // ── 粘贴识别 ──
  const handleCodeChange = useCallback((v: string) => {
    set({ code: v });
    const clean = v.replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length < 6) {
      set({ recog: null, weapon: "", note: "" });
      return;
    }
    if (recogTimer.current) window.clearTimeout(recogTimer.current);
    recogTimer.current = window.setTimeout(async () => {
      try {
        const r = await invoke<RecognizeResult>("recognize_gun_name", { code: v });
        set({ recog: r });
        if (r.recognized) set({ weapon: r.weapon_name, note: r.note || "" });
        else set({ note: "" });
      } catch { /* 忽略 */ }
    }, 250);
  }, [set]);

  // ── 保存 / 删除 / 更新 ──
  const handleSave = async () => {
    if (!s.code.trim()) { showToast("请先粘贴改枪码"); return; }
    set({ busy: true });
    try {
      await invoke("add_local_gun_code", { weaponName: s.weapon, code: s.code, note: s.note });
      showToast("已保存 ✓");
      set({ code: "", weapon: "", note: "", recog: null });
      await refresh();
      void loadMeta();
    } catch (e) {
      showToast("保存失败: " + e);
    }
    set({ busy: false });
  };

  const doDelete = async () => {
    const id = s.confirmDelete;
    set({ confirmDelete: null });
    if (!id) return;
    try {
      await invoke("delete_local_gun_code", { id });
      showToast("已删除");
      await refresh();
    } catch (e) {
      showToast("删除失败: " + e);
    }
  };

  const handleUpdate = async (id: string) => {
    const item = s.items.find((i) => i.id === id);
    if (!item) return;
    try {
      await invoke("update_local_gun_code", {
        id, weaponName: s.editWeapon || item.weapon_name, code: item.code, note: s.editNote,
      });
      set({ editingId: null });
      showToast("已更新 ✓");
      await refresh();
      void loadMeta();
    } catch (e) {
      showToast("更新失败: " + e);
    }
  };

  // ── 导入预览流 ──
  const doPreview = async () => {
    if (!s.importText.trim()) { showToast("请先粘贴文档内容"); return; }
    set({ importing: true });
    try {
      const p = await invoke<PreviewResult>("preview_import_gun_codes", { text: s.importText });
      set({ preview: p, deselected: new Set() });
    } catch (e) {
      showToast("解析失败: " + e);
    }
    set({ importing: false });
  };

  const doConfirmImport = async () => {
    if (!s.preview) return;
    const rows = s.preview.rows.filter((r) => !s.deselected.has(r.code) && !r.duplicate);
    if (rows.length === 0) { showToast("没有可导入的条目"); return; }
    set({ importing: true });
    try {
      const text = rows.map((r) => [r.gun, r.config, r.code].join("\t")).join("\n");
      const res = await invoke<{ imported: number; updated: number; skipped: number }>(
        "import_gun_codes_batch", { text },
      );
      showToast(`导入完成：新增 ${res.imported}，更新 ${res.updated}，跳过 ${res.skipped}`);
      set({ showImport: false, importText: "", preview: null, deselected: new Set() });
      await refresh();
      void loadMeta();
    } catch (e) {
      showToast("导入失败: " + e);
    }
    set({ importing: false });
  };

  const handleExport = async () => {
    try {
      const path = await save({
        defaultPath: `改枪码备份_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const n = await invoke<number>("export_gun_codes", { path });
      showToast(`已导出 ${n} 条`);
    } catch (e) {
      showToast("导出失败: " + e);
    }
  };

  const handleImportJson = async () => {
    try {
      const path = await open({ filters: [{ name: "JSON", extensions: ["json"] }], multiple: false });
      if (!path) return;
      const n = await invoke<number>("import_gun_codes", { path: String(path) });
      showToast(`已导入 ${n} 条`);
      await refresh();
      void loadMeta();
    } catch (e) {
      showToast("导入失败: " + e);
    }
  };

  const previewStats = useMemo(() => {
    if (!s.preview) return { sel: 0, dup: 0, unrecog: 0 };
    let sel = 0, dup = 0, unrecog = 0;
    for (const r of s.preview.rows) {
      if (r.duplicate) dup++;
      else if (!s.deselected.has(r.code)) {
        sel++;
        if (!r.recognized) unrecog++;
      }
    }
    return { sel, dup, unrecog };
  }, [s.preview, s.deselected]);

  const [gunQuery, setGunQuery] = useState("");
  const [gunPanelOpen, setGunPanelOpen] = useState(false);
  const selSet = new Set(s.gunFilter.map(norm));
  const shownGuns = gunCandidates.filter(([g]) => !gunQuery || norm(g).includes(norm(gunQuery)));

  // ═══════════════ 渲染 ═══════════════
  return (
    <div className="app">
      <header className="header">
        <div className="logo">⌖</div>
        <div>
          <h1>三角洲本地改枪码记事本</h1>
          <p className="sub">
            三角洲行动 · 本地改枪码库 · 粘贴自动识别
            {meta && <> · 词库 v{meta.version}（{meta.gunCount} 枪 / {meta.fingerprintCount} 指纹）</>}
          </p>
        </div>
        <div className="stats">
          <span className="stat"><b>{stats.count}</b> 条记录</span>
          <span className="stat"><b>{stats.guns}</b> 把枪</span>
          <button
            className="btn small ghost"
            title="重新读取词库文件（rules.json 可热更）"
            onClick={async () => {
              try {
                await invoke("refresh_gun_rules");
                await loadMeta();
                showToast("词库已刷新");
              } catch (e) { showToast("刷新失败: " + e); }
            }}
          >刷新词库</button>
        </div>
      </header>

      {/* 输入区 */}
      <section className="panel input-panel">
        <h2>添加改枪码</h2>
        <div className="row">
          <div className="field grow">
            <label>改枪码（粘贴后自动识别枪名）</label>
            <textarea
              value={s.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="例如 6KFCC1K08QMG6NRUK6UQC"
              rows={2}
            />
            {s.recog && (
              <div className={"recog " + (s.recog.recognized ? "ok" : "unknown")}>
                {s.recog.recognized ? (
                  <>
                    已识别：<b>{s.recog.weapon_name}</b>
                    {s.recog.confidence > 0 && (
                      <span className="note"> · 置信度 {Math.round(s.recog.confidence * 100)}%</span>
                    )}
                    {s.recog.reason && <span className="note"> · {s.recog.reason}</span>}
                  </>
                ) : (
                  <>未识别出枪名，可手动输入后保存（保存后会学习该指纹）</>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>枪名</label>
            <input value={s.weapon} onChange={(e) => set({ weapon: e.target.value })} placeholder="枪名" />
          </div>
          <div className="field grow">
            <label>备注</label>
            <input value={s.note} onChange={(e) => set({ note: e.target.value })} placeholder="例如 20W青春版 / 55W满改红点" />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={handleSave} disabled={s.busy}>
            {s.busy ? "保存中…" : "保存"}
          </button>
          <button className="btn ghost" onClick={() => set({ showImport: true, importText: "", preview: null })}>
            批量导入（粘贴文档）
          </button>
          <button className="btn ghost" onClick={handleExport}>导出 JSON 备份</button>
          <button className="btn ghost" onClick={handleImportJson}>导入 JSON 备份</button>
        </div>
      </section>

      {/* 批量导入弹窗（预览流） */}
      {s.showImport && (
        <div className="modal-mask" onClick={() => set({ showImport: false, preview: null })}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h2>批量导入改枪码</h2>
            {!s.preview ? (
              <>
                <p className="modal-hint">
                  从在线文档/表格复制整块内容粘贴到下面（支持制表符分隔的表格）。
                  <b>解析后先预览，确认无误再入库。</b>
                  <br />仅收录「烽火地带」模式的改枪码；全面战场 / 黑潮爆破会按分区标题自动跳过。
                </p>
                <textarea
                  className="import-area"
                  value={s.importText}
                  onChange={(e) => set({ importText: e.target.value })}
                  placeholder={"例如：\nRM277 20W青春版 6KFCC1K08QMG6NRUK6UQC\nMK47突击步枪-烽火地带-6HN54R808PBNCS3LFEE0A"}
                  rows={12}
                />
                <div className="btn-row">
                  <button className="btn primary" onClick={doPreview} disabled={s.importing}>
                    {s.importing ? "解析中…" : "解析并预览"}
                  </button>
                  <button className="btn ghost" onClick={() => set({ showImport: false, preview: null })}>取消</button>
                </div>
              </>
            ) : (
              <>
                <div className="preview-stats">
                  <span className="pill">共 {s.preview.total} 条</span>
                  <span className="pill ok-pill">已识别 {s.preview.recognized}</span>
                  {s.preview.unrecognized > 0 && (
                    <span className="pill warn-pill">未识别 {s.preview.unrecognized}</span>
                  )}
                  {previewStats.dup > 0 && <span className="pill">重复 {previewStats.dup}</span>}
                  <span className="note">将导入 <b>{previewStats.sel}</b> 条</span>
                </div>
                {s.preview.unrecognized > 0 && (
                  <p className="modal-hint warn-text">
                    ⚠ 未识别的条目会以「未知枪械」导入，可稍后手动修正（修正后会自动学习）
                  </p>
                )}
                <div className="btn-row" style={{ marginBottom: 8 }}>
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      const importable = s.preview!.rows.filter((r) => !r.duplicate);
                      const allOn = importable.every((r) => !s.deselected.has(r.code));
                      dispatch({ type: "deselectAll", codes: importable.map((r) => r.code), on: !allOn });
                    }}
                  >全选 / 取消全选</button>
                </div>
                <div className="preview-list">
                  {s.preview.rows.map((r) => {
                    const off = r.duplicate || s.deselected.has(r.code);
                    return (
                      <label className={"preview-row" + (off ? " off" : "")} key={r.code}>
                        <input
                          type="checkbox"
                          checked={!off}
                          disabled={r.duplicate}
                          onChange={() => dispatch({ type: "toggleDeselect", code: r.code })}
                        />
                        <div className="preview-info">
                          <div className="preview-line">
                            <b>{r.recognized ? r.gun : "未知枪械"}</b>
                            {r.config && <span className="note"> · {r.config}</span>}
                            {r.duplicate && <span className="tag">已存在</span>}
                            {!r.recognized && <span className="tag warn">未识别</span>}
                          </div>
                          <code className="preview-code">{r.code}</code>
                          <div className="note">{r.reason}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="btn-row">
                  <button
                    className="btn primary"
                    onClick={doConfirmImport}
                    disabled={s.importing || previewStats.sel === 0}
                  >
                    {s.importing
                      ? "导入中…"
                      : `确认导入（${previewStats.sel}）${previewStats.unrecog > 0 ? ` · ${previewStats.unrecog} 条未识别` : ""}`}
                  </button>
                  <button className="btn ghost" onClick={() => set({ preview: null })}>返回重贴</button>
                  <button className="btn ghost" onClick={() => set({ showImport: false, preview: null })}>取消</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 删除确认（应用内，替代 window.confirm） */}
      {s.confirmDelete && (
        <div className="modal-mask" onClick={() => set({ confirmDelete: null })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>删除改枪码</h2>
            <p className="modal-hint">确定删除这条改枪码？此操作不可撤销。</p>
            <code className="preview-code">
              {s.items.find((i) => i.id === s.confirmDelete)?.weapon_name} ·{" "}
              {s.items.find((i) => i.id === s.confirmDelete)?.code}
            </code>
            <div className="btn-row">
              <button className="btn danger" onClick={doDelete}>删除</button>
              <button className="btn ghost" onClick={() => set({ confirmDelete: null })}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 列表区 */}
      <section className="panel list-panel">
        <div className="list-head">
          <h2>我的改枪码库</h2>
          <input
            className="search"
            value={s.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="搜索 枪名 / 代码 / 备注…"
          />
        </div>

        {/* 分类筛选（「其他」可见） */}
        <div className="cat-pills">
          <button
            className={"pill" + (s.catFilter === "all" ? " active" : "")}
            onClick={() => set({ catFilter: "all", gunFilter: [] })}
          >
            全部类别（{s.items.length}）
          </button>
          {catOrder.map((cat) => (
            <button
              key={cat}
              className={"pill" + (s.catFilter === cat ? " active" : "")}
              onClick={() => set({ catFilter: cat, gunFilter: [], collapsed: new Set() })}
            >
              {cat}（{catCounts.get(cat) ?? 0}）
            </button>
          ))}
        </div>

        {/* 枪名筛选（可搜索多选）+ 排序 */}
        <div className="gun-pills">
          <div className="gun-filter-wrap">
            <button
              className={"pill" + (s.gunFilter.length ? " active" : "")}
              onClick={() => setGunPanelOpen((v) => !v)}
            >
              枪名 {s.gunFilter.length ? `（${s.gunFilter.length}）` : ""} ▾
            </button>
            {gunPanelOpen && (
              <div className="gun-pop">
                <input
                  className="search"
                  value={gunQuery}
                  onChange={(e) => setGunQuery(e.target.value)}
                  placeholder="搜索枪名"
                  autoFocus
                />
                <div className="gun-pop-actions">
                  <button className="btn small ghost" onClick={() => {
                    for (const [g] of shownGuns) if (!selSet.has(norm(g))) dispatch({ type: "toggleGun", gun: g });
                  }}>全选</button>
                  <button className="btn small ghost" onClick={() => set({ gunFilter: [] })}>清空</button>
                </div>
                <div className="gun-pop-list">
                  {shownGuns.length === 0 ? (
                    <div className="empty small">无匹配枪名</div>
                  ) : shownGuns.map(([g, n]) => (
                    <label className="gun-pop-row" key={g}>
                      <input
                        type="checkbox"
                        checked={selSet.has(norm(g))}
                        onChange={() => dispatch({ type: "toggleGun", gun: g })}
                      />
                      <span className="gun-pop-name">{g}</span>
                      <span className="note">{n}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <select
            className="sort-select"
            value={s.sortKey}
            onChange={(e) => set({ sortKey: e.target.value as SortKey })}
          >
            <option value="count">按条数</option>
            <option value="name">按名称</option>
            <option value="recent">按最近</option>
          </select>

          {(s.gunFilter.length > 0 || s.catFilter !== "all" || s.search) && (
            <button
              className="btn small ghost"
              onClick={() => set({ search: "", catFilter: "all", gunFilter: [], collapsed: new Set() })}
            >清除筛选</button>
          )}
        </div>

        {s.loading ? (
          <div className="empty">加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            {s.items.length === 0 ? "还没有记录，粘贴一条改枪码开始吧" : "没有匹配的结果"}
          </div>
        ) : (
          <div className="gun-groups">
            {grouped.map(([gun, gunItems]) => {
              const isCollapsed = s.collapsed.has(gun);
              return (
                <div className="gun-group" key={gun}>
                  <div
                    className="gun-group-head"
                    onClick={() => dispatch({ type: "toggleCollapse", gun })}
                  >
                    <span className="gg-arrow">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="gg-name">{gun}</span>
                    <span className="gg-cat">{catOf(gun) === "其他" ? "" : catOf(gun)}</span>
                    <span className="gg-count">{gunItems.length} 条配置</span>
                  </div>
                  {!isCollapsed && (
                    <div className="gg-items">
                      {gunItems.map((item) => (
                        <div className="card gg-card" key={item.id}>
                          {s.editingId === item.id ? (
                            <div className="card-edit">
                              <input value={s.editWeapon} onChange={(e) => set({ editWeapon: e.target.value })} placeholder="枪名" />
                              <input value={s.editNote} onChange={(e) => set({ editNote: e.target.value })} placeholder="备注" />
                              <div className="card-actions">
                                <button className="btn small" onClick={() => handleUpdate(item.id)}>保存修改</button>
                                <button className="btn small ghost" onClick={() => set({ editingId: null })}>取消</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="card-top">
                                <span className="gg-item-note">{item.note || "无备注"}</span>
                                <span className="time">{fmtTime(item.created_at)}</span>
                              </div>
                              <code className="guncode">{item.code}</code>
                              <div className="card-actions">
                                <button className="btn small" onClick={async () => {
                                  if (await copyText(item.code)) showToast("已复制 ✓");
                                  else showToast("复制失败");
                                }}>复制</button>
                                <button className="btn small ghost" onClick={() => {
                                  set({ editingId: item.id, editWeapon: item.weapon_name, editNote: item.note });
                                }}>编辑</button>
                                <button className="btn small danger" onClick={() => set({ confirmDelete: item.id })}>删除</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
