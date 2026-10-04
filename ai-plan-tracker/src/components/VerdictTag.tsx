import type { Verdict } from "@/lib/judge";

const ICON: Record<Verdict["kind"], string> = { lowest: "★", below: "↓", near: "≈", above: "↑" };

/** 价格判断标签：便宜的用绿色，其余中性；图标和文字始终一起出现。 */
export function VerdictTag({ v }: { v: Verdict | undefined }) {
  if (!v) return <span className="meta">—</span>;
  return (
    <span className={`verdict-tag ${v.kind}`}>
      <span aria-hidden>{ICON[v.kind]}</span>
      {v.label}
    </span>
  );
}
