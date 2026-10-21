/**
 * 从 g.aitags.cn（主播同款改枪码）抓取**独立于 anxu 的第三方样本**，用于交叉验证规则库。
 *
 * 为什么要独立源：用 anxu 的数据验证由 anxu 构建的规则库属于循环论证。
 * 本脚本从另一个站抓，才能真实检验「规则库认不认识没见过的码」。
 *
 * 该站主播页是服务端渲染，每行形如：
 *   <tr data-code="M7战斗步枪-烽火地带-6KQGVM0016OGGUAER4S67">
 *     <span class="code-chip">M7战斗步枪-烽火地带-6KQGVM...</span>
 *     ... 描述 ... 价值 ...
 *
 * 用法：node scripts/fetch-aitags.mjs [输出路径]
 * 默认输出 <repo>/.rules-src/aitags-dump.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const OUT = process.argv[2] ?? path.join(REPO, ".rules-src", "aitags-dump.json");

const BASE = "https://g.aitags.cn";

/** 从主页取全部主播 slug */
async function fetchStreamers() {
  const res = await fetch(`${BASE}/live`, {
    headers: { "User-Agent": UA, Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`/live HTTP ${res.status}`);
  const html = await res.text();
  const slugs = [...html.matchAll(/\/streamer\/([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  return [...new Set(slugs)];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36";

/** 解析单个主播页，抽出 data-code 与描述 */
async function fetchStreamerPage(slug) {
  const url = `${BASE}/streamer/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) return { slug, url, rows: [], error: `HTTP ${res.status}` };
  const html = await res.text();

  // 主播名
  const nameM = html.match(/主播\s*([^<\s]{1,24})\s*同款改枪码/);
  const streamerName = nameM ? nameM[1].trim() : slug;

  const rows = [];
  // 每个 <tr ... data-code="..."> 取 data-code 与后续两个 td 的文本
  const trRe = /<tr[^>]*data-code="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g;
  for (const m of html.matchAll(trRe)) {
    const code = m[1].trim();
    const inner = m[2];
    // 去掉第一个 td（码本身），取后面的 td 作为 描述 / 价值
    const tds = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((t) =>
      t[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    rows.push({
      code,
      desc: tds[1] ?? "",
      price: tds[2] ?? "",
    });
  }
  return { slug, url, streamerName, rows };
}

async function main() {
  console.log(`拉取主播列表 ${BASE}/live ...`);
  const slugs = await fetchStreamers();
  console.log(`  主播 ${slugs.length} 位`);

  const out = { source: BASE, fetchedAt: new Date().toISOString(), streamers: [] };

  for (const slug of slugs) {
    try {
      const r = await fetchStreamerPage(slug);
      const n = r.rows?.length ?? 0;
      out.streamers.push(r);
      console.log(`  ${slug.padEnd(20)} ${n} 条${r.error ? " (" + r.error + ")" : ""}`);
    } catch (e) {
      console.log(`  ${slug.padEnd(20)} 失败: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const total = out.streamers.reduce((a, s) => a + (s.rows?.length ?? 0), 0);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n已保存 ${OUT}`);
  console.log(`主播 ${out.streamers.length} 位 / 改枪码 ${total} 条`);

  if (total === 0) {
    console.error("没抓到任何改枪码 —— 页面结构可能已变。");
    process.exit(1);
  }
}

await main();
