/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { CreatorMetricInputPayload } from "./schema";
import { normalizeMetricValue } from "./scoringNormalization";

const creators: CreatorMetricInputPayload[] = [
  {
    name: "Creator A",
    reach: 10_000,
    ctr: 0.02,
    conversionRate: 0.01,
    cpa: 20
  },
  {
    name: "Creator B",
    reach: 40_000,
    ctr: 0.06,
    conversionRate: 0.04,
    cpa: 8
  }
];

describe("scoring normalization", () => {
  test("normalizes rate metrics against the creator cohort before scoring", () => {
    expect(normalizeMetricValue(creators[0]!, creators, "ctr")).toBe(45);
    expect(normalizeMetricValue(creators[1]!, creators, "ctr")).toBe(100);
    expect(normalizeMetricValue(creators[1]!, creators, "conversion_rate")).toBe(100);
  });

  test("normalizes count metrics on the same cohort-relative scale", () => {
    expect(normalizeMetricValue(creators[0]!, creators, "reach")).toBe(45);
    expect(normalizeMetricValue(creators[1]!, creators, "reach")).toBe(100);
  });

  test("inverts efficiency metrics where lower is better", () => {
    expect(normalizeMetricValue(creators[0]!, creators, "cpa")).toBe(45);
    expect(normalizeMetricValue(creators[1]!, creators, "cpa")).toBe(100);
  });

  test("assigns a useful baseline score when only one creator has a metric", () => {
    expect(normalizeMetricValue({ name: "Solo", ctr: 0.04 }, [{ name: "Solo", ctr: 0.04 }], "ctr")).toBe(75);
  });
});
