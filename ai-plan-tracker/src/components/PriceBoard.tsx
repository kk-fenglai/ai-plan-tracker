"use client";

import { useMemo, useState } from "react";
import type { Capability, Plan } from "@/data/types";
import { downloadCsv } from "@/lib/csv";
import { planVerdict } from "@/lib/judge";
import {
  CAPABILITIES,
  TIERS,
  type Billing,
  capabilityLabel,
  effectivePrice,
  extremesByCapability,
  formatUsd,
  sortByPrice,
  tierOf,
} from "@/lib/pricing";
import { useStoredSet } from "@/lib/storage";
import { CapPills } from "./CapPills";
import { type ColumnDef, ColumnPicker } from "./ColumnPicker";
import { SortHeader, type SortDir, nextSort } from "./SortHeader";
import { VerdictTag } from "./VerdictTag";
import { VerifyBadge } from "./VerifyBadge";

const planName = (p: Plan) => `${p.product} ${p.plan}`;

type SortKey = "name" | "monthly" | "annual" | "verification";

type ColId = "name" | "monthly" | "annual" | "verdict" | "caps" | "usage" | "verify";
const COLUMNS: ColumnDef<ColId>[] = [
  { id: "name", label: "厂商 · 档位", required: true },
  { id: "monthly", label: "月付" },
  { id: "annual", label: "年付折合/月" },
  { id: "verdict", label: "价格判断" },
  { id: "caps", label: "能力" },
  { id: "usage", label: "额度说明" },
  { id: "verify", label: "核对" },
];

/** 多选能力按「同时具备」筛选：选了编程 IDE + 深度研究，只留两样都有的档位。 */
const hasCaps = (p: Plan, set: Iterable<Capability>) => [...set].every((c) => p.capabilities.includes(c));

/** 坐标轴上限取整到一个好读的数。 */
function niceMax(max: number): { top: number; step: number } {
  for (const top of [50, 100, 150, 200, 300, 400, 500]) {
    if (max <= top) return { top, step: top <= 150 ? 25 : top <= 300 ? 50 : 100 };
  }
  return { top: Math.ceil(max / 100) * 100, step: 100 };
}

export function PriceBoard({ plans, cnyRate }: { plans: Plan[]; cnyRate: number }) {
  const [caps, setCaps] = useState<Set<Capability>>(new Set());
  const [vendor, setVendor] = useState<string>("all");
  const [billing, setBilling] = useState<Billing>("monthly");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "monthly", dir: "asc" });
  const [hover, setHover] = useState<{ plan: Plan; x: number; y: number } | null>(null);
  const [hiddenCols, setHiddenCols] = useStoredSet("ai-plan-tracker:cols-plans");

  const pool = useMemo(
    () => plans.filter((p) => !verifiedOnly || p.verification === "official"),
    [plans, verifiedOnly],
  );
  const visible = useMemo(
    () => sortByPrice(pool.filter((p) => (vendor === "all" || p.vendor === vendor) && hasCaps(p, caps)), billing),
    [pool, caps, billing, vendor],
  );
  const extremes = useMemo(() => extremesByCapability(pool, billing), [pool, billing]);

  // 筛选项旁的数量：点下去之后会剩几条（Geizhals 式）。
  const capCount = (c: Capability) =>
    pool.filter((p) => (vendor === "all" || p.vendor === vendor) && hasCaps(p, [...caps, c])).length;
  const vendorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pool) if (hasCaps(p, caps)) m.set(p.vendor, (m.get(p.vendor) ?? 0) + 1);
    return [...m.entries()];
  }, [pool, caps]);

  const sorted = useMemo(() => {
    const val = (p: Plan): string | number =>
      sort.key === "name"
        ? `${p.vendor} ${planName(p)}`
        : sort.key === "monthly"
          ? p.monthlyUsd
          : sort.key === "annual"
            ? effectivePrice(p, "annual")
            : p.verification;
    const list = [...visible].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    });
    return sort.dir === "asc" ? list : list.reverse();
  }, [visible, sort]);

  const show = (c: ColId) => !hiddenCols.has(c);
  const toggleCap = (c: Capability) => {
    const next = new Set(caps);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setCaps(next);
  };
  const selectBilling = (b: Billing) => {
    setBilling(b);
    setSort({ key: b === "annual" ? "annual" : "monthly", dir: "asc" });
  };
  const exportCsv = () =>
    downloadCsv(`ai-订阅价格-${billing === "annual" ? "年付" : "月付"}.csv`, [
      ["厂商", "产品", "档位", "月付(USD)", "年付折合/月(USD)", "原价", "价格判断", "能力", "额度说明", "核对", "核对日期", "出处"],
      ...sorted.map((p) => [
        p.vendor,
        p.product,
        p.plan,
        p.monthlyUsd,
        p.annualMonthlyUsd,
        p.originalPrice,
        planVerdict(p, pool, billing)?.label,
        p.capabilities.map(capabilityLabel).join("、"),
        p.usageNote,
        p.verification === "official" ? "已核对" : "待核实",
        p.checkedAt,
        p.sourceUrl,
      ]),
    ]);

  const prices = visible.map((p) => effectivePrice(p, billing));
  const { top, step } = niceMax(prices.length ? Math.max(...prices) : 50);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  // 条形最多占轨道 88%，给末端的数值标签留位置。
  const pct = (v: number) => (v / top) * 88;

  const cheapest = visible[0];
  const priciest = visible[visible.length - 1];
  const capText = caps.size === 0 ? "全部" : `同时具备「${[...caps].map(capabilityLabel).join(" + ")}」的`;

  return (
    <>
      {visible.length > 0 ? (
        <p className="answer">
          {capText} {visible.length} 个档位里，最便宜是{" "}
          <strong>
            {planName(cheapest)} <span className="num">{formatUsd(effectivePrice(cheapest, billing))}</span>
          </strong>
          ，最贵是{" "}
          <strong>
            {planName(priciest)} <span className="num">{formatUsd(effectivePrice(priciest, billing))}</span>
          </strong>
          {visible.length > 1 && (
            <>，相差 {Math.round(effectivePrice(priciest, billing) / effectivePrice(cheapest, billing))} 倍</>
          )}
          。
        </p>
      ) : (
        <p className="answer">没有符合这些条件的档位，试试少选一项。</p>
      )}

      <div className="filters" role="group" aria-label="筛选">
        <div className="seg" role="group" aria-label="能力（可多选，数字为选中后剩余的档位数）">
          <button className="chip" aria-pressed={caps.size === 0} onClick={() => setCaps(new Set())}>
            全部能力
          </button>
          {CAPABILITIES.map((c) => {
            const on = caps.has(c.id);
            const n = on ? visible.length : capCount(c.id);
            return (
              <button
                key={c.id}
                className="chip"
                aria-pressed={on}
                disabled={!on && n === 0}
                onClick={() => toggleCap(c.id)}
              >
                {c.label} <span className="chip-n">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="seg" role="group" aria-label="计费方式">
          <button className="chip" aria-pressed={billing === "monthly"} onClick={() => selectBilling("monthly")}>
            月付
          </button>
          <button className="chip" aria-pressed={billing === "annual"} onClick={() => selectBilling("annual")}>
            年付折合每月
          </button>
        </div>
        <label className="field">
          厂商
          <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="all">全部（{vendorCounts.reduce((s, [, n]) => s + n, 0)}）</option>
            {vendorCounts.map(([v, n]) => (
              <option key={v} value={v}>
                {v}（{n}）
              </option>
            ))}
          </select>
        </label>
        <label className="switch">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          只看已核对
        </label>
        <span className="count" aria-live="polite">
          共 {visible.length} 条
        </span>
      </div>

      <h2>按价位分四档，颜色越深越贵</h2>
      <div className="tiers">
        {TIERS.map((t) => {
          const inTier = visible.filter((p) => tierOf(effectivePrice(p, billing)).id === t.id);
          const ps = inTier.map((p) => effectivePrice(p, billing));
          return (
            <div key={t.id} className="card tier-card" style={{ ["--tier" as string]: `var(--tier-${t.id})` }}>
              <div className="tier-head">
                <span className="tier-name">{t.label}</span>
                <span className="tier-range">{t.range}/月</span>
              </div>
              <div className="tier-stat">
                <span className="big num">{inTier.length}</span> 个档位
                {ps.length > 0 && (
                  <span className="tier-span num">
                    {formatUsd(Math.min(...ps))}
                    {ps.length > 1 && ` – ${formatUsd(Math.max(...ps))}`}
                  </span>
                )}
              </div>
              <ul className="tier-list">
                {inTier.map((p) => (
                  <li key={p.id}>
                    <span className="name" title={planName(p)}>
                      {planName(p)}
                    </span>
                    <span className="price num">{formatUsd(effectivePrice(p, billing))}</span>
                  </li>
                ))}
                {inTier.length === 0 && <li className="name">这一档没有符合条件的档位</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <h2>想要某项能力，最少花多少、最多花多少</h2>
      <div className="card flush table-scroll">
        <table className="data extremes">
          <thead>
            <tr>
              <th>能力</th>
              <th className="num">最便宜</th>
              <th>档位</th>
              <th className="num">最贵</th>
              <th>档位</th>
              <th className="num">价差</th>
            </tr>
          </thead>
          <tbody>
            {extremes
              .filter((e) => e.count > 0)
              .map((e) => {
                const lo = effectivePrice(e.cheapest[0], billing);
                const hi = effectivePrice(e.priciest[0], billing);
                return (
                  <tr key={e.capability}>
                    <td>
                      <button
                        className="link-btn"
                        title="只看具备这项能力的档位"
                        onClick={() => setCaps(new Set([e.capability]))}
                      >
                        {capabilityLabel(e.capability)}
                      </button>
                      <div className="meta">{e.count} 个档位</div>
                    </td>
                    <td className="num strong good">{formatUsd(lo)}</td>
                    <td>{e.cheapest.map(planName).join("、")}</td>
                    <td className="num strong">{formatUsd(hi)}</td>
                    <td>{e.priciest.map(planName).join("、")}</td>
                    <td className="num">{Math.round(hi / lo)}×</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="section-head">
        <h2>完整价格排行</h2>
        <div className="table-tools">
          {!showChart && <ColumnPicker columns={COLUMNS} hidden={hiddenCols} onChange={setHiddenCols} />}
          {!showChart && (
            <button className="chip" onClick={exportCsv} disabled={sorted.length === 0}>
              导出 CSV
            </button>
          )}
          <div className="seg" role="group" aria-label="展示方式">
            <button className="chip" aria-pressed={!showChart} onClick={() => setShowChart(false)}>
              表格
            </button>
            <button className="chip" aria-pressed={showChart} onClick={() => setShowChart(true)}>
              条形图
            </button>
          </div>
        </div>
      </div>

      {!showChart ? (
        <div className="card flush table-scroll">
          <table className="data rtable">
            <thead>
              <tr>
                <SortHeader label="厂商 · 档位" k="name" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} />
                {show("monthly") && (
                  <SortHeader label="月付" k="monthly" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} num />
                )}
                {show("annual") && (
                  <SortHeader label="年付折合/月" k="annual" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} num />
                )}
                {show("verdict") && <th>价格判断</th>}
                {show("caps") && <th>能力</th>}
                {show("usage") && <th>额度说明</th>}
                {show("verify") && (
                  <SortHeader label="核对" k="verification" sort={sort} onSort={(k) => setSort(nextSort(sort, k))} />
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const tier = tierOf(effectivePrice(p, billing));
                return (
                  <tr key={p.id}>
                    <td className="cell-name">
                      <span className="meta">{p.vendor}</span>
                      <a href={p.sourceUrl} target="_blank" rel="noreferrer" title="查看出处">
                        {planName(p)}
                      </a>
                    </td>
                    {show("monthly") && (
                      <td className={`num price-cell${billing === "monthly" ? " active" : ""}`} data-label="月付">
                        <span className="swatch" style={{ background: `var(--tier-${tier.id})` }} title={`${tier.label}档`} />
                        {formatUsd(p.monthlyUsd)}
                        {p.originalPrice && <div className="meta">{p.originalPrice}</div>}
                      </td>
                    )}
                    {show("annual") && (
                      <td className={`num price-cell${billing === "annual" ? " active" : ""}`} data-label="年付折合/月">
                        {p.annualMonthlyUsd !== undefined ? (
                          formatUsd(p.annualMonthlyUsd)
                        ) : (
                          <span className="meta">无年付</span>
                        )}
                      </td>
                    )}
                    {show("verdict") && (
                      <td data-label="价格判断">
                        <VerdictTag v={planVerdict(p, pool, billing)} />
                      </td>
                    )}
                    {show("caps") && (
                      <td data-label="能力">
                        <CapPills caps={p.capabilities} />
                      </td>
                    )}
                    {show("usage") && (
                      <td className="usage" data-label="额度">
                        {p.usageNote}
                      </td>
                    )}
                    {show("verify") && (
                      <td data-label="核对">
                        <VerifyBadge v={p.verification} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <p className="empty">没有符合条件的档位。</p>}
        </div>
      ) : (
        <div className="card rank" style={{ ["--label-w" as string]: "clamp(120px, 40%, 230px)" }}>
          <div className="legend" aria-label="图例">
            {TIERS.map((t) => (
              <span key={t.id}>
                <span className="swatch" style={{ background: `var(--tier-${t.id})` }} aria-hidden />
                {t.label} {t.range}
              </span>
            ))}
          </div>
          <div className="rank-axis" aria-hidden>
            <span />
            <div className="ticks">
              {ticks.map((t) => (
                <span key={t} style={{ left: `${pct(t)}%` }}>
                  ${t}
                </span>
              ))}
            </div>
          </div>
          <div role="list" onMouseLeave={() => setHover(null)}>
            {visible.map((p) => {
              const price = effectivePrice(p, billing);
              const tier = tierOf(price);
              return (
                <div
                  key={p.id}
                  role="listitem"
                  tabIndex={0}
                  className="rank-row"
                  aria-label={`${planName(p)}，每月 ${formatUsd(price)}，${tier.label}档`}
                  onMouseMove={(e) => setHover({ plan: p, x: e.clientX, y: e.clientY })}
                  onFocus={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setHover({ plan: p, x: r.left + r.width / 2, y: r.bottom });
                  }}
                  onBlur={() => setHover(null)}
                >
                  <div className="rank-label" title={planName(p)}>
                    {planName(p)}
                  </div>
                  <div className="rank-track" style={{ ["--tick-step" as string]: `${pct(step)}%` }}>
                    <div className="rank-bar" style={{ width: `${pct(price)}%`, background: `var(--tier-${tier.id})` }} />
                    <span className="rank-value" style={{ left: `${pct(price)}%` }}>
                      {formatUsd(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {visible.length === 0 && <p className="meta">没有符合条件的档位。</p>}
        </div>
      )}

      {hover && (
        <div
          className="tooltip"
          role="tooltip"
          style={{
            left: Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 316),
            top: hover.y + 14,
          }}
        >
          <div className="t">
            {hover.plan.vendor} · {planName(hover.plan)}
          </div>
          <div className="row">
            月付 {formatUsd(hover.plan.monthlyUsd)}
            {hover.plan.annualMonthlyUsd !== undefined && ` · 年付折合 ${formatUsd(hover.plan.annualMonthlyUsd)}/月`}
          </div>
          {hover.plan.originalPrice && <div className="row">原价 {hover.plan.originalPrice}</div>}
          <div className="row">{hover.plan.usageNote}</div>
          <div className="row">能力：{hover.plan.capabilities.map(capabilityLabel).join("、")}</div>
          <div className="row" style={{ marginTop: 4 }}>
            <VerifyBadge v={hover.plan.verification} /> 核对于 {hover.plan.checkedAt}
          </div>
        </div>
      )}

      <p className="notice">
        价格为美国地区标价、不含税。人民币标价按 1 USD ≈ {cnyRate} CNY 估算。免费档、团队档和企业档不在比较范围内。「价格判断」不受能力和厂商筛选影响：「某能力最低价」表示它是具备该能力的档位里唯一最便宜的；「同类」指能力不少于它的所有档位，只比能力类别，不比额度。点击档位名可查看价格出处。
      </p>
    </>
  );
}
