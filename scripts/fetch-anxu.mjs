/**
 * 抓取 guns.anxu.cc 的改枪方案，输出归一化前的原始样本。
 *
 * 背景：本项目识别改枪码靠「前 10 位指纹 → 枪名 + 配置」。原规则库只有 399 条，
 * 且部分枪名归属错位（详见 scripts/rules-report.md）。本脚本从公开站点补真实样本。
 *
 * 该站方案接口返回 AES-256-CBC 加密的 JSON，签名与解密参数来自其自身前端代码：
 *   - 请求签名：HMAC-SHA256(apiSecret, "k1=v1&k2=v2..."（key 升序）)
 *   - 解密：key = SHA-256(apiSecret)，AES-256-CBC，iv/data 均为 base64
 *
 * 只做只读抓取，仅用于本地识别库建设；不写入对方站点、不做高频请求。
 *
 * 用法：
 *   node scripts/fetch-anxu.mjs [输出路径]
 * 默认输出到 <repo>/.rules-src/anxu-dump.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const OUT = process.argv[2] ?? path.join(REPO, ".rules-src", "anxu-dump.json");

// 站点前端公开可见的常量
const API_SECRET = "b892bebfa11726c349f542660361e187e105c4fa1012217ebc9a189d30361151";
const APP_ID = "atguns1102";
const BASE = "https://guns.anxu.cc";

const rand = (n = 16) => {
  const cs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i += 1) s += cs.charAt(Math.floor(Math.random() * cs.length));
  return s;
};

function sign(params) {
  const flat = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === "sign" || v === null || v === undefined) continue;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") flat[k] = String(v);
  }
  const str = Object.keys(flat).sort().map((k) => `${k}=${flat[k]}`).join("&");
  return crypto.createHmac("sha256", API_SECRET).update(str, "utf8").digest("hex");
}

function decrypt(payload) {
  const key = crypto.createHash("sha256").update(API_SECRET, "utf8").digest();
  const iv = Buffer.from(payload.iv, "base64");
  const data = Buffer.from(payload.data, "base64");
  const d = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
}

async function getJson(apiPath, params = {}) {
  const all = { ...params, appId: APP_ID, timestamp: Math.floor(Date.now() / 1000), nonce: rand() };
  const qs = new URLSearchParams({ ...all, sign: sign(all) }).toString();
  const res = await fetch(`${BASE}${apiPath}?${qs}`, {
    headers: {
      Referer: `${BASE}/`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`${apiPath} HTTP ${res.status}`);
  const json = await res.json();
  return json && json.encrypted ? decrypt(json) : json;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const out = { source: BASE, fetchedAt: new Date().toISOString(), weapons: [], categories: [], schemes: [] };

  console.log("拉取枪械表 /api/weapons ...");
  out.weapons = (await getJson("/api/weapons")).items ?? [];
  console.log(`  枪械 ${out.weapons.length} 把`);

  console.log("拉取分类 /api/categories ...");
  out.categories = (await getJson("/api/categories")).items ?? [];
  console.log(`  分类 ${out.categories.length} 个`);

  const PAGE_SIZE = 100;
  const MAX_PAGES = 80;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let r;
    try {
      r = await getJson("/api/schemes", {
        page,
        page_size: PAGE_SIZE,
        sort: "smart",
        data_source: "cn",
      });
    } catch (e) {
      console.log(`  第 ${page} 页失败（停止）：${e.message}`);
      break;
    }
    const items = r.items ?? r.data ?? [];
    if (items.length === 0) break;
    out.schemes.push(...items);
    console.log(`  第 ${page} 页 +${items.length}（累计 ${out.schemes.length}）`);
    if (items.length < PAGE_SIZE) break;
    await new Promise((r2) => setTimeout(r2, 250));
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n已保存 ${OUT}`);
  console.log(`枪械 ${out.weapons.length} / 分类 ${out.categories.length} / 方案 ${out.schemes.length}`);

  if (out.schemes.length === 0) {
    console.error("\n没有抓到任何方案 —— 接口或密钥可能已变更。");
    process.exit(1);
  }
}

await main();
