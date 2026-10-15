import { Button, Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { CopyRegular, CheckmarkRegular } from "@fluentui/react-icons";
import { useEffect, useRef, useState } from "react";
import { Highlight } from "./Highlight";

const useStyles = makeStyles({
  line: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    /**
     * 必须有 minWidth:0：flex 子项的默认 min-width 是 auto，会被内容撑开，
     * 导致 `text-overflow: ellipsis` 失效、长码直接溢出到相邻列（实测溢出 46px）。
     */
    minWidth: 0,
    width: "100%",
  },
  /**
   * 代码本体**不做常驻 chip 装饰**。
   * 上一版给每行代码套了底色 + 边框 + 圆角，555 行就是 555 个色块，
   * 这是「像论坛」的主要来源之一。现在只在悬停时给出轻微底纹，
   * 表示「此处可点击复制」，静止态保持干净的等宽文本。
   */
  code: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    letterSpacing: "0.02em",
    color: tokens.colorBrandForeground2,
    cursor: "pointer",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    /** 同上：flex 收缩后仍要能被截断，故显式给 0 */
    minWidth: 0,
    /**
     * `0 1 auto`：按内容宽度自适应（改枪码是定长文本，不需要铺满整格），
     * 空间不足时才收缩并触发 ellipsis。用 `1 1 auto` 会让代码框被拉得过宽。
     */
    flex: "0 1 auto",
    maxWidth: "100%",
    display: "block",
    userSelect: "text",
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    paddingTop: "1px",
    paddingBottom: "1px",
    borderRadius: tokens.borderRadiusSmall,
    transitionProperty: "background-color, color",
    transitionDuration: tokens.durationFaster,
    transitionTimingFunction: tokens.curveEasyEase,
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      color: tokens.colorBrandForeground1,
    },
    ":focus-visible": {
      outlineWidth: tokens.strokeWidthThick,
      outlineStyle: "solid",
      outlineColor: tokens.colorStrokeFocus2,
      outlineOffset: "1px",
    },
  },
  copied: {
    color: tokens.colorPaletteGreenForeground1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  glyph: {
    flexShrink: 0,
    width: "16px",
    color: tokens.colorPaletteGreenForeground1,
    display: "inline-flex",
    alignItems: "center",
  },
});

/**
 * 改枪码文本：点击即复制（桌面应用里这是最高频动作，值得做成零跳转的一击）。
 *
 * 复制成功后按钮短暂切成对勾，给一个不必看 Toast 的即时反馈；
 * 同时按代码长度自动截断并保留 Tooltip 全文，避免长码撑破表格列宽。
 */
export function GunCodeText({
  code,
  query = "",
  onCopy,
  copyable = true,
}: {
  code: string;
  query?: string;
  onCopy: (code: string) => void;
  copyable?: boolean;
}) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = () => {
    if (!copyable) return;
    onCopy(code);
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={styles.line}>
      <Tooltip content={copied ? "已复制" : `点击复制 · ${code}`} relationship="description" withArrow>
        <code
          className={styles.code + (copied ? " " + styles.copied : "")}
          role={copyable ? "button" : undefined}
          tabIndex={copyable ? 0 : undefined}
          title={code}
          onClick={copy}
          onKeyDown={(e) => {
            if (!copyable) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copy();
            }
          }}
        >
          <Highlight text={code} query={query} />
        </code>
      </Tooltip>
      <span className={styles.glyph}>
        {copied ? <CheckmarkRegular fontSize={14} /> : null}
      </span>
    </div>
  );
}

/** 仅图标复制按钮，供工具栏/行内操作用 */
export function CopyIconButton({
  code,
  onCopy,
  label = "复制改枪码",
}: {
  code: string;
  onCopy: (code: string) => void;
  label?: string;
}) {
  return (
    <Tooltip content={label} relationship="label" withArrow>
      <Button
        appearance="subtle"
        size="small"
        icon={<CopyRegular />}
        aria-label={label}
        onClick={() => onCopy(code)}
      />
    </Tooltip>
  );
}
