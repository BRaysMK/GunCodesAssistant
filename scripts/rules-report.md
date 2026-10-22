# 规则库构建报告

生成时间：2026-10-22T02:27:09.012Z

## 数据源

| 优先级 | 来源 | 条数 | 说明 |
|---|---|---|---|
| P0 | 本机 local_gun_codes.json | 543 | 用户自己确认过的枪名，权威 |
| P1 | guns.anxu.cc | 2156 | 线上公开方案，指纹零冲突 |
| P2 | 旧 rules.json | 399 | 仅保留未冲突项 |

## 结果

- 指纹总数：**2332**（P0 626 / P1 新增 1698 / P2 新增 8）
- 枪械总数：**69**
- 分类分布：冲锋枪 12 / 机枪 4 / 射手步枪 10 / 狙击枪 5 / 手枪 8 / 霰弹枪 5 / 弓 1 / 步枪 24
- 冲突覆盖：225 条

## 备注（config）收录规则

> 规则库**一律不写备注**。所有条目的 `config` 恒为空字符串。

原因：
1. 规则库的职责只是「识别枪名」。配置名是用户自己那套改法的说明，不该由别人的数据预填。
2. 从 P1/P2 抄来的配置名多为作者营销文案（如「28w机密得吃巨浪！」），
   以及表格跨行继承错位产生的错误配置名 —— 两者都会污染用户数据。
3. 即便 P0（用户自己的数据）也不写：他保存时本来就有自己的备注，
   规则库再回填一遍只会在新增时把旧备注糊上去。

因此以下字段**全部丢弃**：`title`、`short_desc`、`author_name`、`display_name`、
以及 code 里内嵌的括号段（如 `（稳压版）`）。

## 枪名归一化映射（供人工复核）

| 原始写法 | 归一后 |
|---|---|
| 0开镜速度PSG-1 | PSG-1 |
| 1.5-5=M4A1突击步枪 | M4A1 |
| 100腰腾龙突击步枪 | 腾龙 |
| 100腰K416突击步枪 | K416 |
| 100腰S12K霰弹枪 | S12K |
| 14w极致性价比——P90冲锋枪 | P90 |
| 19w稳定均衡体——P90冲锋枪 | P90 |
| 21W半改：PKM通用机枪 | PKM |
| 22w40m射程完全体——P90冲锋枪 | P90 |
| 31W短刃枪管组合：KC17突击步枪 | KC17 |
| 357左轮 | 左轮 |
| 35W半改双修流：MP7冲锋枪 | MP7 |
| 41W满改 ：PKM通用机枪 | PKM |
| 47W共三沙暴组合：KC17突击步枪 | KC17 |
| 52W鏖战轻语：MK47突击步枪 | MK47 |
| 55W长枪管双修：MP7冲锋枪 | MP7 |
| 59W双修满改：SR-3M紧凑突击步枪 | SR-3M |
| 60W共三沙暴：M14射手步枪 | M14 |
| 64W共二沙暴：M14射手步枪 | M14 |
| 725双管 | 725 |
| 725双管霰弹枪 | 725 |
| 93r | 93R |
| 巴雷特 | M82 |
| 不稳的PTR-32 | PTR-32 |
| 杠杆式 | 杠杆步枪 |
| 杠杆式步枪 | 杠杆步枪 |
| 弓 | 复合弓 |
| 满改腰射M14 | M14 |
| 满改腰射M7 | M7 |
| 满改腰射SCAR-H | SCAR-H |
| 满改腰射SG552 | SG552 |
| 普通便宜超级稳ASh-12战斗步枪 | ASH-12 |
| 汤姆逊   冲锋枪 | 汤姆逊 |
| 汤姆逊冲锋枪 | 汤姆逊 |
| 腾龙突击步枪 | 腾龙 |
| 腾龙突击步枪20w无枪管均衡 | 腾龙 |
| 腾龙突击步枪40w高速导气低后座 | 腾龙 |
| 腰射MK47突击步枪 | MK47 |
| 野牛冲锋枪 | 野牛 |
| 一根M16A4 | M16A4 |
| 勇士冲锋枪 | 勇士 |
| 战斧无后座ASh-12战斗步枪 | ASH-12 |
| AK-12突击步枪 | AK-12 |
| AK12 | AK-12 |
| AKM突击步枪 | AKM |
| AKM突击步枪24w腰射颗秒流 | AKM |
| AKS-74U突击步枪 | AKS-74U |
| AR-57 | AR57 |
| AR57突击步枪 | AR57 |
| AS Val   （真半改往下翻） | AS Val |
| AS Val突击步枪 | AS Val |
| AS Val突击步枪50w半改 | AS Val |
| AS Val突击步枪65w45发弹夹满改 | AS Val |
| ASh-12 | ASH-12 |
| ASh-12战斗步枪 | ASH-12 |
| ASh-12战斗步枪30w双发套件 | ASH-12 |
| ASh-12战斗步枪38w带枪托满改性能 | ASH-12 |
| AUG突击步枪 | AUG |
| AWM狙击步枪 | AWM |
| CAR-15突击步枪 | CAR-15 |
| FS-12霰弹枪 | FS-12 |
| G3战斗步枪 | G3 |
| G3战斗步枪13w带镭射均衡 | G3 |
| K416突击步枪 | K416 |
| K437突击步枪 | K437 |
| KC17突击步枪 | KC17 |
| M1014霰弹枪 | M1014 |
| m14 | M14 |
| M14射手步枪 | M14 |
| M14射手步枪（稳压版） | M14 |
| M14射手步枪（消音器版） | M14 |
| M16A4突击步枪 | M16A4 |
| M249轻机枪 | M249 |
| M250通用机枪 | M250 |
| M4A1突击步枪 | M4A1 |
| M700狙击步枪 | M700 |
| M7战斗步枪 | M7 |
| M7战斗步枪（消音一倍镜） | M7 |
| M82狙击步枪 | M82 |
| M870霰弹枪 | M870 |
| Marlin杠杆步枪 | 杠杆步枪 |
| MCX | MCX LT |
| MCX LT突击步枪 | MCX LT |
| MDR突击步枪 | MDR |
| Mini-14射手步枪 | MINI14 |
| mk4 | MK4 |
| MK47突击步枪 | MK47 |
| MK4冲锋枪 | MK4 |
| MK4冲锋枪15w全绿稳定三连发 | MK4 |
| MK4冲锋枪25w性能强化版 | MK4 |
| MP5冲锋枪 | MP5 |
| MP7冲锋枪 | MP7 |
| P90冲锋枪 | P90 |
| PKM通用机枪 | PKM |
| PSG-1射手步枪 | PSG-1 |
| PTR-32突击步枪 | PTR-32 |
| QBZ95-1突击步枪 | QBZ-95 |
| QCQ171冲锋枪 | QCQ171 |
| QJB201 | QJB |
| QJB201轻机枪 | QJB |
| R93狙击步枪 | R93 |
| RM277突击步枪 | RM277 |
| S12K霰弹枪 | S12K |
| SCAR-H战斗步枪 | SCAR-H |
| SG552突击步枪 | SG552 |
| SKS射手步枪 | SKS |
| SMG-45 | SMG45 |
| SMG-45冲锋枪 | SMG45 |
| SMG-45冲锋枪12w低后座 | SMG45 |
| SMG-45冲锋枪12w对远特化 | SMG45 |
| SMG-45冲锋枪7w双修 | SMG45 |
| SR-25射手步枪 | SR25 |
| SR-3M紧凑突击步枪 | SR-3M |
| SR9射手步枪 | SR9 |
| SV-98狙击步枪 | SV-98 |
| SVCH精确射手 步枪 | SVCH |
| SVCH精确射手步枪 | SVCH |
| SVCH精确射手步枪50w满改 | SVCH |
| SVD狙击步枪 | SVD |
| UZI冲锋枪 | UZI |
| Vector冲锋枪 | Vector |
| vito的AS Val | AS Val |
| vito的SVCH | SVCH |
| VSS射手步枪 | VSS |

## 争议指纹（已排除，不参与识别）

这些码的来源互相矛盾且无法确认，故从规则库排除。
遇到时会显示「未识别」，而不是给出可能错误的枪名。

| 指纹 | 完整码 | 排除原因 |
|---|---|---|
| `6HHM76G03H` | `6HHM76G03HGRN5B0HUTCF` | 本机数据标 MK47（备注混有广告词），第三方直播平台数据源标「M700狙击步枪（三倍）」。双方均为人工录入且无法确认，用户决定排除。 |

## 冲突明细（低优先级被覆盖）

| 指纹 | 保留 | 丢弃 | 来源 |
|---|---|---|---|
| `6JOFC1S07O` | AR57 [X0] | RM277 [P0] | 本机数据 |
| `6JNV7PC08M` | AR57 [X0] | RM277 [P0] | 本机数据 |
| `6JNV8GO08M` | AR57 [X0] | RM277 [P0] | 本机数据 |
| `6JNV94008M` | AR57 [X0] | RM277 [P0] | 本机数据 |
| `6JNVA9008M` | AR57 [X0] | RM277 [P0] | 本机数据 |
| `6JNVAH008M` | AR57 [X0] | RM277 [P0] | 本机数据 |
| `6JNVE6O08M` | AS Val [X0] | 腾龙 [P0] | 本机数据 |
| `6JNVEA408M` | AS Val [X0] | 腾龙 [P0] | 本机数据 |
| `6JNVEG008M` | AS Val [X0] | 腾龙 [P0] | 本机数据 |
| `6JNVEJO08M` | AS Val [X0] | 腾龙 [P0] | 本机数据 |
| `6JNVFOG08M` | AK-12 [X0] | SCAR-H [P0] | 本机数据 |
| `6KFCL8C08Q` | AK-12 [X0] | SCAR-H [P0] | 本机数据 |
| `6JNVFQO08M` | AK-12 [X0] | SCAR-H [P0] | 本机数据 |
| `6JNVG7O08M` | AK-12 [X0] | SCAR-H [P0] | 本机数据 |
| `6JNVRDC08M` | Vector [X0] | UZI [P0] | 本机数据 |
| `6JNVRIG08M` | Vector [X0] | UZI [P0] | 本机数据 |
| `6JNVVM407O` | MK4 [X0] | 腾龙 [P0] | 本机数据 |
| `6JDADU00B1` | Vector [X0] | UZI [P0] | 本机数据 |
| `6JKA3B40B1` | Vector [X0] | UZI [P0] | 本机数据 |
| `6JCBN3C01O` | 杠杆步枪 [X0] | SVCH [P0] | 本机数据 |
| `6JCBN1K01O` | 杠杆步枪 [X0] | SVCH [P0] | 本机数据 |
| `6JDAPT80B1` | M14 [X0] | SVCH [P0] | 本机数据 |
| `6KTGH700ES` | M14 [X0] | SVCH [P0] | 本机数据 |
| `6JSLAQS0B1` | M14 [X0] | SVCH [P0] | 本机数据 |
| `6JCBNIG01O` | M14 [X0] | SVCH [P0] | 本机数据 |
| `6K1AQ380B1` | M14 [X0] | SVCH [P0] | 本机数据 |
| `6JCBPB401O` | 93R [X0] | G18 [P0] | 本机数据 |
| `6GPEANC0CQ` | PSG-1 [P0] | SR9 [P1] | 线上样本 |
| `6KMPJV80B1` | QJB [X0] | 汤姆逊 [P2] | 旧规则库 |
| `6JCBMMO01O` | PSG-1 [X0] | 汤姆逊 [P2] | 旧规则库 |
| `6L6IO8G0B1` | 汤姆逊 [X0] | M250 [P2] | 旧规则库 |
| `6KR3KCC0B1` | M250 [X0] | MK4 [P2] | 旧规则库 |
| `6JCLML001O` | SR25 [X0] | MK4 [P2] | 旧规则库 |
| `6JKA32C0B1` | MK4 [X0] | SVCH [P2] | 旧规则库 |
| `6K8SNBC0B1` | M250 [X0] | SVCH [P2] | 旧规则库 |
| `6LFPQ0C0B1` | MK4 [X0] | SVCH [P2] | 旧规则库 |
| `6K1ABMS0B1` | M250 [X0] | SVCH [P2] | 旧规则库 |
| `6LBTIHO08Q` | MK4 [X0] | MDR [P2] | 旧规则库 |
| `6JCBN3C01O` | 杠杆步枪 [X0] | QCQ171 [P2] | 旧规则库 |
| `6JDBP9K0B1` | QCQ171 [X0] | RM277 [P2] | 旧规则库 |
| `6JCBN1K01O` | 杠杆步枪 [X0] | RM277 [P2] | 旧规则库 |
| `6KFHOH00B1` | RM277 [P0] | M249 [P2] | 旧规则库 |
| `6KVF8JO0B1` | QCQ171 [X0] | M249 [P2] | 旧规则库 |
| `6JDAPT80B1` | M14 [X0] | M249 [P2] | 旧规则库 |
| `6JDBPB80B1` | MP7 [X0] | AR57 [P2] | 旧规则库 |
| `6KR3KGS0B1` | M249 [X0] | AR57 [P2] | 旧规则库 |
| `6ID9VEK013` | MP7 [X0] | AR57 [P2] | 旧规则库 |
| `6JCKL3O01O` | M249 [X0] | AR57 [P2] | 旧规则库 |
| `6JKA3640B1` | 勇士 [X0] | K437 [P2] | 旧规则库 |
| `6KR3KIO0B1` | M249 [X0] | K437 [P2] | 旧规则库 |
| `6JDGAQK0B1` | K437 [P0] | PKM [P2] | 旧规则库 |
| `6KTGH700ES` | M14 [X0] | PKM [P2] | 旧规则库 |
| `6JDGARK0B1` | K437 [P0] | SR-3M [P2] | 旧规则库 |
| `6JDBP680B1` | PKM [X0] | SR-3M [P2] | 旧规则库 |
| `6JSLAQS0B1` | M14 [X0] | SR-3M [P2] | 旧规则库 |
| `6JJG0B008Q` | PKM [X0] | SR-3M [P2] | 旧规则库 |
| `6JCBNIG01O` | M14 [X0] | SR-3M [P2] | 旧规则库 |
| `6IE8GH0013` | SR-3M [X0] | MCX LT [P2] | 旧规则库 |
| `6JJG0SC08Q` | PKM [X0] | MCX LT [P2] | 旧规则库 |
| `6K1AQ380B1` | M14 [X0] | MCX LT [P2] | 旧规则库 |
| `6JI40HC0AR` | MCX LT [P0] | SVD [P2] | 旧规则库 |
| `6HLS290053` | SMG45 [X0] | 腾龙 [P2] | 旧规则库 |
| `6K40NRG07O` | SVD [X0] | SMG45 [P2] | 旧规则库 |
| `6K6LJVG0B1` | SMG45 [X0] | 腾龙 [P2] | 旧规则库 |
| `6JCBNRO01O` | SVD [X0] | 腾龙 [P2] | 旧规则库 |
| `6JDJ8VK04U` | 腾龙 [P0] | 野牛 [P2] | 旧规则库 |
| `6JCBNV401O` | VSS [X0] | 野牛 [P2] | 旧规则库 |
| `6JDHM8O0B1` | 腾龙 [P0] | AS Val [P2] | 旧规则库 |
| `6K6LK2O0B1` | UZI [X0] | AS Val [P2] | 旧规则库 |
| `6JCBODO01O` | MINI14 [X0] | AS Val [P2] | 旧规则库 |
| `6JDHM9K0B1` | 腾龙 [P0] | Vector [P2] | 旧规则库 |
| `6L2UR480B1` | MINI14 [X0] | Vector [P2] | 旧规则库 |
| `6JDHMB00B1` | 腾龙 [P0] | Vector [P2] | 旧规则库 |
| `6L2UR5K0B1` | MINI14 [X0] | Vector [P2] | 旧规则库 |
| `6KVLAQK0B1` | 腾龙 [P0] | P90 [P2] | 旧规则库 |
| `6L31VT00B1` | SKS [X0] | P90 [P2] | 旧规则库 |
| `6JNVVM407O` | MK4 [X0] | SVCH [P2] | 旧规则库 |
| `6JFFGCS04U` | AWM [X0] | MP5 [P2] | 旧规则库 |
| `6JDJAIO04U` | KC17 [P0] | M700 [P2] | 旧规则库 |
| `6JDJB1404U` | KC17 [P0] | M700 [P2] | 旧规则库 |
| `6L6IH5C0B1` | M700 [X0] | MK47 [P2] | 旧规则库 |
| `6L6IKP80B1` | M700 [X0] | MK47 [P2] | 旧规则库 |
| `6K1AACS0B1` | MK47 [P0] | R93 [P2] | 旧规则库 |
| `6JDJC7G04U` | MK47 [P0] | 93R [P2] | 旧规则库 |
| `6JCBPEG01O` | 725 [X0] | G3 [P2] | 旧规则库 |
| `6JDANNK0B1` | S12K [X0] | SCAR-H [P2] | 旧规则库 |
| `6JDANPO0B1` | S12K [X0] | SCAR-H [P2] | 旧规则库 |
| `6JCBPL801O` | 复合弓 [X0] | SCAR-H [P2] | 旧规则库 |
| `6JCBPOC01O` | 复合弓 [X0] | SCAR-H [P2] | 旧规则库 |
| `6JEQHH80B1` | AK-12 [P0] | FS-12 [P2] | 旧规则库 |
| `6JMF8G408Q` | FS-12 [X0] | SG552 [P2] | 旧规则库 |
| `6JO73L80B1` | K416 [P0] | ASH-12 [P2] | 旧规则库 |
| `6JE5ED80B1` | K416 [P0] | ASH-12 [P2] | 旧规则库 |
| `6JDBPP00B1` | K416 [P0] | ASH-12 [P2] | 旧规则库 |
| `6L6EE1C07O` | 汤姆逊 [X0] | MDR [P2] | 旧规则库 |
| `6KFCGHO08Q` | SVCH [X0] | MDR [P2] | 旧规则库 |
| `6JO0GI004L` | M250 [X0] | MDR [P2] | 旧规则库 |
| `6L6EE3C07O` | 汤姆逊 [X0] | MDR [P2] | 旧规则库 |
| `6KFCH1408Q` | SVCH [X0] | MDR [P2] | 旧规则库 |
| `6JO0GKO04L` | M250 [X0] | MDR [P2] | 旧规则库 |
| `6L6EHHK07O` | MDR [X0] | M14 [P2] | 旧规则库 |
| `6L6FQE40F5` | 汤姆逊 [X0] | M14 [P2] | 旧规则库 |
| `6JO0GMO04L` | M250 [X0] | M14 [P2] | 旧规则库 |
| `6L6EFTC07O` | MDR [X0] | QCQ171 [P2] | 旧规则库 |
| `6JO03N804L` | M14 [X0] | QCQ171 [P2] | 旧规则库 |
| `6JO0GP404L` | M250 [X0] | QCQ171 [P2] | 旧规则库 |
| `6L6EGUS07O` | MDR [X0] | PKM [P2] | 旧规则库 |
| `6JNVMOG08M` | QCQ171 [X0] | PKM [P2] | 旧规则库 |
| `6JO03RS04L` | M14 [X0] | PKM [P2] | 旧规则库 |
| `6JNVNHK08M` | MP7 [X0] | RM277 [P2] | 旧规则库 |
| `6L6F2JS0F5` | M14 [X0] | RM277 [P2] | 旧规则库 |
| `6JO0H1G04L` | PKM [X0] | RM277 [P2] | 旧规则库 |
| `6L6F5RK0F5` | MP7 [X0] | RM277 [P2] | 旧规则库 |
| `6JO04JK04L` | M14 [X0] | RM277 [P2] | 旧规则库 |
| `6JO0H8C04L` | PKM [X0] | RM277 [P2] | 旧规则库 |
| `6JNVNSS08M` | MP7 [X0] | RM277 [P2] | 旧规则库 |
| `6JO04PC04L` | M14 [X0] | RM277 [P2] | 旧规则库 |
| `6JO0HCK04L` | PKM [X0] | RM277 [P2] | 旧规则库 |
| `6JNVO8O08M` | MP7 [X0] | RM277 [P2] | 旧规则库 |
| `6JO0HG804L` | PKM [X0] | RM277 [P2] | 旧规则库 |
| `6JNVOBS08M` | 勇士 [X0] | AR57 [P2] | 旧规则库 |
| `6JO04UG04L` | M700 [X0] | AR57 [P2] | 旧规则库 |
| `6JO0HKO04L` | QJB [X0] | AR57 [P2] | 旧规则库 |
| `6JNVOE408M` | 勇士 [X0] | AR57 [P2] | 旧规则库 |
| `6JO05B804L` | M700 [X0] | AR57 [P2] | 旧规则库 |
| `6JO0HMO04L` | QJB [X0] | AR57 [P2] | 旧规则库 |
| `6JNVOPK08M` | 勇士 [X0] | AR57 [P2] | 旧规则库 |
| `6JO05ES04L` | M700 [X0] | AR57 [P2] | 旧规则库 |
| `6JO0J6404L` | QJB [X0] | AR57 [P2] | 旧规则库 |
| `6JNV94008M` | AR57 [X0] | SR-3M [P2] | 旧规则库 |
| `6L6EQ800F5` | M700 [X0] | SR-3M [P2] | 旧规则库 |
| `6JO0J8O04L` | QJB [X0] | SR-3M [P2] | 旧规则库 |
| `6JNVA9008M` | AR57 [X0] | SR-3M [P2] | 旧规则库 |
| `6L6EOAG0F5` | M700 [X0] | SR-3M [P2] | 旧规则库 |
| `6JO0JB004L` | QJB [X0] | SR-3M [P2] | 旧规则库 |
| `6JNVAU808M` | MCX LT [X0] | M249 [P2] | 旧规则库 |
| `6JNVPHC08M` | SR-3M [X0] | M249 [P2] | 旧规则库 |
| `6JO06C804L` | PSG-1 [X0] | M249 [P2] | 旧规则库 |
| `6KS5RFS07O` | MCX LT [X0] | SVD [P2] | 旧规则库 |
| `6JNVPK808M` | SR-3M [X0] | SVD [P2] | 旧规则库 |
| `6JO0JP004L` | M249 [X0] | SVD [P2] | 旧规则库 |
| `6JNVB9K08M` | MCX LT [X0] | SMG45 [P2] | 旧规则库 |
| `6JO06Q004L` | SVD [X0] | SMG45 [P2] | 旧规则库 |
| `6JNVBHO08M` | MCX LT [X0] | SMG45 [P2] | 旧规则库 |
| `6JNVBRO08M` | MCX LT [X0] | MINI14 [P2] | 旧规则库 |
| `6JNV5F408M` | SMG45 [X0] | MINI14 [P2] | 旧规则库 |
| `6JNV5PG08M` | SMG45 [X0] | MK47 [P2] | 旧规则库 |
| `6JO074S04L` | MINI14 [X0] | MK47 [P2] | 旧规则库 |
| `6JO0LMK04L` | S12K [X0] | MK47 [P2] | 旧规则库 |
| `6JNVC7808M` | MK47 [X0] | VSS [P2] | 旧规则库 |
| `6JNV69S08M` | SMG45 [X0] | VSS [P2] | 旧规则库 |
| `6JNVCAO08M` | MK47 [X0] | SR25 [P2] | 旧规则库 |
| `6JNV6KO08M` | SMG45 [X0] | SR25 [P2] | 旧规则库 |
| `6JO0LQ004L` | M1014 [X0] | SR25 [P2] | 旧规则库 |
| `6JNVCCK08M` | MK47 [X0] | 野牛 [P2] | 旧规则库 |
| `6JO080C04L` | SR25 [X0] | 野牛 [P2] | 旧规则库 |
| `6JO0LTO04L` | 725 [X0] | 野牛 [P2] | 旧规则库 |
| `6JNVCE408M` | MK47 [X0] | R93 [P2] | 旧规则库 |
| `6JNVQSS08M` | 野牛 [X0] | R93 [P2] | 旧规则库 |
| `6JO0LV404L` | 725 [X0] | R93 [P2] | 旧规则库 |
| `6JNVCGG08M` | MK47 [X0] | UZI [P2] | 旧规则库 |
| `6JO08A004L` | SV-98 [X0] | UZI [P2] | 旧规则库 |
| `6JO0M2C04L` | 93R [X0] | UZI [P2] | 旧规则库 |
| `6JNVRDC08M` | Vector [X0] | KC17 [P2] | 旧规则库 |
| `6JO08HO04L` | AWM [X0] | KC17 [P2] | 旧规则库 |
| `6L6ESCK0F5` | 93R [X0] | KC17 [P2] | 旧规则库 |
| `6JNVD0008M` | KC17 [X0] | G18 [P2] | 旧规则库 |
| `6JNVRIG08M` | Vector [X0] | G18 [P2] | 旧规则库 |
| `6JO0F8K07O` | AWM [X0] | G18 [P2] | 旧规则库 |
| `6JNVD1O08M` | KC17 [X0] | P90 [P2] | 旧规则库 |
| `6JO0FKS04L` | AWM [X0] | P90 [P2] | 旧规则库 |
| `6JO0M7404L` | 沙鹰 [X0] | P90 [P2] | 旧规则库 |
| `6JOPRU808M` | KC17 [X0] | SKS [P2] | 旧规则库 |
| `6JNVRPK08M` | P90 [X0] | SKS [P2] | 旧规则库 |
| `6JO0MFO04L` | 沙鹰 [X0] | SKS [P2] | 旧规则库 |
| `6JNVRVC08M` | P90 [X0] | K437 [P2] | 旧规则库 |
| `6JO0G2404L` | SKS [X0] | K437 [P2] | 旧规则库 |
| `6JO0N0C04L` | 沙鹰 [X0] | K437 [P2] | 旧规则库 |
| `6JNVDB408M` | K437 [X0] | MP5 [P2] | 旧规则库 |
| `6JO0G6K04L` | 杠杆步枪 [X0] | MP5 [P2] | 旧规则库 |
| `6JO0MOO04L` | 沙鹰 [X0] | MP5 [P2] | 旧规则库 |
| `6JNVDEK08M` | K437 [X0] | 左轮 [P2] | 旧规则库 |
| `6JNVS4008M` | MP5 [X0] | 左轮 [P2] | 旧规则库 |
| `6JO0G7S04L` | 杠杆步枪 [X0] | 左轮 [P2] | 旧规则库 |
| `6LG99GS07O` | K437 [X0] | MK4 [P2] | 旧规则库 |
| `6JO0GAC04L` | 杠杆步枪 [X0] | MK4 [P2] | 旧规则库 |
| `6KFCNRG08Q` | 复合弓 [X0] | MK4 [P2] | 旧规则库 |
| `6JNVSU408M` | MK4 [X0] | 腾龙 [P2] | 旧规则库 |
| `6KGA7FO04L` | M82 [X0] | 腾龙 [P2] | 旧规则库 |
| `6KFCO6008Q` | 复合弓 [X0] | 腾龙 [P2] | 旧规则库 |
| `6JNVS9C08M` | MK4 [X0] | 腾龙 [P2] | 旧规则库 |
| `6L6EN180F5` | M82 [X0] | 腾龙 [P2] | 旧规则库 |
| `6KFCODC08Q` | 复合弓 [X0] | 腾龙 [P2] | 旧规则库 |
| `6JNVSBO08M` | MK4 [X0] | 腾龙 [P2] | 旧规则库 |
| `6KFCOKK08Q` | 复合弓 [X0] | 腾龙 [P2] | 旧规则库 |
| `6KFCJMO08Q` | 腾龙 [X0] | FS-12 [P2] | 旧规则库 |
| `6JNVSHO08M` | MK4 [X0] | FS-12 [P2] | 旧规则库 |
| `6JNVE2C08M` | 腾龙 [X0] | M870 [P2] | 旧规则库 |
| `6L6F7IK0F5` | MK4 [X0] | M870 [P2] | 旧规则库 |
| `6JNVE6O08M` | AS Val [X0] | M14 [P2] | 旧规则库 |

（共 225 条，此处仅列前 200）
