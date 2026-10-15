import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import type {
  GunCode,
  PreviewResult,
  RecognizeResult,
  RulesMeta,
} from "@/lib/gunCodes";
import { setGunTable } from "@/lib/gunCodes";

export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  unrecognized: number;
}

/**
 * 数据层：所有 Tauri 命令调用集中在此。
 * 组件只消费状态与回调，不直接 `invoke`。
 */
export function useGunCodes(onError: (msg: string) => void) {
  const [items, setItems] = useState<GunCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<RulesMeta | null>(null);

  // 用 ref 存 onError，避免把它放进 useCallback 依赖导致 refresh 频繁重建
  const errRef = useRef(onError);
  useEffect(() => {
    errRef.current = onError;
  }, [onError]);

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<GunCode[]>("get_local_gun_codes");
      setItems(list);
    } catch (e) {
      errRef.current("加载失败: " + e);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 加载规则库元信息，并把**枪械分类表**注入纯逻辑层
   *
   * 注入后 `catOf()` 才能给出正确分类（否则一律「其他」）。
   * 这也让「刷新词库」后分类表自动同步，无需重编译。
   */
  const loadMeta = useCallback(async () => {
    try {
      const m = await invoke<RulesMeta>("get_gun_rules_meta");
      setMeta(m);
      if (m.guns && m.guns.length > 0) setGunTable(m.guns);
    } catch {
      /* 元信息失败不阻塞主流程（分类退回兜底表） */
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadMeta();
  }, [refresh, loadMeta]);

  // ── 识别（粘贴时实时调用）──
  const recognize = useCallback(
    (code: string) => invoke<RecognizeResult>("recognize_gun_name", { code }),
    [],
  );

  // ── 增删改 ──
  const add = useCallback(
    async (weaponName: string, code: string, note: string) => {
      await invoke("add_local_gun_code", { weaponName, code, note });
      await refresh();
      void loadMeta();
    },
    [refresh, loadMeta],
  );

  const update = useCallback(
    async (id: string, weaponName: string, code: string, note: string) => {
      await invoke("update_local_gun_code", { id, weaponName, code, note });
      await refresh();
      void loadMeta();
    },
    [refresh, loadMeta],
  );

  const remove = useCallback(
    async (id: string) => {
      await invoke("delete_local_gun_code", { id });
      await refresh();
    },
    [refresh],
  );

  /**
   * 批量删除。
   *
   * 刻意**不新增 Tauri 命令**：顺序复用既有的 `delete_local_gun_code`，
   * 结束后 refresh 一次。既保持后端命令面不变，也避免为一次 UI 需求改动 Rust。
   * 有失败项时抛错，让上层如实汇报，而不是谎报「全部成功」。
   */
  const removeMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return 0;
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await invoke("delete_local_gun_code", { id });
          ok++;
        } catch {
          failed++;
        }
      }
      await refresh();
      if (failed > 0) throw new Error(`${failed} 条未能删除（可能已被移除）`);
      return ok;
    },
    [refresh],
  );

  // ── 导入 ──
  /** 解析预览（**不写库**） */
  const preview = useCallback(
    (text: string) => invoke<PreviewResult>("preview_import_gun_codes", { text }),
    [],
  );

  /** 提交导入（把勾选项拼成 TSV 复用同一解析路径） */
  const importRows = useCallback(
    async (rows: { gun: string; config: string; code: string }[]) => {
      const text = rows.map((r) => [r.gun, r.config, r.code].join("\t")).join("\n");
      const res = await invoke<ImportSummary>("import_gun_codes_batch", { text });
      await refresh();
      void loadMeta();
      return res;
    },
    [refresh, loadMeta],
  );

  // ── 备份 ──
  const exportJson = useCallback(async () => {
    const path = await save({
      defaultPath: `改枪码备份_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return null;
    return invoke<number>("export_gun_codes", { path });
  }, []);

  const importJson = useCallback(async () => {
    const path = await open({
      filters: [{ name: "JSON", extensions: ["json"] }],
      multiple: false,
    });
    if (!path) return null;
    const n = await invoke<number>("import_gun_codes", { path: String(path) });
    await refresh();
    void loadMeta();
    return n;
  }, [refresh, loadMeta]);

  // ── 词库 ──
  const refreshRules = useCallback(async () => {
    await invoke("refresh_gun_rules");
    await loadMeta();
  }, [loadMeta]);

  return {
    items, loading, meta,
    refresh, loadMeta,
    recognize,
    add, update, remove, removeMany,
    preview, importRows,
    exportJson, importJson,
    refreshRules,
  };
}
