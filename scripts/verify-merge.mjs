/**
 * 验证「本地优先合并」的逻辑（纯 JS 复刻 Rust 侧 merge_remote_into_local）。
 *
 * 目的：在不启动 App 的前提下，确认三条关键语义：
 *   1. 远程只补本地没有的指纹
 *   2. 本地已有的指纹**绝不被覆盖**
 *   3. 合并进来的条目 config 恒为空
 *
 * 用法：node scripts/verify-merge.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const LOCAL_RULES = path.join(REPO, "src-tauri", "resources", "gun-codes", "rules.json");
const REMOTE_DUMP = path.join(REPO, ".rules-src", "anxu-dump.json");

const base = JSON.parse(fs.readFileSync(LOCAL_RULES, "utf8"));

/** 从线上 dump 造一个「远程规则库」（模拟服务端发布的那份） */
function buildRemoteFromDump() {
  if (!fs.existsSync(REMOTE_DUMP)) return null;
  const d = JSON.parse(fs.readFileSync(REMOTE_DUMP, "utf8"));
  const fingerprints = {};
  const guns = {};
  for (const s of d.schemes ?? []) {
    const m = String(s.code ?? "").match(/^(.+?)-(烽火地带)-([0-9A-Za-z]{10,})$/);
    if (!m) continue;
    const fp = m[3].replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
    const gun = m[1].trim();
    if (!gun || fingerprints[fp]) continue;
    fingerprints[fp] = { gun, config: "", mode: "烽火地带" };
    guns[gun] = guns[gun] ?? { category: "其他", aliases: [] };
  }
  return { version: 99, generated: "test", mode: "烽火地带", guns, fingerprints };
}

const remote = buildRemoteFromDump();
if (!remote) {
  console.log("缺少 .rules-src/anxu-dump.json，跳过（先跑 scripts/fetch-anxu.mjs）");
  process.exit(0);
}

console.log("=== 本地优先合并验证 ===");
console.log(`本地库: v${base.version}, ${Object.keys(base.fingerprints).length} 指纹`);
console.log(`模拟远程: v${remote.version}, ${Object.keys(remote.fingerprints).length} 指纹\n`);

// 复刻 Rust 的合并逻辑
const merged = {
  ...base,
  fingerprints: { ...base.fingerprints },
  guns: { ...base.guns },
};
let added = 0;
let skippedExisting = 0;
let skippedNoGun = 0;
const overwritten = [];

for (const [fp, f] of Object.entries(remote.fingerprints)) {
  if (merged.fingerprints[fp]) {
    skippedExisting += 1;
    // 断言：本地条目必须原封不动
    const before = base.fingerprints[fp];
    const after = merged.fingerprints[fp];
    if (before.gun !== after.gun) overwritten.push(`${fp}: ${before.gun} → ${after.gun}`);
    continue;
  }
  if (!f.gun || !f.gun.trim()) {
    skippedNoGun += 1;
    continue;
  }
  if (f.mode && f.mode !== "烽火地带") continue;
  merged.fingerprints[fp] = { gun: f.gun, config: "", mode: "烽火地带" };
  added += 1;
}
for (const [g, meta] of Object.entries(remote.guns)) {
  if (!merged.guns[g]) merged.guns[g] = meta;
}

const afterCount = Object.keys(merged.fingerprints).length;
console.log(`结果: ${afterCount} 指纹（新增 ${added}，本地已存在跳过 ${skippedExisting}，无枪名跳过 ${skippedNoGun}）`);

// ── 断言 ──
const fails = [];

if (overwritten.length > 0) {
  fails.push(`本地条目被覆盖了 ${overwritten.length} 条: ${overwritten.slice(0, 3).join("; ")}`);
}

// 合并后 config 必须全空
const withCfg = Object.entries(merged.fingerprints).filter(([, v]) => v.config && v.config.trim());
if (withCfg.length > 0) {
  fails.push(`合并后有 ${withCfg.length} 条带备注（应为 0）`);
}

// 本地原有的每一条都必须在合并结果里、且枪名一致
for (const [fp, v] of Object.entries(base.fingerprints)) {
  const m = merged.fingerprints[fp];
  if (!m) { fails.push(`本地指纹 ${fp} 在合并结果中丢失`); break; }
  if (m.gun !== v.gun) { fails.push(`本地指纹 ${fp} 枪名被改: ${v.gun} → ${m.gun}`); break; }
}

// 新增条目必须都有枪名
const emptyGun = Object.entries(merged.fingerprints).filter(([, v]) => !v.gun || !v.gun.trim());
if (emptyGun.length > 0) fails.push(`合并后有 ${emptyGun.length} 条空枪名`);

console.log("");
if (fails.length) {
  console.log("失败:");
  fails.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
console.log("PASS  本地条目零覆盖");
console.log("PASS  合并结果无备注");
console.log("PASS  本地指纹无丢失/无改名");
console.log("PASS  新增条目均有枪名");
console.log("\n全部通过。");
