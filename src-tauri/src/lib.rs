//! 三角洲行动本地改枪码库 - 独立应用
//
// `local_gun_codes` 设为 `pub` 是为了让 `tests/` 下的集成测试
// （PDF 格式端到端识别测试）能访问其纯函数；不影响应用本身。
pub mod local_gun_codes;
pub mod remote_rules;
pub mod rule_overrides;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        // 词库在线热更新：仅在用户手动点「检查词库更新」时才发起请求
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // v1.6.0 迁移：清理旧版「合并文件」（改用三层叠加后不再需要）
            local_gun_codes::cleanup_legacy_merged(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            local_gun_codes::get_local_gun_codes,
            local_gun_codes::add_local_gun_code,
            local_gun_codes::delete_local_gun_code,
            // v1.7.0 新增：批量删除 / 清空全部改枪码
            local_gun_codes::delete_local_gun_codes_by_ids,
            local_gun_codes::clear_all_local_gun_codes,
            local_gun_codes::update_local_gun_code,
            local_gun_codes::recognize_gun_name,
            local_gun_codes::import_gun_codes_batch,
            local_gun_codes::export_gun_codes,
            local_gun_codes::import_gun_codes,
            // v1.1.0 新增：导入预览流 + 规则库元信息（词库随包热更）
            local_gun_codes::preview_import_gun_codes,
            local_gun_codes::get_gun_rules_meta,
            local_gun_codes::refresh_gun_rules,
            // v1.4.0 新增：规则库在线热更新（多源回退 + 本地优先合并）
            remote_rules::check_gun_rules_update,
            remote_rules::update_gun_rules,
            remote_rules::reset_gun_rules,
            // v1.6.0 新增：规则库条目增删改（本地/线上分离存储）
            rule_overrides::list_rule_fingerprints,
            rule_overrides::delete_rule_fingerprint,
            rule_overrides::update_rule_fingerprint,
            rule_overrides::clear_online_rules_cmd,
            rule_overrides::clear_rule_overrides,
            // v1.4.0 新增：学习表管理（输错枪名后可纠正）
            local_gun_codes::list_learned_fingerprints,
            local_gun_codes::delete_learned_fingerprint,
            local_gun_codes::clear_learned_fingerprints,
            local_gun_codes::clear_learned_notes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
