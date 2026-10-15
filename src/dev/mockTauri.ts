/**
 * 开发用 Tauri 后端替身（**仅在浏览器预览时存在**）
 *
 * 目的：只改界面时不必跑 `cargo`（首次编译 Tauri 要十几分钟）。在普通浏览器里
 * 打开 `VITE_GCA_MOCK=1 npm run dev` 就能看真实界面与完整数据流。
 *
 * 工作原理：`@tauri-apps/api` 的 `invoke()` 只是转发给
 * `window.__TAURI_INTERNALS__.invoke(cmd, args)`，所以塞一个同形状的对象即可。
 *
 * 切除保证：本文件只在 `main.tsx` 里以 `import.meta.env.VITE_GCA_MOCK === "1"`
 * 为条件**动态 import**，Vite 在正式构建时会把该分支判死并摇掉整个 chunk。
 * 校验方式：`grep __GCA_MOCK__ dist/assets/*.js` 必须无结果。
 *
 * 数据是内存态的，刷新即重置；不影响 `%APPDATA%` 下的真实数据文件。
 */
import type { GunCode, PreviewResult, PreviewRow, RecognizeResult, RulesMeta } from "@/lib/gunCodes";

const MOCK_TAG = "__GCA_MOCK__";

/** 假词库指纹表：够覆盖「已识别 / 未识别 / 重复」三种预览分支 */
const FINGERPRINTS: Record<string, { gun: string; note: string }> = {
  "6KFCC1K08Q": { gun: "RM277", note: "20W青春版" },
  "6KFCDT008Q": { gun: "RM277", note: "55W满改红点" },
  "6KFCE0008Q": { gun: "RM277", note: "30W均衡版" },
  "6HN54R808P": { gun: "MK47", note: "75W满改红点" },
  "6HN55R808P": { gun: "MK47", note: "80W满改" },
  "6L6INHO0B1": { gun: "汤姆逊", note: "36w" },
  "6JCB1FO0B1": { gun: "M14", note: "红点" },
  "6JFFGC404U": { gun: "AK-12", note: "满改" },
  "6JKA32C0B1": { gun: "M4A1", note: "腰射" },
  "6K2AB1C0D1": { gun: "Vector", note: "短管冲锋" },
  "6K3EF2G0H1": { gun: "S12K", note: "近战喷" },
  "6K4IJ3K0L1": { gun: "M250", note: "压制机枪" },
  "6K5MN4O0P1": { gun: "AWM", note: "远程狙击" },
  "6K6QR5S0T1": { gun: "93R", note: "副武器" },
  "6K7UV6W0X1": { gun: "巴雷特", note: "反器材" },
  "6K8YZ7A0B1": { gun: "野牛", note: "高射速" },
};

/** 初始数据：覆盖多分类、多配置、未识别、无备注、旧时间戳 */
const SEED: GunCode[] = [
  { id: "m01", weapon_name: "RM277", code: "6KFCC1K08QMG6NRUK6UQC", note: "20W青春版", created_at: 1760400000 },
  { id: "m02", weapon_name: "RM277", code: "6KFCDT008QMG6NRUK6UQC", note: "55W满改红点", created_at: 1760403600 },
  { id: "m03", weapon_name: "MK47", code: "6HN54R808PBNCS3LFEE0A", note: "75W满改红点", created_at: 1760410000 },
  { id: "m04", weapon_name: "汤姆逊", code: "6L6INHO0B1H3TI624U64G", note: "36w", created_at: 1760415000 },
  { id: "m05", weapon_name: "AK12", code: "6JFFGC404U3TN9SQ0V71K", note: "满改", created_at: 1760420000 },
  { id: "m06", weapon_name: "AK-12", code: "6JFFGCS04U3TN9SQ0V71K", note: "", created_at: 1760423000 },
  { id: "m07", weapon_name: "M4A1", code: "6JKA32C0B1H3TI624U64G", note: "腰射", created_at: 1760426000 },
  { id: "m08", weapon_name: "Vector", code: "6K2AB1C0D1H3TI624U64G", note: "短管冲锋", created_at: 1760430000 },
  { id: "m09", weapon_name: "S12K", code: "6K3EF2G0H1H3TI624U64G", note: "近战喷", created_at: 1760434000 },
  { id: "m10", weapon_name: "M250", code: "6K4IJ3K0L1H3TI624U64G", note: "压制机枪", created_at: 1760438000 },
  { id: "m11", weapon_name: "AWM", code: "6K5MN4O0P1H3TI624U64G", note: "远程狙击", created_at: 1760442000 },
  { id: "m12", weapon_name: "93R", code: "6K6QR5S0T1H3TI624U64G", note: "副武器", created_at: 1760446000 },
  { id: "m13", weapon_name: "未知枪械", code: "6Z9ZZ9Z0Z1H3TI624U64G", note: "", created_at: 1760450000 },
  { id: "m14", weapon_name: "巴雷特", code: "6K7UV6W0X1H3TI624U64G", note: "反器材", created_at: 1760454000 },
  { id: "m15", weapon_name: "野牛", code: "6K8YZ7A0B1H3TI624U64G", note: "高射速", created_at: 1760458000 },
  { id: "m16", weapon_name: "M7", code: "6K9CD8E0F1H3TI624U64G", note: "", created_at: 1760462000 },
];

let items: GunCode[] = [...SEED];
const learned = new Map<string, { gun: string; note: string }>();
let seq = 100;

const now = () => Math.floor(Date.now() / 1000);
const fingerprint = (code: string) => code.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
const delay = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function recognize(code: string): RecognizeResult {
  const fp = fingerprint(code);
  const hit = learned.get(fp) ?? FINGERPRINTS[fp];
  if (hit) {
    return {
      weapon_name: hit.gun,
      note: hit.note,
      recognized: true,
      confidence: 2 / 3,
      reason: `指纹 ${fp} 命中${learned.has(fp) ? "已学习" : "内置"}规则`,
      source: code.slice(-11),
    };
  }
  return {
    weapon_name: "未知枪械",
    note: "",
    recognized: false,
    confidence: 0,
    reason: `指纹 ${fp} 未收录（可手动补充后自动学习）`,
    source: code.slice(-11),
  };
}

/** 极简「文档 → 行」解析：够喂饱导入预览流 */
function parseDocument(text: string): PreviewRow[] {
  const existing = new Set(items.map((i) => i.code.trim().toUpperCase()));
  const rows: PreviewRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/\t|\s{2,}| /).filter(Boolean);
    const codeCell = cells.find((c) => /^[A-Za-z0-9]{20,}$/.test(c));
    if (!codeCell) continue;
    const code = codeCell.toUpperCase();
    const r = recognize(code);
    const idx = cells.indexOf(codeCell);
    const config = idx > 0 ? cells[idx - 1] : "";
    rows.push({
      code,
      gun: r.recognized ? r.weapon_name : "",
      config: r.note || config,
      recognized: r.recognized,
      confidence: r.confidence,
      reason: r.reason,
      source: r.source,
      duplicate: existing.has(code),
    });
  }
  return rows;
}

function rulesMeta(): RulesMeta {
  return {
    version: 3,
    generated: "2026-10-15",
    source: `${MOCK_TAG} 开发预览数据（非真实词库）`,
    gunCount: 71,
    fingerprintCount: 399,
    learnedCount: learned.size,
    categories: { 步枪: 24, 冲锋枪: 13, 射手步枪: 15, 机枪: 4, 霰弹枪: 7, 手枪: 7, 弓: 1 },
  };
}

async function invokeMock(cmd: string, args: Record<string, unknown> = {}): Promise<unknown> {
  // 人为延时，让 Skeleton 加载态真的可见
  if (cmd === "get_local_gun_codes") {
    await delay(280);
    return [...items].sort((a, b) => b.created_at - a.created_at);
  }
  if (cmd === "get_gun_rules_meta") {
    await delay(120);
    return rulesMeta();
  }
  if (cmd === "add_local_gun_code") {
    const code = String(args.code ?? "").trim();
    if (!code) throw new Error("改枪码不能为空");
    const r = recognize(code);
    const weapon = String(args.weaponName ?? "").trim() || r.weapon_name;
    const note = String(args.note ?? "").trim() || r.note;
    const item: GunCode = { id: `m${seq++}`, weapon_name: weapon, code, note, created_at: now() };
    items = [...items, item];
    learned.set(fingerprint(code), { gun: weapon, note });
    return item;
  }
  if (cmd === "update_local_gun_code") {
    const id = String(args.id);
    items = items.map((i) =>
      i.id === id
        ? {
            ...i,
            weapon_name: String(args.weaponName ?? "").trim() || i.weapon_name,
            code: String(args.code ?? "").trim() || i.code,
            note: String(args.note ?? "").trim(),
          }
        : i,
    );
    const cur = items.find((i) => i.id === id);
    if (cur) learned.set(fingerprint(cur.code), { gun: cur.weapon_name, note: cur.note });
    return null;
  }
  if (cmd === "delete_local_gun_code") {
    const id = String(args.id);
    const before = items.length;
    items = items.filter((i) => i.id !== id);
    if (items.length === before) throw new Error("未找到该改枪码");
    return null;
  }
  if (cmd === "recognize_gun_name") return recognize(String(args.code ?? ""));
  if (cmd === "preview_import_gun_codes") {
    await delay(420);
    const rows = parseDocument(String(args.text ?? ""));
    const recognized = rows.filter((r) => r.recognized).length;
    const result: PreviewResult = {
      total: rows.length,
      recognized,
      unrecognized: rows.length - recognized,
      rows,
    };
    return result;
  }
  if (cmd === "import_gun_codes_batch") {
    await delay(360);
    const rows = parseDocument(String(args.text ?? ""));
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    for (const r of rows) {
      const hit = items.find((i) => i.code.toUpperCase() === r.code.toUpperCase());
      if (hit) {
        if (!hit.note && r.config) {
          hit.note = r.config;
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      const gun = r.gun || "未知枪械";
      items = [...items, { id: `m${seq++}`, weapon_name: gun, code: r.code, note: r.config, created_at: now() }];
      if (r.recognized) learned.set(fingerprint(r.code), { gun, note: r.config });
      imported++;
    }
    return { imported, updated, skipped, unrecognized: rows.filter((r) => !r.recognized).length };
  }
  if (cmd === "refresh_gun_rules") {
    await delay(200);
    return { ok: true, gunCount: 71, fingerprintCount: 399 };
  }
  if (cmd === "export_gun_codes") return items.length;
  if (cmd === "import_gun_codes") return 0;
  // tauri-plugin-dialog：浏览器里没有原生对话框，返回假路径让备份流程可走通
  if (cmd === "plugin:dialog|save") return "C:\\Users\\mock\\改枪码备份_预览.json";
  if (cmd === "plugin:dialog|open") return "C:\\Users\\mock\\改枪码备份_预览.json";
  throw new Error(`${MOCK_TAG} 未实现的命令: ${cmd}`);
}

/** 安装替身；若已存在真实 Tauri 运行时则不做任何事 */
export function installMockTauri(): void {
  const w = window as unknown as { __TAURI_INTERNALS__?: Record<string, unknown> };
  if (w.__TAURI_INTERNALS__) return;

  let cbId = 0;
  const callbacks = new Map<number, (payload: unknown) => void>();

  w.__TAURI_INTERNALS__ = {
    invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args ?? {}),
    transformCallback: (cb: (payload: unknown) => void, once = false) => {
      const id = ++cbId;
      callbacks.set(id, (payload) => {
        if (once) callbacks.delete(id);
        cb(payload);
      });
      return id;
    },
    unregisterCallback: (id: number) => {
      callbacks.delete(id);
    },
    convertFileSrc: (filePath: string) => filePath,
  };

  // 让「文件对话框」在浏览器里也能走通：返回一个假的导出路径
  window.setTimeout(() => {
    console.info(`[${MOCK_TAG}] 开发预览模式：Tauri 命令已由内存假数据接管，刷新即重置`);
  }, 0);
}
