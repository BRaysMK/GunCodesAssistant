/**
 * 规则库构建：三源合并 + 枪名归一化 + 优先级仲裁 + 自检。
 *
 * 数据源与可信度（高 → 低）：
 *   P0  本机真实数据  %APPDATA%/com.braysmk.guncodes/local_gun_codes.json
 *       用户自己确认过的枪名与备注，权威来源。
 *   P1  线上样本      .rules-src/anxu-dump.json（由 scripts/fetch-anxu.mjs 抓取）
 *       指纹零冲突，用于扩大覆盖。
 *   P2  旧规则库      src-tauri/resources/gun-codes/rules.json
 *       仅保留与 P0/P1 不冲突的条目。
 *
 * ⚠️ 备注（config）处理规则 —— 这是本脚本最关键的约束：
 *   **规则库一律不写备注。** 所有条目的 config 恒为空字符串。
 *
 *   原因：
 *   1. 规则库的职责只是「识别枪名」。配置名是用户自己那套改法的说明，
 *      不该由别人的数据预填 —— 从 P1/P2 抄来的尤其如此（多为营销文案）。
 *   2. 即便 P0（用户自己的数据）也不写：他保存时已经有自己的备注了，
 *      再回填一遍只会在新增时把旧备注糊上去。
 *   3. 因此 `title` / `short_desc` / `author_name` / code 内嵌括号段
 *      **全部丢弃**，不做任何「猜一个配置名」的尝试。
 *
 * 用法：node scripts/build-rules.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");

const RULES_PATH = path.join(REPO, "src-tauri", "resources", "gun-codes", "rules.json");
const RULES_BAK = path.join(REPO, "src-tauri", "resources", "gun-codes", "rules.v5.bak.json");
const ANXU_PATH = path.join(REPO, ".rules-src", "anxu-dump.json");
const REPORT_PATH = path.join(REPO, "scripts", "rules-report.md");
const LOCAL_DATA = path.join(
  os.homedir(),
  "AppData",
  "Roaming",
  "com.braysmk.guncodes",
  "local_gun_codes.json",
);

// ───────────────────────── 基础工具 ─────────────────────────

/** 与后端 Rust `normalize()` 逐字符等价 */
const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();

/** 取 10 位指纹 */
const fingerprint = (code) =>
  String(code ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();

// ─────────────────────── 枪名归一化 ───────────────────────

/** 枪械类型后缀，从「M14射手步枪」这类写法里剥掉 */
const TYPE_SUFFIXES = [
  "精确射手步枪",
  "突击步枪",
  "战斗步枪",
  "射手步枪",
  "狙击步枪",
  "通用机枪",
  "轻机枪",
  "冲锋枪",
  "霰弹枪",
  "手枪",
  "步枪",
  "机枪",
  "紧凑",
  "精准",
];

/** 明确不可合并的别名（避免 M7/M700 这类被误合） */
const NEVER_MERGE = new Set(["M7", "M700", "M14", "M250", "M249", "M4A1", "M16A4"]);

/** 显式别名 → 规范名（只写高置信度的） */
const ALIAS_TO_CANON = {
  // ── 型号写法差异 ──
  "SMG-45": "SMG45",
  SMG45: "SMG45",
  QJB201: "QJB",
  "SR-25": "SR25",
  "ASh-12": "ASH-12",
  ASH12: "ASH-12",
  "AS VAL": "AS Val",
  ASVAL: "AS Val",
  "AS-VAL": "AS Val",
  "AK 12": "AK-12",
  AK12: "AK-12",
  "QBZ95-1": "QBZ-95",
  "QBZ-95": "QBZ-95",
  "QBZ95": "QBZ-95",
  M16: "M16A4",
  "MK 47": "MK47",
  "KC 17": "KC17",
  "SR-3M": "SR-3M",
  SR3M: "SR-3M",
  "M 250": "M250",
  "PSG-1": "PSG-1",
  PSG1: "PSG-1",
  M14A: "M14",
  "M 82": "M82",
  // 巴雷特 = M82：巴雷特是厂商名（Barrett），M82 是型号，同一把枪。
  // 用户数据里只写「巴雷特」，旧库只写「M82」，必须归一到同一个规范名，
  // 否则同一把枪会分裂成两个条目、两个分类。
  巴雷特: "M82",
  // ── 剥壳误伤修复 ──
  R: "93R", // 93R 被「数字前缀」规则误剥成 R
  双管: "725", // 725 双管霰弹枪
  // ── 中文枪名的规范写法 ──
  杠杆: "杠杆步枪",
  杠杆式: "杠杆步枪",
  Marlin杠杆: "杠杆步枪",
  // 弓的规范名是「复合弓」；「弓」是用户数据里的简写，作为别名收敛过来
  弓: "复合弓",
  轻: "机枪", // 「轻机枪」被剥成「轻」的兜底
  // ── 别名收敛 ──
  // MCX LT 是这把枪的**规范名**（用户确认）。「MCX」是简写，「MCXLT」是去空格写法。
  // 三者必须归一到 MCX LT，否则同一把枪会分裂成多个条目。
  MCX: "MCX LT",
  MCXLT: "MCX LT",
  SVCH精确射手: "SVCH",
  "vito的AS Val": "AS Val",
  "vito的SVCH": "SVCH",
  "m射程完全体": "P90",
  // ⚠️ 巴雷特 → M82：见上方 ALIAS_TO_CANON 的说明，两者是同一把枪。
};

/**
 * 争议指纹：来源互相矛盾、且无法确认归属的码，**一律从规则库排除**。
 *
 * 排除后该码会显示「未识别」，而不是给出一个可能错误的枪名 ——
 * 错认比不认更糟：用户会以为识别是对的，直接把错误数据存进去。
 *
 * 每个条目都写明冲突来源，便于日后核实后再收回来。
 */
const EXCLUDED_FINGERPRINTS = new Map([
  [
    "6HHM76G03H",
    {
      code: "6HHM76G03HGRN5B0HUTCF",
      reason:
        "本机数据标 MK47（备注混有抖音广告词），g.aitags.cn 的 bbFps 页标「M700狙击步枪（三倍）」。双方均为人工录入且无法确认，用户决定排除。",
    },
  ],
]);

/** 这些是「类型词」而非枪名，归一化后若得到它们，说明原始数据本身没写枪名 —— 直接丢弃 */
const NOT_A_GUN = new Set([
  "其他",
  "冲锋枪",
  "步枪",
  "机枪",
  "轻机枪",
  "霰弹枪",
  "手枪",
  "狙击枪",
  "射手步枪",
  "未知枪械",
  "",
]);
// 注意：**「弓」不在此列** —— 它是本项目里的合法枪名（用户数据里就写作「弓」），
// 只有「复合弓」才是它的别名。早期把「弓」当类型词丢弃，导致 6 条真实数据认错。

/**
 * 把任意枪名写法收敛到「基础枪名」。
 * 例：`M14射手步枪（稳压版）` → `M14`；`SR-3M紧凑突击步枪` → `SR-3M`；`MP7冲锋枪` → `MP7`
 *
 * 注意：**不能粗暴剥前导数字** —— `93R`、`725`、`M250` 里的数字是枪名的一部分。
 * 只剥「明显的价格/序号前缀」，且必须带单位或分隔符（`19w`、`1.5-5=`、`21W`）。
 */
function canonicalGun(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";

  // 1) 去掉括号内容（配置说明，不是枪名的一部分）
  s = s.replace(/[（(][^)）]*[)）]/g, "").trim();

  // 2) 剥价格/序号前缀：`19w` `21W` `1.5-5=` `14w极致性价比——`
  //    要求：数字 + 可选 w/W/万 + 可选分隔符，且**必须带单位或分隔符**。
  //    绝不允许裸数字被剥 —— `93R`、`725`、`M250` 里的数字是枪名的一部分。
  {
    const m = s.match(/^(\d+(?:\.\d+)?)\s*([wW万]|[-=:：])\s*/);
    if (m) {
      const rest = s.slice(m[0].length).trim();
      // 只有「带单位」或「后面还有像枪名的内容」时才剥
      if (rest.length >= 2 && /[A-Za-z\u4e00-\u9fa5]/.test(rest)) {
        s = rest;
      }
    }
  }

  // 3) 剥中文营销前缀：`100腰K416` → `K416`、`腰射MK47` → `MK47`、`战斧无后座ASh-12` → `ASh-12`
  //    策略：从左往右找到第一个「看起来是枪名起点」的位置
  //    枪名起点 = 大写字母开头，或已知中文枪名（腾龙/野牛/勇士/汤姆逊/杠杆/左轮/巴雷特）
  const CN_GUNS = ["腾龙", "野牛", "勇士", "汤姆逊", "杠杆", "左轮", "巴雷特", "双管"];
  let start = -1;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (/[A-Za-z]/.test(ch)) { start = i; break; }
    if (CN_GUNS.some((g) => s.startsWith(g, i))) { start = i; break; }
  }
  if (start > 0) s = s.slice(start).trim();

  // 4) 去掉尾部「——xxx」这类后缀
  s = s.replace(/——.*$/, "").trim();

  // 5) 剥类型后缀（可能叠加，如「紧凑突击步枪」）
  //    注意：剥完必须还剩 ≥2 字符，否则不剥 —— 防止「轻机枪」→「轻」、「冲锋枪」→「」
  const stripType = () => {
    let did = false;
    for (const suf of TYPE_SUFFIXES) {
      if (s.length > suf.length && s.endsWith(suf)) {
        const rest = s.slice(0, -suf.length).trim();
        if (rest.length >= 2) {
          s = rest;
          did = true;
        }
      }
    }
    return did;
  };
  let changed = true;
  while (changed) changed = stripType();

  // 5.5) 剥「枪名 + 配置」粘连的尾巴：
  //      `SMG-45冲锋枪12w低后座`（类型词已剥）→ `SMG-4512w低后座` → `SMG-45`
  //      `AKM突击步枪24w腰射颗秒流`            → `AKM24w腰射颗秒流`  → `AKM`
  //      做法：在「已知枪名」之后若紧跟数字+配置描述，就截断到枪名为止。
  //      这里不依赖已知枪名表，而是用「数字 + w/万 + 中文」的模式定位配置起点。
  {
    // 形如 `12w低后座` / `24w腰射颗秒流` / `15w全绿稳定三连发`
    const cfgTail = /^(.*?)(\d+(?:\.\d+)?\s*[wW万].*)$/;
    const m2 = s.match(cfgTail);
    if (m2 && m2[1].trim().length >= 2) {
      s = m2[1].trim();
    }
  }

  // 5.6) 剥「作者前缀」：`vito的AS Val` → `AS Val`
  s = s.replace(/^[^\p{Script=Han}\p{L}\d]{0,4}[\p{Script=Han}]{1,6}的(?=[A-Za-z])/u, "").trim();

  // 5.7) 再剥一次类型后缀（上面截断后可能又露出类型词）
  changed = true;
  while (changed) changed = stripType();

  // 6) 显式别名
  const upper = s.toUpperCase();
  if (ALIAS_TO_CANON[s]) s = ALIAS_TO_CANON[s];
  else if (ALIAS_TO_CANON[upper]) s = ALIAS_TO_CANON[upper];
  // 7) NEVER_MERGE 保护：保持原样，不做进一步合并
  else if (NEVER_MERGE.has(upper)) return s;

  // 8) 最终校验：类型词 / 空串不是枪名
  if (NOT_A_GUN.has(s.trim())) return "";

  return s;
}

// ───────────────────── 分类归一化 ─────────────────────

const CATEGORY_ALIAS = {
  步枪: "步枪",
  突击步枪: "步枪",
  战斗步枪: "步枪",
  冲锋枪: "冲锋枪",
  狙击步枪: "狙击枪",
  狙击枪: "狙击枪",
  射手步枪: "射手步枪",
  精确射手步枪: "射手步枪",
  轻机枪: "机枪",
  通用机枪: "机枪",
  机枪: "机枪",
  霰弹枪: "霰弹枪",
  手枪: "手枪",
  弓: "弓",
  特殊武器: "其他",
};

const canonCategory = (c) => CATEGORY_ALIAS[String(c ?? "").trim()] ?? "其他";

// ─────────────────── 备注：一律不收录 ───────────────────

/**
 * 规则库不写任何备注。保留此函数仅用于**自检**：确保输出里没有意外混入的文案。
 * （历史上曾把作者 title 当成配置名收进库，例如「28w机密得吃巨浪！」，
 *   以及把表格跨行继承错位的配置名带进库，造成枪名/配置双重污染。）
 */
function looksLikeProse(text) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (t.length > 18) return true;
  return /[!！,，。、]|得吃|机密|自用|爆闪|巨浪|统治|顶配|ProMax|要么|手感|推荐|必选|无脑/i.test(t);
}

// ───────────────────────── 主流程 ─────────────────────────

function readJson(p, label) {
  if (!fs.existsSync(p)) {
    console.warn(`  [跳过] ${label} 不存在: ${p}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.warn(`  [跳过] ${label} 解析失败: ${e.message}`);
    return null;
  }
}

console.log("=== 读取数据源 ===");

/**
 * P2 旧库基线。
 *
 * ⚠️ 必须优先读**备份文件**，不能直接读 rules.json ——
 * 本脚本会覆盖 rules.json，若第二次运行时仍从 rules.json 读「旧库」，
 * 读到的就是上次生成的 v6 自身，分类/别名会被自己的输出污染
 * （实测后果：腾龙/AKM/AS Val 等枪的分类全部退化成「其他」）。
 */
const oldRules = (() => {
  if (fs.existsSync(RULES_BAK)) {
    const r = readJson(RULES_BAK, "旧库备份");
    if (r) {
      console.log(`  P2 旧库备份（v${r.version}）: ${Object.keys(r.guns ?? {}).length} 枪 / ${Object.keys(r.fingerprints ?? {}).length} 指纹`);
      return r;
    }
  }
  const r = readJson(RULES_PATH, "规则库");
  if (r) console.log(`  P2 规则库（v${r.version}）: ${Object.keys(r.guns ?? {}).length} 枪 / ${Object.keys(r.fingerprints ?? {}).length} 指纹`);
  return r;
})();
const oldGuns = oldRules?.guns ?? {};

// P0 本机真实数据
const localRaw = readJson(LOCAL_DATA, "本机真实数据");
const localItems = Array.isArray(localRaw) ? localRaw : (localRaw?.items ?? localRaw?.data ?? []);
console.log(`  P0 本机数据: ${localItems.length} 条`);

// P1 线上样本
const anxu = readJson(ANXU_PATH, "线上样本");
const anxuSchemes = anxu?.schemes ?? [];
console.log(`  P1 线上样本: ${anxuSchemes.length} 条`);

if (localItems.length === 0 && anxuSchemes.length === 0 && !oldRules) {
  console.error("\n没有任何可用数据源，中止。");
  process.exit(1);
}

console.log("\n=== 构建指纹表（按优先级仲裁）===");

/** fingerprint -> { gun, config, mode, src } */
const fps = new Map();
/** 冲突记录，写进报告 */
const conflicts = [];
/** 归一化映射记录，供人工复核 */
const gunNameMap = new Map();

/**
 * 登记一个指纹。
 *
 * **config 恒为空** —— 规则库只回答「这是哪把枪」，不回答「这套改法叫什么」。
 * 因此这里根本不接收 config 参数，从源头杜绝文案混入。
 */
function put(fp, gunRaw, src, originDesc) {
  if (!fp || fp.length < 10) return;
  // 争议指纹直接排除（见 EXCLUDED_FINGERPRINTS）
  if (EXCLUDED_FINGERPRINTS.has(fp)) return;
  const gun = canonicalGun(gunRaw);
  if (!gun) return; // 没有枪名的一律丢弃，绝不入库
  if (!gunNameMap.has(gunRaw)) gunNameMap.set(gunRaw, gun);

  const existing = fps.get(fp);
  const RANK = { P0: 0, P1: 1, P2: 2 };

  if (!existing) {
    fps.set(fp, { gun, src });
    return;
  }
  if (existing.gun === gun) return;

  // 枪名冲突：优先级高者胜
  if (RANK[src] < RANK[existing.src]) {
    conflicts.push({
      fp,
      kept: `${gun} [${src}]`,
      dropped: `${existing.gun} [${existing.src}]`,
      origin: originDesc,
    });
    fps.set(fp, { gun, src });
  } else {
    conflicts.push({
      fp,
      kept: `${existing.gun} [${existing.src}]`,
      dropped: `${gun} [${src}]`,
      origin: originDesc,
    });
  }
}

// P0：本机数据（最高优先级）—— 只取枪名，备注不参与
for (const it of localItems) {
  put(fingerprint(it.code), it.weapon_name, "P0", "本机数据");
}
const p0Count = fps.size;
console.log(`  P0 写入后: ${p0Count} 指纹`);

// P1：线上样本 —— 只取「码 → 枪名」，title/short_desc/括号段全部丢弃
for (const s of anxuSchemes) {
  const code = String(s.code ?? "");
  const m = code.match(/^(.+?)-(烽火地带|全面战场|黑潮爆破)-([0-9A-Za-z]{10,})$/);
  if (!m) continue;
  const [, rawGun, mode, rawCode] = m;
  if (mode !== "烽火地带") continue; // 仅收录烽火地带
  put(fingerprint(rawCode), rawGun, "P1", "线上样本");
}
const p1Count = fps.size;
console.log(`  P1 写入后: ${p1Count} 指纹 (+${p1Count - p0Count})`);

// P2：旧库未冲突项 —— 同样只取枪名
let p2Added = 0;
for (const [fp, v] of Object.entries(oldRules?.fingerprints ?? {})) {
  if (!v?.gun) continue; // 旧库里的空枪名脏数据直接丢弃
  const before = fps.size;
  put(fp, v.gun, "P2", "旧规则库");
  if (fps.size > before) p2Added += 1;
}
console.log(`  P2 写入后: ${fps.size} 指纹 (+${p2Added})`);

// ─────────────────────── 枪械表 ───────────────────────

console.log("\n=== 构建枪械表 ===");

/** gun -> { category, aliases:Set } */
const guns = new Map();

/**
 * 旧库分类查询表：用**归一化 key** 建索引。
 *
 * 不能用 `canonicalGun(旧库key)` 当 key —— 旧库 key 本身就是规范名（`AS Val`、`ASH-12`），
 * 再过一遍 canonicalGun 会被剥成 `AS`、`ASH` 之类，导致分类全部丢失。
 */
const oldCatByNorm = new Map();
for (const [g, v] of Object.entries(oldGuns)) {
  oldCatByNorm.set(norm(g), canonCategory(v?.category));
}

// 从 anxu 的 weapons 表补充分类（同样用归一化 key）
const anxuCat = new Map((anxu?.categories ?? []).map((c) => [c.id, c.name]));
for (const w of anxu?.weapons ?? []) {
  const k = norm(w.name);
  if (!k || oldCatByNorm.has(k)) continue;
  oldCatByNorm.set(k, canonCategory(anxuCat.get(w.category_id)));
}

/**
 * 手工补充分类（**强制覆盖**旧库推断）。
 *
 * 用途：旧库把某些枪当成了别名（如把「复合弓」当「弓」的别名、把「巴雷特」当
 * 「M82」的别名），导致它们在旧库查表里查不到自己的分类。
 * 这些枪在用户数据里是独立枪名，必须有自己的分类。
 */
const MANUAL_CATEGORY = {
  复合弓: "弓",
  杠杆步枪: "射手步枪",
  // MCX LT 的规范名带空格，旧库/第三方写「MCX」，故显式给分类
  "MCX LT": "步枪",
};
for (const [g, c] of Object.entries(MANUAL_CATEGORY)) {
  oldCatByNorm.set(norm(g), c); // 强制覆盖，不是「不存在才补」
}

// 建立枪表：所有指纹里出现过的枪都要有分类
const catMisses = [];
for (const { gun } of fps.values()) {
  if (!guns.has(gun)) {
    const cat = oldCatByNorm.get(norm(gun));
    if (!cat) catMisses.push(gun);
    guns.set(gun, {
      category: cat ?? "其他",
      aliases: new Set(),
    });
  }
}
if (catMisses.length) {
  console.log(`  未匹配到分类的枪名 (${catMisses.length}): ${[...new Set(catMisses)].slice(0, 20).join(" | ")}`);
}

// 别名：旧库显式别名 + 归一化时被合并掉的原始写法
for (const [raw, v] of Object.entries(oldGuns)) {
  const canon = canonicalGun(raw);
  if (!guns.has(canon)) continue;
  for (const a of v?.aliases ?? []) {
    if (!a || norm(a) === norm(canon)) continue;
    // ⚠️ 若该别名本身是一把独立存在的枪（如「MCX LT」），就不能挂到别的枪上，
    // 否则同一把枪会有两个归属，识别时按先命中者算，导致错认。
    if (guns.has(a)) continue;
    guns.get(canon).aliases.add(a);
  }
  if (raw !== canon && norm(raw) !== norm(canon) && !guns.has(raw)) {
    guns.get(canon).aliases.add(raw);
  }
}
for (const [raw, canon] of gunNameMap) {
  if (!guns.has(canon)) continue;
  if (raw !== canon && norm(raw) !== norm(canon) && !guns.has(raw)) {
    guns.get(canon).aliases.add(raw);
  }
}

console.log(`  枪械 ${guns.size} 把`);

// ─────────────────────── 自检 ───────────────────────

console.log("\n=== 自检 ===");
const problems = [];

// 1) 指纹唯一（Map 天然唯一，这里校验格式）
for (const [fp] of fps) {
  if (fp.length !== 10) problems.push(`指纹长度不是 10: ${fp}`);
}

// 2) 不允许空枪名
for (const [fp, v] of fps) {
  if (!v.gun) problems.push(`指纹 ${fp} 枪名为空`);
}

// 3) 必须没有任何备注（config 恒为空）
for (const [fp, v] of fps) {
  if (v.config) problems.push(`指纹 ${fp} 不应带备注: ${v.config}`);
}
if (fps.size > 0) {
  const withCfg = [...fps.values()].filter((v) => v.config).length;
  if (withCfg !== 0) problems.push(`有 ${withCfg} 条带了备注（应为 0）`);
}

// 4) 分类必须合法
const VALID_CATS = new Set(["步枪", "冲锋枪", "狙击枪", "射手步枪", "机枪", "霰弹枪", "手枪", "弓", "其他"]);
for (const [g, v] of guns) {
  if (!VALID_CATS.has(v.category)) problems.push(`枪 ${g} 分类非法: ${v.category}`);
}

// 5) 规模下限
if (fps.size < 1000) problems.push(`指纹数过少: ${fps.size}（应 ≥1000）`);
if (guns.size < 50) problems.push(`枪械数过少: ${guns.size}`);

if (problems.length) {
  console.error("自检失败:");
  problems.slice(0, 20).forEach((p) => console.error("  - " + p));
  if (problems.length > 20) console.error(`  ... 共 ${problems.length} 项`);
  process.exit(1);
}
console.log("  全部通过");

// ─────────────────────── 输出 ───────────────────────

const catStats = {};
for (const v of guns.values()) catStats[v.category] = (catStats[v.category] ?? 0) + 1;

const outRules = {
  version: 6,
  generated: new Date().toISOString().slice(0, 10),
  mode: "烽火地带",
  note:
    "三源合并：本机真实数据(P0，最高优先) + guns.anxu.cc 线上样本(P1) + 旧库未冲突项(P2)。" +
    "规则库只记录「指纹 → 枪名」，**一律不写备注**；配置名由用户自己填。",
  source: "P0 本机 local_gun_codes.json / P1 guns.anxu.cc / P2 旧 rules.json",
  guns: Object.fromEntries(
    [...guns.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"))
      .map(([g, v]) => [
        g,
        { category: v.category, aliases: [...v.aliases].sort((x, y) => x.localeCompare(y)) },
      ]),
  ),
  fingerprints: Object.fromEntries(
    [...fps.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fp, v]) => [
      fp,
      // config 恒为空串 —— 结构保持不变以兼容 Rust 反序列化
      { gun: v.gun, config: "", mode: "烽火地带" },
    ]),
  ),
  noise: oldRules?.noise ?? [],
};

console.log("\n=== 统计 ===");
console.log(`  指纹 ${fps.size}（P0 ${p0Count} / P1 +${p1Count - p0Count} / P2 +${p2Added}）`);
console.log(`  枪械 ${guns.size}`);
console.log(`  分类 ${JSON.stringify(catStats)}`);
console.log(`  冲突 ${conflicts.length} 条（低优先级被高优先级覆盖）`);

if (DRY) {
  console.log("\n--dry：不写文件");
} else {
  // 备份旧库（只备份一次）
  if (oldRules && !fs.existsSync(RULES_BAK)) {
    fs.writeFileSync(RULES_BAK, JSON.stringify(oldRules, null, 2), "utf8");
    console.log(`\n已备份旧库 → ${path.relative(REPO, RULES_BAK)}`);
  }
  fs.writeFileSync(RULES_PATH, JSON.stringify(outRules, null, 2), "utf8");
  console.log(`已写入 ${path.relative(REPO, RULES_PATH)}`);
}

// ─────────────────────── 报告 ───────────────────────

const report = [
  "# 规则库构建报告",
  "",
  `生成时间：${new Date().toISOString()}`,
  "",
  "## 数据源",
  "",
  "| 优先级 | 来源 | 条数 | 说明 |",
  "|---|---|---|---|",
  `| P0 | 本机 local_gun_codes.json | ${localItems.length} | 用户自己确认过的枪名，权威 |`,
  `| P1 | guns.anxu.cc | ${anxuSchemes.length} | 线上公开方案，指纹零冲突 |`,
  `| P2 | 旧 rules.json | ${Object.keys(oldRules?.fingerprints ?? {}).length} | 仅保留未冲突项 |`,
  "",
  "## 结果",
  "",
  `- 指纹总数：**${fps.size}**（P0 ${p0Count} / P1 新增 ${p1Count - p0Count} / P2 新增 ${p2Added}）`,
  `- 枪械总数：**${guns.size}**`,
  `- 分类分布：${Object.entries(catStats).map(([k, v]) => `${k} ${v}`).join(" / ")}`,
  `- 冲突覆盖：${conflicts.length} 条`,
  "",
  "## 备注（config）收录规则",
  "",
  "> 规则库**一律不写备注**。所有条目的 `config` 恒为空字符串。",
  "",
  "原因：",
  "1. 规则库的职责只是「识别枪名」。配置名是用户自己那套改法的说明，不该由别人的数据预填。",
  "2. 从 P1/P2 抄来的配置名多为作者营销文案（如「28w机密得吃巨浪！」），",
  "   以及表格跨行继承错位产生的错误配置名 —— 两者都会污染用户数据。",
  "3. 即便 P0（用户自己的数据）也不写：他保存时本来就有自己的备注，",
  "   规则库再回填一遍只会在新增时把旧备注糊上去。",
  "",
  "因此以下字段**全部丢弃**：`title`、`short_desc`、`author_name`、`display_name`、",
  "以及 code 里内嵌的括号段（如 `（稳压版）`）。",
  "",
  "## 枪名归一化映射（供人工复核）",
  "",
  "| 原始写法 | 归一后 |",
  "|---|---|",
  ...[...gunNameMap.entries()]
    .filter(([raw, canon]) => raw !== canon)
    .sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([raw, canon]) => `| ${raw} | ${canon} |`),
  "",
  // 争议指纹排除清单：让读者知道哪些码被刻意排除、为什么
  EXCLUDED_FINGERPRINTS.size
    ? [
        "## 争议指纹（已排除，不参与识别）",
        "",
        "这些码的来源互相矛盾且无法确认，故从规则库排除。",
        "遇到时会显示「未识别」，而不是给出可能错误的枪名。",
        "",
        "| 指纹 | 完整码 | 排除原因 |",
        "|---|---|---|",
        ...[...EXCLUDED_FINGERPRINTS.entries()].map(
          ([fp, v]) => `| \`${fp}\` | \`${v.code}\` | ${v.reason} |`,
        ),
        "",
      ].join("\n")
    : "",
  conflicts.length
    ? [
        "## 冲突明细（低优先级被覆盖）",
        "",
        "| 指纹 | 保留 | 丢弃 | 来源 |",
        "|---|---|---|---|",
        ...conflicts.slice(0, 200).map((c) => `| \`${c.fp}\` | ${c.kept} | ${c.dropped} | ${c.origin} |`),
        conflicts.length > 200 ? `\n（共 ${conflicts.length} 条，此处仅列前 200）` : "",
      ].join("\n")
    : "## 冲突明细\n\n无冲突。",
  "",
];

fs.writeFileSync(REPORT_PATH, report.join("\n"), "utf8");
console.log(`已写入 ${path.relative(REPO, REPORT_PATH)}`);
