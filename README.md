# 三角洲本地改枪码记事本

三角洲行动（Delta Force）玩家的**本地改枪码记事本** —— 保存、识别、管理你的改枪码，完全本地运行，离线可用。

## 这个软件是干嘛的

三角洲行动里每把枪的改枪方案都对应一串**改枪码**（如 `6KFCC1K08QMG6NRUK6UQC`），可以在游戏内直接导入。但改枪码又多又长，群里/文档里翻来翻去很麻烦。

这个记事本帮你：

1. **粘贴即识别** —— 把改枪码粘进来，自动识别出**枪名**和**配置名**（如 `RM277 + 20W青春版`、`MK47 + 75W满改红点`），不用手动记
2. **批量导入（带预览）** —— 从在线文档/表格复制整块内容，先**解析预览**（可逐条勾选、查看识别依据、标记重复），确认后再入库
3. **自动学习** —— 手动保存过的新枪/新配置，下次粘贴同枪代码自动识别
4. **分类 + 枪名筛选** —— 按类别（步枪/冲锋枪/射手步枪/机枪/霰弹枪/手枪/弓）与**可搜索多选的枪名**组合筛选，支持按条数/名称/最近排序
5. **数据安全** —— 数据存在本地 JSON，支持一键**导出备份 / 导入恢复**，换电脑不丢

## 识别能力（v1.1.0 重写）

| | v1.0.x | v1.1.0 |
|---|---|---|
| 真实文档识别率 | 53% | **100%** |
| 指纹匹配 | 前 6 位（会冲突） | **前 10 位**（实测唯一） |
| 规则库 | 硬编码 | **`resources/gun-codes/rules.json`**（399 指纹 / 71 枪，可热更） |
| 解析方式 | 纯文本行匹配 | **三段式**：行分类 → 同行匹配 → 跨行继承 |
| 识别失败 | 静默「未知枪械」 | 给出**置信度与识别依据** |
| 游戏模式 | 混收三个模式 | **仅烽火地带**（全面战场/黑潮爆破按分区自动跳过） |

**关于三个模式**：三角洲的 `烽火地带` / `全面战场` / `黑潮爆破` 改枪码**兼容性未知**，
本工具**只收录烽火地带**。导入含其他模式的文档时，会按分区标题自动识别并跳过。

**词库热更**：`rules.json` 随包分发在 `resources/gun-codes/` 下，
替换该文件后点界面左下角「刷新词库」即可生效，无需重新编译。

## 界面（v1.3.0 用 FluentUI 重做）

界面基于 **Microsoft FluentUI v9（Fluent 2 设计语言）**，不引入任何自绘组件或手写样式表。

整体是标准桌面应用外壳：**顶栏 / 主区 / 状态栏** 三行，主区再分**磁贴导航 + 内容**两栏。

- **顶栏**：品牌 · 搜索 · 排序菜单 · 表格/分组视图切换 · 批量导入 · 备份菜单 · 添加改枪码 · 主题与词库
- **磁贴导航（左栏）**：分类选择器（一排紧凑按钮）+ **武器磁贴网格**。
  一块磁贴 = 一把枪，标注配置条数；分类用左侧 3px 色条表达而非徽标。
  点磁贴即筛选该枪，**Ctrl/⌘ + 点击可多选**（沿用桌面端惯例，不额外占界面）。
- **内容区**：
  - **表格**：一行一条配置，列可拖拽调宽、支持多选（批量复制 / 批量删除）
  - **分组**：按枪折叠展开，适合逐把枪浏览
  - 行操作收进每行一个「⋯」菜单，而不是常驻三个图标
- **状态栏**：记录数 / 枪数 / 当前筛选 / 词库版本
- **添加与编辑合并为一个右侧抽屉（OverlayDrawer）**：粘贴后自动识别，显示置信度与识别依据
- **深色 / 浅色**一键切换（选择会记住），品牌色阶取自应用图标（蓝→紫）
- 窗口 <1100px 时磁贴导航收为浮层抽屉，由顶栏汉堡按钮唤起
- 骨架屏加载态、两态空状态（库为空 / 筛选无果）、搜索命中高亮、Fluent Toast 通知

> **排序只有一处真源**（顶栏排序菜单），表格表头不参与排序，避免两个入口互相覆盖。
>
> **视觉规范**见 `docs/UI-DECISIONS.md`：字体阶、表面层次、行高、降噪规则都写在那里，
> 改动界面前请先读，避免回退到「能用但廉价」的状态。

### 只想改界面、不想编译 Rust？

界面可以在普通浏览器里预览（用内存假数据顶替 Tauri 后端）：

```bash
VITE_GCA_MOCK=1 npm run dev
```

`src/dev/mockTauri.ts` 实现了 `window.__TAURI_INTERNALS__` 的最小替身。它**只在
`VITE_GCA_MOCK=1` 时被动态 import**，正式构建会被完全摇掉 —— 可用
`grep __GCA_MOCK__ dist/assets/*.js` 验证（应无结果）。

## 快速开始

### 方式一：直接下载（推荐）
到 [Releases](https://github.com/BRaysMK/GunCodesAssistant/releases) 下载：
- `gun-codes-app.exe` —— 绿色版，双击即用
- `GunCodesAssistant_*_x64_en-US.msi` —— 安装版

Windows 10/11 自带 WebView2 运行时，无需额外安装。

### 方式二：源码构建
```bash
npm install
npm run tauri:build
# 产物在 src-tauri/target/release/
```

> 本机若 `cargo` 不在 PATH，需先设置 `CARGO_HOME` / `RUSTUP_HOME` 再执行
> （见 `.dsh/scripts/gca-tauri-build.ps1` 的写法）。

## 使用说明

### 添加单条
1. 点右上角「添加」→ 右侧抽屉滑出
2. 粘贴改枪码 → 自动识别枪名 + 配置名（可手动修改）
3. 点「保存」

### 批量导入（带预览）
1. 点「批量导入」
2. 从在线文档/表格复制整段内容粘贴进来
3. 点「解析并预览」→ **先看预览**（可逐条勾选、查看识别依据、标记重复）
4. 确认无误点「确认导入（N）」

支持的格式示例：
```
RM277 20W青春版 6KFCC1K08QMG6NRUK6UQC
MK47突击步枪-烽火地带-6HN54R808PBNCS3LFEE0A
```

### 筛选与查找
- **类别**：左侧边栏点选（步枪 / 冲锋枪 / 射手步枪 / 机枪 / 霰弹枪 / 手枪 / 弓 / 其他）
- **枪名**：工具栏「枪名」按钮 → 可搜索的**多选**浮层
- **搜索**：枪名/代码/备注，**归一化匹配**（搜 `ak12` 也能命中 `AK-12`），命中片段高亮
- **排序**：按条数 / 名称 / 最近
- 以上可**自由组合**，筛选状态会记住

### 备份
- 「导出 JSON 备份」→ 选保存位置
- 「导入 JSON 备份」→ 选之前导出的文件，自动合并（按代码去重）

## 技术栈
- 桌面框架：Tauri 2（Rust 后端 + WebView2）
- 前端：React 19 + TypeScript + Vite
- UI：**FluentUI v9**（`@fluentui/react-components` + `@fluentui/react-icons`）
- 样式：Fluent 设计令牌（`tokens.*`）+ `makeStyles`；全局 CSS 只留 `src/styles/global.css`（尺寸链、首屏底色、滚动条）
- 存储：tauri-plugin-store（本地 JSON，数据在 `%APPDATA%\com.braysmk.guncodes\local_gun_codes.json`）

## 开发

```bash
npm install
VITE_GCA_MOCK=1 npm run dev   # 纯界面预览（无需 Rust，用内存假数据）
npm run tauri:dev             # 完整开发模式（真实后端）
npm run test:logic            # 纯逻辑层单测（11 项，无需测试框架）
npm run tauri:build           # 打包
```

代码结构：
```
src/
├── theme/theme.ts         # 品牌色阶 + Fluent 浅/深主题（全项目唯一写颜色字面量的地方）
├── lib/
│   ├── gunCodes.ts        # 纯逻辑（归一化/分类/统计），有单测锁定
│   └── clipboard.ts       # 复制（clipboard API + execCommand 降级）
├── hooks/
│   ├── useGunCodes.ts     # 数据层（所有 Tauri 命令集中于此）
│   ├── useFilters.ts      # 筛选/排序/分组/持久化/失效自愈
│   ├── useThemeMode.ts    # 主题解析与持久化（沿用 gca_theme_mode 键）
│   └── useMediaQuery.ts   # 断点订阅
├── components/            # FluentUI 组件层（SideNav/CommandBar/DataGrid/Tree/Editor/Dialog…）
├── dev/mockTauri.ts       # 浏览器预览用的假后端（正式构建会被摇掉）
└── styles/global.css      # 仅剩的全局样式
```

### 两个务必注意的 FluentUI 坑（都已在代码注释中标注）

1. **不要给 `FluentProvider` 传 `className` 承载布局。**
   它的 `applyStylesToPortals`（默认开）会把整个 className 复制到每个 portal 挂载节点上；
   而 portal 节点自带 `position:absolute; inset-inline:0; z-index:1000000` 且有不透明背景。
   一旦 className 里有 `height:100%`，每个 Tooltip 的 portal 都会变成铺满窗口的遮罩
   —— 实测 22 个 Tooltip 直接把界面盖没。布局请用 `style`。
2. **`NavCategoryItem` 的展开回调里，分类值在 `data.categoryValue`**，
   `data.value` 恒为空串。用错字段表现为「分类永远展不开」。

## 隐私
- 100% 本地运行，数据不上传、不联网
- 无任何广告、统计、遥测

## License
GPL-3.0
