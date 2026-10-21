/**
 * 决定性验证：「前 10 位」到底是枪械特征，还是唯一 ID？
 *
 * 判据（关键）：
 *   如果前 10 位是「枪械特征」，那么**同一把枪的不同码，前 10 位应当有共性**
 *   （比如共享某个前缀段）。
 *   如果前 10 位是「唯一 ID」，那么同一把枪的不同码，前 10 位**毫无共性**。
 *
 * 做法：按枪名分组，看组内前 10 位的「公共前缀长度」分布。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const clean = (c) => String(c ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();

const byGun = new Map();
function add(code, gun) {
  const g = norm(gun);
  if (!g || g === "未知枪械") return;
  if (!byGun.has(g)) byGun.set(g, []);
  byGun.get(g).push(clean(code));
}

const LOCAL = path.join(process.env.USERPROFILE ?? process.env.HOME,
  "AppData", "Roaming", "com.braysmk.guncodes", "local_gun_codes.json");
if (fs.existsSync(LOCAL)) {
  const raw = JSON.parse(fs.readFileSync(LOCAL, "utf8"));
  for (const it of (Array.isArray(raw) ? raw : raw.items ?? [])) add(it.code, it.weapon_name);
}
const ANXU = path.join(REPO, ".rules-src", "anxu-dump.json");
if (fs.existsSync(ANXU)) {
  const d = JSON.parse(fs.readFileSync(ANXU, "utf8"));
  for (const s of d.schemes ?? []) {
    const m = String(s.code ?? "").match(/^(.+?)-烽火地带-([0-9A-Za-z]{10,})$/);
    if (m) add(m[2], m[1]);
  }
}

/** 一组字符串的最长公共前缀长度 */
function lcp(arr) {
  if (arr.length === 0) return 0;
  let n = 0;
  const first = arr[0];
  outer: for (let i = 0; i < first.length; i += 1) {
    for (const s of arr) {
      if (s[i] !== first[i]) break outer;
    }
    n += 1;
  }
  return n;
}

console.log("=== 同一把枪内部，码的公共前缀长度 ===");
console.log("（若前 10 位是枪械特征，同枪多码的公共前缀应普遍 ≥6~10）\n");
console.log("枪名            样本数   公共前缀   前10位是否全同");

const rows = [];
for (const [gun, codes] of byGun) {
  if (codes.length < 3) continue;
  const p = lcp(codes);
  const first10 = new Set(codes.map((c) => c.slice(0, 10)));
  rows.push({ gun, n: codes.length, lcp: p, same10: first10.size === 1 });
}
rows.sort((a, b) => b.n - a.n);

for (const r of rows.slice(0, 25)) {
  console.log(
    `${r.gun.padEnd(15)} ${String(r.n).padStart(5)} ${String(r.lcp).padStart(9)}   ${r.same10 ? "是" : "否"}`,
  );
}

// 统计
const all = rows.filter((r) => r.n >= 3);
const avgLcp = all.reduce((a, r) => a + r.lcp, 0) / (all.length || 1);
const mostlySame = all.filter((r) => r.same10).length;

console.log("\n=== 汇总 ===");
console.log(`有 ≥3 条样本的枪: ${all.length} 把`);
console.log(`平均公共前缀长度: ${avgLcp.toFixed(2)} 位`);
console.log(`前 10 位完全相同的枪: ${mostlySame} / ${all.length}`);
console.log("");
if (avgLcp <= 3) {
  console.log("结论: 同一把枪的码**几乎没有公共前缀** → 前 10 位是「唯一 ID」，不是枪械特征。");
  console.log("      当前实现等价于「记住见过的码」，泛化能力为零。");
} else {
  console.log("结论: 同枪多码存在明显公共前缀 → 前缀含有枪械特征信息。");
}
