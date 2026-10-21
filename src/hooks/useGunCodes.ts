import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import type {
  GunCode,
  LearnedList,
  PreviewResult,
  RecognizeResult,
  RulesMeta,
  RuleFingerprintList,
  DeleteBulkResult,
  ClearAllResult,
  RulesResetResult,
  RulesUpdateCheck,
  RulesUpdateResult,
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
  /**
   * 批量删除
   *
   * v1.7.0 起改为**一次 IPC** 调用后端批量命令。
   * 旧实现是前端 for 循环逐条 invoke —— 543 条就是 543 次 IPC 加 543 次全量读写盘，
   * 既慢又会把中间状态反复落盘。
   */
  const removeMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return 0;
      const r = await invoke<DeleteBulkResult>("delete_local_gun_codes_by_ids", { ids });
      await refresh();
      if (!r.ok) throw new Error("批量删除失败");
      return r.deleted;
    },
    [refresh],
  );

  /** 清空全部改枪码（不可恢复，调用前必须二次确认） */
  const clearAll = useCallback(async () => {
    const r = await invoke<ClearAllResult>("clear_all_local_gun_codes");
    await refresh();
    return r;
  }, [refresh]);

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

  // ── 词库在线热更新 ──

  /** 检查是否有更新（只比对，不落盘） */
  const checkRulesUpdate = useCallback(
    () => invoke<RulesUpdateCheck>("check_gun_rules_update"),
    [],
  );

  /** 下载并应用远程词库（本地优先合并） */
  const updateRules = useCallback(async () => {
    const res = await invoke<RulesUpdateResult>("update_gun_rules");
    await loadMeta();
    return res;
  }, [loadMeta]);

  /** 清除合并结果，回到随包分发的词库 */
  const resetRules = useCallback(async () => {
    const res = await invoke<RulesResetResult>("reset_gun_rules");
    await loadMeta();
    return res;
  }, [loadMeta]);

  // ── 学习表管理（输错枪名后可纠正） ──

  const listLearned = useCallback(
    () => invoke<LearnedList>("list_learned_fingerprints"),
    [],
  );

  const deleteLearned = useCallback(
    (fingerprint: string) => invoke<{ ok: boolean; removed?: number; remaining?: number; error?: string }>(
      "delete_learned_fingerprint",
      { fingerprint },
    ),
    [],
  );

  const clearLearned = useCallback(
    () => invoke<{ ok: boolean; cleared: number }>("clear_learned_fingerprints"),
    [],
  );

  /** 只清除学习表里遗留的备注，保留枪名（早期版本把备注也存了进去） */
  const clearLearnedNotes = useCallback(
    () => invoke<{ ok: boolean; cleaned: number; total?: number }>("clear_learned_notes"),
    [],
  );

  // ── 规则库条目管理（v1.6.0）──

  /** 列出规则库条目（搜索 + 分页） */
  const listRuleFingerprints = useCallback(
    (query = "", page = 1, pageSize = 50) =>
      invoke<RuleFingerprintList>("list_rule_fingerprints", { query, page, pageSize }),
    [],
  );

  /** 删除单条规则（写入黑名单，立即生效） */
  const deleteRuleFingerprint = useCallback(
    async (fingerprint: string) => {
      const r = await invoke<{ ok: boolean; error?: string }>("delete_rule_fingerprint", { fingerprint });
      await loadMeta();
      return r;
    },
    [loadMeta],
  );

  /** 修改单条规则的枪名（立即生效） */
  const updateRuleFingerprint = useCallback(
    async (fingerprint: string, gun: string) => {
      const r = await invoke<{ ok: boolean; error?: string }>("update_rule_fingerprint", { fingerprint, gun });
      await loadMeta();
      return r;
    },
    [loadMeta],
  );

  /** 清空线上库（回到纯本地库） */
  const clearOnlineRules = useCallback(async () => {
    const r = await invoke<{ ok: boolean; error?: string; removed?: boolean }>("clear_online_rules_cmd");
    await loadMeta();
    return r;
  }, [loadMeta]);

  /** 清空全部用户改动（删除黑名单 + 修改记录） */
  const clearRuleOverrides = useCallback(async () => {
    const r = await invoke<{ ok: boolean; error?: string; removed?: boolean }>("clear_rule_overrides");
    await loadMeta();
    return r;
  }, [loadMeta]);

  return {
    items, loading, meta,
    refresh, loadMeta,
    recognize,
    add, update, remove, removeMany, clearAll,
    preview, importRows,
    exportJson, importJson,
    refreshRules,
    checkRulesUpdate, updateRules, resetRules,
    listLearned, deleteLearned, clearLearned, clearLearnedNotes,
    listRuleFingerprints, deleteRuleFingerprint, updateRuleFingerprint,
    clearOnlineRules, clearRuleOverrides,
  };
}
