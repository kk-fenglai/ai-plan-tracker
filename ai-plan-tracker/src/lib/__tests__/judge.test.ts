import { describe, expect, it } from "vitest";
import type { ApiModel, Capability, Plan } from "../../data/types";
import { apiModels } from "../../data/apiModels";
import { plans } from "../../data/plans";
import { toCsv } from "../csv";
import { apiVerdict, median, planVerdict, priceVerdict } from "../judge";

const plan = (id: string, monthlyUsd: number, capabilities: Capability[]): Plan => ({
  id,
  vendor: id,
  product: id,
  plan: id,
  monthlyUsd,
  capabilities,
  usageNote: "",
  verification: "official",
  sourceUrl: "https://example.com",
  checkedAt: "2026-09-25",
});

const model = (id: string, inputPer1M: number, outputPer1M: number): ApiModel => ({
  id,
  vendor: "V",
  model: id,
  inputPer1M,
  outputPer1M,
  verification: "official",
  sourceUrl: "https://example.com",
  checkedAt: "2026-09-25",
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("priceVerdict", () => {
  it("needs at least two peers", () => {
    expect(priceVerdict(10, [10], "同档")).toBeUndefined();
  });
  it("marks the minimum as lowest", () => {
    expect(priceVerdict(5, [5, 10, 20], "同档")).toEqual({ kind: "lowest", label: "同档最低" });
  });
  it("does not call anything lowest when all peers tie", () => {
    expect(priceVerdict(10, [10, 10], "同档")?.kind).toBe("near");
  });
  it("says tied when several share the minimum", () => {
    expect(priceVerdict(5, [5, 5, 20], "同类")).toEqual({ kind: "lowest", label: "同类并列最低" });
  });
  it("reports percentage against the median", () => {
    expect(priceVerdict(6, [5, 10, 20], "同档")).toEqual({ kind: "below", label: "比同档中位数低 40%" });
    expect(priceVerdict(20, [5, 10, 20], "同档")).toEqual({ kind: "above", label: "比同档中位数高 100%" });
    expect(priceVerdict(10.5, [5, 10, 20], "同档")?.kind).toBe("near");
  });
});

describe("planVerdict", () => {
  it("prefers the cheapest-for-a-capability label", () => {
    const pool = [plan("a", 10, ["image"]), plan("b", 20, ["image", "chat"]), plan("c", 8, ["chat"])];
    expect(planVerdict(pool[0], pool, "monthly")?.label).toBe("图像生成最低价");
    expect(planVerdict(pool[2], pool, "monthly")?.label).toBe("对话最低价");
  });
  it("compares against plans whose capabilities cover this one", () => {
    const pool = [
      plan("cheap", 10, ["chat", "search"]),
      plan("mid", 20, ["chat", "search", "image"]),
      plan("pricey", 100, ["chat", "search"]),
      plan("other", 5, ["video"]),
    ];
    // pricey 的同类是 cheap、mid、pricey（中位数 20），other 能力不同不算。
    expect(planVerdict(pool[2], pool, "monthly")).toEqual({ kind: "above", label: "比同类中位数高 400%" });
  });
  it("does not mark a tie as the cheapest for a capability", () => {
    const pool = [plan("a", 10, ["chat"]), plan("b", 10, ["chat"]), plan("c", 30, ["chat"])];
    expect(planVerdict(pool[0], pool, "monthly")?.label).toBe("同类并列最低");
  });
  it("gives every real plan a verdict or none without throwing", () => {
    for (const p of plans) expect(() => planVerdict(p, plans, "annual")).not.toThrow();
  });
});

describe("apiVerdict", () => {
  it("marks the overall cheapest model", () => {
    const pool = [model("a", 0.1, 0.4), model("b", 0.5, 2), model("c", 3, 15)];
    expect(apiVerdict(pool[0], pool)?.label).toBe("全场最低");
  });
  it("labels exactly one real model as overall lowest", () => {
    const lowest = apiModels.filter((m) => apiVerdict(m, apiModels)?.label === "全场最低");
    expect(lowest).toHaveLength(1);
  });
});

describe("toCsv", () => {
  it("quotes fields with commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "x\ny", 3, undefined]])).toBe('"a,b","say ""hi""","x\ny",3,');
  });
  it("neutralises formula-looking text", () => {
    expect(toCsv([["=SUM(A1)", "-1"]])).toBe("'=SUM(A1),'-1");
  });
});
