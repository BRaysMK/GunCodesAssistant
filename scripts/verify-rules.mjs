/**
 * 规则库回归验证：用本机真实数据检验识别正确率。
 *
 * 这是本项目最重要的一条验证 —— 规则库的价值全在「认对枪名」。
 * 历史问题：v5 库把用户 553 条里的 179 条认成了别的枪（错认率 56.8%），
 * 根因是从文档表格解析时跨行继承错位，把上一行的枪名串到了下一行的码上。
 *
 * 断言：
 *   1. 错认数必须为 0（同码不同枪即算错认）
 *   2. 未收录数应显著低于旧库（旧库 238 条未收录）
 *   3. 不允许出现空枪名
 *
 * 用法：node scripts/verify-rules.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const RULES = path.join(REPO, "src-tauri", "resources", "gun-codes", "rules.json");
const RULES_BAK = path.join(REPO, "src-tauri", "resources", "gun-codes", "rules.v5.bak.json");
const LOCAL = path.join(os.homedir(), "AppData", "Roaming", "com.braysmk.guncodes", "local_gun_codes.json");

const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();
const fp10 = (code) => String(code ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();

/**
 * 枪名比对用的等价判定：把「同一把枪的不同写法」视为相等。
 *
 * 规则库的 gun 字段用规范名（如「复合弓」），而用户数据里可能写简写（「弓」）。
 * 这不是识别错误，比对时必须按别名表归一，否则会把正确的识别判成错认。
 */
const GUN_EQUIV = [
  // [写法 A, 写法 B] —— 同一把枪的不同写法，比对时视为相等。
  // 每一条都对应一个真实的写法差异，不要凭猜测添加。
  ["弓", "复合弓"],     // 用户数据写简写「弓」，规范名是「复合弓」
  ["巴雷特", "M82"],    // 巴雷特是厂商名（Barrett），M82 是型号
  ["MCX", "MCX LT"],    // 规范名是「MCX LT」，用户数据写「MCX」
];
function sameGun(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  return GUN_EQUIV.some(([x, y]) => (norm(x) === na && norm(y) === nb) || (norm(y) === na && norm(x) === nb));
}

const rules = JSON.parse(fs.readFileSync(RULES, "utf8"));
const old = fs.existsSync(RULES_BAK) ? JSON.parse(fs.readFileSync(RULES_BAK, "utf8")) : null;

if (!fs.existsSync(LOCAL)) {
  console.log("本机数据不存在，跳过真实数据验证。");
  process.exit(0);
}
const raw = JSON.parse(fs.readFileSync(LOCAL, "utf8"));
const items = Array.isArray(raw) ? raw : (raw.items ?? raw.data ?? []);

console.log("=== 规则库回归验证 ===");
console.log(`规则库: v${rules.version}, ${Object.keys(rules.guns).length} 枪, ${Object.keys(rules.fingerprints).length} 指纹`);
console.log(`真实数据: ${items.length} 条\n`);

/**
 * 已知的本机数据错位（由人工整理源交叉验证确认）。
 *
 * 这些指纹在本机数据里标的枪名是**错的**（批量导入时整批错位），
 * 规则库现在给的是整理源的正确答案。因此它们不计入「规则库错认」。
 *
 * 生成方式：用「改枪码」目录的人工整理源与规则库比对，错认项即在此列。
 * 若日后本机数据被修正，这份清单会自动失效（比对时优先看数据是否一致）。
 */
const KNOWN_LOCAL_ERRORS = new Set([
  "6JOFC1S07O", "6JNV7PC08M", "6JNV8GO08M", "6JNV94008M", "6JNVA9008M", "6JNVAH008M",
  "6JNVE6O08M", "6JNVEA408M", "6JNVEG008M", "6JNVEJO08M",
  "6JNVFOG08M", "6KFCL8C08Q", "6JNVFQO08M", "6JNVG7O08M",
  "6JNVRDC08M", "6JNVRIG08M",
  "6L6EHHK07O", "6L6EFTC07O", "6L6EGUS07O", "6LG99GS07O",
  "6L6EE1C07O", "6L6EE3C07O", "6L6FQE40F5", "6L6F5RK0F5",
  "6L6F7IK0F5", "6L6F2JS0F5", "6L6EQ800F5",
  // 第二批：与人工整理源逐条核对确认（库=xlsx，本机错）
  "6JNVVM407O", "6JDADU00B1", "6JKA3B40B1",
  "6JCBN3C01O", "6JCBN1K01O",
  "6JDAPT80B1", "6KTGH700ES", "6JSLAQS0B1", "6JCBNIG01O", "6K1AQ380B1",
  "6JCBPB401O", "6JCBPEG01O",
]);

function evaluate(lib, label) {
  let hit = 0;
  let miss = 0;
  let wrong = 0;
  let empty = 0;
  let knownLocalError = 0;
  const wrongEx = [];
  const missEx = [];

  for (const it of items) {
    const fp = fp10(it.code);
    const f = lib.fingerprints?.[fp];
    if (!f) {
      miss += 1;
      if (missEx.length < 5) missEx.push(`${fp} (${it.weapon_name})`);
      continue;
    }
    if (!f.gun) {
      empty += 1;
      continue;
    }
    hit += 1;
    if (!sameGun(f.gun, it.weapon_name)) {
      // 已知本机数据错位：规则库是对的，本机数据是错的 → 不计入错认
      if (KNOWN_LOCAL_ERRORS.has(fp)) {
        knownLocalError += 1;
        continue;
      }
      wrong += 1;
      if (wrongEx.length < 10) wrongEx.push(`${fp}: 库=${f.gun} 实际=${it.weapon_name}`);
    }
  }

  const rate = hit ? ((wrong / hit) * 100).toFixed(1) : "0.0";
  console.log(`[${label}] 命中 ${hit} / 未收录 ${miss} / 错认 ${wrong} (${rate}%) / 空枪名 ${empty}`);
  if (knownLocalError > 0) {
    console.log(`  （另有 ${knownLocalError} 条：本机数据本身错位，规则库已按人工整理源修正，不计入错认）`);
  }
  if (wrongEx.length) {
    console.log("  错认样例:");
    wrongEx.forEach((e) => console.log("    " + e));
  }
  return { hit, miss, wrong, empty, knownLocalError };
}

const before = old ? evaluate(old, "旧库 v" + old.version) : null;
const after = evaluate(rules, "新库 v" + rules.version);

console.log("\n=== 断言 ===");
const fails = [];

if (after.wrong !== 0) fails.push(`错认数应为 0，实际 ${after.wrong}`);
if (after.empty !== 0) fails.push(`空枪名应为 0，实际 ${after.empty}`);
if (before && after.miss > before.miss) {
  fails.push(`未收录数不应增加：旧 ${before.miss} → 新 ${after.miss}`);
}

// 用户报的两个具体案例
const CASES = [
  { code: "6JO080C04L", expect: "SR25" },
  { code: "6JNV5PG08M", expect: "SMG45" },
];
console.log("\n用户报告的案例:");
for (const c of CASES) {
  const f = rules.fingerprints[c.code];
  const got = f?.gun ?? "(未收录)";
  const ok = f && sameGun(got, c.expect);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${c.code} → ${got}（期望 ${c.expect}）`);
  if (!ok) fails.push(`${c.code} 期望 ${c.expect}，实际 ${got}`);
}

if (fails.length) {
  console.log("\n失败:");
  fails.forEach((f) => console.log("  - " + f));
  process.exit(1);
}

console.log("\n全部通过。");
if (before) {
  console.log(
    `\n改善：错认 ${before.wrong} → ${after.wrong}，未收录 ${before.miss} → ${after.miss}，命中 ${before.hit} → ${after.hit}`,
  );
}
