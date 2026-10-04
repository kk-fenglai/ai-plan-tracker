"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Change } from "@/data/types";
import { changeSortKey } from "@/lib/pricing";
import { CHANGE_TYPES } from "./changeTypes";

const WINDOW_DAYS = 30;
const MAX_ROWS = 4;

/**
 * 首页的「最近变动」信息流。页面是构建时静态生成的，「最近 30 天」要按访问当天算，
 * 所以日期比较放在客户端；挂载前先显示最近几条，不显示数量。
 */
export function RecentChanges({ changes }: { changes: Change[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const cutoff = now === null ? null : new Date(now - WINDOW_DAYS * 86400_000).toISOString().slice(0, 10);
  const recent = cutoff === null ? [] : changes.filter((c) => changeSortKey(c.date) >= cutoff);
  const rows = (recent.length > 0 ? recent : changes).slice(0, MAX_ROWS);

  return (
    <section className="card recent" aria-labelledby="recent-h">
      <div className="recent-head">
        <h2 id="recent-h">
          {now === null
            ? "最近变动"
            : recent.length > 0
              ? `最近 ${WINDOW_DAYS} 天有 ${recent.length} 次套餐变动`
              : `最近 ${WINDOW_DAYS} 天没有新变动，这是最近几次`}
        </h2>
        <Link href="/changes/">全部 {changes.length} 条变更 →</Link>
      </div>
      <ul className="recent-list">
        {rows.map((c) => {
          const t = CHANGE_TYPES[c.type];
          return (
            <li key={c.id}>
              <span className="change-date num">{c.date}</span>
              <span className={`type ${t.tone}`}>
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </span>
              <span className="recent-title">
                <strong>{c.vendor}</strong> {c.title}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
