import type { ApiModel, Plan } from "../data/types";
import { blendedPrice } from "./api";
import { type Billing, CAPABILITIES, capabilityLabel, effectivePrice } from "./pricing";

/**
 * 一句话价格判断（对标 Google Flights 的「偏低 / 正常 / 偏高」）：
 * 单看一个数字没有意义，要和同类比较才知道算贵还是便宜。
 */
export type VerdictKind = "lowest" | "below" | "near" | "above";

export interface Verdict {
  kind: VerdictKind;
  label: string;
}

/** 与中位数相差不到这个比例，算「接近中位数」。 */
const NEAR = 0.1;

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * value 与同类 peers（包含 value 自身）比较。同类不足 2 个时无从比较，返回 undefined。
 * scope 是同类的中文名，例如「同类」。最低价并列时标「并列最低」。
 */
export function priceVerdict(value: number, peers: number[], scope: string): Verdict | undefined {
  if (peers.length < 2) return undefined;
  const min = Math.min(...peers);
  if (value <= min && peers.some((p) => p !== min)) {
    const tied = peers.filter((p) => p === min).length > 1;
    return { kind: "lowest", label: tied ? `${scope}并列最低` : `${scope}最低` };
  }
  const med = median(peers);
  if (med <= 0) return undefined;
  const diff = (value - med) / med;
  const pct = Math.round(Math.abs(diff) * 100);
  if (Math.abs(diff) < NEAR) return { kind: "near", label: `接近${scope}中位数` };
  return diff < 0
    ? { kind: "below", label: `比${scope}中位数低 ${pct}%` }
    : { kind: "above", label: `比${scope}中位数高 ${pct}%` };
}

/**
 * API 模型按混合单价和全部模型比较。
 * 不按价位档比：档位本身就是按价格划的，拿同档比较没有信息量。
 */
export function apiVerdict(m: ApiModel, pool: ApiModel[]): Verdict | undefined {
  return priceVerdict(blendedPrice(m), pool.map(blendedPrice), "全场");
}

/** q 的能力是否覆盖 p 的全部能力。 */
const covers = (q: Plan, p: Plan) => p.capabilities.every((c) => q.capabilities.includes(c));

/**
 * 订阅档位先看它是不是某项能力的唯一最低价（用户最关心的判断）；
 * 否则和「同类」比较：能力不少于它的所有档位（含自身）。
 * 同样不按价位带比，价位带本身就是按价格划的。
 */
export function planVerdict(p: Plan, pool: Plan[], billing: Billing): Verdict | undefined {
  const price = effectivePrice(p, billing);
  for (const { id } of CAPABILITIES) {
    if (!p.capabilities.includes(id)) continue;
    const others = pool.filter((x) => x.id !== p.id && x.capabilities.includes(id)).map((x) => effectivePrice(x, billing));
    if (others.length > 0 && others.every((o) => price < o)) {
      return { kind: "lowest", label: `${capabilityLabel(id)}最低价` };
    }
  }
  const peers = pool.filter((q) => q.id === p.id || covers(q, p)).map((q) => effectivePrice(q, billing));
  return priceVerdict(price, peers, "同类");
}
