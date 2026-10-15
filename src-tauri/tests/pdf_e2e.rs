//! 端到端测试：PDF / 流式文档格式的枪名识别
//!
//! ## 背景
//!
//! 内核原本只支持「xlsx/TSV」格式 —— 枪名是**独立单元格**，
//! 因此 `match_gun_in_row` 用「整体等于」即可。但 PDF / 贴吧 / 网页复制出来的
//! 文本是**流式**的，枪名与型号后缀紧贴、并与码用 `-` 连成一串：
//!
//! ```text
//! T1 65W 满改 AR57突击步枪-烽火地带-6L6FVH000B5F1EC0CC9I8
//!                       └────┬────┘
//!                    枪名带「突击步枪」后缀
//! ```
//!
//! **修复前实测识别率 0/27**（整体等于永远不成立）。
//!
//! ## 本测试的作用
//!
//! 用**真实文档文本**（`fixtures/daozai_pdf.txt`，从 `刀仔三角洲枪械改装.pdf`
//! 提取）跑三个纯函数（`split_by_code_anchor` / `match_gun_in_text` / `canonical_gun`），
//! 复现解析器的核心路径，断言：
//!   1. 识别率 ≥ 95%（修复前为 0%）
//!   2. 双码同行时**不跨段串枪**（各自匹配到自己的枪名）
//!   3. 噪音行（表头/分类词）不产生枪名
//!
//! 由于完整 `parse_document` 需要 `tauri::AppHandle`（读规则库），
//! 此处直接调用其内部纯函数，等价覆盖同一套匹配逻辑。

use std::collections::HashMap;

use gun_codes_app_lib::local_gun_codes::{
    canonical_gun_for_test, match_gun_in_text_for_test, split_by_code_anchor_for_test,
};

const FIXTURE: &str = include_str!("fixtures/daozai_pdf.txt");

/// 构造最小别名索引（模拟规则库加载后的结果）
///
/// 与 `rules.json` 的 guns/aliases 保持一致的关键项。
fn test_index() -> HashMap<String, String> {
    let mut m: HashMap<String, String> = HashMap::new();
    let norm = |s: &str| -> String {
        s.chars()
            .filter(|c| !c.is_whitespace() && *c != '-' && *c != '_')
            .collect::<String>()
            .to_uppercase()
    };

    let pairs: &[(&str, &[&str])] = &[
        ("AR57", &[]),
        ("MK4", &[]),
        ("MK47", &[]),
        ("SR-3M", &["SR3M"]),
        ("KC17", &[]),
        ("MP7", &[]),
        ("M7", &[]),
        ("M700", &[]),
        ("M249", &[]),
        ("M250", &[]),
        ("M1014", &[]),
        ("M4A1", &[]),
        ("M16A4", &[]),
        ("M14", &[]),
        ("AS Val", &["ASVAL"]),
        ("UZI", &[]),
        ("野牛", &[]),
        ("QJB", &["QJB201"]),
        ("弓", &["复合弓"]),
        ("M82", &[]),
        ("PSG-1", &[]),
        ("MINI14", &["Mini-14"]),
        ("SR25", &["SR-25"]),
        ("QBZ-95", &["QBZ95-1"]),
        ("杠杆步枪", &[]),
        ("Vector", &[]),
        ("MP5", &[]),
        ("PKM", &[]),
        ("CAR-15", &[]),
        ("SCAR-H", &[]),
        ("腾龙", &[]),
        ("AUG", &[]),
        ("SG552", &[]),
        ("AKM", &[]),
        ("ASH-12", &["ASh-12"]),
        ("AK-12", &["AK12"]),
        ("AKS-74U", &[]),
        ("PTR-32", &[]),
        ("SKS", &[]),
        ("SVD", &[]),
        ("SV-98", &[]),
        ("AWM", &[]),
        ("R93", &[]),
        ("SR9", &["SR-9"]),
        ("VSS", &[]),
        ("SVCH", &[]),
        ("S12K", &[]),
        ("M870", &[]),
        ("FS-12", &[]),
        ("P90", &[]),
    ];

    for (canon, aliases) in pairs {
        m.insert(norm(canon), canon.to_string());
        for a in *aliases {
            m.insert(norm(a), canon.to_string());
        }
    }
    m
}

#[test]
fn pdf_document_recognition_rate() {
    let idx = test_index();
    let mut total = 0usize;
    let mut recognized = 0usize;
    let mut detail: Vec<(String, bool)> = Vec::new();

    for line in FIXTURE.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }
        let segs = split_by_code_anchor_for_test(line);
        for (code, left) in &segs {
            total += 1;
            let gun = match_gun_in_text_for_test(&idx, left);
            let ok = gun.is_some();
            if ok {
                recognized += 1;
            }
            detail.push((format!("{} -> {:?}", code, gun), ok));
        }
    }

    let rate = recognized as f64 / total.max(1) as f64;
    println!("=== PDF 端到端识别 ===");
    println!("码总数: {total}  已识别: {recognized}  识别率: {:.1}%", rate * 100.0);
    for (d, _) in detail.iter().filter(|(_, ok)| !*ok).take(10) {
        println!("  未识别: {d}");
    }

    assert!(total >= 50, "夹具应含 ≥50 个码，实得 {total}（解析可能失效）");
    assert!(
        rate >= 0.95,
        "PDF 识别率 {:.1}% 低于 95% 门槛（修复前为 0%）",
        rate * 100.0
    );
}

#[test]
fn pdf_dual_code_line_no_cross_segment() {
    // 双码同行：每段必须匹配到自己的枪名，不能都取第一段的
    let idx = test_index();
    let line = "T1 50W 满腰射 AR57突击步枪-烽火地带-6JNVKVK03EINQ63AGU05N \
                T0 50W 三连发满改 MK47突击步枪-烽火地带-6IUK40806N3JUGK4SSBSR";
    let segs = split_by_code_anchor_for_test(line);
    assert_eq!(segs.len(), 2);

    let g0 = match_gun_in_text_for_test(&idx, &segs[0].1);
    let g1 = match_gun_in_text_for_test(&idx, &segs[1].1);
    assert_eq!(g0.as_deref(), Some("AR57"), "第 1 段应为 AR57，实得 {g0:?}");
    assert_eq!(g1.as_deref(), Some("MK47"), "第 2 段应为 MK47，实得 {g1:?}");
}

#[test]
fn pdf_headers_produce_no_gun() {
    // 表头 / 分类词 / 说明行不应产生枪名
    let idx = test_index();
    let noise_lines = [
        "抖音搜：刀仔（三角洲枪匠之王）",
        "步枪本版本 冲锋枪版本",
        "轻机枪版本",
        "连狙栓狙版本",
        "喷子手枪版本",
        "AR57",
    ];
    for l in noise_lines {
        // 无锚点 → 无段；即便有段，也不应匹配出枪名
        let segs = split_by_code_anchor_for_test(l);
        for (_, left) in &segs {
            let g = match_gun_in_text_for_test(&idx, left);
            assert!(g.is_none(), "噪音行 {l:?} 误配为 {g:?}");
        }
    }
}

#[test]
fn pdf_hyphen_and_space_names() {
    // 含连字符 / 空格的枪名必须能正确解析（旧实现的最大盲点）
    let idx = test_index();
    let cases: &[(&str, &str)] = &[
        ("T1 19W 丐版 SR-3M紧凑突击步枪-", "SR-3M"),
        ("T0 50W 半改 AS Val突击步枪-", "AS Val"),
        ("T2 40w 满改 MP5冲锋枪-", "MP5"),
        ("连狙 20W 24镜 Marlin杠杆步枪-", "杠杆步枪"),
    ];
    for (left, expect) in cases {
        let got = match_gun_in_text_for_test(&idx, left);
        assert_eq!(got.as_deref(), Some(*expect), "{left:?} 期望 {expect:?}，实得 {got:?}");
    }
}

#[test]
fn pdf_short_name_not_confused() {
    // 短名不得抢先：M700 不能变 M7、M1014 不能变 M10
    let idx = test_index();
    let cases: &[(&str, &str)] = &[
        ("狙击 55w 红点全自动 M700狙击步枪-", "M700"),
        ("T2 15w 鹿弹修脚 M1014霰弹枪-", "M1014"),
        ("T0 65W 高机动满改 M250通用机枪-", "M250"),
        ("T2 46w 满改红点 M249轻机枪-", "M249"),
        ("T2 15w 五弹爆头 M16A4突击步枪-", "M16A4"),
        ("T1 18W 丐版 M4A1突击步枪-", "M4A1"),
    ];
    for (left, expect) in cases {
        let got = match_gun_in_text_for_test(&idx, left);
        assert_eq!(got.as_deref(), Some(*expect), "{left:?} 期望 {expect:?}，实得 {got:?}");
    }
}

#[test]
fn four_stage_matcher_unit() {
    // 四段式各分支的等价性检查（不依赖文档）
    let idx = test_index();
    let cases: &[(&str, &str)] = &[
        ("AR57", "AR57"),                      // ① 整体
        ("AR57突击步枪", "AR57"),               // ② 剥离
        ("SR-3M紧凑突击步枪", "SR-3M"),          // ② 多轮剥离
        ("QJB201轻机枪", "QJB"),                // ③ 前缀
        ("Marlin杠杆步枪", "杠杆步枪"),          // ④ 子串
        ("复合弓", "弓"),                       // 别名
    ];
    for (input, expect) in cases {
        let got = canonical_gun_for_test(&idx, input);
        assert_eq!(got.as_deref(), Some(*expect), "{input:?} 期望 {expect:?}，实得 {got:?}");
    }
}
