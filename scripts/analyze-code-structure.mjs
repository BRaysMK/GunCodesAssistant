/**
 * 分析改枪码的**结构**：到底哪一部分才是「枪械特征」？
 *
 * 背景：当前实现取前 10 位当指纹查表。但如果前 10 位只是「唯一 ID 的前缀」，
 * 那它就不是特征 —— 同一把枪换个配置、换一批数据，前 10 位就变了，
 * 等于「只认见过的码」，泛化能力为零。
 *
 * 本脚本用已标注的真实数据，逐位置/逐 n-gram 统计「预测枪名的能力」，
 * 找出真正稳定的枪械特征段。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const clean = (c) => String(c ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();

// ── 收集全部「已知枪名」的样本 ──
const samples = [];

// 1) 本机数据
const LOCAL = path.join(
  process.env.USERPROFILE ?? process.env.HOME,
  "AppData", "Roaming", "com.braysmk.guncodes", "local_gun_codes.json",
);
if (fs.existsSync(LOCAL)) {
  const raw = JSON.parse(fs.readFileSync(LOCAL, "utf8"));
  const items = Array.isArray(raw) ? raw : (raw.items ?? []);
  for (const it of items) {
    if (!it.weapon_name || norm(it.weapon_name) === "未知枪械") continue;
    samples.push({ code: clean(it.code), gun: it.weapon_name, src: "local" });
  }
}

// 2) anxu
const ANXU = path.join(REPO, ".rules-src", "anxu-dump.json");
if (fs.existsSync(ANXU)) {
  const d = JSON.parse(fs.readFileSync(ANXU, "utf8"));
  for (const s of d.schemes ?? []) {
    const m = String(s.code ?? "").match(/^(.+?)-(烽火地带)-([0-9A-Za-z]{10,})$/);
    if (!m) continue;
    samples.push({ code: clean(m[3]), gun: m[1].trim(), src: "anxu" });
  }
}

// 3) aitags
const AIT = path.join(REPO, ".rules-src", "aitags-dump.json");
if (fs.existsSync(AIT)) {
  const d = JSON.parse(fs.readFileSync(AIT, "utf8"));
  for (const s of d.streamers ?? []) {
    for (const r of s.rows ?? []) {
      const m = String(r.code ?? "").match(/^(.+?)-(烽火地带)-([0-9A-Za-z]{10,})$/);
      if (!m) continue;
      samples.push({ code: clean(m[3]), gun: m[1].trim(), src: "aitags" });
    }
  }
}

console.log(`样本总数: ${samples.length}`);
const lenDist = {};
samples.forEach((s) => { lenDist[s.code.length] = (lenDist[s.code.length] ?? 0) + 1; });
console.log(`码长分布: ${JSON.stringify(lenDist)}`);

// ── 分析 1：前 N 位作为 key 的「唯一性」与「跨枪碰撞」──
console.log("\n=== 前 N 位作为 key ===");
console.log("N    唯一key数   一key多枪(碰撞)   覆盖率");
for (const n of [4, 5, 6, 8, 10, 12, 14]) {
  const m = new Map();
  for (const s of samples) {
    const k = s.code.slice(0, n);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(norm(s.gun));
  }
  let collide = 0;
  for (const set of m.values()) if (set.size > 1) collide += 1;
  const cov = ((m.size / samples.length) * 100).toFixed(1);
  console.log(`${String(n).padEnd(4)} ${String(m.size).padEnd(10)} ${String(collide).padEnd(16)} ${cov}%`);
}

// ── 分析 2：后 N 位 ──
console.log("\n=== 后 N 位作为 key ===");
console.log("N    唯一key数   一key多枪(碰撞)");
for (const n of [6, 8, 10, 12]) {
  const m = new Map();
  for (const s of samples) {
    const k = s.code.slice(-n);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k).add(norm(s.gun));
  }
  let collide = 0;
  for (const set of m.values()) if (set.size > 1) collide += 1;
  console.log(`${String(n).padEnd(4)} ${String(m.size).padEnd(10)} ${collide}`);
}

// ── 分析 3：逐位置字符 → 枪名的确定性 ──
// 对每个位置，看「该位置字符」能否区分枪名（用条件熵的粗略替代：最大纯度）
console.log("\n=== 逐位置字符对枪名的区分力（纯度 = 该字符下最常见枪名占比）===");
console.log("位置  取值数  平均纯度  最高纯度");
const maxLen = Math.max(...samples.map((s) => s.code.length));
const posStats = [];
for (let i = 0; i < Math.min(maxLen, 30); i += 1) {
  const byChar = new Map();
  for (const s of samples) {
    const ch = s.code[i];
    if (ch === undefined) continue;
    if (!byChar.has(ch)) byChar.set(ch, new Map());
    const g = norm(s.gun);
    byChar.get(ch).set(g, (byChar.get(ch).get(g) ?? 0) + 1);
  }
  let total = 0, weighted = 0, best = 0;
  for (const [, guns] of byChar) {
    const cnt = [...guns.values()].reduce((a, b) => a + b, 0);
    const top = Math.max(...guns.values());
    total += cnt;
    weighted += top;
    best = Math.max(best, top / cnt);
  }
  const purity = total ? weighted / total : 0;
  posStats.push({ pos: i, distinct: byChar.size, purity, best });
  console.log(
    `${String(i).padEnd(5)} ${String(byChar.size).padEnd(7)} ${(purity * 100).toFixed(1).padStart(8)}% ${(best * 100).toFixed(1).padStart(9)}%`,
  );
}

// ── 分析 4：找出「最能区分枪名」的连续子串（滑动窗口）──
console.log("\n=== 滑动窗口：哪个连续片段最能区分枪名 ===");
console.log("起-止   片段样例       唯一值数  纯度");
const windows = [];
for (const w of [4, 5, 6, 8]) {
  for (let start = 0; start + w <= maxLen; start += 1) {
    const m = new Map();
    for (const s of samples) {
      if (s.code.length < start + w) continue;
      const k = s.code.slice(start, start + w);
      if (!m.has(k)) m.set(k, new Map());
      const g = norm(s.gun);
      m.get(k).set(g, (m.get(k).get(g) ?? 0) + 1);
    }
    let total = 0, weighted = 0;
    for (const [, guns] of m) {
      const cnt = [...guns.values()].reduce((a, b) => a + b, 0);
      total += cnt;
      weighted += Math.max(...guns.values());
    }
    if (total === 0) continue;
    windows.push({
      w, start, end: start + w,
      distinct: m.size,
      purity: weighted / total,
      sample: [...m.keys()].slice(0, 3).join(","),
    });
  }
}
windows.sort((a, b) => b.purity - a.purity);
windows.slice(0, 15).forEach((x) => {
  console.log(
    `${String(x.start + "-" + x.end).padEnd(8)} ${x.sample.slice(0, 13).padEnd(14)} ${String(x.distinct).padEnd(9)} ${(x.purity * 100).toFixed(1)}%`,
  );
});

console.log("\n=== 结论提示 ===");
console.log("若「前 10 位」的纯度接近 100% 且碰撞为 0，说明它只是唯一 ID 前缀；");
console.log("若存在某个短片段纯度很高且跨数据集稳定，那个才是真正的枪械特征。");
