/**
 * 终极检验：改枪码里**到底有没有**能标识枪械的片段？
 *
 * 方法（跨批次验证，排除「同一批数据凑巧相似」）：
 *   1. 用码的尾部（后 12 位）作为「批次 ID」把样本分组。
 *   2. 只保留**同一把枪出现在 ≥2 个不同批次**的样本。
 *   3. 枚举所有长度 3~8、所有起始位置，检查该片段的值是否能预测枪名
 *      （即：同一片段值 → 总是同一把枪，且跨批次成立）。
 *
 * 若找不到任何这样的片段，说明码里**不编码枪械信息**，
 * 只能靠「见过的码 → 枪名」查表，无法泛化。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const clean = (c) => String(c ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const norm = (s) => String(s ?? "").replace(/[\s\-_]/g, "").toUpperCase();

const samples = [];
function add(code, gun) {
  const c = clean(code);
  const g = norm(gun);
  if (!g || g === "未知枪械" || c.length < 21) return;
  samples.push({ code: c, gun: g, batch: c.slice(-12) });
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

// 只保留跨批次出现的枪（否则无法排除批次巧合）
const gunBatches = new Map();
for (const s of samples) {
  if (!gunBatches.has(s.gun)) gunBatches.set(s.gun, new Set());
  gunBatches.get(s.gun).add(s.batch);
}
const multiBatch = new Set([...gunBatches].filter(([, b]) => b.size >= 2).map(([g]) => g));
const use = samples.filter((s) => multiBatch.has(s.gun));

console.log(`样本总数: ${samples.length}`);
console.log(`跨 ≥2 批次的枪: ${multiBatch.size} 把，涉及样本 ${use.length} 条`);
console.log(`不同批次数: ${new Set(samples.map((s) => s.batch)).size}\n`);

const LEN = 21;
console.log("=== 枚举所有片段，找「跨批次仍能预测枪名」的位置 ===");
console.log("（判据：同一片段值 → 同一把枪，且该枪来自 ≥2 个批次）\n");
console.log("起-止   片段长度  唯一值数  能预测的样本数  纯度");

const findings = [];
for (let w = 3; w <= 8; w += 1) {
  for (let start = 0; start + w <= LEN; start += 1) {
    const m = new Map(); // 片段值 -> Map(gun -> count)
    for (const s of use) {
      const k = s.code.slice(start, start + w);
      if (!m.has(k)) m.set(k, new Map());
      const g = s.gun;
      m.get(k).set(g, (m.get(k).get(g) ?? 0) + 1);
    }
    let predictable = 0;
    let total = 0;
    let weighted = 0;
    for (const [, guns] of m) {
      const cnt = [...guns.values()].reduce((a, b) => a + b, 0);
      const top = Math.max(...guns.values());
      total += cnt;
      weighted += top;
      // 只统计「该片段值稳定对应单枪」且样本量 ≥2 的
      if (guns.size === 1 && cnt >= 2) predictable += cnt;
    }
    const purity = total ? weighted / total : 0;
    findings.push({ start, end: start + w, w, distinct: m.size, predictable, purity });
  }
}

findings.sort((a, b) => b.purity - a.purity);
for (const f of findings.slice(0, 15)) {
  console.log(
    `${String(f.start + "-" + f.end).padEnd(8)} ${String(f.w).padEnd(8)} ${String(f.distinct).padEnd(8)} ${String(f.predictable).padEnd(15)} ${(f.purity * 100).toFixed(1)}%`,
  );
}

// 关键判据：纯度接近 100% 且 distinct 很小 → 该片段能标识枪械
const best = findings[0];
console.log("\n=== 判定 ===");
console.log(`最高纯度片段: 位置 ${best.start}-${best.end}，纯度 ${(best.purity * 100).toFixed(1)}%，唯一值 ${best.distinct}`);

// 高纯度但 distinct 很大 = 只是唯一 ID（每段只出现一次），没有泛化力
const informative = findings.filter((f) => f.purity > 0.9 && f.distinct < use.length * 0.5);
if (informative.length === 0) {
  console.log("");
  console.log("结论: **码里不存在能标识枪械的片段**。");
  console.log("     所有高纯度片段都是「几乎唯一」的 ID 段（distinct ≈ 样本数），");
  console.log("     等于只记住了见过的码，对没见过的码毫无泛化能力。");
  console.log("");
  console.log("=> 规则库本质上只能是「码 → 枪名」查表，覆盖面 = 收录过的码。");
} else {
  console.log("\n找到可能有泛化力的片段:");
  informative.slice(0, 5).forEach((f) =>
    console.log(`  位置 ${f.start}-${f.end}: 纯度 ${(f.purity * 100).toFixed(1)}%, 唯一值 ${f.distinct}`),
  );
}
