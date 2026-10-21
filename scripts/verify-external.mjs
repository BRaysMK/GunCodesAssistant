/**
 * 用**第三方独立样本**验证规则库（交叉验证）。
 *
 * 为什么需要：build-rules.mjs 用了 anxu 的数据，若再用 anxu 验证就是循环论证。
 * 本脚本用 g.aitags.cn（14 位主播、153 条）这类**完全没参与构建**的数据来检验，
 * 才能真实回答「规则库认不认识没见过的码」。
 *
 * 统计口径：
 *   - 命中且枪名一致  → PASS
 *   - 命中但枪名不符  → FAIL（错认，最严重）
 *   - 未收录          → MISS（可接受，说明库还需扩充）
 *
 * 用法：node scripts/verify-external.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const RULES = path.join(REPO, "src-tauri", "resources", "gun-codes", "rules.json");
const EXT = path.join(REPO, ".rules-src", "aitags-dump.json");

const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();
const fp10 = (c) => String(c ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();

/** 同一把枪的不同写法（与 verify-rules.mjs 保持一致） */
const GUN_EQUIV = [
  // 同一把枪的不同写法（每一条都对应真实的写法差异）
  ["弓", "复合弓"],
  ["巴雷特", "M82"],
  ["MCX", "MCX LT"], // 规范名 MCX LT，第三方/用户数据可能写 MCX
  ["SR-25", "SR25"],
  ["SMG-45", "SMG45"], // SMG45 是独立的一把冲锋枪，与 MCX LT 无关
  ["ASh-12", "ASH-12"],
  ["QJB201", "QJB"],
  ["QBZ95-1", "QBZ-95"],
];
function sameGun(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return true;
  return GUN_EQUIV.some(([x, y]) => (norm(x) === na && norm(y) === nb) || (norm(y) === na && norm(x) === nb));
}

/** 从「M7战斗步枪-烽火地带-6KQG...」里拆出枪名/模式/码 */
function parseCode(code) {
  const m = String(code).match(/^(.+?)-(烽火地带|全面战场|黑潮爆破)-([0-9A-Za-z]{10,})$/);
  if (!m) return null;
  return { gun: m[1].trim(), mode: m[2], raw: m[3] };
}

/**
 * 归一化第三方站点的枪名到本库写法。
 * 第三方会写「M7战斗步枪」「SR-3M紧凑突击步枪」这类带类型后缀的全名。
 */
const TYPE_SUFFIXES = [
  "精确射手步枪", "突击步枪", "战斗步枪", "射手步枪", "狙击步枪",
  "通用机枪", "轻机枪", "冲锋枪", "霰弹枪", "手枪", "步枪", "机枪",
];
function baseGun(raw) {
  let s = String(raw ?? "").trim().replace(/[（(][^)）]*[)）]/g, "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of TYPE_SUFFIXES) {
      if (s.length > suf.length && s.endsWith(suf)) {
        const rest = s.slice(0, -suf.length).trim();
        if (rest.length >= 2) { s = rest; changed = true; }
      }
    }
  }
  return s;
}

if (!fs.existsSync(EXT)) {
  console.log("缺少 .rules-src/aitags-dump.json，先跑 scripts/fetch-aitags.mjs");
  process.exit(0);
}

const rules = JSON.parse(fs.readFileSync(RULES, "utf8"));
const ext = JSON.parse(fs.readFileSync(EXT, "utf8"));

// 收集全部第三方样本
const samples = [];
for (const s of ext.streamers ?? []) {
  for (const r of s.rows ?? []) {
    const p = parseCode(r.code);
    if (!p) continue;
    if (p.mode !== "烽火地带") continue;
    samples.push({ ...p, streamer: s.streamerName ?? s.slug, desc: r.desc ?? "" });
  }
}

console.log("=== 第三方独立样本交叉验证 ===");
console.log(`规则库: v${rules.version}, ${Object.keys(rules.fingerprints).length} 指纹, ${Object.keys(rules.guns).length} 枪`);
console.log(`第三方: ${ext.source}, ${ext.streamers?.length ?? 0} 位主播, ${samples.length} 条烽火地带样本\n`);

let pass = 0, fail = 0, miss = 0;
const fails = [];
const misses = [];

for (const s of samples) {
  const fp = fp10(s.raw);
  const f = rules.fingerprints[fp];
  if (!f) {
    miss += 1;
    if (misses.length < 15) misses.push(`${fp} 期望=${baseGun(s.gun)} (${s.streamer})`);
    continue;
  }
  // 双向比对：库里的枪名 与 第三方枪名（含归一化）
  if (sameGun(f.gun, s.gun) || sameGun(f.gun, baseGun(s.gun))) {
    pass += 1;
  } else {
    fail += 1;
    if (fails.length < 20) {
      fails.push(`${fp}: 库=${f.gun} | 第三方=${s.gun} (归一后 ${baseGun(s.gun)}) @${s.streamer}`);
    }
  }
}

const hit = pass + fail;
const precision = hit ? ((pass / hit) * 100).toFixed(1) : "n/a";
const coverage = samples.length ? ((hit / samples.length) * 100).toFixed(1) : "n/a";

console.log("结果:");
console.log(`  命中且正确: ${pass}`);
console.log(`  命中但错认: ${fail}`);
console.log(`  未收录:     ${miss}`);
console.log(`  精确率(命中中正确占比): ${precision}%`);
console.log(`  覆盖率(全部样本中命中占比): ${coverage}%`);

if (fails.length) {
  console.log("\n错认明细（最严重，必须为 0）:");
  fails.forEach((x) => console.log("  " + x));
}
if (misses.length) {
  console.log("\n未收录样例（可接受，说明库可再扩充）:");
  misses.forEach((x) => console.log("  " + x));
}

console.log("\n=== 断言 ===");
const problems = [];
if (fail > 0) problems.push(`存在 ${fail} 条错认（应为 0）`);
if (samples.length < 50) problems.push(`第三方样本过少（${samples.length}），不足以验证`);

if (problems.length) {
  console.log("失败:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("PASS  零错认");
console.log("PASS  样本量充足");
console.log("\n交叉验证通过。");
