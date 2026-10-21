//! 规则库远程热更新
//!
//! 设计要点（每一条都对应一个真实踩过的坑）：
//!
//! 1. **多源回退**：GitHub raw 为主（缓存 5 分钟，更新及时），jsDelivr 为备
//!    （缓存 7 天，但国内可达性更好）。两者内容相同，任一可用即可。
//! 2. **本地永远优先**：远程库只用来**补充本地未收录的指纹**，
//!    绝不覆盖本地已有的条目。原因：本地数据是用户自己确认过的；
//!    而远程库（哪怕是本项目发布的）也可能有解析错误。
//!    实测教训：v5 库有 56.8% 的枪名归属错误，若让远程覆盖本地，用户数据会被污染。
//! 3. **不写入任何备注**：远程库只提供「指纹 → 枪名」，config 恒为空。
//!    别人的配置名（尤其营销文案）不该进用户的库。
//! 4. **落盘到 appDataDir，不碰 resource_dir**：
//!    resource_dir 属于安装目录，可能只读（Program Files 下 MSI 安装）。
//!    远程库写到用户数据目录，加载时优先读它。
//! 5. **只手动触发**：不自动联网。用户点「检查词库更新」才发请求。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

/// 远程规则库的候选地址（按顺序尝试，第一个成功即用）
///
/// 顺序理由：GitHub raw 的 Cache-Control 是 `max-age=300`（5 分钟），
/// 更新后很快就能拿到新版本；jsDelivr 对 `@main` 分支的缓存是 7 天，
/// 作为兜底更合适 —— 它稳定但滞后，不该放第一位。
const REMOTE_SOURCES: &[(&str, &str)] = &[
    (
        "github-raw",
        "https://raw.githubusercontent.com/BRaysMK/GunCodesAssistant/main/src-tauri/resources/gun-codes/rules.json",
    ),
    (
        "jsdelivr",
        "https://cdn.jsdelivr.net/gh/BRaysMK/GunCodesAssistant@main/src-tauri/resources/gun-codes/rules.json",
    ),
];

/// 远程库落盘文件名（放在 appDataDir 下）
const REMOTE_RULES_FILE: &str = "rules.remote.json";

/// 远程规则库的完整结构（与内嵌 rules.json 同构，另带一个来源标记）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteRules {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub generated: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub guns: std::collections::HashMap<String, crate::local_gun_codes::GunMeta>,
    #[serde(default)]
    pub fingerprints: std::collections::HashMap<String, crate::local_gun_codes::Fingerprint>,
}

/// 远程库在本地磁盘上的路径
pub fn remote_rules_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(REMOTE_RULES_FILE))
}

/// 读取已缓存的远程库（不联网）。文件不存在或损坏则返回 None。
pub fn load_cached_remote(app: &tauri::AppHandle) -> Option<RemoteRules> {
    let p = remote_rules_path(app)?;
    if !p.exists() {
        return None;
    }
    let text = std::fs::read_to_string(&p).ok()?;
    match serde_json::from_str::<RemoteRules>(&text) {
        Ok(r) => Some(r),
        Err(e) => {
            log::warn!("[Rules] 缓存的远程库解析失败 {}: {e}", p.display());
            None
        }
    }
}

/// 保存远程库到 appDataDir
fn save_remote(app: &tauri::AppHandle, r: &RemoteRules) -> Result<PathBuf, String> {
    let p = remote_rules_path(app).ok_or("无法获取应用数据目录")?;
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let text = serde_json::to_string_pretty(r).map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&p, text).map_err(|e| format!("写入失败: {e}"))?;
    Ok(p)
}

/// 从单个地址拉取并校验
async fn fetch_one(url: &str) -> Result<RemoteRules, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .user_agent("GunCodesAssistant/1.3 (+https://github.com/BRaysMK/GunCodesAssistant)")
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }

    let text = resp.text().await.map_err(|e| format!("读取响应失败: {e}"))?;

    let rules: RemoteRules = serde_json::from_str(&text).map_err(|e| format!("JSON 解析失败: {e}"))?;

    // 基本校验：宁可拒绝，也不要把坏数据落盘
    if rules.fingerprints.is_empty() {
        return Err("远程库指纹为空".into());
    }
    if rules.guns.is_empty() {
        return Err("远程库枪械表为空".into());
    }
    // 只接受烽火地带口径（与本地约定一致）
    if !rules.mode.is_empty() && rules.mode != "烽火地带" {
        return Err(format!("远程库模式不符: {}", rules.mode));
    }

    Ok(rules)
}

/// 联网检查并下载远程规则库。
///
/// 返回 `(来源名, 规则库)`。所有源都失败时返回 Err（附带每个源的失败原因）。
pub async fn fetch_remote() -> Result<(&'static str, RemoteRules), String> {
    let mut errors: Vec<String> = Vec::new();
    for (name, url) in REMOTE_SOURCES {
        match fetch_one(url).await {
            Ok(r) => {
                log::info!(
                    "[Rules] 远程库拉取成功: {} (v{}, {} 指纹)",
                    name,
                    r.version,
                    r.fingerprints.len()
                );
                return Ok((name, r));
            }
            Err(e) => {
                log::warn!("[Rules] 源 {} 失败: {e}", name);
                errors.push(format!("{name}: {e}"));
            }
        }
    }
    Err(format!("所有源均失败 —— {}", errors.join("；")))
}

/// 合并策略：**本地优先**，远程只补本地没有的指纹。
///
/// 返回 `(合并后的规则库, 新增条数)`。
///
/// 为什么不覆盖本地：本地指纹来自用户自己确认的数据。远程库即便由本项目发布，
/// 也可能因上游解析错误而失真（v5 曾有 56.8% 枪名归属错误）。
/// 因此远程只能「补空缺」，不能「改已有」。
pub fn merge_remote_into_local(
    mut base: crate::local_gun_codes::GunRules,
    remote: &RemoteRules,
) -> (crate::local_gun_codes::GunRules, usize) {
    let mut added = 0usize;

    for (fp, f) in &remote.fingerprints {
        // 本地已有 → 一律保留本地，不覆盖
        if base.fingerprints.contains_key(fp) {
            continue;
        }
        // 远程条目必须带枪名，否则丢弃（空枪名会污染界面）
        if f.gun.trim().is_empty() {
            continue;
        }
        // 只收烽火地带
        if !f.mode.is_empty() && f.mode != "烽火地带" {
            continue;
        }
        // 关键：**config 强制清空** —— 远程库不带备注进来
        base.fingerprints.insert(
            fp.clone(),
            crate::local_gun_codes::Fingerprint {
                gun: f.gun.clone(),
                config: String::new(),
                mode: "烽火地带".to_string(),
            },
        );
        added += 1;
    }

    // 补枪械表：远程有而本地没有的枪，带上分类与别名
    for (name, meta) in &remote.guns {
        base.guns.entry(name.clone()).or_insert_with(|| meta.clone());
    }

    // 版本号取两者较大者，便于前端展示
    base.version = base.version.max(remote.version);

    (base, added)
}

// ═══════════════════════ Tauri 命令 ═══════════════════════

/// 检查远程词库是否有更新（**只比对版本，不落盘**）
///
/// 供前端「检查更新」按钮先探测一次，避免用户误点就直接改库。
#[tauri::command]
pub async fn check_gun_rules_update(app: tauri::AppHandle) -> serde_json::Value {
    let local = crate::local_gun_codes::load_rules(&app);
    let local_ver = local.version;

    match fetch_remote().await {
        Ok((src, remote)) => {
            // 计算「若合并，能新增多少」
            let would_add = remote
                .fingerprints
                .iter()
                .filter(|(fp, f)| {
                    !local.fingerprints.contains_key(*fp)
                        && !f.gun.trim().is_empty()
                        && (f.mode.is_empty() || f.mode == "烽火地带")
                })
                .count();

            serde_json::json!({
                "ok": true,
                "source": src,
                "localVersion": local_ver,
                "remoteVersion": remote.version,
                "remoteGenerated": remote.generated,
                "remoteFingerprints": remote.fingerprints.len(),
                "wouldAdd": would_add,
                "hasUpdate": would_add > 0,
            })
        }
        Err(e) => serde_json::json!({
            "ok": false,
            "error": e,
            "localVersion": local_ver,
        }),
    }
}

/// 下载并应用远程词库（本地优先合并）
#[tauri::command]
pub async fn update_gun_rules(app: tauri::AppHandle) -> serde_json::Value {
    let (src, remote) = match fetch_remote().await {
        Ok(v) => v,
        Err(e) => {
            return serde_json::json!({ "ok": false, "error": e });
        }
    };

    // 先落盘远程库（保留原始副本，便于排查）
    let saved = match save_remote(&app, &remote) {
        Ok(p) => p.display().to_string(),
        Err(e) => {
            return serde_json::json!({ "ok": false, "error": format!("保存远程库失败: {e}") });
        }
    };

    // 合并进当前规则库
    let base = crate::local_gun_codes::load_rules(&app);
    let before = base.fingerprints.len();
    let (merged, added) = merge_remote_into_local(base, &remote);

    // 写回「合并后的规则库」到 appDataDir，并让运行时优先加载它
    if let Err(e) = crate::local_gun_codes::save_merged_rules(&app, &merged) {
        return serde_json::json!({ "ok": false, "error": e });
    }

    // 刷新缓存，让后续识别立即生效
    let reloaded = crate::local_gun_codes::reload_rules(&app);

    serde_json::json!({
        "ok": true,
        "source": src,
        "savedRemote": saved,
        "remoteVersion": remote.version,
        "remoteGenerated": remote.generated,
        "added": added,
        "before": before,
        "after": reloaded.fingerprints.len(),
        "version": reloaded.version,
        "gunCount": reloaded.guns.len(),
        "guns": crate::local_gun_codes::guns_table_public(&reloaded),
    })
}

/// 清除本地合并结果，回到随包分发的规则库
#[tauri::command]
pub fn reset_gun_rules(app: tauri::AppHandle) -> serde_json::Value {
    match crate::local_gun_codes::clear_merged_rules(&app) {
        Ok(removed) => {
            let r = crate::local_gun_codes::reload_rules(&app);
            serde_json::json!({
                "ok": true,
                "removed": removed,
                "version": r.version,
                "fingerprintCount": r.fingerprints.len(),
                "gunCount": r.guns.len(),
                "guns": crate::local_gun_codes::guns_table_public(&r),
            })
        }
        Err(e) => serde_json::json!({ "ok": false, "error": e }),
    }
}
