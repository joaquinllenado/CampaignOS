import type {
  CampaignIntelligenceReport,
  CampaignObjective,
  FrameworkEvaluation,
  Recommendation
} from "./campaignTypes";

export type SimulationHorizon = 30 | 60 | 90;
export const SIMULATION_HORIZONS: SimulationHorizon[] = [30, 60, 90];

/**
 * How much of the remaining headroom (100 - currentSubScore) a recommendation closes per
 * affected metric, before horizon, framework, and effectiveness scaling. These numbers are
 * intentionally conservative: a high-priority recommendation closes 25% of the gap, not the
 * whole gap.
 */
const PRIORITY_CLOSURE: Record<Recommendation["priority"], number> = {
  high: 0.25,
  medium: 0.12,
  low: 0.05
};

/**
 * Saturating adoption curve. A 30-day horizon realises ~55% of a recommendation's effect,
 * 60 days ~85%, 90 days ~100%. Values cannot exceed 1 — the model never extrapolates past
 * full realisation of the projected lift.
 */
const HORIZON_REALIZATION: Record<SimulationHorizon, number> = {
  30: 0.55,
  60: 0.85,
  90: 1
};

const FRAMEWORK_CONFIDENCE_FACTOR: Record<"low" | "medium" | "high", number> = {
  low: 0.7,
  medium: 0.85,
  high: 1
};

/** Width of the confidence band around the expected projection (± of closure). */
const CONFIDENCE_BAND_SPREAD = 0.3;

/**
 * Maps a recommendation category onto the KPI framework metric names that the recommendation
 * is plausibly able to move. Shares within a category sum to 1.0 — they describe how a
 * recommendation's effect is distributed across the metrics it touches, not absolute lift.
 *
 * Metric names match the strings used by the API's KPI frameworks (see
 * `apps/api/src/agent/schema.ts` SUPPORTED_KPI_METRIC_NAMES). Metrics not present in a
 * specific framework are simply skipped at projection time, so the same map works for
 * awareness / engagement / sales frameworks.
 */
export const recommendationMetricImpactMap: Record<Recommendation["category"], Record<string, number>> = {
  creator_mix: {
    reach: 0.25,
    impressions: 0.15,
    audience_penetration: 0.15,
    engagement_quality: 0.15,
    gmv: 0.15,
    conversion_rate: 0.15
  },
  creative_direction: {
    completion_rate: 0.25,
    engagement_quality: 0.2,
    comment_depth: 0.15,
    saves: 0.15,
    shares: 0.1,
    cta_intent: 0.15
  },
  cta: {
    cta_intent: 0.25,
    conversion_rate: 0.25,
    ctr: 0.2,
    add_to_cart: 0.1,
    gmv: 0.1,
    roas: 0.1
  },
  budget: {
    reach: 0.25,
    impressions: 0.2,
    audience_penetration: 0.15,
    gmv: 0.2,
    share_velocity: 0.1,
    shares: 0.1
  },
  audience: {
    engagement_quality: 0.25,
    brand_sentiment: 0.15,
    sentiment: 0.15,
    comment_depth: 0.15,
    conversion_rate: 0.2,
    cta_intent: 0.1
  },
  measurement: {
    funnel_drop_off: 0.35,
    conversation_themes: 0.2,
    cta_intent: 0.15,
    conversion_rate: 0.15,
    engagement_quality: 0.15
  }
};

/**
 * How relevant a recommendation category is to a framework objective (0..1). Replaces the
 * legacy `categoryObjectiveLift` table with a single dimension: relevance, not absolute
 * point lift. The headroom model already governs magnitude.
 */
export const categoryObjectiveEffectiveness: Record<Recommendation["category"], Record<CampaignObjective, number>> = {
  creator_mix:        { awareness: 0.9, engagement: 0.7, sales: 0.7 },
  creative_direction: { awareness: 0.7, engagement: 1.0, sales: 0.5 },
  cta:                { awareness: 0.2, engagement: 0.5, sales: 1.0 },
  budget:             { awareness: 0.9, engagement: 0.4, sales: 0.7 },
  audience:           { awareness: 0.6, engagement: 0.8, sales: 0.7 },
  measurement:        { awareness: 0.3, engagement: 0.4, sales: 0.5 }
};

const priorityRank: Record<Recommendation["priority"], number> = { high: 0, medium: 1, low: 2 };

export function sortRecommendations(recommendations: Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

export function recommendationSimulationId(recommendation: Recommendation, index: number): string {
  return recommendation.id ?? `${recommendation.priority}-${recommendation.category}-${index}`;
}

export type FrameworkMetricSubScore = {
  metricName: string;
  weight: number;
  baselineSubScore: number;
  evidence: { strong: number; weak: number; missing: number; cohortSize: number };
};

export type RecommendationMetricLift = {
  objective: CampaignObjective;
  metricName: string;
  weight: number;
  subScoreBefore: number;
  subScoreAfter: number;
  pointContributionToFramework: number;
};

export type RecommendationContribution = {
  simulationId: string;
  recommendation: Recommendation;
  perFrameworkPoints: Array<{ objective: CampaignObjective; points: number }>;
  compositePoints: number;
  perMetricLifts: RecommendationMetricLift[];
  unmodeled: boolean;
};

export type SimulationBand = { conservative: number; expected: number; optimistic: number };

export type FrameworkProjection = {
  objective: CampaignObjective;
  baselineCampaignScore: number;
  projectedCampaignScore: number;
  band: SimulationBand;
  metricSubScores: Array<{
    metricName: string;
    weight: number;
    baseline: number;
    projected: number;
    pointContributionToFramework: number;
  }>;
};

export type FutureSimulation = {
  horizon: SimulationHorizon;
  selectedRecommendations: Recommendation[];
  frameworkProjections: FrameworkProjection[];
  baselineCompositeScore: number;
  projectedCompositeScore: number;
  compositeBand: SimulationBand;
  contributions: RecommendationContribution[];
  unmodeledRecommendations: Recommendation[];
  narrative: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Estimate per-metric sub-scores for a framework using only data already in the report:
 * the framework's overall campaignScore and per-creator strongestMetrics / weakestMetrics /
 * missingMetrics flags. Each metric starts at the framework score and is nudged up or down
 * by the share of creators that flagged it as a strength, weakness, or missing data point.
 */
export function estimatedFrameworkSubScores(framework: FrameworkEvaluation): FrameworkMetricSubScore[] {
  const cohortSize = Math.max(1, framework.creatorEvaluations.length);
  const prior = framework.campaignScore;

  const strongCounts = new Map<string, number>();
  const weakCounts = new Map<string, number>();
  const missingCounts = new Map<string, number>();
  for (const evaluation of framework.creatorEvaluations) {
    for (const name of evaluation.strongestMetrics) strongCounts.set(name, (strongCounts.get(name) ?? 0) + 1);
    for (const name of evaluation.weakestMetrics) weakCounts.set(name, (weakCounts.get(name) ?? 0) + 1);
    for (const name of evaluation.missingMetrics) missingCounts.set(name, (missingCounts.get(name) ?? 0) + 1);
  }

  return framework.framework.metrics.map((metric) => {
    const strong = strongCounts.get(metric.name) ?? 0;
    const weak = weakCounts.get(metric.name) ?? 0;
    const missing = missingCounts.get(metric.name) ?? 0;
    const evidenceShift = ((strong - weak) / cohortSize) * 12 - (missing / cohortSize) * 5;
    const baselineSubScore = clamp(Math.round(prior + evidenceShift), 10, 95);
    return {
      metricName: metric.name,
      weight: metric.weight,
      baselineSubScore,
      evidence: { strong, weak, missing, cohortSize }
    };
  });
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function weightedCompositeScore(
  frameworks: Array<{ objective: CampaignObjective; score: number }>,
  weights: Record<CampaignObjective, number>
): number {
  return Math.round(
    weightedAverage(frameworks.map((framework) => ({ value: framework.score, weight: weights[framework.objective] ?? 0 })))
  );
}

function closureFraction(
  recommendation: Recommendation,
  framework: FrameworkEvaluation,
  horizon: SimulationHorizon,
  scale: number
): number {
  const priority = PRIORITY_CLOSURE[recommendation.priority];
  const horizonScale = HORIZON_REALIZATION[horizon];
  const frameworkConfidence = FRAMEWORK_CONFIDENCE_FACTOR[framework.confidence];
  const effectiveness = categoryObjectiveEffectiveness[recommendation.category][framework.objective] ?? 0.2;
  return priority * horizonScale * frameworkConfidence * effectiveness * scale;
}


type FrameworkSimulationState = {
  framework: FrameworkEvaluation;
  weightTotal: number;
  /** subScore mutates in place as recommendations are applied in priority order. */
  subScores: Map<string, { weight: number; subScore: number; baseline: number }>;
  /** Unrounded weighted average of the baseline sub-scores. Projected scores are anchored to
   * `framework.campaignScore` and shifted by the change relative to this baseline so that a
   * zero-recommendation simulation always reports the campaign's actual score. */
  baselineRawWeighted: number;
  /** point lifts contributed to this framework's campaignScore, keyed by simulationId. */
  contributions: Map<string, number>;
};

function buildFrameworkStates(report: CampaignIntelligenceReport): FrameworkSimulationState[] {
  return report.frameworkEvaluations.map((framework) => {
    const subScores = new Map<string, { weight: number; subScore: number; baseline: number }>();
    let weightTotal = 0;
    let weightedSum = 0;
    for (const item of estimatedFrameworkSubScores(framework)) {
      subScores.set(item.metricName, { weight: item.weight, subScore: item.baselineSubScore, baseline: item.baselineSubScore });
      weightTotal += item.weight;
      weightedSum += item.baselineSubScore * item.weight;
    }
    const baselineRawWeighted = weightTotal > 0 ? weightedSum / weightTotal : framework.campaignScore;
    return { framework, weightTotal, subScores, baselineRawWeighted, contributions: new Map() };
  });
}

function applyRecommendationToState(
  state: FrameworkSimulationState,
  recommendation: Recommendation,
  simulationId: string,
  horizon: SimulationHorizon,
  scale: number
): RecommendationMetricLift[] {
  const impactMap = recommendationMetricImpactMap[recommendation.category];
  const lifts: RecommendationMetricLift[] = [];
  let frameworkPointLift = 0;

  // Normalise the recommendation's impact share across only the metrics that this framework
  // actually weights. The rationale: a recommendation budgets its effort across the metrics
  // it can plausibly move, and that effort concentrates on whatever subset of those metrics
  // a given framework cares about. Without this, a CTA recommendation against a sales
  // framework that only weights `gmv` would receive just gmv's tiny global share (10%),
  // producing a vanishingly small lift even though the recommendation is highly relevant.
  const presentEntries = Object.entries(impactMap).filter(([metricName]) => state.subScores.has(metricName));
  const presentShareTotal = presentEntries.reduce((sum, [, share]) => sum + share, 0);
  if (presentShareTotal <= 0) return lifts;

  for (const [metricName, rawShare] of presentEntries) {
    const subScoreEntry = state.subScores.get(metricName)!;
    const impactShare = rawShare / presentShareTotal;
    const headroom = 100 - subScoreEntry.subScore;
    if (headroom <= 0) continue;

    const closure = closureFraction(recommendation, state.framework, horizon, scale);
    const subScoreLift = headroom * closure * impactShare;
    if (subScoreLift <= 0) continue;

    const subScoreBefore = subScoreEntry.subScore;
    const subScoreAfter = Math.min(100, subScoreBefore + subScoreLift);
    subScoreEntry.subScore = subScoreAfter;

    const pointContribution = state.weightTotal > 0 ? ((subScoreAfter - subScoreBefore) * subScoreEntry.weight) / state.weightTotal : 0;
    frameworkPointLift += pointContribution;
    lifts.push({
      objective: state.framework.objective,
      metricName,
      weight: subScoreEntry.weight,
      subScoreBefore: Math.round(subScoreBefore),
      subScoreAfter: Math.round(subScoreAfter),
      pointContributionToFramework: pointContribution
    });
  }

  if (frameworkPointLift > 0) {
    state.contributions.set(simulationId, (state.contributions.get(simulationId) ?? 0) + frameworkPointLift);
  }
  return lifts;
}

function rawWeightedSubScore(state: FrameworkSimulationState): number {
  if (state.weightTotal <= 0) return state.baselineRawWeighted;
  let weighted = 0;
  for (const entry of state.subScores.values()) weighted += entry.subScore * entry.weight;
  return weighted / state.weightTotal;
}

function projectedScoreFromState(state: FrameworkSimulationState): number {
  // Anchor to the framework's reported campaignScore; only the *change* from the baseline
  // recompute is added on top so a zero-recommendation simulation matches the dashboard.
  const delta = rawWeightedSubScore(state) - state.baselineRawWeighted;
  return clamp(Math.round(state.framework.campaignScore + delta), 0, 100);
}

function buildFrameworkProjection(
  state: FrameworkSimulationState,
  band: SimulationBand
): FrameworkProjection {
  const metricSubScores = Array.from(state.subScores.entries()).map(([metricName, entry]) => ({
    metricName,
    weight: entry.weight,
    baseline: Math.round(entry.baseline),
    projected: Math.round(entry.subScore),
    pointContributionToFramework: state.weightTotal > 0 ? ((entry.subScore - entry.baseline) * entry.weight) / state.weightTotal : 0
  }));
  return {
    objective: state.framework.objective,
    baselineCampaignScore: state.framework.campaignScore,
    projectedCampaignScore: projectedScoreFromState(state),
    band,
    metricSubScores
  };
}

function runProjection(
  report: CampaignIntelligenceReport,
  selectedRecommendations: Recommendation[],
  horizon: SimulationHorizon,
  scale: number
): { frameworkScores: Map<CampaignObjective, number>; perRecFrameworkPoints: Map<string, Map<CampaignObjective, number>>; perRecMetricLifts: Map<string, RecommendationMetricLift[]> } {
  const states = buildFrameworkStates(report);
  const perRecFrameworkPoints = new Map<string, Map<CampaignObjective, number>>();
  const perRecMetricLifts = new Map<string, RecommendationMetricLift[]>();

  for (let index = 0; index < selectedRecommendations.length; index += 1) {
    const recommendation = selectedRecommendations[index]!;
    const simulationId = recommendationSimulationId(recommendation, index);
    perRecFrameworkPoints.set(simulationId, new Map());
    perRecMetricLifts.set(simulationId, []);
    for (const state of states) {
      const before = projectedScoreFromState(state);
      const lifts = applyRecommendationToState(state, recommendation, simulationId, horizon, scale);
      const after = projectedScoreFromState(state);
      perRecFrameworkPoints.get(simulationId)!.set(state.framework.objective, after - before);
      if (lifts.length) perRecMetricLifts.get(simulationId)!.push(...lifts);
    }
  }

  const frameworkScores = new Map<CampaignObjective, number>();
  for (const state of states) frameworkScores.set(state.framework.objective, projectedScoreFromState(state));
  return { frameworkScores, perRecFrameworkPoints, perRecMetricLifts };
}

function buildNarrative(delta: number, count: number, horizon: SimulationHorizon, unmodeled: number): string {
  if (!count) return "Select recommendations to simulate how actioning them could change future performance.";
  const direction = delta >= 0 ? "+" : "";
  const base = `Applying ${count} recommendation${count === 1 ? "" : "s"} over ${horizon} days projects a ${direction}${delta} point move in the overall campaign score.`;
  if (unmodeled > 0) {
    return `${base} ${unmodeled} selected recommendation${unmodeled === 1 ? " targets" : "s target"} metrics that are not weighted in this campaign's KPI frameworks, so they are not counted in the projection.`;
  }
  return base;
}

export function simulateCampaignFuture(
  report: CampaignIntelligenceReport,
  selectedRecommendationIds: Set<string>,
  horizon: SimulationHorizon
): FutureSimulation {
  const sorted = sortRecommendations(report.recommendations);
  const selectedRecommendations = sorted.filter((recommendation, index) =>
    selectedRecommendationIds.has(recommendationSimulationId(recommendation, index))
  );

  // Run three projections (conservative / expected / optimistic) so the headline number
  // is always shown with a confidence band rather than a single suspiciously precise value.
  const expected = runProjection(report, selectedRecommendations, horizon, 1);
  const conservative = runProjection(report, selectedRecommendations, horizon, 1 - CONFIDENCE_BAND_SPREAD);
  const optimistic = runProjection(report, selectedRecommendations, horizon, 1 + CONFIDENCE_BAND_SPREAD);

  // Rebuild expected states once more so we can produce the per-framework metric breakdowns
  // alongside the band derived above.
  const expectedStates = buildFrameworkStates(report);
  for (let index = 0; index < selectedRecommendations.length; index += 1) {
    const recommendation = selectedRecommendations[index]!;
    const simulationId = recommendationSimulationId(recommendation, index);
    for (const state of expectedStates) {
      applyRecommendationToState(state, recommendation, simulationId, horizon, 1);
    }
  }

  const frameworkProjections: FrameworkProjection[] = expectedStates.map((state) => {
    const objective = state.framework.objective;
    const expectedScore = expected.frameworkScores.get(objective) ?? state.framework.campaignScore;
    const conservativeScore = conservative.frameworkScores.get(objective) ?? state.framework.campaignScore;
    const optimisticScore = optimistic.frameworkScores.get(objective) ?? state.framework.campaignScore;
    return buildFrameworkProjection(state, {
      conservative: conservativeScore,
      expected: expectedScore,
      optimistic: optimisticScore
    });
  });

  const blendWeights = report.objectiveBlend.weights;
  const baselineCompositeScore = weightedCompositeScore(
    report.frameworkEvaluations.map((framework) => ({ objective: framework.objective, score: framework.campaignScore })),
    blendWeights
  );
  const compositeBand: SimulationBand = {
    conservative: weightedCompositeScore(
      Array.from(conservative.frameworkScores.entries()).map(([objective, score]) => ({ objective, score })),
      blendWeights
    ),
    expected: weightedCompositeScore(
      Array.from(expected.frameworkScores.entries()).map(([objective, score]) => ({ objective, score })),
      blendWeights
    ),
    optimistic: weightedCompositeScore(
      Array.from(optimistic.frameworkScores.entries()).map(([objective, score]) => ({ objective, score })),
      blendWeights
    )
  };
  const projectedCompositeScore = compositeBand.expected;

  const totalBlendWeight = (blendWeights.awareness ?? 0) + (blendWeights.engagement ?? 0) + (blendWeights.sales ?? 0);
  const contributions: RecommendationContribution[] = selectedRecommendations.map((recommendation, index) => {
    const simulationId = recommendationSimulationId(recommendation, index);
    const perFramework = expected.perRecFrameworkPoints.get(simulationId) ?? new Map<CampaignObjective, number>();
    const perFrameworkPoints: Array<{ objective: CampaignObjective; points: number }> = Array.from(perFramework.entries()).map(
      ([objective, points]) => ({ objective: objective as CampaignObjective, points: points as number })
    );
    const compositePoints = totalBlendWeight > 0
      ? perFrameworkPoints.reduce((sum, item) => sum + item.points * (blendWeights[item.objective] ?? 0), 0) / totalBlendWeight
      : 0;
    const perMetricLifts = expected.perRecMetricLifts.get(simulationId) ?? [];
    return {
      simulationId,
      recommendation,
      perFrameworkPoints,
      compositePoints,
      perMetricLifts,
      unmodeled: perMetricLifts.length === 0
    };
  }).sort((a, b) => b.compositePoints - a.compositePoints);

  const unmodeledRecommendations = contributions.filter((item) => item.unmodeled).map((item) => item.recommendation);
  const narrative = buildNarrative(
    projectedCompositeScore - baselineCompositeScore,
    selectedRecommendations.length,
    horizon,
    unmodeledRecommendations.length
  );

  return {
    horizon,
    selectedRecommendations,
    frameworkProjections,
    baselineCompositeScore,
    projectedCompositeScore,
    compositeBand,
    contributions,
    unmodeledRecommendations,
    narrative
  };
}

