import type { CreatorMetricInputPayload } from "./schema";

const COHORT_SCORE_FLOOR = 45;
const SINGLE_VALUE_SCORE = 75;

export function numericMetric(metric: CreatorMetricInputPayload, name: string): number | undefined {
  const engagementRate =
    metric.impressions && metric.impressions > 0
      ? ((metric.likes ?? 0) + (metric.comments ?? 0) + (metric.shares ?? 0) + (metric.saves ?? 0)) /
        metric.impressions
      : undefined;

  const values: Record<string, number | undefined> = {
    reach: metric.reach,
    impressions: metric.impressions,
    completion_rate: metric.completionRate,
    share_velocity: metric.shares,
    audience_penetration: metric.reach,
    brand_sentiment: metric.sentimentScore,
    comment_depth: metric.comments,
    saves: metric.saves,
    shares: metric.shares,
    engagement_quality: engagementRate,
    sentiment: metric.sentimentScore,
    conversation_themes: metric.comments,
    cta_intent: metric.ctr,
    gmv: metric.gmv,
    conversion_rate: metric.conversionRate,
    ctr: metric.ctr,
    add_to_cart: metric.addToCart,
    cpa: metric.cpa,
    roas: metric.roas,
    funnel_drop_off: metric.conversionRate
  };

  return values[name];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function cohortNormalizedScore(value: number, cohortValues: number[], lowerIsBetter = false): number | undefined {
  const values = cohortValues.filter((item) => Number.isFinite(item));
  if (!Number.isFinite(value) || !values.length) return undefined;

  const min = Math.min(...values, value);
  const max = Math.max(...values, value);
  if (max <= 0 && min >= 0) return 0;
  if (max === min) return value === 0 ? 0 : SINGLE_VALUE_SCORE;

  const normalized = lowerIsBetter ? (max - value) / (max - min) : (value - min) / (max - min);
  return clampScore(COHORT_SCORE_FLOOR + normalized * (100 - COHORT_SCORE_FLOOR));
}

export function normalizeMetricValue(
  metric: CreatorMetricInputPayload,
  allMetrics: CreatorMetricInputPayload[],
  name: string
): number | undefined {
  const value = numericMetric(metric, name);
  if (value === undefined) return undefined;

  const cohortValues = allMetrics
    .map((item) => numericMetric(item, name))
    .filter((item): item is number => item !== undefined && Number.isFinite(item));

  return cohortNormalizedScore(value, cohortValues, name === "cpa");
}
