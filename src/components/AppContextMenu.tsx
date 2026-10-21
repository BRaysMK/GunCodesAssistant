import { useCallback, useEffect, useRef, useState } from "react";
import {
  Menu, MenuItem, MenuList, MenuPopover, makeStyles, tokens,
} from "@fluentui/react-components";
import {
  CopyRegular, SelectAllOnRegular,
} from "@fluentui/react-icons";
import { copyText } from "@/lib/clipboard";

const useStyles = makeStyles({
  /**
   * 右键菜单的锚点：定位在鼠标位置。
   *
   * Fluent 的 Menu 需要一个触发元素来做定位，但右键菜单没有真正的触发按钮，
   * 所以这里放一个 1×1 的隐形锚点，用 `fixed` 定位到光标处。
   */
  anchor: {
    position: "fixed",
    width: "1px",
    height: "1px",
    pointerEvents: "none",
    zIndex: 9999,
  },
});

/** 右键时记录的信息 */
interface CtxState {
  x: number;
  y: number;
  /** 命中位置是否在可编辑区域内 */
  editable: boolean;
  /** 该位置下的可复制文本（改枪码等） */
  copyText: string;
  /** 当前是否有选中文本 */
  hasSelection: boolean;
}

/**
 * 应用内右键菜单
 *
 * **为什么需要**：Tauri 的 WebView2 默认弹出浏览器那套菜单
 * （刷新 / 另存为 / 打印 / 检查），在桌面应用里非常违和。
 *
 * 处理策略（不是简单禁用）：
 *   - 可编辑区域（input / textarea / contenteditable）→ **不拦截**，
 *     保留系统原生菜单，输入法、拼写检查、粘贴历史才不会坏。
 *   - 其它区域 → 拦截，弹出应用自己的菜单：
 *       · 有选中文本 → 「复制」
 *       · 命中改枪码 → 「复制改枪码」
 *       · 「全选」
 *   - 无处可操作时（既无选中也无码）→ 仍然拦截，只是菜单项极少，
 *     保证「刷新/另存为/打印」永不出现。
 */
export function AppContextMenu() {
  const styles = useStyles();
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // ① 可编辑区域：放行原生菜单
    const tag = target.tagName;
    const isEditable =
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      target.isContentEditable ||
      !!target.closest('[contenteditable="true"]');
    if (isEditable) return;

    // ② 其它区域：拦截，避免出现浏览器的「刷新/另存为/打印」
    e.preventDefault();

    // 收集上下文
    const sel = window.getSelection();
    const hasSelection = !!sel && !sel.isCollapsed && (sel.toString() ?? "").trim().length > 0;

    // 命中改枪码：向上找最近的 <code> 元素
    const codeEl = target.closest("code");
    const codeText = codeEl?.textContent?.trim() ?? "";

    setCtx({
      x: e.clientX,
      y: e.clientY,
      editable: false,
      copyText: codeText,
      hasSelection,
    });
    setOpen(true);
  }, []);

  useEffect(() => {
    // 用捕获阶段，确保比任何组件先拿到事件
    window.addEventListener("contextmenu", handleContextMenu, true);
    return () => window.removeEventListener("contextmenu", handleContextMenu, true);
  }, [handleContextMenu]);

  // 右键时若已开着菜单，先关掉再重开（保证位置更新）
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!ctx) {
    // 首次渲染前也要有锚点，否则 Menu 无法定位
    return <div ref={anchorRef} className={styles.anchor} style={{ left: -9999, top: -9999 }} />;
  }

  const doCopySelection = () => {
    const text = window.getSelection()?.toString() ?? "";
    if (text) void copyText(text);
    setOpen(false);
  };

  const doCopyCode = () => {
    if (ctx.copyText) void copyText(ctx.copyText);
    setOpen(false);
  };

  const doSelectAll = () => {
    // 只选中当前聚焦区域或整页文本
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("root") ?? document.body);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    setOpen(false);
  };

  return (
    <>
      <div
        ref={anchorRef}
        className={styles.anchor}
        style={{ left: ctx.x, top: ctx.y }}
        aria-hidden
      />
      <Menu
        open={open}
        onOpenChange={(_e, d) => setOpen(d.open)}
        positioning={{ target: anchorRef.current ?? undefined, position: "below", align: "start" }}
      >
        <MenuPopover>
          <MenuList>
            {ctx.hasSelection && (
              <MenuItem icon={<CopyRegular />} onClick={doCopySelection}>
                复制
              </MenuItem>
            )}
            {ctx.copyText && (
              <MenuItem icon={<CopyRegular />} onClick={doCopyCode}>
                复制改枪码
              </MenuItem>
            )}
            <MenuItem icon={<SelectAllOnRegular />} onClick={doSelectAll}>
              全选
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
    </>
  );
}

/** 供调试：判断某元素是否属于「可编辑」白名单 */
export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as HTMLElement).isContentEditable ||
    !!el.closest('[contenteditable="true"]')
  );
}
