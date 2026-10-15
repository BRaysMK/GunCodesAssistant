/**
 * 纯逻辑单测 runner
 *
 * 用项目自带的 esbuild（vite 依赖）把 TS 测试打包成 CJS，再用 Node 执行。
 * 无需引入 vitest/jest 等测试框架，保持「无额外依赖」定位。
 *
 * 用法：node scripts/run-logic-tests.mjs
 */
import { build } from "esbuild";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

const tmp = mkdtempSync(join(tmpdir(), "gca-test-"));
const outfile = join(tmp, "tests.mjs");

try {
  await build({
    entryPoints: ["src/lib/gunCodes.test.ts"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    logLevel: "warning",
  });

  const mod = await import(pathToFileURL(outfile).href);
  const { pass, fail, messages } = mod.runAll();

  console.log("=== 纯逻辑层单测 ===");
  for (const m of messages) console.log(m);
  console.log();
  console.log(`结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
