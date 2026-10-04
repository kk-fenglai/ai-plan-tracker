"use client";

import { useMemo } from "react";
import type { Plan } from "@/data/types";
import { checkOverlap } from "@/lib/overlap";
import { CAPABILITIES, capabilityLabel, effectivePrice, formatUsd } from "@/lib/pricing";
import { MINE_KEY, PRIMARY_KEY, useStoredSet } from "@/lib/storage";

const name = (p: Plan) => `${p.product} ${p.plan}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function MySubscriptions({ plans }: { plans: Plan[] }) {
  const [mine, setMine, loaded] = useStoredSet(MINE_KEY);
  const [primary, setPrimary] = useStoredSet(PRIMARY_KEY);

  const byVendor = useMemo(() => {
    const m = new Map<string, Plan[]>();
    for (const p of plans) m.set(p.vendor, [...(m.get(p.vendor) ?? []), p]);
    return [...m.entries()];
  }, [plans]);

  const selected = plans.filter((p) => mine.has(p.id));
  const activePrimary = new Set([...primary].filter((id) => mine.has(id)));
  const result = checkOverlap(selected, activePrimary);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const annualTotal = round2(selected.reduce((s, p) => s + effectivePrice(p, "annual"), 0));
  // 矩阵的列：8 类能力各被几个已选档位覆盖。
  const capCount = new Map(result.matrix.map((r) => [r.capability, r.planIds.length]));

  const toggle = (id: string) => {
    const next = new Set(mine);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setMine(next);
  };
  const togglePrimary = (id: string) => {
    const next = new Set(primary);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPrimary(next);
  };

  return (
    <div className="mine-layout">
      <aside className="card picker" aria-labelledby="pick-h">
        <div className="picker-head">
          <h2 id="pick-h">勾选你在付费的档位</h2>
          <span className="count">已选 {selected.length}</span>
        </div>
        {byVendor.map(([vendor, list]) => (
          <fieldset key={vendor} className="vendor-group">
            <legend>{vendor}</legend>
            {list.map((p) => (
              <label key={p.id} className={`pick${mine.has(p.id) ? " on" : ""}`}>
                <input type="checkbox" checked={mine.has(p.id)} onChange={() => toggle(p.id)} />
                <span>{name(p)}</span>
                <span className="price num">{formatUsd(p.monthlyUsd)}</span>
              </label>
            ))}
          </fieldset>
        ))}
        {selected.length > 0 && (
          <button className="link-btn" style={{ marginTop: 12 }} onClick={() => setMine(new Set())}>
            清空勾选
          </button>
        )}
        <p className="meta" style={{ margin: "12px 0 0" }}>
          🔒 勾选只保存在本浏览器，不上传、不需要登录。
        </p>
      </aside>

      <div className="results">
        {!loaded ? null : selected.length === 0 ? (
          <div className="card empty-state">
            <h2>还没有勾选任何订阅</h2>
            <p>在左侧勾选你正在付费的档位，这里会马上告诉你：</p>
            <ol>
              <li>每个月一共花多少钱</li>
              <li>哪些能力你重复买了</li>
              <li>哪个订阅可以考虑去掉、每月能省多少</li>
            </ol>
          </div>
        ) : (
          <>
            <p className="answer">
              你订阅了 <strong className="num">{selected.length}</strong> 个档位，每月{" "}
              <strong className="num">{formatUsd(result.monthlyTotal)}</strong>
              {result.monthlySavings > 0 ? (
                <>
                  ；去掉重叠的部分，每月可省 <strong className="num good">{formatUsd(result.monthlySavings)}</strong>。
                </>
              ) : (
                "，没有发现可以整体去掉的订阅。"
              )}
            </p>

            <div className="stats">
              <div className="card">
                <div className="stat-label">每月合计（月付）</div>
                <div className="stat-value num">{formatUsd(result.monthlyTotal)}</div>
                <div className="meta">一年 {formatUsd(Math.round(result.monthlyTotal * 12))}</div>
              </div>
              <div className="card">
                <div className="stat-label">改成年付，折合每月</div>
                <div className="stat-value num">{formatUsd(annualTotal)}</div>
                <div className="meta">
                  {annualTotal < result.monthlyTotal
                    ? `比月付每月少 ${formatUsd(round2(result.monthlyTotal - annualTotal))}`
                    : "所选档位没有年付优惠"}
                </div>
              </div>
              <div className="card">
                <div className="stat-label">去掉重叠后每月可省</div>
                <div className={`stat-value num${result.monthlySavings > 0 ? " good" : ""}`}>
                  {formatUsd(result.monthlySavings)}
                </div>
                <div className="meta">只按能力类别判断，不含额度差异</div>
              </div>
            </div>

            <h2>哪些能力买重了</h2>
            <p className="meta" style={{ margin: "-4px 0 10px" }}>
              一列里有两个及以上 ● 就是重复购买，已用色块标出。
            </p>
            <div className="card flush table-scroll">
              <table className="data matrix">
                <thead>
                  <tr>
                    <th>档位</th>
                    {CAPABILITIES.map((c) => {
                      const n = capCount.get(c.id) ?? 0;
                      return (
                        <th key={c.id} className={n > 1 ? "dup" : undefined}>
                          {c.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {selected.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {name(p)}
                        <div className="meta num">{formatUsd(p.monthlyUsd)}/月</div>
                      </td>
                      {CAPABILITIES.map((c) => {
                        const has = p.capabilities.includes(c.id);
                        const dup = (capCount.get(c.id) ?? 0) > 1;
                        return (
                          <td key={c.id} className={`hit${dup ? " dup" : ""}`}>
                            {has ? <span aria-label="有">●</span> : <span className="sr-only">无</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>覆盖次数</td>
                    {CAPABILITIES.map((c) => {
                      const n = capCount.get(c.id) ?? 0;
                      return (
                        <td key={c.id} className={`hit num${n > 1 ? " dup" : ""}`}>
                          {n > 1 ? <strong>重复 {n}</strong> : n === 1 ? "1" : "—"}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>

            <h2>可以考虑去掉的订阅</h2>
            {result.suggestions.length === 0 ? (
              <p className="notice">没有发现可以整体去掉的订阅：每个订阅都至少提供一项别的订阅没有的能力。</p>
            ) : (
              <ul className="suggest">
                {result.suggestions.map((s) => (
                  <li key={s.plan.id} className="card">
                    <div className="suggest-head">
                      <strong>{name(s.plan)}</strong>
                      <span className="save num">每月省 {formatUsd(s.plan.monthlyUsd)}</span>
                    </div>
                    <div className="suggest-why">
                      原因：它的每项能力你的其他订阅都有——
                      <ul>
                        {s.coveredBy.map((c) => (
                          <li key={c.capability}>
                            <strong>{capabilityLabel(c.capability)}</strong>：
                            {c.planIds.map((id) => name(planById.get(id)!)).join("、")}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button className="link-btn" onClick={() => togglePrimary(s.plan.id)}>
                      这是我的主力，不要建议去掉
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {activePrimary.size > 0 && (
              <p className="meta" style={{ marginTop: 10 }}>
                已标记为主力：{[...activePrimary].map((id) => name(planById.get(id)!)).join("、")}。{" "}
                <button className="link-btn" onClick={() => setPrimary(new Set())}>
                  清除标记
                </button>
              </p>
            )}
            <p className="notice">
              这里只比较「有没有这项能力」，不比较额度多少和模型好坏。同样能写代码，两家的额度和体验可能差很多，去掉前请确认你真的不依赖它。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
