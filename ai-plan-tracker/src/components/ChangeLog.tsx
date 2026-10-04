"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Change, ChangeType, Plan } from "@/data/types";
import { MINE_KEY, useStoredSet } from "@/lib/storage";
import { CHANGE_TYPES as TYPES } from "./changeTypes";
import { VerifyBadge } from "./VerifyBadge";

const monthLabel = (date: string) => `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月`;

export function ChangeLog({ changes, plans }: { changes: Change[]; plans: Plan[] }) {
  const [mine, , loaded] = useStoredSet(MINE_KEY);
  const [vendor, setVendor] = useState<string>("all");
  const [type, setType] = useState<ChangeType | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const vendors = useMemo(() => [...new Set(changes.map((c) => c.vendor))], [changes]);
  const types = useMemo(
    () => (Object.keys(TYPES) as ChangeType[]).filter((t) => changes.some((c) => c.type === t)),
    [changes],
  );
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const affectsMe = (c: Change) => c.planIds.some((id) => mine.has(id));

  const shown = changes.filter(
    (c) =>
      (vendor === "all" || c.vendor === vendor) && (type === "all" || c.type === type) && (!onlyMine || affectsMe(c)),
  );
  // 数据已按时间倒序，按月份顺序分组即可保持倒序。
  const groups: [string, Change[]][] = [];
  for (const c of shown) {
    const key = c.date.slice(0, 7);
    const last = groups.at(-1);
    if (last && last[0] === key) last[1].push(c);
    else groups.push([key, [c]]);
  }
  const mineCount = changes.filter(affectsMe).length;

  return (
    <>
      <p className="answer">
        共记录 <strong className="num">{changes.length}</strong> 次变更，最近一次在{" "}
        <strong className="num">{changes[0]?.date}</strong>
        {loaded && mine.size > 0 && (
          <>
            ；其中 <strong className="num">{mineCount}</strong> 次影响你的订阅
          </>
        )}
        。
      </p>

      <div className="filters">
        <label className="field">
          厂商
          <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="all">全部厂商</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="seg" role="group" aria-label="变更类型">
          <button className="chip" aria-pressed={type === "all"} onClick={() => setType("all")}>
            全部类型
          </button>
          {types.map((t) => (
            <button key={t} className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
              {TYPES[t].label}
            </button>
          ))}
        </div>
        <label className="switch" title={mine.size === 0 ? "先在「我的订阅」里勾选你的档位" : undefined}>
          <input
            type="checkbox"
            checked={onlyMine}
            disabled={loaded && mine.size === 0}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          只看影响我的
        </label>
        <span className="count" aria-live="polite">
          共 {shown.length} 条
        </span>
      </div>
      {loaded && mine.size === 0 && (
        <p className="meta" style={{ marginTop: -8 }}>
          想筛出影响你的变更？先到 <Link href="/mine/">我的订阅</Link> 勾选正在付费的档位。
        </p>
      )}

      {groups.map(([month, list]) => (
        <section key={month} className="month">
          <h2>{monthLabel(month)}</h2>
          <ol className="timeline">
            {list.map((c) => {
              const t = TYPES[c.type];
              const affected = c.planIds.map((id) => planById.get(id)).filter(Boolean) as Plan[];
              return (
                <li key={c.id} className={`card change${affectsMe(c) ? " is-mine" : ""}`}>
                  <div className="change-head">
                    <span className="change-date num">{c.date}</span>
                    <span className="sep" aria-hidden>
                      ·
                    </span>
                    <span className="change-vendor">{c.vendor}</span>
                    <span className={`type ${t.tone}`}>
                      <span aria-hidden>{t.icon}</span>
                      {t.label}
                    </span>
                    {affectsMe(c) && <span className="mine-flag">影响你的订阅</span>}
                  </div>
                  <h3 className="change-title">{c.title}</h3>
                  {(c.before || c.after) && (
                    <div className="facts">
                      <div className="fact">
                        <div className="fact-label">变更前</div>
                        <div>{c.before ?? "—"}</div>
                      </div>
                      <div className="fact-arrow" aria-hidden>
                        →
                      </div>
                      <div className="fact after">
                        <div className="fact-label">变更后</div>
                        <div>{c.after ?? "—"}</div>
                      </div>
                    </div>
                  )}
                  <div className="note">
                    <span className="note-label">解读</span>
                    {c.note}
                  </div>
                  <div className="change-foot">
                    {affected.length > 0 && (
                      <span>影响档位：{affected.map((p) => `${p.product} ${p.plan}`).join("、")}</span>
                    )}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      原文出处 ↗
                    </a>
                    <VerifyBadge v={c.verification} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {shown.length === 0 && <p className="empty card">没有符合条件的变更，换个筛选条件试试。</p>}
    </>
  );
}
