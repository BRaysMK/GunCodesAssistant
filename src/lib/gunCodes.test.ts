/**
 * 纯逻辑层单元测试
 *
 * 运行：node --test src/lib/gunCodes.test.ts（需先构建）
 * 说明：项目未配 vitest，这里用 Node 内置 test runner + 手写等价断言，
 *       并以 .mjs 形式提供可执行版本（见同名 .test.mjs）。
 *
 * 本文件保留为「测试意图文档」，实际执行请用 npm run test:logic。
 */
import {
  norm,
  canonicalOf,
  catOf,
  CATEGORY_FALLBACK,
  CATEGORY_ORDER,
  buildCatOrder,
  countByCategory,
  computePreviewStats,
  healGunFilter,
  healCatFilter,
  buildGunCandidates,
  matchesQuery,
  fmtTime,
  type GunCode,
} from "./gunCodes";

export const CASES: { name: string; fn: () => void }[] = [
  {
    name: "norm 合并常见变体",
    fn: () => {
      const eq = (a: string, b: string) => norm(a) === norm(b);
      if (!eq("AK-12", "AK12")) throw new Error("AK-12 应等于 AK12");
      if (!eq("SR-3M", "SR3M")) throw new Error("SR-3M 应等于 SR3M");
      if (!eq("AS Val", "ASVAL")) throw new Error("AS Val 应等于 ASVAL");
      if (!eq("as val", "AS VAL")) throw new Error("应忽略大小写");
      if (norm("M7") === norm("M700")) throw new Error("M7 与 M700 不应混淆");
    },
  },
  {
    name: "canonicalOf 归一枪名（AS Val 只是一把枪）",
    fn: () => {
      const c = canonicalOf("AS VAL");
      if (c !== "AS Val") throw new Error(`期望 AS Val，得到 ${c}`);
      if (canonicalOf("ASVal") !== "AS Val") throw new Error("ASVal 未归一");
      if (canonicalOf("AS-VAL") !== "AS Val") throw new Error("AS-VAL 未归一");
      if (canonicalOf("AK12") !== "AK-12") throw new Error("AK12 未归一");
      if (canonicalOf("QJB201") !== "QJB") throw new Error("QJB201 未归一");
    },
  },
  {
    name: "catOf 分类 + 未收录归「其他」",
    fn: () => {
      if (catOf("M4A1") !== "步枪") throw new Error("M4A1 应为步枪");
      if (catOf("Vector") !== "冲锋枪") throw new Error("Vector 应为冲锋枪");
      if (catOf("AK12") !== "步枪") throw new Error("变体也应分类正确");
      if (catOf("某把新枪") !== CATEGORY_FALLBACK) throw new Error("未收录应归其他");
    },
  },
  {
    name: "「其他」必须在可见分类顺序中（旧版最严重缺陷）",
    fn: () => {
      const counts = countByCategory([
        { id: "1", weapon_name: "M4A1", code: "A", note: "", created_at: 0 },
        { id: "2", weapon_name: "某把新枪", code: "B", note: "", created_at: 0 },
      ]);
      const order = buildCatOrder(counts);
      if (!order.includes(CATEGORY_FALLBACK)) {
        throw new Error(`「其他」必须可见，实际顺序: ${order.join(",")}`);
      }
    },
  },
  {
    name: "buildCatOrder 剔除空分类且按数量降序追加其余",
    fn: () => {
      const counts = new Map([
        ["步枪", 5],
        ["其他", 2],
        ["霰弹枪", 0],
      ]);
      const order = buildCatOrder(counts);
      if (order.includes("霰弹枪")) throw new Error("空分类不应出现");
      if (!order.includes("其他")) throw new Error("「其他」应出现");
      const fixed = order.filter((c) => CATEGORY_ORDER.includes(c));
      const expected = CATEGORY_ORDER.filter((c) => (counts.get(c) ?? 0) > 0);
      if (fixed.join(",") !== expected.join(",")) {
        throw new Error(`固定顺序错乱: ${fixed.join(",")}`);
      }
    },
  },
  {
    name: "matchesQuery 归一化匹配（搜 ak12 命中 AK-12）",
    fn: () => {
      const item = { weapon_name: "AK-12", code: "6ABC", note: "满改红点" };
      if (!matchesQuery(item, "ak12")) throw new Error("应命中 ak12");
      if (!matchesQuery(item, "AK-12")) throw new Error("应命中 AK-12");
      if (!matchesQuery(item, "红点")) throw new Error("应命中备注");
      if (!matchesQuery(item, "6abc")) throw new Error("应命中代码（忽略大小写）");
      if (matchesQuery(item, "步枪x")) throw new Error("不应命中");
      if (!matchesQuery(item, "")) throw new Error("空查询应全通过");
    },
  },
  {
    name: "healGunFilter 剔除已不存在的枪名",
    fn: () => {
      const items: GunCode[] = [
        { id: "1", weapon_name: "M4A1", code: "A", note: "", created_at: 0 },
      ];
      const kept = healGunFilter(items, ["M4A1", "已删除的枪"]);
      if (kept.length !== 1 || kept[0] !== "M4A1") {
        throw new Error(`应只保留 M4A1，实际 ${kept.join(",")}`);
      }
      if (healGunFilter(items, ["不存在的枪"]).length !== 0) {
        throw new Error("全失效应清空");
      }
    },
  },
  {
    name: "healCatFilter 分类清空后回退 all",
    fn: () => {
      const items: GunCode[] = [
        { id: "1", weapon_name: "M4A1", code: "A", note: "", created_at: 0 },
      ];
      if (healCatFilter(items, "霰弹枪") !== "all") throw new Error("空分类应回退 all");
      if (healCatFilter(items, "步枪") !== "步枪") throw new Error("非空分类应保留");
      if (healCatFilter(items, "all") !== "all") throw new Error("all 应保持");
    },
  },
  {
    name: "computePreviewStats 统计正确（重复不计入可导入）",
    fn: () => {
      const preview = {
        total: 4,
        recognized: 3,
        unrecognized: 1,
        rows: [
          { code: "A", gun: "M4A1", config: "", recognized: true, confidence: 1, reason: "", source: "", duplicate: false },
          { code: "B", gun: "", config: "", recognized: false, confidence: 0, reason: "", source: "", duplicate: false },
          { code: "C", gun: "AKM", config: "", recognized: true, confidence: 1, reason: "", source: "", duplicate: true },
          { code: "D", gun: "M7", config: "", recognized: true, confidence: 1, reason: "", source: "", duplicate: false },
        ],
      };
      const st = computePreviewStats(preview, new Set());
      if (st.sel !== 3) throw new Error(`可导入应 3，实际 ${st.sel}`);
      if (st.dup !== 1) throw new Error(`重复应 1，实际 ${st.dup}`);
      if (st.unrecog !== 1) throw new Error(`未识别应 1，实际 ${st.unrecog}`);

      // 取消勾选 B 后：可导入 2，未识别 0
      const st2 = computePreviewStats(preview, new Set(["B"]));
      if (st2.sel !== 2) throw new Error(`取消后应 2，实际 ${st2.sel}`);
      if (st2.unrecog !== 0) throw new Error(`取消后未识别应 0，实际 ${st2.unrecog}`);

      const st3 = computePreviewStats(null, new Set());
      if (st3.sel !== 0 || st3.dup !== 0) throw new Error("null 预览应全 0");
    },
  },
  {
    name: "buildGunCandidates 受分类筛选影响并按条数降序",
    fn: () => {
      const items: GunCode[] = [
        { id: "1", weapon_name: "M4A1", code: "A", note: "", created_at: 0 },
        { id: "2", weapon_name: "AK12", code: "B", note: "", created_at: 0 },
        { id: "3", weapon_name: "AK-12", code: "C", note: "", created_at: 0 },
        { id: "4", weapon_name: "Vector", code: "D", note: "", created_at: 0 },
      ];
      // 全部：AK-12 合并后应为 2 条，排第一
      const all = buildGunCandidates(items, "all");
      if (all[0][0] !== "AK-12" || all[0][1] !== 2) {
        throw new Error(`AK-12 应合并为 2 条且居首，实际 ${JSON.stringify(all[0])}`);
      }
      // 只看冲锋枪：只剩 Vector
      const smg = buildGunCandidates(items, "冲锋枪");
      if (smg.length !== 1 || smg[0][0] !== "Vector") {
        throw new Error(`冲锋枪应只剩 Vector，实际 ${JSON.stringify(smg)}`);
      }
    },
  },
  {
    name: "fmtTime 边界",
    fn: () => {
      if (fmtTime(0) !== "") throw new Error("0 应返回空串");
      const out = fmtTime(1700000000);
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(out)) {
        throw new Error(`格式不符: ${out}`);
      }
    },
  },
];

/** 供 .mjs runner 调用的执行入口 */
export function runAll(): { pass: number; fail: number; messages: string[] } {
  let pass = 0;
  let fail = 0;
  const messages: string[] = [];
  for (const c of CASES) {
    try {
      c.fn();
      pass++;
      messages.push(`  ✅ ${c.name}`);
    } catch (e) {
      fail++;
      messages.push(`  ❌ ${c.name}\n       ${(e as Error).message}`);
    }
  }
  return { pass, fail, messages };
}
