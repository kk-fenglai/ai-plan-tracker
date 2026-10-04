import type { ChangeType } from "@/data/types";

/**
 * 只有三种类型用颜色：降配（红）、升配（绿）、规则改变（黄），其余中性。
 * 每种都同时带图标和文字，颜色从不单独承载含义。
 */
export const CHANGE_TYPES: Record<ChangeType, { label: string; icon: string; tone: "bad" | "good" | "warn" | "neutral" }> = {
  downgrade: { label: "降配", icon: "▼", tone: "bad" },
  upgrade: { label: "升配", icon: "▲", tone: "good" },
  "rule-change": { label: "规则改变", icon: "↻", tone: "warn" },
  "price-change": { label: "改价", icon: "$", tone: "neutral" },
  "promo-start": { label: "活动开始", icon: "+", tone: "neutral" },
  "promo-end": { label: "活动结束", icon: "■", tone: "neutral" },
  "new-plan": { label: "新档位", icon: "+", tone: "neutral" },
};
