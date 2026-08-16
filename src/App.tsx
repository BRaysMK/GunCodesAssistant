import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

interface GunCode {
  id: string;
  weapon_name: string;
  code: string;
  note: string;
  created_at: number;
}

interface ImportResult {
  weapon_name: string;
  note: string;
  recognized: boolean;
}

// ── 枪械类别映射 ──
const CATEGORY_MAP: Record<string, string> = {
  // 步枪
  "RM277": "步枪", "AR57": "步枪", "MCX": "步枪", "MK47": "步枪", "KC17": "步枪",
  "K437": "步枪", "腾龙": "步枪", "AS Val": "步枪", "CAR-15": "步枪", "PTR-32": "步枪",
  "G3": "步枪", "SCAR-H": "步枪", "AK-12": "步枪", "SG552": "步枪", "M7": "步枪",
  "AUG": "步枪", "M16A4": "步枪", "K416": "步枪", "ASH-12": "步枪", "AKS-74U": "步枪",
  "QBZ-95": "步枪", "AKM": "步枪", "M4A1": "步枪",
  // 冲锋枪
  "QCQ171": "冲锋枪", "MP7": "冲锋枪", "勇士": "冲锋枪", "SR-3M": "冲锋枪", "SMG45": "冲锋枪",
  "野牛": "冲锋枪", "UZI": "冲锋枪", "Vector": "冲锋枪", "P90": "冲锋枪", "MP5": "冲锋枪", "MK4": "冲锋枪",
  // 射手步枪 / 狙击
  "SVCH": "射手步枪", "M14": "射手步枪", "M700": "射手步枪", "PSG-1": "射手步枪", "SVD": "射手步枪",
  "MINI14": "射手步枪", "VSS": "射手步枪", "SR25": "射手步枪", "R93": "射手步枪", "SV-98": "射手步枪",
  "AWM": "射手步枪", "SKS": "射手步枪", "杠杆步枪": "射手步枪", "巴雷特": "射手步枪",
  // 机枪
  "M250": "机枪", "PKM": "机枪", "QJB": "机枪", "M249": "机枪",
  // 霰弹枪
  "S12K": "霰弹枪", "M1014": "霰弹枪", "725": "霰弹枪", "M870": "霰弹枪", "FS-12": "霰弹枪",
  // 手枪
  "93R": "手枪", "G18": "手枪", "沙鹰": "手枪", "左轮": "手枪", "M1911": "手枪",
  // 弓
  "弓": "弓",
};
const CATEGORY_ORDER = ["步枪", "冲锋枪", "射手步枪", "机枪", "霰弹枪", "手枪", "弓"];

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

// ── 主组件 ─────────────────────────────
export default function App() {
  const [items, setItems] = useState<GunCode[]>([]);
  const [search, setSearch] = useState("");
  const [gunFilter, setGunFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [code, setCode] = useState("");
  const [weapon, setWeapon] = useState("");
  const [note, setNote] = useState("");
  const [recog, setRecog] = useState<ImportResult | null>(null);
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeapon, setEditWeapon] = useState("");
  const [editNote, setEditNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const recogTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string, type?: "error") => {
    setToast(type === "error" ? "⚠ " + msg : msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<GunCode[]>("get_local_gun_codes");
      setItems(list);
    } catch (e) {
      showToast("加载失败: " + e);
    }
  }, [showToast]);

  useEffect(() => { refresh(); }, [refresh]);

  // 粘贴/输入代码时自动识别枪名
  const handleCodeChange = useCallback((v: string) => {
    setCode(v);
    const clean = v.replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length >= 6) {
      if (recogTimer.current) window.clearTimeout(recogTimer.current);
      recogTimer.current = window.setTimeout(async () => {
        try {
          const r = await invoke<ImportResult>("recognize_gun_name", { code: v });
          setRecog(r);
          if (r.recognized) {
            setWeapon(r.weapon_name);
            setNote(r.note || "");
          } else {
            setNote("");
          }
        } catch (_) { /* ignore */ }
      }, 300);
    } else {
      setRecog(null);
      setWeapon("");
      setNote("");
    }
  }, []);

  const handleSave = async () => {
    if (!code.trim()) { showToast("请先粘贴改枪码"); return; }
    setBusy(true);
    try {
      await invoke("add_local_gun_code", { weaponName: weapon, code, note });
      showToast("已保存 ✓");
      setCode(""); setWeapon(""); setNote(""); setRecog(null);
      await refresh();
    } catch (e) {
      showToast("保存失败: " + e);
    }
    setBusy(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("确定删除这条改枪码？")) return;
    try {
      await invoke("delete_local_gun_code", { id });
      showToast("已删除");
      await refresh();
    } catch (e) { showToast("删除失败: " + e); }
  };

  const handleUpdate = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    try {
      await invoke("update_local_gun_code", {
        id, weaponName: editWeapon || item.weapon_name, code: item.code, note: editNote,
      });
      setEditingId(null);
      showToast("已更新 ✓");
      await refresh();
    } catch (e) { showToast("更新失败: " + e); }
  };

  const handleBatchImport = async () => {
    if (!importText.trim()) { showToast("请先粘贴文档内容"); return; }
    setImporting(true);
    try {
      const res = await invoke<{ imported: number; skipped: number }>("import_gun_codes_batch", { text: importText });
      showToast(`批量导入完成：新增 ${res.imported} 条${res.skipped ? `，跳过重复 ${res.skipped} 条` : ""}`);
      setShowImport(false);
      setImportText("");
      await refresh();
    } catch (e) {
      showToast("批量导入失败: " + e);
    }
    setImporting(false);
  };

  const handleExport = async () => {
    try {
      const path = await save({
        title: "导出改枪码备份",
        defaultPath: `改枪码备份_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const n = await invoke<number>("export_gun_codes", { path });
      showToast(`已导出 ${n} 条记录 ✓`);
    } catch (e) {
      showToast("导出失败: " + e, "error");
    }
  };

  const handleImportJson = async () => {
    try {
      const path = await open({
        title: "导入改枪码备份",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const n = await invoke<number>("import_gun_codes", { path: String(path) });
      showToast(`导入完成：新增 ${n} 条${n === 0 ? "（无新记录）" : ""}`);
      await refresh();
    } catch (e) {
      showToast("导入失败: " + e, "error");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (catFilter !== "all" && CATEGORY_MAP[i.weapon_name] !== catFilter) return false;
      if (gunFilter !== "all" && i.weapon_name !== gunFilter) return false;
      if (!q) return true;
      return (
        i.weapon_name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.note.toLowerCase().includes(q)
      );
    });
  }, [items, search, gunFilter, catFilter]);

  const gunOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) {
      if (catFilter !== "all" && CATEGORY_MAP[i.weapon_name] !== catFilter) continue;
      counts.set(i.weapon_name, (counts.get(i.weapon_name) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [items, catFilter]);

  // 按枪分组（保留枪内时间倒序）
  const grouped = useMemo(() => {
    const groups = new Map<string, GunCode[]>();
    for (const item of filtered) {
      const arr = groups.get(item.weapon_name) || [];
      arr.push(item);
      groups.set(item.weapon_name, arr);
    }
    return [...groups.entries()];
  }, [filtered]);

  // 类别计数
  const catCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) {
      const c = CATEGORY_MAP[i.weapon_name] || "其他";
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    return counts;
  }, [items]);

  const stats = useMemo(() => {
    const guns = new Set(items.map((i) => i.weapon_name));
    return { count: items.length, guns: guns.size };
  }, [items]);

  return (
    <div className="app">
      <header className="header">
        <div className="logo">⌖</div>
        <div>
          <h1>三角洲本地改枪码记事本</h1>
          <p className="sub">三角洲行动 · 本地改枪码库 · 粘贴自动识别</p>
        </div>
        <div className="stats">
          <span className="stat"><b>{stats.count}</b> 条记录</span>
          <span className="stat"><b>{stats.guns}</b> 把枪</span>
        </div>
      </header>

      {/* 输入区 */}
      <section className="panel input-panel">
        <h2>添加改枪码</h2>
        <div className="row">
          <div className="field grow">
            <label>改枪码（粘贴后自动识别枪名）</label>
            <textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="例如 6KFCC1K08QMG6NRUK6UQC"
              rows={2}
            />
            {recog && (
              <div className={"recog " + (recog.recognized ? "ok" : "unknown")}>
                {recog.recognized
                  ? <>已识别：<b>{recog.weapon_name}</b></>
                  : <>未识别出枪名，可手动输入后保存，下次同枪代码将自动识别</>}
              </div>
            )}
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>枪名</label>
            <input value={weapon} onChange={(e) => setWeapon(e.target.value)} placeholder="枪名" />
          </div>
          <div className="field grow">
            <label>备注</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如 20W青春版 / 55W满改红点" />
          </div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={handleSave} disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
          <button className="btn ghost" onClick={() => setShowImport(true)}>
            批量导入（粘贴文档）
          </button>
          <button className="btn ghost" onClick={handleExport}>
            导出 JSON 备份
          </button>
          <button className="btn ghost" onClick={handleImportJson}>
            导入 JSON 备份
          </button>
        </div>
      </section>

      {/* 批量导入弹窗 */}
      {showImport && (
        <div className="modal-mask" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>批量导入改枪码</h2>
            <p className="modal-hint">
              从在线文档/群里复制整段内容（枪名 + 配置 + 改枪码），粘贴到下面即可。
              自动识别每一条并保存，识别失败的可导入后手动修改。
            </p>
            <textarea
              className="import-area"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"例如：\nRM277 20W青春版 6KFCC1K08QMG6NRUK6UQC\nMK47突击步枪-烽火地带-6HN54R808PBNCS3LFEE0A"}
              rows={12}
            />
            <div className="btn-row">
              <button className="btn primary" onClick={handleBatchImport} disabled={importing}>
                {importing ? "导入中…" : "开始导入"}
              </button>
              <button className="btn ghost" onClick={() => setShowImport(false)}>取消</button>
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 枪名 / 代码 / 备注…"
          />
        </div>
        <div className="cat-pills">
          <button
            className={"pill" + (catFilter === "all" ? " active" : "")}
            onClick={() => { setCatFilter("all"); setGunFilter("all"); }}
          >
            全部类别（{items.length}）
          </button>
          {CATEGORY_ORDER.map((cat) => {
            const cnt = catCounts.get(cat) || 0;
            if (cnt === 0) return null;
            return (
              <button
                key={cat}
                className={"pill" + (catFilter === cat ? " active" : "")}
                onClick={() => { setCatFilter(cat); setGunFilter("all"); }}
              >
                {cat}（{cnt}）
              </button>
            );
          })}
        </div>
        {gunOptions.length > 0 && (
          <div className="gun-pills">
            <button
              className={"pill" + (gunFilter === "all" ? " active" : "")}
              onClick={() => setGunFilter("all")}
            >
              全部（{items.length}）
            </button>
            {gunOptions.map((name) => {
              const cnt = items.filter((i) => i.weapon_name === name).length;
              return (
                <button
                  key={name}
                  className={"pill" + (gunFilter === name ? " active" : "")}
                  onClick={() => setGunFilter(name)}
                >
                  {name}（{cnt}）
                </button>
              );
            })}
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="empty">
            {items.length === 0 ? "还没有记录，粘贴一条改枪码开始吧" : "没有匹配的结果"}
          </div>
        ) : (
          <div className="gun-groups">
            {grouped.map(([gun, gunItems]) => {
              const isCollapsed = collapsed.has(gun);
              return (
                <div className="gun-group" key={gun}>
                  <div
                    className="gun-group-head"
                    onClick={() => {
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(gun)) next.delete(gun);
                        else next.add(gun);
                        return next;
                      });
                    }}
                  >
                    <span className="gg-arrow">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="gg-name">{gun}</span>
                    <span className="gg-cat">{CATEGORY_MAP[gun] || ""}</span>
                    <span className="gg-count">{gunItems.length} 条配置</span>
                  </div>
                  {!isCollapsed && (
                    <div className="gg-items">
                      {gunItems.map((item) => (
                        <div className="card gg-card" key={item.id}>
                          {editingId === item.id ? (
                            <div className="card-edit">
                              <input value={editWeapon} onChange={(e) => setEditWeapon(e.target.value)} placeholder="枪名" />
                              <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="备注" />
                              <div className="card-actions">
                                <button className="btn small" onClick={() => handleUpdate(item.id)}>保存修改</button>
                                <button className="btn small ghost" onClick={() => setEditingId(null)}>取消</button>
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
                                  setEditingId(item.id);
                                  setEditWeapon(item.weapon_name);
                                  setEditNote(item.note);
                                }}>编辑</button>
                                <button className="btn small danger" onClick={() => handleDelete(item.id)}>删除</button>
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
