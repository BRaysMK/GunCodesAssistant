/** 骨架屏：加载列表时的占位，替代「加载中…」文字 */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-group" key={i}>
          <div className="skeleton skeleton-line w40" />
          <div className="skeleton skeleton-line w90" style={{ marginTop: 12 }} />
          <div className="skeleton skeleton-line w70" />
        </div>
      ))}
    </div>
  );
}
