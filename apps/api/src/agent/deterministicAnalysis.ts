import {
  attributionInsightSchema,
  campaignIntelligenceReportSchema,
  kpiFrameworkSchema,
  recommendationSchema,
  type AttributionInsight,
  type CampaignAgentState,
  type CreatorEvaluation,
  type CreatorMetricInputPayload,
  type KpiFramework,
  type NormalizedCampaignBrief,
  type Recommendation,
  type ResolvedCampaignObjective
} from "./schema";
import { createModel, getModelName } from "./model";
import { normalizeInput } from "./objective";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function defaultKpiFramework(
  objective: ResolvedCampaignObjective,
  normalizedBrief: NormalizedCampaignBrief,
  hasNiaContext: boolean
): KpiFramework {
  const defaults: Record<ResolvedCampaignObjective, KpiFramework["metrics"]> = {
    awareness: [
      { name: "reach", weight: 24, reason: "Measures top-of-funnel visibility and audience penetration." },
      { name: "impressions", weight: 18, reason: "Captures repeated exposure and campaign momentum." },
      { name: "completion_rate", weight: 18, reason: "Shows whether the content held attention." },
      { name: "shares", weight: 16, reason: "Signals creator amplification and network spread." },
      { name: "engagement_quality", weight: 12, reason: "Separates active awareness from passive impressions." },
      { name: "brand_sentiment", weight: 12, reason: "Checks whether visibility is directionally positive." }
    ],
    engagement: [
      { name: "comment_depth", weight: 22, reason: "Measures conversation quality, not just reactions." },
      { name: "saves", weight: 18, reason: "Signals durable audience intent and usefulness." },
      { name: "shares", weight: 16, reason: "Captures peer-to-peer endorsement." },
      { name: "engagement_quality", weight: 18, reason: "Balances active engagements against exposure." },
      { name: "sentiment", weight: 14, reason: "Evaluates whether conversation is positive." },
      { name: "cta_intent", weight: 12, reason: "Connects engagement to next-step interest." }
    ],
    sales: [
      { name: "gmv", weight: 24, reason: "Directly measures revenue contribution." },
      { name: "conversion_rate", weight: 20, reason: "Shows how efficiently traffic becomes purchase behavior." },
      { name: "ctr", weight: 16, reason: "Captures creator ability to move viewers into the funnel." },
      { name: "add_to_cart", weight: 14, reason: "Measures mid-funnel buying intent." },
      { name: "cpa", weight: 14, reason: "Checks acquisition efficiency." },
      { name: "roas", weight: 12, reason: "Balances revenue against spend." }
    ]
  };

  return {
    objective,
    summary: `${normalizedBrief.brand} should evaluate ${normalizedBrief.name} as a ${objective} campaign for ${normalizedBrief.product}.`,
    metrics: defaults[objective],
    evaluationLogic: [
      "Normalize each creator metric against the available creator set.",
      "Apply objective-specific weights that sum to 100.",
      "Reduce confidence when key funnel metrics are missing.",
      "Use Nia context for strategic interpretation and Reacher/manual metrics for observed performance."
    ],
    confidence: hasNiaContext && normalizedBrief.confidence !== "low" ? "high" : "medium"
  };
}

export async function generateKpiFramework(
  state: CampaignAgentState
): Promise<Partial<CampaignAgentState>> {
  const normalizedBrief = state.normalizedBrief ?? normalizeInput(state);
  const fallback = defaultKpiFramework(
    normalizedBrief.objective,
    normalizedBrief,
    Boolean(state.niaContext?.length)
  );
  const model = createModel();
  if (!model) return { kpiFramework: fallback };

  try {
    const structuredModel = model.withStructuredOutput(kpiFrameworkSchema);
    const kpiFramework = await structuredModel.invoke([
      {
        role: "system",
        content:
          "You generate objective-specific influencer campaign KPI frameworks. Return only data matching the schema. Metric weights must sum to 100. Do not invent exact metrics."
      },
      {
        role: "user",
        content: JSON.stringify({
          normalizedBrief,
          niaContext: state.niaContext ?? [],
          availableMetrics: state.reacherMetrics ?? [],
          defaultFramework: fallback
        })
      }
    ]);

    const totalWeight = kpiFramework.metrics.reduce((sum, metric) => sum + metric.weight, 0);
    if (Math.round(totalWeight) !== 100) return { kpiFramework: fallback };

    return { kpiFramework };
  } catch (error) {
    return {
      kpiFramework: fallback,
      errors: [`KPI model generation failed, so defaults were used: ${errorMessage(error)}`]
    };
  }
}

function numericMetric(metric: CreatorMetricInputPayload, name: string): number | undefined {
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

function normalizeRateOrScore(value: number): number {
  if (value <= 1) return value * 100;
  return Math.min(value, 100);
}

function normalizeMetricValue(
  metric: CreatorMetricInputPayload,
  allMetrics: CreatorMetricInputPayload[],
  name: string
): number | undefined {
  const value = numericMetric(metric, name);
  if (value === undefined) return undefined;

  if (
    [
      "completion_rate",
      "brand_sentiment",
      "sentiment",
      "engagement_quality",
      "cta_intent",
      "conversion_rate",
      "ctr"
    ].includes(name)
  ) {
    return normalizeRateOrScore(value);
  }

  if (name === "cpa") {
    const cpaValues = allMetrics
      .map((item) => numericMetric(item, name))
      .filter((item): item is number => item !== undefined && item > 0);
    const max = Math.max(...cpaValues, value);
    return max > 0 ? Math.max(0, 100 - (value / max) * 100) : undefined;
  }

  const values = allMetrics
    .map((item) => numericMetric(item, name))
    .filter((item): item is number => item !== undefined && item >= 0);
  const max = Math.max(...values, value);
  return max > 0 ? (value / max) * 100 : undefined;
}

function availableMetricNames(
  creator: CreatorMetricInputPayload,
  allCreators: CreatorMetricInputPayload[],
  framework: KpiFramework
): string[] {
  return framework.metrics
    .filter((metric) => normalizeMetricValue(creator, allCreators, metric.name) !== undefined)
    .map((metric) => metric.name);
}

function missingMetricNames(
  creator: CreatorMetricInputPayload,
  allCreators: CreatorMetricInputPayload[],
  framework: KpiFramework
): string[] {
  return framework.metrics
    .filter((metric) => normalizeMetricValue(creator, allCreators, metric.name) === undefined)
    .map((metric) => metric.name);
}

export function evaluateCreators(state: CampaignAgentState): Partial<CampaignAgentState> {
  const framework = state.kpiFramework;
  const metrics = state.reacherMetrics ?? [];

  if (!framework || !metrics.length) {
    return {
      creatorEvaluations: [],
      errors: ["Creator evaluation skipped because metrics or KPI framework were missing."]
    };
  }

  const evaluations = metrics
    .map((creator) => {
      let weightedScore = 0;
      let appliedWeight = 0;
      const contributions: { name: string; score: number; weight: number }[] = [];

      for (const metric of framework.metrics) {
        const normalized = normalizeMetricValue(creator, metrics, metric.name);
        if (normalized === undefined) continue;

        weightedScore += normalized * metric.weight;
        appliedWeight += metric.weight;
        contributions.push({ name: metric.name, score: normalized, weight: metric.weight });
      }

      const score = appliedWeight > 0 ? Math.round(weightedScore / appliedWeight) : 0;
      const strengths = contributions
        .filter((item) => item.score >= 65)
        .sort((a, b) => b.score * b.weight - a.score * a.weight)
        .slice(0, 3)
        .map((item) => `${item.name} outperformed peers`);
      const weaknesses = [
        ...contributions
          .filter((item) => item.score < 45)
          .sort((a, b) => a.score * b.weight - b.score * b.weight)
          .slice(0, 2)
          .map((item) => `${item.name} lagged the creator set`),
        ...missingMetricNames(creator, metrics, framework)
          .slice(0, 2)
          .map((name) => `${name} was missing`)
      ];
      const sortedContributions = [...contributions].sort(
        (a, b) => b.score * b.weight - a.score * a.weight
      );

      return {
        creatorName: creator.name,
        score,
        rank: 1,
        strengths: strengths.length ? strengths : ["Performance was directionally balanced."],
        weaknesses: weaknesses.length ? weaknesses : ["No major weakness in supplied metrics."],
        primaryDriver: sortedContributions[0]?.name ?? "insufficient data",
        primaryDrag: sortedContributions.at(-1)?.name ?? "insufficient data",
        recommendedAction: recommendedCreatorAction(framework.objective, creator, score),
        confidence: availableMetricNames(creator, metrics, framework).length >= framework.metrics.length - 1
          ? "high"
          : "medium"
      } satisfies CreatorEvaluation;
    })
    .sort((a, b) => b.score - a.score)
    .map((evaluation, index) => ({ ...evaluation, rank: index + 1 }));

  return { creatorEvaluations: evaluations };
}

function recommendedCreatorAction(
  objective: ResolvedCampaignObjective,
  creator: CreatorMetricInputPayload,
  score: number
): string {
  if (score >= 75) return `Scale ${creator.name} with more budget or additional content variations.`;
  if (objective === "sales") return `Tighten CTA and product proof points before scaling ${creator.name}.`;
  if (objective === "engagement") return `Give ${creator.name} prompts that invite comments, saves, and shares.`;
  return `Improve the first three seconds and brand cue clarity for ${creator.name}.`;
}

export function fallbackAttribution(state: CampaignAgentState): AttributionInsight[] {
  const topCreator = state.creatorEvaluations?.[0];
  const objective = state.kpiFramework?.objective ?? state.normalizedBrief?.objective ?? "awareness";

  if (!topCreator) {
    return [
      {
        claim: "The campaign needs creator-level metrics before strong attribution claims can be made.",
        evidence: ["No creator evaluation was available."],
        businessImplication: "Treat this report as a planning framework rather than a performance diagnosis.",
        confidence: "low"
      }
    ];
  }

  return [
    {
      claim: `${topCreator.creatorName} is the strongest observed contributor for the ${objective} objective.`,
      evidence: [
        `${topCreator.creatorName} ranked #${topCreator.rank} with a score of ${topCreator.score}.`,
        `Primary driver: ${topCreator.primaryDriver}.`
      ],
      businessImplication:
        "Use the highest-scoring creator pattern as the next creative and creator-selection benchmark.",
      confidence: topCreator.confidence
    }
  ];
}

export async function reasonAboutAttribution(
  state: CampaignAgentState
): Promise<Partial<CampaignAgentState>> {
  if (state.report) return {};

  const fallback = fallbackAttribution(state);
  const model = createModel();
  if (!model) return { attributionInsights: fallback };

  try {
    const structuredModel = model.withStructuredOutput(attributionInsightSchema.array().min(1).max(4));
    const attributionInsights = await structuredModel.invoke([
      {
        role: "system",
        content:
          "Explain why campaign outcomes happened using only supplied metrics and Nia context. Distinguish observed evidence from interpretation."
      },
      {
        role: "user",
        content: JSON.stringify({
          normalizedBrief: state.normalizedBrief,
          niaContext: state.niaContext,
          metrics: state.reacherMetrics,
          kpiFramework: state.kpiFramework,
          creatorEvaluations: state.creatorEvaluations
        })
      }
    ]);
    return { attributionInsights };
  } catch (error) {
    return {
      attributionInsights: fallback,
      errors: [`Attribution model generation failed, so deterministic attribution was used: ${errorMessage(error)}`]
    };
  }
}

export function fallbackRecommendations(state: CampaignAgentState): Recommendation[] {
  const objective = state.kpiFramework?.objective ?? state.normalizedBrief?.objective ?? "awareness";
  const topCreator = state.creatorEvaluations?.[0];

  return [
    {
      priority: "high",
      category: "creator_mix",
      action: topCreator
        ? `Prioritize creators with the same pattern as ${topCreator.creatorName}.`
        : "Collect creator-level metrics before reallocating budget.",
      rationale: topCreator
        ? `${topCreator.creatorName} led the objective-weighted scorecard.`
        : "Attribution is low-confidence without creator-level data.",
      expectedImpact:
        "Improves alignment between creator selection and the campaign's business objective.",
      followUpDataNeeded: topCreator ? undefined : ["creator-level reach, engagement, and commerce metrics"]
    },
    {
      priority: "medium",
      category: objective === "sales" ? "cta" : "creative_direction",
      action:
        objective === "sales"
          ? "Move the TikTok Shop CTA earlier and pair it with clearer product proof."
          : "Test stronger opening hooks that make the brand benefit clear in the first three seconds.",
      rationale: "The framework rewards funnel movement, not isolated vanity metrics.",
      expectedImpact: "Should reduce drop-off between attention and the next desired action."
    },
    {
      priority: "medium",
      category: "measurement",
      action: "Keep Nia source citations and Reacher metrics attached to every report refresh.",
      rationale: "Separating source-backed context from model reasoning keeps recommendations auditable.",
      expectedImpact: "Improves confidence in future diagnostics and optimization decisions."
    }
  ];
}

export async function recommendOptimizations(
  state: CampaignAgentState
): Promise<Partial<CampaignAgentState>> {
  if (state.report) return {};

  const fallback = fallbackRecommendations(state);
  const model = createModel();
  if (!model) return { recommendations: fallback };

  try {
    const structuredModel = model.withStructuredOutput(recommendationSchema.array().min(3).max(6));
    const recommendations = await structuredModel.invoke([
      {
        role: "system",
        content:
          "Produce prioritized campaign optimization recommendations. Keep claims advisory and evidence-backed. Do not guarantee outcomes."
      },
      {
        role: "user",
        content: JSON.stringify({
          normalizedBrief: state.normalizedBrief,
          niaContext: state.niaContext,
          kpiFramework: state.kpiFramework,
          creatorEvaluations: state.creatorEvaluations,
          attributionInsights: state.attributionInsights,
          dataProvenance: state.dataProvenance
        })
      }
    ]);
    return { recommendations };
  } catch (error) {
    return {
      recommendations: fallback,
      errors: [`Recommendation model generation failed, so deterministic recommendations were used: ${errorMessage(error)}`]
    };
  }
}

function reportConfidence(state: CampaignAgentState): "low" | "medium" | "high" {
  if (state.errors.length > 2 || state.dataProvenance?.contextSource === "brief_only") return "medium";
  if (state.creatorEvaluations?.some((evaluation) => evaluation.confidence === "low")) return "medium";
  return "high";
}

export function composeReport(state: CampaignAgentState): Partial<CampaignAgentState> {
  if (state.report) return {};

  const normalizedBrief = state.normalizedBrief;
  const kpiFramework = state.kpiFramework;
  const dataProvenance = state.dataProvenance;

  if (!normalizedBrief || !kpiFramework || !dataProvenance) {
    return { errors: ["Report composition failed because graph state was incomplete."] };
  }

  const topCreator = state.creatorEvaluations?.[0];
  const executiveSummary = topCreator
    ? `${normalizedBrief.brand}'s ${normalizedBrief.name} should be evaluated as a ${normalizedBrief.objective} campaign. ${topCreator.creatorName} currently leads the creator set with a score of ${topCreator.score}, driven by ${topCreator.primaryDriver}.`
    : `${normalizedBrief.brand}'s ${normalizedBrief.name} should be evaluated as a ${normalizedBrief.objective} campaign, but creator-level metrics are needed for performance ranking.`;

  const report = campaignIntelligenceReportSchema.parse({
    executiveSummary,
    objective: normalizedBrief.objective,
    dataProvenance: {
      ...dataProvenance,
      missingInputs: [...new Set([...dataProvenance.missingInputs, ...state.errors])]
    },
    kpiFramework,
    creatorEvaluations: state.creatorEvaluations ?? [],
    attributionInsights: state.attributionInsights ?? [],
    recommendations: state.recommendations ?? [],
    confidence: reportConfidence(state),
    generatedAt: new Date().toISOString(),
    model: createModel() ? getModelName() : "deterministic-fallback"
  });

  return { report };
}
