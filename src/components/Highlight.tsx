/**
 * 搜索命中高亮
 *
 * 按归一化规则切分原串（归一化会去掉 `-`/空格，索引会错位，
 * 故用「逐字符归一化后匹配 + 原串切片」的方式定位）。
 */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const normChar = (c: string) => (/[\s\-_]/.test(c) ? "" : c.toUpperCase());
  const normQ = [...q].map(normChar).join("");
  if (!normQ) return <>{text}</>;

  // 在原串上滑动匹配：累积归一化字符，记录每个归一化位置对应的原串下标
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
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
