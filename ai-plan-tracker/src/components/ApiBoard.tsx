"use client";

import { useMemo, useState } from "react";
import type { ApiModel, Plan } from "@/data/types";
import {
  API_TIERS,
  type Usage,
  apiTierOf,
  blendedPrice,
  cheapestPlanOfVendor,
  formatPer1M,
  monthlyApiCost,
  sortByBlended,
} from "@/lib/api";
import { downloadCsv } from "@/lib/csv";
import { apiVerdict } from "@/lib/judge";
import { formatUsd } from "@/lib/pricing";
import { useStoredSet } from "@/lib/storage";
import { type ColumnDef, ColumnPicker } from "./ColumnPicker";
import { SortHeader, type SortDir, nextSort } from "./SortHeader";
import { VerdictTag } from "./VerdictTag";
import { VerifyBadge } from "./VerifyBadge";

/**
 * API 价格跨三个数量级（$0.045 到 $50），散点图两根轴都用对数刻度。
 * 越靠左下越便宜；点的颜色是混合单价所在的档位。
 */
const W = 880;
const H = 400;
const M = { top: 16, right: 20, bottom: 48, left: 60 };

const PRESETS: { label: string; usage: Omit<Usage, "cacheHitRatio">; hint: string }[] = [
  { label: "轻度聊天", usage: { inputM: 2, outputM: 0.5 }, hint: "每天几十轮对话" },
  { label: "日常编程", usage: { inputM: 20, outputM: 2 }, hint: "每天数小时 IDE 辅助" },
  { label: "重度 Agent", usage: { inputM: 150, outputM: 10 }, hint: "全天跑编程 Agent" },
];

type SortKey = "name" | "input" | "output" | "blended" | "monthly";

type ColId = "name" | "input" | "cached" | "output" | "blended" | "monthly" | "vsSub" | "verdict" | "note" | "verify";
const COLUMNS: ColumnDef<ColId>[] = [
  { id: "name", label: "厂商 · 模型", required: true },
  { id: "monthly", label: "预估月费" },
  { id: "vsSub", label: "对比订阅" },
  { id: "verdict", label: "价格判断" },
  { id: "input", label: "输入价" },
  { id: "cached", label: "缓存命中价" },
  { id: "output", label: "输出价" },
  { id: "blended", label: "混合单价" },
  { id: "note", label: "说明" },
  { id: "verify", label: "核对" },
];

function logDomain(values: number[]): [number, number] {
  const lo = Math.floor(Math.log10(Math.min(...values)));
  const hi = Math.ceil(Math.log10(Math.max(...values)));
  return [lo, hi === lo ? lo + 1 : hi];
}

export function ApiBoard({ models, plans }: { models: ApiModel[]; plans: Plan[] }) {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [vendor, setVendor] = useState<string>("all");
  const [tier, setTier] = useState<number | "all">("all");
  const [hover, setHover] = useState<{ m: ApiModel; x: number; y: number } | null>(null);
  const [inputM, setInputM] = useState(20);
  const [outputM, setOutputM] = useState(2);
  const [cacheHitRatio, setCacheHitRatio] = useState(0.5);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "monthly", dir: "asc" });
  const [hiddenCols, setHiddenCols] = useStoredSet("ai-plan-tracker:cols-api");

  const pool = useMemo(
    () => sortByBlended(models.filter((m) => !verifiedOnly || m.verification === "official")),
    [models, verifiedOnly],
  );
  const inTier = (m: ApiModel, t: number | "all") => t === "all" || apiTierOf(blendedPrice(m)).id === t;
  const visible = useMemo(
    () => pool.filter((m) => (vendor === "all" || m.vendor === vendor) && inTier(m, tier)),
    [pool, vendor, tier],
  );
  // 筛选项旁的数量：选中之后会剩几条。
  const vendorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of pool) if (inTier(x, tier)) m.set(x.vendor, (m.get(x.vendor) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [pool, tier]);
  const tierCount = (t: number) => pool.filter((m) => (vendor === "all" || m.vendor === vendor) && inTier(m, t)).length;

  const usage: Usage = { inputM, outputM, cacheHitRatio };
  const cost = (m: ApiModel) => monthlyApiCost(m, usage);

  const sorted = useMemo(() => {
    const val = (m: ApiModel): string | number =>
      sort.key === "name"
        ? `${m.vendor} ${m.model}`
        : sort.key === "input"
          ? m.inputPer1M
          : sort.key === "output"
            ? m.outputPer1M
            : sort.key === "blended"
              ? blendedPrice(m)
              : monthlyApiCost(m, { inputM, outputM, cacheHitRatio });
    const list = [...visible].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return typeof va === "number" && typeof vb === "number"
        ? va - vb || blendedPrice(a) - blendedPrice(b)
        : String(va).localeCompare(String(vb));
    });
    return sort.dir === "asc" ? list : list.reverse();
  }, [visible, sort, inputM, outputM, cacheHitRatio]);

  const byCost = [...visible].sort((a, b) => cost(a) - cost(b));
  const cheapest = byCost[0];
  const priciest = byCost[byCost.length - 1];
  const show = (c: ColId) => !hiddenCols.has(c);
  const onSort = (k: SortKey) => setSort(nextSort(sort, k));

  const exportCsv = () =>
    downloadCsv("ai-api价格.csv", [
      [
        "厂商",
        "模型",
        "输入(USD/百万)",
        "缓存命中(USD/百万)",
        "输出(USD/百万)",
        "混合单价(USD/百万)",
        `预估月费(USD，输入${inputM}M/输出${outputM}M/缓存${Math.round(cacheHitRatio * 100)}%)`,
        "价格判断",
        "说明",
        "核对",
        "核对日期",
        "出处",
      ],
      ...sorted.map((m) => [
        m.vendor,
        m.model,
        m.inputPer1M,
        m.cachedInputPer1M,
        m.outputPer1M,
        Math.round(blendedPrice(m) * 10000) / 10000,
        cost(m),
        apiVerdict(m, pool)?.label,
        m.note,
        m.verification === "official" ? "已核对" : "待核实",
        m.checkedAt,
        m.sourceUrl,
      ]),
    ]);

  // 两根轴用同一个对数区间，方便比较输入和输出差多少。
  const [lo, hi] = logDomain(models.flatMap((m) => [m.inputPer1M, m.outputPer1M]));
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i));
  const sx = (v: number) => M.left + ((Math.log10(v) - lo) / (hi - lo)) * (W - M.left - M.right);
  const sy = (v: number) => H - M.bottom - ((Math.log10(v) - lo) / (hi - lo)) * (H - M.top - M.bottom);
  const tickLabel = (t: number) => `$${t < 1 ? Number(t.toPrecision(1)) : t}`;

  return (
    <>
      {cheapest && (
        <p className="answer">
          按你的用量，{visible.length} 个模型里最省的是{" "}
          <strong>
            {cheapest.model} <span className="num">约 {formatUsd(cost(cheapest))}/月</span>
          </strong>
          {byCost.length > 1 && (
            <>
              ，最贵的是{" "}
              <strong>
                {priciest.model} <span className="num">约 {formatUsd(cost(priciest))}/月</span>
              </strong>
            </>
          )}
          。只看单价会误判：输入便宜、输出贵的模型，按总价算可能反而更贵。
        </p>
      )}

      <div className="card usage-card">
        <div className="usage-head">
          <h2>先填你每月的用量</h2>
          <div className="seg" role="group" aria-label="用量预设">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="chip"
                title={p.hint}
                aria-pressed={inputM === p.usage.inputM && outputM === p.usage.outputM}
                onClick={() => {
                  setInputM(p.usage.inputM);
                  setOutputM(p.usage.outputM);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="calc-inputs">
          <label>
            每月输入（百万 token）
            <input
              type="number"
              min={0}
              step={0.5}
              value={inputM}
              onChange={(e) => setInputM(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label>
            每月输出（百万 token）
            <input
              type="number"
              min={0}
              step={0.5}
              value={outputM}
              onChange={(e) => setOutputM(Math.max(0, Number(e.target.value) || 0))}
            />
          </label>
          <label>
            输入命中缓存的比例
            <select value={cacheHitRatio} onChange={(e) => setCacheHitRatio(Number(e.target.value))}>
              <option value={0}>0%（不用缓存）</option>
              <option value={0.5}>50%</option>
              <option value={0.8}>80%（编程 Agent 常见）</option>
            </select>
          </label>
        </div>
      </div>

      <div className="filters" role="group" aria-label="筛选">
        <div className="seg" role="group" aria-label="价位档（数字为选中后剩余的模型数）">
          <button className="chip" aria-pressed={tier === "all"} onClick={() => setTier("all")}>
            全部档位
          </button>
          {API_TIERS.map((t) => {
            const n = tierCount(t.id);
            return (
              <button
                key={t.id}
                className="chip"
                aria-pressed={tier === t.id}
                disabled={n === 0 && tier !== t.id}
                onClick={() => setTier(tier === t.id ? "all" : t.id)}
              >
                <span className="swatch" style={{ background: `var(--tier-${t.id})` }} aria-hidden />
                {t.label} <span className="chip-n">{n}</span>
              </button>
            );
          })}
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
          共 {visible.length} 个模型
        </span>
      </div>

      <div className="section-head">
        <h2>按预估月费从低到高</h2>
        <div className="table-tools">
          <ColumnPicker columns={COLUMNS} hidden={hiddenCols} onChange={setHiddenCols} />
          <button className="chip" onClick={exportCsv} disabled={sorted.length === 0}>
            导出 CSV
          </button>
        </div>
      </div>
      <div className="card flush table-scroll">
        <table className="data rtable">
          <thead>
            <tr>
              <SortHeader label="厂商 · 模型" k="name" sort={sort} onSort={onSort} />
              {show("monthly") && <SortHeader label="预估月费" k="monthly" sort={sort} onSort={onSort} num />}
              {show("vsSub") && <th>对比同厂商最便宜订阅</th>}
              {show("verdict") && <th>单价判断</th>}
              {show("input") && <SortHeader label="输入" k="input" sort={sort} onSort={onSort} num />}
              {show("cached") && <th className="num">缓存命中</th>}
              {show("output") && <SortHeader label="输出" k="output" sort={sort} onSort={onSort} num />}
              {show("blended") && <SortHeader label="混合" k="blended" sort={sort} onSort={onSort} num />}
              {show("note") && <th>说明</th>}
              {show("verify") && <th>核对</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => {
              const c = cost(m);
              const plan = cheapestPlanOfVendor(plans, m.vendor);
              const diff = plan ? Math.round(Math.abs(plan.monthlyUsd - c) * 100) / 100 : 0;
              return (
                <tr key={m.id}>
                  <td className="cell-name">
                    <span className="meta">{m.vendor}</span>
                    <a href={m.sourceUrl} target="_blank" rel="noreferrer" title="查看出处">
                      {m.model}
                    </a>
                  </td>
                  {show("monthly") && (
                    <td className="num price-cell active" data-label="预估月费">
                      {formatUsd(c)}
                    </td>
                  )}
                  {show("vsSub") && (
                    <td data-label="对比订阅">
                      {plan ? (
                        <span className="vs">
                          <span className={`verdict ${c <= plan.monthlyUsd ? "api" : "sub"}`}>
                            {c <= plan.monthlyUsd ? "API 更省" : "订阅更省"} <span className="num">{formatUsd(diff)}</span>
                          </span>
                          <span className="meta">
                            {plan.product} {plan.plan} {formatUsd(plan.monthlyUsd)}
                          </span>
                        </span>
                      ) : (
                        <span className="meta">该厂商无个人订阅</span>
                      )}
                    </td>
                  )}
                  {show("verdict") && (
                    <td data-label="单价判断">
                      <VerdictTag v={apiVerdict(m, pool)} />
                    </td>
                  )}
                  {show("input") && (
                    <td className="num" data-label="输入">
                      {formatPer1M(m.inputPer1M)}
                    </td>
                  )}
                  {show("cached") && (
                    <td className="num" data-label="缓存命中">
                      {m.cachedInputPer1M !== undefined ? formatPer1M(m.cachedInputPer1M) : "—"}
                    </td>
                  )}
                  {show("output") && (
                    <td className="num" data-label="输出">
                      {formatPer1M(m.outputPer1M)}
                    </td>
                  )}
                  {show("blended") && (
                    <td className="num" data-label="混合">
                      <span className="swatch" style={{ background: `var(--tier-${apiTierOf(blendedPrice(m)).id})` }} />
                      {formatPer1M(blendedPrice(m))}
                    </td>
                  )}
                  {show("note") && (
                    <td className="usage" data-label="说明">
                      {m.note ?? ""}
                    </td>
                  )}
                  {show("verify") && (
                    <td data-label="核对">
                      <VerifyBadge v={m.verification} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="empty">没有符合条件的模型。</p>}
      </div>
      <p className="meta" style={{ marginTop: 8 }}>
        单价单位：美元 / 百万 token。混合单价 =（3 × 输入 + 输出）÷ 4；「单价判断」按混合单价和全部模型比较，不受筛选影响。
      </p>

      <h2>按混合单价分四档，颜色越深越贵</h2>
      <div className="tiers">
        {API_TIERS.map((t) => {
          const list = visible.filter((m) => apiTierOf(blendedPrice(m)).id === t.id);
          return (
            <div key={t.id} className="card tier-card" style={{ ["--tier" as string]: `var(--tier-${t.id})` }}>
              <div className="tier-head">
                <span className="tier-name">{t.label}</span>
                <span className="tier-range">{t.range}/百万</span>
              </div>
              <div className="tier-stat">
                <span className="big num">{list.length}</span> 个模型
              </div>
              <ul className="tier-list">
                {list.map((m) => (
                  <li key={m.id}>
                    <span className="name" title={m.model}>
                      {m.model}
                    </span>
                    <span className="price num">{formatPer1M(blendedPrice(m))}</span>
                  </li>
                ))}
                {list.length === 0 && <li className="name">这一档没有模型</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <h2>输入价和输出价：越靠左下越便宜</h2>
      <div className="card scatter">
        <div className="legend" aria-label="图例">
          {API_TIERS.map((t) => (
            <span key={t.id}>
              <span className="dot-key" style={{ background: `var(--tier-${t.id})` }} aria-hidden />
              {t.label} {t.range}
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="各模型输入价与输出价散点图，双轴对数刻度。上方表格包含全部数值。"
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t} className="grid">
              <line x1={sx(t)} x2={sx(t)} y1={M.top} y2={H - M.bottom} />
              <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} />
              <text x={sx(t)} y={H - M.bottom + 18} textAnchor="middle">
                {tickLabel(t)}
              </text>
              <text x={M.left - 8} y={sy(t) + 4} textAnchor="end">
                {tickLabel(t)}
              </text>
            </g>
          ))}
          <text className="axis-title" x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle">
            输入价（美元 / 百万 token）
          </text>
          <text
            className="axis-title"
            transform={`translate(14 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            输出价（美元 / 百万 token）
          </text>
          {visible.map((m) => {
            const active = hover?.m.id === m.id;
            return (
              <circle
                key={m.id}
                className="pt"
                cx={sx(m.inputPer1M)}
                cy={sy(m.outputPer1M)}
                r={active ? 8 : 6}
                fill={`var(--tier-${apiTierOf(blendedPrice(m)).id})`}
                tabIndex={0}
                aria-label={`${m.model}：输入 ${formatPer1M(m.inputPer1M)}，输出 ${formatPer1M(m.outputPer1M)}`}
                onMouseMove={(e) => setHover({ m, x: e.clientX, y: e.clientY })}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHover({ m, x: r.right, y: r.bottom });
                }}
                onBlur={() => setHover(null)}
              />
            );
          })}
          {hover && (
            <text className="pt-label" x={sx(hover.m.inputPer1M) + 11} y={sy(hover.m.outputPer1M) - 9}>
              {hover.m.model}
            </text>
          )}
        </svg>
      </div>

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
            {hover.m.vendor} · {hover.m.model}
          </div>
          <div className="row">
            输入 {formatPer1M(hover.m.inputPer1M)} · 输出 {formatPer1M(hover.m.outputPer1M)}
            {hover.m.cachedInputPer1M !== undefined && ` · 缓存命中 ${formatPer1M(hover.m.cachedInputPer1M)}`}
          </div>
          <div className="row">
            混合单价 {formatPer1M(blendedPrice(hover.m))} · 按你的用量约 {formatUsd(cost(hover.m))}/月
          </div>
          {hover.m.note && <div className="row">{hover.m.note}</div>}
          <div className="row" style={{ marginTop: 4 }}>
            <VerifyBadge v={hover.m.verification} /> 核对于 {hover.m.checkedAt}
          </div>
        </div>
      )}

      <p className="notice">
        订阅额度不按 token 公开，「对比订阅」只把 API 花费和同厂商最便宜的订阅价放在一起看：最便宜的订阅不一定包含这个模型，额度也不一定够用。订阅额度用完要等重置，API
        按量付费、没有上限。价格为标准档，不含批量折扣和长上下文加价。
      </p>
    </>
  );
}
