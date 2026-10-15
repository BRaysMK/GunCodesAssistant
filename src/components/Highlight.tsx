import { makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  mark: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    borderRadius: "2px",
    paddingInline: "1px",
    fontWeight: tokens.fontWeightSemibold,
  },
});

/**
 * 搜索命中高亮
 *
 * 按归一化规则切分原串：归一化会去掉 `-`/空格/下划线，若直接拿归一化串的
 * 下标去切原串就会错位。因此这里「逐字符归一化后匹配 + 记录归一化位置→原串
 * 下标映射」，再用原串切片，保证搜 `ak12` 能整段高亮出 `AK-12`。
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const styles = useStyles();
  const q = query.trim();
  if (!q) return <>{text}</>;

  const normChar = (c: string) => (/[\s\-_]/.test(c) ? "" : c.toUpperCase());
  const normQ = [...q].map(normChar).join("");
  if (!normQ) return <>{text}</>;

  const chars = [...text];
  const map: number[] = []; // 归一化下标 → 原串下标
  for (let i = 0; i < chars.length; i++) {
    if (normChar(chars[i]) !== "") map.push(i);
  }
  const normText = chars.map(normChar).join("");

  const idx = normText.indexOf(normQ);
  if (idx < 0) return <>{text}</>;

  const start = map[idx];
  const end = map[Math.min(idx + normQ.length - 1, map.length - 1)] + 1;

  return (
    <>
      {text.slice(0, start)}
      <mark className={styles.mark}>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
