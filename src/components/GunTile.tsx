import { Caption1, Text, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { catOf, CATEGORY_FALLBACK, type GunCode } from "@/lib/gunCodes";
import { Highlight } from "./Highlight";

/**
 * 分类 → 左边框颜色。
 *
 * 磁贴需要一个「一眼区分类别」的视觉锚点，但**不能**给每块磁贴塞一个彩色徽标
 * （555 行 × 每行一个徽标 = 纯噪音）。用 2px 的左色条表达分类：
 * 面积小、不抢文字，却能在网格里形成可扫读的分组感。
 *
 * 全部取自 Fluent 语义化调色板，深浅主题下都成立。
 */
const CATEGORY_ACCENT: Record<string, string> = {
  步枪: tokens.colorPaletteBlueBorderActive,
  冲锋枪: tokens.colorPaletteTealBorderActive,
  狙击枪: tokens.colorPaletteBerryBorderActive,
  射手步枪: tokens.colorPalettePurpleBorderActive,
  机枪: tokens.colorPaletteMarigoldBorderActive,
  霰弹枪: tokens.colorPaletteDarkOrangeBorderActive,
  手枪: tokens.colorPaletteRedBorderActive,
  弓: tokens.colorPaletteGreenBorderActive,
};

const useStyles = makeStyles({
  tile: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    rowGap: tokens.spacingVerticalXXS,
    /**
     * 磁贴高度固定 56px：足够放下两行文字且满足 44px 最小可点面积，
     * 同时让网格在 320px 宽的窄栏里保持整齐的两列节奏。
     */
    minHeight: "56px",
    width: "100%",
    boxSizing: "border-box",
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalMNudge,
    paddingRight: tokens.spacingHorizontalS,
    textAlign: "left",
    cursor: "pointer",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusMedium,
    borderTopStyle: "solid",
    borderTopWidth: tokens.strokeWidthThin,
    borderRightStyle: "solid",
    borderRightWidth: tokens.strokeWidthThin,
    borderBottomStyle: "solid",
    borderBottomWidth: tokens.strokeWidthThin,
    borderLeftStyle: "solid",
    /** 左色条：比其余三边粗，作为分类锚点 */
    borderLeftWidth: "3px",
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: tokens.durationFast,
    transitionTimingFunction: tokens.curveEasyEase,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      borderTopColor: tokens.colorNeutralStroke1,
      borderRightColor: tokens.colorNeutralStroke1,
      borderBottomColor: tokens.colorNeutralStroke1,
    },
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
    ":focus-visible": {
      outlineWidth: tokens.strokeWidthThick,
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "1px",
    },
  },
  selected: {
    backgroundColor: tokens.colorBrandBackground2,
    borderTopColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    boxShadow: tokens.shadow2,
    ":hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
    },
  },
  name: {
    /** 枪名是磁贴主信息：语义化 semibold，不手写 font-weight */
    display: "block",
    width: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    width: "100%",
    color: tokens.colorNeutralForeground3,
  },
  count: {
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
  },
  /** 未收录分类的枪用虚线左条标记，避免与已知分类抢视觉权重 */
  unknownCat: {
    borderLeftStyle: "dashed",
  },
});

/**
 * 武器磁贴
 *
 * 一块磁贴 = 一把枪。作为总览入口，它承担「快速定位到某把枪」的职责，
 * 因此信息只保留**扫读必需**的两项：枪名与配置条数。
 * 分类用左色条表达而非徽标 —— 详见 CATEGORY_ACCENT 注释。
 */
export function GunTile({
  gun,
  count,
  selected,
  query,
  onSelect,
}: {
  gun: string;
  count: number;
  selected: boolean;
  /** 用于高亮搜索命中片段 */
  query: string;
  /** additive=true 表示按住 Ctrl/Cmd，累加选择而非替换 */
  onSelect: (gun: string, additive: boolean) => void;
}) {
  const styles = useStyles();
  const cat = catOf(gun);
  const accent = CATEGORY_ACCENT[cat];

  return (
    <button
      type="button"
      data-testid="gun-tile"
      data-gun={gun}
      className={mergeClasses(styles.tile, selected && styles.selected, !accent && styles.unknownCat)}
      style={accent ? { borderLeftColor: accent } : undefined}
      aria-pressed={selected}
      title={`${gun} · ${cat} · ${count} 条配置${selected ? "（Ctrl+点击可多选）" : ""}`}
      onClick={(e) => onSelect(gun, e.ctrlKey || e.metaKey)}
    >
      <Text className={styles.name} weight="semibold" size={300}>
        <Highlight text={gun} query={query} />
      </Text>
      <span className={styles.meta}>
        <Caption1 className={styles.count}>{count} 条</Caption1>
        {cat !== CATEGORY_FALLBACK && <Caption1>· {cat}</Caption1>}
      </span>
    </button>
  );
}

/** 供列表视图复用的分类色（表格里只在中性场景下用，避免噪音） */
export function categoryAccentOf(gun: string): string | undefined {
  return CATEGORY_ACCENT[catOf(gun)];
}

export type { GunCode };
