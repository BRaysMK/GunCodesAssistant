/**
 * 解析「改枪码」目录下的测试源（人工整理的 xlsx）。
 *
 * 为什么单独抽一个模块：
 *   这两个 xlsx 是**人工逐条整理**的，准确率远高于旧库（实测 87% vs 44.8%），
 *   因此作为构建规则库时的**最高优先级源**（P0）。
 *
 * 支持的两种布局（都是横向多组并排，但列偏移不同）：
 *
 *   布局甲（横向四组）—— 每组 4 列：
 *        [枪名] [配置名] [改枪码] [备注]
 *
 *   布局乙（多区并排）—— 每组 4 列，从「区名」列起：
 *        [区名/枪名] [价格] [改枪码] [备注]
 *        注意：枪名只在换枪那一行有值，后续行留空 → 需要「向下继承」
 *
 * 输出统一格式：{ gun, rawGun, code }
 *   - **不含 config**：规则库一律不写备注（既定约束）
 *   - **不含 source**：来源信息一律不入库（脱敏要求）
 *   - gun 已归一到规则库里的规范名；归不上的条目被丢弃并计数
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** xlsx 依赖（装在 GunCodesAssistant 下） */
function loadXLSX() {
  const candidates = [
    "xlsx",
    path.resolve(process.env.GCA_ROOT ?? ".", "node_modules/xlsx"),
    path.resolve("node_modules/xlsx"),
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* try next */
    }
  }
  throw new Error("缺少 xlsx 依赖。请先 `npm i -D xlsx`");
}

const XLSX = loadXLSX();

const clean = (c) => String(c ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
export const fp10 = (c) => clean(c).slice(0, 10);
const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();
const isCode = (s) => /^[0-9A-Za-z]{20,}$/.test(String(s ?? "").trim());

const TYPE_SUFFIXES = [
  "精确射手步枪", "突击步枪", "战斗步枪", "射手步枪", "狙击步枪",
  "通用机枪", "轻机枪", "冲锋枪", "霰弹枪", "手枪", "步枪", "机枪",
];

/** 去掉类型后缀（「QJB201轻机枪」→「QJB201」） */
function baseGun(raw) {
  let s = String(raw ?? "").trim().replace(/[（(][^)）]*[)）]/g, "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of TYPE_SUFFIXES) {
      if (s.length > suf.length && s.endsWith(suf)) {
        const rest = s.slice(0, -suf.length).trim();
        if (rest.length >= 2) {
          s = rest;
          changed = true;
        }
      }
    }
  }
  return s;
}

/**
 * 构造枪名归一化函数
 * @param {object} rules 规则库（用它的 guns + aliases 建索引）
 */
export function makeCanon(rules) {
  const aliasIdx = new Map();
  for (const [g, meta] of Object.entries(rules.guns ?? {})) {
    aliasIdx.set(norm(g), g);
    for (const a of meta.aliases ?? []) aliasIdx.set(norm(a), g);
  }
  // 指纹里出现过的枪名也纳入（防 guns 段漏收）
  for (const f of Object.values(rules.fingerprints ?? {})) {
    if (f?.gun) aliasIdx.set(norm(f.gun), f.gun);
  }
  return (raw) => aliasIdx.get(norm(raw)) ?? aliasIdx.get(norm(baseGun(raw))) ?? null;
}

/**
 * 解析布局甲（横向四组）
 *
 * 烽火地带 sheet：横向 4 组，组起点由表头里的「步枪/冲锋枪/机枪/弓」定位，
 * 每组固定 4 列（枪名 | 配置 | 码 | 备注），枪名向下继承。
 * 高手版 sheet：纵向，列 0 = 枪名，列 1 = 码。
 */
export function parseLayoutA(file, canon) {
  const wb = XLSX.readFile(file);
  const out = [];
  const dropped = [];

  for (const sheetName of ["烽火地带", "高手版"]) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws["!ref"]) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

    if (sheetName === "烽火地带") {
      const header = (rows[0] ?? []).map((c) => String(c).trim());
      const groups = [];
      for (let i = 0; i < header.length; i += 1) {
        if (header[i] && /步枪|冲锋枪|机枪|弓/.test(header[i])) groups.push(i);
      }
      for (const start of groups) {
        let cur = null;
        for (let r = 1; r < rows.length; r += 1) {
          const nameCell = String(rows[r][start] ?? "").trim();
          const codeCell = String(rows[r][start + 2] ?? "").trim();
          if (nameCell && !isCode(nameCell) && canon(nameCell)) cur = nameCell;
          if (!isCode(codeCell)) continue;
          if (!cur) continue;
          const gun = canon(cur);
          if (!gun) {
            dropped.push({ raw: cur, code: codeCell, why: "枪名无法归一" });
            continue;
          }
          out.push({ gun, rawGun: cur, code: codeCell });
        }
      }
    } else {
      // 高手版：纵向
      let cur = null;
      for (let r = 0; r < rows.length; r += 1) {
        const nameCell = String(rows[r][0] ?? "").trim();
        const codeCell = String(rows[r][1] ?? "").trim();
        if (nameCell && !isCode(nameCell) && canon(nameCell)) cur = nameCell;
        if (!isCode(codeCell) || !cur) continue;
        const gun = canon(cur);
        if (!gun) {
          dropped.push({ raw: cur, code: codeCell, why: "枪名无法归一" });
          continue;
        }
        out.push({ gun, rawGun: cur, code: codeCell });
      }
    }
  }
  return { items: out, dropped };
}

/**
 * 解析布局乙（多区并排）
 *
 * 烽火地带 sheet 布局（实测）：
 *   [5] 区名/枪名   [6] 哈夫币   [7] 改枪码   [8] 备注
 *   [10] 轻机枪区   [11] 哈夫币  [12] 改枪码  [13] 备注
 *   [15] 射手步枪区 [16] 哈夫币  [17] 改枪码  [18] 备注
 *
 * 「改枪码」列由表头定位；枪名在 codeCol-2，且只在换枪时出现（向下继承）。
 */
export function parseLayoutB(file, canon) {
  const wb = XLSX.readFile(file);
  const out = [];
  const dropped = [];

  const ws = wb.Sheets["烽火地带"];
  if (!ws || !ws["!ref"]) return { items: out, dropped };
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

  const header = (rows[0] ?? []).map((c) => String(c).replace(/\s/g, ""));
  const codeCols = [];
  for (let i = 0; i < header.length; i += 1) {
    if (header[i] === "改枪码") codeCols.push(i);
  }

  for (const codeCol of codeCols) {
    const nameCol = codeCol - 2;
    let cur = null;
    for (let r = 1; r < rows.length; r += 1) {
      const nameCell = String(rows[r][nameCol] ?? "").trim();
      const codeCell = String(rows[r][codeCol] ?? "").trim();
      // 枪名列只在换枪时有值；「轻机枪区」这类区名归一会失败，正好被跳过
      if (nameCell && !isCode(nameCell) && canon(nameCell)) cur = nameCell;
      if (!isCode(codeCell) || !cur) continue;
      const gun = canon(cur);
      if (!gun) {
        dropped.push({ raw: cur, code: codeCell, why: "枪名无法归一" });
        continue;
      }
      out.push({ gun, rawGun: cur, code: codeCell });
    }
  }
  return { items: out, dropped };
}

/**
 * 读取全部测试源
 *
 * @param {string} dir 「改枪码」目录
 * @param {object} rules 现有规则库（用于枪名归一）
 * @returns {{ items: Array, dropped: Array, files: Array }}
 */
export function loadTestSources(dir, rules, canonOverride) {
  const canon = canonOverride ?? makeCanon(rules);
  const items = [];
  const dropped = [];
  const files = [];

  // 扫描目录下的全部 xlsx，用「表头特征」自动判定布局，不依赖文件名。
  // 这样既避免了实名硬编码，也让新增测试源无需改代码。
  if (!fs.existsSync(dir)) {
    return { items, dropped, files: [{ label: "(目录缺失)", status: "缺失" }] };
  }
  const all = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xlsx"));

  for (const name of all) {
    const p = path.join(dir, name);
    let layout = null;
    try {
      const wb = XLSX.readFile(p);
      const sheet = wb.Sheets["烽火地带"] ?? wb.Sheets[wb.SheetNames[0]];
      if (!sheet || !sheet["!ref"]) continue;
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      const headerCells = (rows[0] ?? []).map((c) => String(c).replace(/\s/g, ""));
      // 布局乙的特征：表头里同时出现「改枪码」与「哈夫币」
      const hasCodeHeader = headerCells.includes("改枪码");
      const hasPriceHeader = headerCells.includes("哈夫币");
      if (hasCodeHeader && hasPriceHeader) layout = "B";
      else if (headerCells.some((c) => /步枪|冲锋枪|机枪/.test(c))) layout = "A";
      else continue;
    } catch {
      continue;
    }

    const parser = layout === "B" ? parseLayoutB : parseLayoutA;
    const label = layout === "B" ? "多区并排" : "横向四组";
    const { items: got, dropped: drop } = parser(p, canon);
    items.push(...got);
    dropped.push(...drop);
    files.push({ label, status: "OK", count: got.length });
  }

  return { items, dropped, files };
}
