"use client";

import { useEffect, useRef } from "react";

export interface ColumnDef<K extends string> {
  id: K;
  label: string;
  /** 必须显示的列（如名称）不能隐藏。 */
  required?: boolean;
}

/** 「显示哪些列」下拉：用原生 details 实现，键盘和读屏都能用；点外面或按 Esc 收起。 */
export function ColumnPicker<K extends string>({
  columns,
  hidden,
  onChange,
}: {
  columns: ColumnDef<K>[];
  hidden: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (e: Event) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const optional = columns.filter((c) => !c.required);
  const shown = optional.filter((c) => !hidden.has(c.id)).length;
  const toggle = (id: K) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <details className="colpick" ref={ref}>
      <summary className="chip">
        显示列 {shown}/{optional.length}
      </summary>
      <div className="colpick-menu">
        {optional.map((c) => (
          <label key={c.id} className="switch">
            <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => toggle(c.id)} />
            {c.label}
          </label>
        ))}
        {hidden.size > 0 && (
          <button className="link-btn" onClick={() => onChange(new Set())}>
            全部显示
          </button>
        )}
      </div>
    </details>
  );
}
