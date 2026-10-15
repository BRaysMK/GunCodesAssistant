//! 三角洲行动本地改枪码库 - 独立应用
mod local_gun_codes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            local_gun_codes::get_local_gun_codes,
            local_gun_codes::add_local_gun_code,
            local_gun_codes::delete_local_gun_code,
            local_gun_codes::update_local_gun_code,
            local_gun_codes::recognize_gun_name,
            local_gun_codes::import_gun_codes_batch,
            local_gun_codes::export_gun_codes,
            local_gun_codes::import_gun_codes,
            // v1.1.0 新增：导入预览流 + 规则库元信息（词库随包热更）
            local_gun_codes::preview_import_gun_codes,
            local_gun_codes::get_gun_rules_meta,
            local_gun_codes::refresh_gun_rules
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
