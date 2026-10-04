export type SortDir = "asc" | "desc";

/** 可点击排序的表头；当前排序列显示箭头，并通过 aria-sort 告诉读屏软件。 */
export function SortHeader<K extends string>({
  label,
  k,
  sort,
  onSort,
  num,
}: {
  label: string;
  k: K;
  sort: { key: K; dir: SortDir };
  onSort: (k: K) => void;
  num?: boolean;
}) {
  const active = sort.key === k;
  return (
    <th
      className={num ? "num" : undefined}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button className="sort-btn" onClick={() => onSort(k)}>
        {label}
        <span className="arrow" aria-hidden>
          {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

/** 点同一列切换升降序，点新列从升序开始。 */
export function nextSort<K extends string>(cur: { key: K; dir: SortDir }, k: K): { key: K; dir: SortDir } {
  return cur.key === k ? { key: k, dir: cur.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "asc" };
}
