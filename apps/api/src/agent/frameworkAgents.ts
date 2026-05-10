import {
  unifiedScoringPackSchema,
  type CampaignAgentState,
  type CreatorEvaluation,
  type CreatorMetricInputPayload,
  type FrameworkCreatorEvaluation,
  type FrameworkEvaluation,
  type KpiFramework,
  type MetricDefinition,
  type ObjectiveBlend,
  type ResolvedCampaignObjective,
  type NormalizedCampaignBrief,
  type UnifiedScoringPack,
  type WeightedMetric
} from "./schema";
import { createModel } from "./model";
import { defaultKpiFramework, errorMessage } from "./deterministicAnalysis";
import { normalizeInput } from "./objective";
import {
  compactCampaignSummaryForLlm,
  compactCreatorMetricsForLlm,
  compactNormalizedBriefForLlm,
  compactNiaContextForLlm
} from "./llmContextCompact";
import { cohortPerformanceTiersForScores, type PerformanceTier } from "./performanceTiering";
import { normalizeMetricValue } from "./scoringNormalization";
import { AGENT_WEIGHT_INSTRUCTIONS } from "./agentWeight";

const OBJECTIVES: ResolvedCampaignObjective[] = ["awareness", "engagement", "sales"];

const OBJECTIVE_BLEND_MIN = 15;
const OBJECTIVE_BLEND_MAX = 80;

/** Enforce AgentWeight hard constraints: sum 100, each [15, 80]. */
function clampObjectiveBlendWeights(weights: ObjectiveBlend["weights"]): ObjectiveBlend["weights"] {
  let a = Math.round(weights.awareness);
  let e = Math.round(weights.engagement);
  let s = Math.round(weights.sales);

  const MIN = OBJECTIVE_BLEND_MIN;
  const MAX = OBJECTIVE_BLEND_MAX;

  const clampTriple = (): void => {
    a = Math.min(MAX, Math.max(MIN, a));
    e = Math.min(MAX, Math.max(MIN, e));
    s = Math.min(MAX, Math.max(MIN, s));
  };

  const headroomIncrease = (): [number, "a" | "e" | "s"][] => [
    [MAX - a, "a"],
    [MAX - e, "e"],
    [MAX - s, "s"]
  ];

  const headroomDecrease = (): [number, "a" | "e" | "s"][] => [
    [a - MIN, "a"],
    [e - MIN, "e"],
    [s - MIN, "s"]
  ];

  for (let i = 0; i < 200; i++) {
    clampTriple();
    let sum = a + e + s;
    const diff = 100 - sum;
    if (diff === 0) {
      return { awareness: a, engagement: e, sales: s };
    }

    if (diff > 0) {
      const candidates = [...headroomIncrease()].filter(([room]) => room > 0);
      if (!candidates.length) break;
      candidates.sort((x, y) => y[0] - x[0]);
      const [room, slot] = candidates[0]!;
      const step = Math.min(diff, Math.max(room, 0));
      if (step <= 0) break;
      if (slot === "a") a += step;
      else if (slot === "e") e += step;
      else s += step;
    } else {
      const candidates = [...headroomDecrease()].filter(([room]) => room > 0);
      if (!candidates.length) break;
      candidates.sort((x, y) => y[0] - x[0]);
      const [room, slot] = candidates[0]!;
      const step = Math.min(-diff, Math.max(room, 0));
      if (step <= 0) break;
      if (slot === "a") a -= step;
      else if (slot === "e") e -= step;
      else s -= step;
    }

    clampTriple();
    sum = a + e + s;
    if (sum !== 100) continue;
    return { awareness: a, engagement: e, sales: s };
  }

  clampTriple();
  if (a + e + s !== 100 || a < MIN || a > MAX || e < MIN || e > MAX || s < MIN || s > MAX) {
    return { awareness: 34, engagement: 33, sales: 33 };
  }
  return { awareness: a, engagement: e, sales: s };
}

const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  reach: {
    name: "reach",
    displayName: "Reach",
    definition: "The number of unique people exposed to the creator's campaign content.",
    whyItMatters: "Shows the scale of top-of-funnel visibility.",
    sourceMetricKeys: ["reach"]
  },
  impressions: {
    name: "impressions",
    displayName: "Impressions",
    definition: "The total number of times campaign content was shown.",
    whyItMatters: "Captures repeated exposure and awareness momentum.",
    sourceMetricKeys: ["impressions"]
  },
  completion_rate: {
    name: "completion_rate",
    displayName: "Completion Rate",
    definition: "The share of viewers who watched enough of the content to indicate attention quality.",
    whyItMatters: "Separates fleeting reach from content that actually held attention.",
    sourceMetricKeys: ["completionRate"]
  },
  share_velocity: {
    name: "share_velocity",
    displayName: "Share Velocity",
    definition: "How strongly audiences passed the content along through shares.",
    whyItMatters: "Signals amplification beyond the creator's owned audience.",
    sourceMetricKeys: ["shares"]
  },
  audience_penetration: {
    name: "audience_penetration",
    displayName: "Audience Penetration",
    definition: "How effectively campaign content reached the intended audience pool.",
    whyItMatters: "Helps determine whether awareness expanded in the right market.",
    sourceMetricKeys: ["reach", "audienceSegment"]
  },
  brand_sentiment: {
    name: "brand_sentiment",
    displayName: "Brand Sentiment",
    definition: "The direction and quality of audience reaction toward the brand.",
    whyItMatters: "Visibility only helps when it creates useful brand associations.",
    sourceMetricKeys: ["sentimentScore", "representativeComments"]
  },
  comment_depth: {
    name: "comment_depth",
    displayName: "Comment Depth",
    definition: "The volume and substance of comments generated by the content.",
    whyItMatters: "Shows whether audiences were moved to participate, ask, or react.",
    sourceMetricKeys: ["comments", "representativeComments"]
  },
  saves: {
    name: "saves",
    displayName: "Saves",
    definition: "The number of users who saved the content for later.",
    whyItMatters: "Indicates durable interest and future intent beyond a passive view.",
    sourceMetricKeys: ["saves"]
  },
  shares: {
    name: "shares",
    displayName: "Shares",
    definition: "The number of times users shared the content.",
    whyItMatters: "Reflects audience endorsement and community spread.",
    sourceMetricKeys: ["shares"]
  },
  engagement_quality: {
    name: "engagement_quality",
    displayName: "Engagement Quality",
    definition: "Active engagement relative to exposure, including likes, comments, shares, and saves.",
    whyItMatters: "Shows resonance quality instead of raw interaction volume.",
    sourceMetricKeys: ["likes", "comments", "shares", "saves", "impressions"]
  },
  sentiment: {
    name: "sentiment",
    displayName: "Sentiment",
    definition: "The positive or negative direction of audience response.",
    whyItMatters: "Helps distinguish useful engagement from noisy or negative conversation.",
    sourceMetricKeys: ["sentimentScore", "representativeComments"]
  },
  conversation_themes: {
    name: "conversation_themes",
    displayName: "Conversation Themes",
    definition: "The amount of audience discussion available for understanding what resonated.",
    whyItMatters: "Reveals what audiences are responding to and what needs clarification.",
    sourceMetricKeys: ["comments", "representativeComments"]
  },
  cta_intent: {
    name: "cta_intent",
    displayName: "CTA Intent",
    definition: "Audience movement from content toward a next action, approximated by click-through behavior.",
    whyItMatters: "Connects engagement with intent to continue through the funnel.",
    sourceMetricKeys: ["ctr"]
  },
  gmv: {
    name: "gmv",
    displayName: "GMV",
    definition: "Gross merchandise value attributed to the creator or campaign.",
    whyItMatters: "Directly measures commercial output.",
    sourceMetricKeys: ["gmv"]
  },
  conversion_rate: {
    name: "conversion_rate",
    displayName: "Conversion Rate",
    definition: "The rate at which qualified traffic converted into purchase behavior.",
    whyItMatters: "Shows whether attention and clicks translated into actual buying.",
    sourceMetricKeys: ["conversionRate"]
  },
  ctr: {
    name: "ctr",
    displayName: "Click-Through Rate",
    definition: "The share of viewers who clicked from content into the next funnel step.",
    whyItMatters: "Measures the creator's ability to create purchase intent.",
    sourceMetricKeys: ["ctr"]
  },
  add_to_cart: {
    name: "add_to_cart",
    displayName: "Add To Cart",
    definition: "The count of users who added the product to cart after creator exposure.",
    whyItMatters: "Captures mid-funnel buying intent before final conversion.",
    sourceMetricKeys: ["addToCart"]
  },
  cpa: {
    name: "cpa",
    displayName: "CPA Efficiency",
    definition: "Cost efficiency of acquiring a customer or desired action; lower is better.",
    whyItMatters: "Prevents raw sales volume from hiding inefficient spend.",
    sourceMetricKeys: ["cpa"]
  },
  roas: {
    name: "roas",
    displayName: "ROAS",
    definition: "Revenue returned for each unit of spend.",
    whyItMatters: "Balances revenue scale against budget efficiency.",
    sourceMetricKeys: ["roas"]
  },
  funnel_drop_off: {
    name: "funnel_drop_off",
    displayName: "Funnel Drop-Off",
    definition: "Where audiences lose momentum between attention, click, cart, and purchase.",
    whyItMatters: "Highlights the bottleneck that most limits business outcome.",
    sourceMetricKeys: ["ctr", "addToCart", "conversionRate"]
  }
};

const UNIFIED_OBJECTIVE_WEIGHT_BLUEPRINT = `${AGENT_WEIGHT_INSTRUCTIONS.trim()}


Unified scorer — additional hard output rules:
• Phase 1: Apply the blueprint above to objectiveBlend.weights (Awareness / Engagement / Sales). Weights MUST sum to exactly 100. Each funnel weight MUST be between ${OBJECTIVE_BLEND_MIN}% and ${OBJECTIVE_BLEND_MAX}% inclusive (do not expose scoring formulas or raw percentile math to the user).
• Phase 2: Framework influence mirrors objective weights. Each KPI framework (awareness / engagement / sales) must use metric weights that sum to exactly 100 and metrics must align with that framework’s objective enum.
• Apply trust-led conversion, primary KPI overrides, repeated-theme priority, signal hierarchy (KPIs > repeated goals > CTA > content style > creator prefs > isolated keywords).
• Populate rationale, classification, benchmark interpretation context, recommendation priorities, and risk signals per OUTPUT REQUIREMENTS in the blueprint; tone = strategic intelligence, not analytics dashboards.
Include evaluationLogic bullets that cite objective trade-offs (awareness vs sales, engagement vs sales, engagement vs passive reach).
Return ONLY JSON validated by schema. Prefer metrics referenced in normalizedBriefCompact and creatorMetricsPreview; otherwise follow the KPI catalog in defaultFallbackPack.`;

function finalizeObjectiveBlendCandidate(
  candidate: ObjectiveBlend | undefined,
  fallback: ObjectiveBlend,
  errors: string[]
): ObjectiveBlend {
  if (!candidate) {
    errors.push("Unified scorer returned no objective blend; deterministic mix applied.");
    return fallback;
  }
  const rawTotal = candidate.weights.awareness + candidate.weights.engagement + candidate.weights.sales;
  if (Math.round(rawTotal) !== 100) {
    errors.push(`Unified objective blend summed to ${Math.round(rawTotal)}% instead of 100; deterministic mix applied.`);
    return fallback;
  }
  const buckets = [
    candidate.weights.awareness,
    candidate.weights.engagement,
    candidate.weights.sales
  ] as const;
  if (buckets.some((weight) => weight < OBJECTIVE_BLEND_MIN || weight > OBJECTIVE_BLEND_MAX)) {
    errors.push(
      `Unified objective blend violated min ${OBJECTIVE_BLEND_MIN} / max ${OBJECTIVE_BLEND_MAX} funnel rule; deterministic mix applied.`
    );
    return fallback;
  }
  return candidate;
}

function finalizeKpiFrameworkCandidate(
  objective: ResolvedCampaignObjective,
  candidate: KpiFramework | undefined,
  normalizedBrief: NormalizedCampaignBrief,
  state: CampaignAgentState,
  errors: string[]
): KpiFramework {
  const fallback = defaultKpiFramework(objective, { ...normalizedBrief, objective }, Boolean(state.niaContext?.length));
  if (!candidate) {
    errors.push(`Unified scorer omitted the ${objective} framework; defaults used.`);
    return fallback;
  }
  const framework: KpiFramework = { ...candidate, objective };
  const totalWeight = framework.metrics.reduce((sum, metric) => sum + metric.weight, 0);
  if (Math.round(totalWeight) !== 100) {
    errors.push(`${objective} unified metrics summed to ${Math.round(totalWeight)}; defaults used.`);
    return fallback;
  }
  return framework;
}

async function runUnifiedFrameworkPack(
  state: CampaignAgentState
): Promise<{ frameworkEvaluations: FrameworkEvaluation[]; objectiveBlend: ObjectiveBlend; errors: string[] }> {
  const normalizedBrief = state.normalizedBrief ?? normalizeInput(state);
  const errors: string[] = [];
  const deterministicBlend = deterministicObjectiveBlend(state);

  const defaultPackBase = (): UnifiedScoringPack => ({
    objectiveBlend: deterministicBlend,
    frameworks: {
      awareness: defaultKpiFramework("awareness", { ...normalizedBrief, objective: "awareness" }, Boolean(state.niaContext?.length)),
      engagement: defaultKpiFramework(
        "engagement",
        { ...normalizedBrief, objective: "engagement" },
        Boolean(state.niaContext?.length)
      ),
      sales: defaultKpiFramework("sales", { ...normalizedBrief, objective: "sales" }, Boolean(state.niaContext?.length))
    }
  });

  let pack: UnifiedScoringPack | null = null;
  const model = createModel();
  if (model) {
    try {
      const structuredModel = model.withStructuredOutput(unifiedScoringPackSchema);
      pack = await structuredModel.invoke([
        {
          role: "system",
          content: `You are the CampaignOS campaign scorer. In ONE structured answer, output:
• objectiveBlend: funnel weights plus rationale/confidence referencing the Detection & Confidence rules.
• frameworks: KPI scorecards for awareness, engagement, and sales (each weighted metrics sum to 100; include KPI priorities inside summary + evaluationLogic).
${UNIFIED_OBJECTIVE_WEIGHT_BLUEPRINT}
Return ONLY JSON validated by schema. Use metrics that exist in normalizedBriefCompact and creatorMetricsPreview payloads when possible; otherwise choose from the KPI catalog in defaultFallbackPack.`
        },
        {
          role: "user",
          content: JSON.stringify({
            normalizedBriefCompact: compactNormalizedBriefForLlm({ ...normalizedBrief, objective: normalizedBrief.objective }),
            niaContext: compactNiaContextForLlm(state.niaContext ?? []),
            creatorMetricsPreview: compactCreatorMetricsForLlm(state.reacherMetrics ?? []),
            campaignSummary: compactCampaignSummaryForLlm(state.campaignSummary),
            defaultFallbackPack: defaultPackBase()
          })
        }
      ]);
    } catch (error) {
      errors.push(`Unified scoring agent failed, so deterministic packs were used: ${errorMessage(error)}`);
      pack = null;
    }
  }

  let resolvedPack = pack ?? defaultPackBase();
  resolvedPack = {
    objectiveBlend: finalizeObjectiveBlendCandidate(resolvedPack.objectiveBlend, deterministicBlend, errors),
    frameworks: {
      awareness: finalizeKpiFrameworkCandidate("awareness", resolvedPack.frameworks.awareness, normalizedBrief, state, errors),
      engagement: finalizeKpiFrameworkCandidate("engagement", resolvedPack.frameworks.engagement, normalizedBrief, state, errors),
      sales: finalizeKpiFrameworkCandidate("sales", resolvedPack.frameworks.sales, normalizedBrief, state, errors)
    }
  };

  const frameworkEvaluations: FrameworkEvaluation[] = OBJECTIVES.map((objective) =>
    buildFrameworkEvaluation(objective, resolvedPack.frameworks[objective], state)
  );

  return {
    frameworkEvaluations,
    objectiveBlend: resolvedPack.objectiveBlend,
    errors
  };
}

type Contribution = { name: string; score: number; weight: number };

function metricDefinitionFor(name: string): MetricDefinition {
  return (
    METRIC_DEFINITIONS[name] ?? {
      name,
      displayName: name.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      definition: "A campaign metric used by the selected scoring framework.",
      whyItMatters: "It contributes to the objective-specific performance grade.",
      sourceMetricKeys: [name]
    }
  );
}

function tierLabel(tier: "low" | "average" | "high"): string {
  if (tier === "high") return "High performer";
  if (tier === "average") return "Average performer";
  return "Low performer";
}

function evaluateCreatorForFramework(
  creator: CreatorMetricInputPayload,
  metrics: CreatorMetricInputPayload[],
  framework: KpiFramework
): Omit<FrameworkCreatorEvaluation, "performanceTier" | "tierRationale"> & { contributions: Contribution[] } {
  let weightedScore = 0;
  let appliedWeight = 0;
  const contributions: Contribution[] = [];
  const missingMetrics: string[] = [];

  for (const metric of framework.metrics) {
    const normalized = normalizeMetricValue(creator, metrics, metric.name);
    if (normalized === undefined) {
      missingMetrics.push(metric.name);
      continue;
    }

    weightedScore += normalized * metric.weight;
    appliedWeight += metric.weight;
    contributions.push({ name: metric.name, score: normalized, weight: metric.weight });
  }

  const score = appliedWeight > 0 ? Math.round(weightedScore / appliedWeight) : 0;
  const strongestMetrics = [...contributions]
    .filter((item) => item.score >= 65)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .map((item) => item.name);
  const weakestMetrics = [...contributions]
    .filter((item) => item.score < 45)
    .sort((a, b) => a.score * b.weight - b.score * b.weight)
    .slice(0, 3)
    .map((item) => item.name);

  return {
    creatorName: creator.name,
    score,
    strongestMetrics,
    weakestMetrics,
    missingMetrics,
    confidence: missingMetrics.length > 1 ? "medium" : "high",
    contributions
  };
}

function frameworkTakeaways(
  objective: ResolvedCampaignObjective,
  evaluations: FrameworkCreatorEvaluation[]
): string[] {
  const top = [...evaluations].sort((a, b) => b.score - a.score)[0];
  if (!top) {
    return [`The ${objective} framework needs creator metrics before it can grade performance.`];
  }

  return [
    `${top.creatorName} is the strongest ${objective} performer in the supplied creator set.`,
    `${tierLabel(top.performanceTier)} label is driven by ${top.strongestMetrics[0] ?? "the available weighted signals"}.`,
    top.missingMetrics.length
      ? `Confidence is limited by missing ${top.missingMetrics.slice(0, 2).join(" and ")} data.`
      : `The ${objective} framework has enough tracked metrics for a directional read.`
  ];
}

function buildFrameworkEvaluation(
  objective: ResolvedCampaignObjective,
  framework: KpiFramework,
  state: CampaignAgentState
): FrameworkEvaluation {
  const metrics = state.reacherMetrics ?? [];
  const draftedEvaluations = metrics.map((creator) => evaluateCreatorForFramework(creator, metrics, framework));
  const frameworkTiers = cohortPerformanceTiersForScores(draftedEvaluations.map((item) => item.score));
  const creatorEvaluations = draftedEvaluations.map(({ contributions: _contributions, ...evaluation }, idx) => {
    const tier = frameworkTiers[idx]!;
    return {
      ...evaluation,
      performanceTier: tier,
      tierRationale: `${tierLabel(tier)} for ${objective}: ${evaluation.score}/100 vs ${metrics.length} creators in this set (tier is cohort-relative within the weighted ${objective} scorecard).`
    };
  });
  const campaignScore = creatorEvaluations.length
    ? Math.round(creatorEvaluations.reduce((sum, item) => sum + item.score, 0) / creatorEvaluations.length)
    : 0;

  return {
    objective,
    framework,
    metricDefinitions: framework.metrics.map((metric) => metricDefinitionFor(metric.name)),
    campaignScore,
    creatorEvaluations,
    takeaways: frameworkTakeaways(objective, creatorEvaluations),
    confidence:
      creatorEvaluations.some((item) => item.confidence === "medium") ? "medium" : framework.confidence
  };
}

export async function runFrameworkAgents(state: CampaignAgentState): Promise<Partial<CampaignAgentState>> {
  const unified = await runUnifiedFrameworkPack(state);
  const primaryFramework =
    unified.frameworkEvaluations.find((item) => item.objective === state.normalizedBrief?.objective) ??
    unified.frameworkEvaluations[0];
  return {
    frameworkEvaluations: unified.frameworkEvaluations,
    kpiFramework: primaryFramework?.framework,
    objectiveBlend: unified.objectiveBlend,
    errors: [...unified.errors]
  };
}

function defaultObjectiveBlend(primary: ResolvedCampaignObjective): ObjectiveBlend {
  const weights: ObjectiveBlend["weights"] = { awareness: 20, engagement: 20, sales: 20 };
  weights[primary] = 60;
  return {
    weights,
    rationale: `The campaign goal is primarily ${primary}, so that framework carries 60% of the composite grade while the other funnel signals remain visible at 20% each.`,
    confidence: "medium"
  };
}

function escapeRegexChars(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Repeated-theme approximation: bounded word/phrase occurrences (aligned with blueprint — themes over lone keywords). */
function hitLower(haystackLower: string, needle: string): number {
  const n = needle.toLowerCase().trim();
  if (!n) return 0;
  if (/\s/.test(n)) {
    let c = 0;
    let from = 0;
    while (true) {
      const ix = haystackLower.indexOf(n, from);
      if (ix === -1) break;
      c++;
      from = ix + Math.max(1, n.length);
    }
    return c;
  }
  return [...haystackLower.matchAll(new RegExp(`\\b${escapeRegexChars(n)}\\b`, "g"))].length;
}

function objectiveKeywordStrength(fullTextLower: string, objective: ResolvedCampaignObjective): number {
  const awarenessNeedles = [
    "awareness",
    "visibility",
    "reach",
    "impressions",
    "viral",
    "virality",
    "amplify",
    "amplification",
    "trend",
    "mass awareness",
    "broad audience",
    "cultural",
    "exposure",
    "views",
    "momentum"
  ];
  const engagementNeedles = [
    "authentic",
    "authenticity",
    "trust",
    "honest",
    "conversation",
    "comments",
    "comment",
    "resonance",
    "community",
    "recommendation",
    "reviews",
    "believable",
    "participation",
    "discussion",
    "affinity",
    "connection",
    "engagement"
  ];
  const salesNeedles = [
    "sales",
    "gmv",
    "conversion",
    "roi",
    "roas",
    "cpa",
    "purchase",
    "revenue",
    "orders",
    "tiktok shop",
    "shop now",
    "purchase intent",
    "creator conversion",
    "cart",
    "gmv efficiency"
  ];
  const catalogs: Record<ResolvedCampaignObjective, readonly string[]> = {
    awareness: awarenessNeedles,
    engagement: engagementNeedles,
    sales: salesNeedles
  };
  return catalogs[objective].reduce((acc, needle) => acc + hitLower(fullTextLower, needle), 0);
}

function normalizeWeights(raw: Record<ResolvedCampaignObjective, number>): ObjectiveBlend["weights"] {
  const positive = OBJECTIVES.map((objective) => Math.max(0, raw[objective] || 0));
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { awareness: 34, engagement: 33, sales: 33 };

  const rounded = OBJECTIVES.map((objective, index) => ({
    objective,
    weight: Math.round((positive[index] / total) * 100)
  }));
  const delta = 100 - rounded.reduce((sum, item) => sum + item.weight, 0);
  rounded[0] = { ...rounded[0]!, weight: rounded[0]!.weight + delta };

  return {
    awareness: rounded.find((item) => item.objective === "awareness")?.weight ?? 0,
    engagement: rounded.find((item) => item.objective === "engagement")?.weight ?? 0,
    sales: rounded.find((item) => item.objective === "sales")?.weight ?? 0
  };
}

function deterministicObjectiveBlend(state: CampaignAgentState): ObjectiveBlend {
  const normalizedBrief = state.normalizedBrief ?? normalizeInput(state);
  const kpiCombined = [...normalizedBrief.kpiPriorities].join("\n").toLowerCase();

  const text = [
    normalizedBrief.objective,
    normalizedBrief.brief,
    normalizedBrief.product,
    normalizedBrief.audience,
    ...normalizedBrief.kpiPriorities,
    ...(state.niaContext ?? []).map((item) => item.excerpt)
  ]
    .join(" ")
    .toLowerCase();

  /** Explicit KPI cues (weighted higher than stray copy). */
  const commerceKpiHits = ["gmv", "orders", "order volume", "conversion", "revenue", "purchase", "tiktok shop", "creator conversion", "creator sales"].reduce(
    (n, w) => n + hitLower(`${kpiCombined} ${normalizedBrief.objective}`, w),
    0
  );

  const trustMechanismHits = ["authentic", "authenticity", "trust", "honest", "recommendation", "conversation", "comments", "believable", "reviews", "creator opinion"].reduce(
    (n, w) => n + hitLower(text, w),
    0
  );

  const kpisHeavyCommerce = /\b(primary|priorit|kpi|success|measurable\s+goal|north\s+star).{0,160}\b(gmv|orders?|conversion|revenue|\bpurchase|tiktok\s+shop|creator\s+conversion|\broas\b|\broi\b)/is.test(
    `${kpiCombined}\n${text}`
  );
  const kpisHeavyTrustMechanism = /\b(primary|priorit|kpi|success|measurable\s+goal|north\s+star).{0,160}\b(trust|authentic|comments|conversation|reviews|believable|opinion|\bcta\b\s+style)/is.test(
    `${kpiCombined}\n${text}`
  );

  let weights: ObjectiveBlend["weights"];

  /** Primary KPI OVERRIDE + trust-led fusion (AgentWeight blueprint). */
  const dualCommerceAndTrustMechanismPrimary = kpisHeavyCommerce && kpisHeavyTrustMechanism && commerceKpiHits >= 1 && trustMechanismHits >= 3;
  if (dualCommerceAndTrustMechanismPrimary) {
    weights = clampObjectiveBlendWeights({
      awareness: 15,
      engagement: 40,
      sales: 45
    });
  } else if (kpisHeavyCommerce && trustMechanismHits >= 4 && commerceKpiHits >= 2) {
    weights = clampObjectiveBlendWeights({
      awareness: commerceKpiHits >= 4 ? 15 : 20,
      engagement: commerceKpiHits >= 5 ? 35 : 40,
      sales: commerceKpiHits >= 5 ? 50 : commerceKpiHits >= 4 ? 45 : 40
    });
  } else {
    /** Signal hierarchy approximation: KPIs > repeated thematic copy > observed metrics > summary stats. */
    const raw: Record<ResolvedCampaignObjective, number> = { awareness: 18, engagement: 22, sales: 18 };
    raw[normalizedBrief.objective] += 40;

    const kpiMirror = `${kpiCombined}\n${kpiCombined}`;
    for (const objective of OBJECTIVES) {
      raw[objective] += objectiveKeywordStrength(text, objective) * 6;
      raw[objective] += objectiveKeywordStrength(kpiMirror, objective) * 5;
    }

    raw.engagement += 4; /** Engagement rarely 0 — creator-led default lift (blueprint guidance). */

    const metrics = state.reacherMetrics ?? [];
    if (metrics.some((item) => item.gmv !== undefined || item.conversionRate !== undefined || item.roas !== undefined)) {
      raw.sales += 12;
    }
    if (metrics.some((item) => item.comments !== undefined || item.saves !== undefined || item.shares !== undefined)) {
      raw.engagement += 10;
    }
    if (metrics.some((item) => item.reach !== undefined || item.impressions !== undefined)) {
      raw.awareness += 10;
    }
    if (state.campaignSummary?.totalOrders !== undefined) raw.sales += 8;
    if (
      state.campaignSummary?.totalLikes !== undefined ||
      state.campaignSummary?.totalComments !== undefined ||
      state.campaignSummary?.avgEngagementRate !== undefined
    ) {
      raw.engagement += 8;
    }
    if (state.campaignSummary?.totalViews !== undefined || state.campaignSummary?.avgDailyViews !== undefined) {
      raw.awareness += 8;
    }

    weights = clampObjectiveBlendWeights(normalizeWeights(raw));
  }

  let rationalePieces: string[];

  if (dualCommerceAndTrustMechanismPrimary) {
    rationalePieces = [
      `Trust-led commerce: KPI priorities stress revenue outcomes while thematic copy repeats authenticity/trust — parity-style blend with Sales at ${weights.sales}%.`
    ];
  } else if (kpisHeavyCommerce && trustMechanismHits >= 4 && commerceKpiHits >= 2) {
    rationalePieces = [
      "Strong commerce KPIs paired with recurring trust cues: Sales leads while Engagement stays co-primary (trust-led conversion pattern)."
    ];
  } else {
    rationalePieces = [
      `Weights follow the blueprint hierarchy (explicit KPIs > recurring goals/themes > telemetry). Primary resolved objective is "${normalizedBrief.objective}".`,
      kpisHeavyCommerce ? "Commerce KPI text triggered stronger Sales influence." : "",
      trustMechanismHits >= 5 ? "High trust-building language increased Engagement materially." : ""
    ].filter(Boolean);
  }

  return {
    weights,
    rationale:
      rationalePieces.join(" ") +
      " Metric availability nudges weights when KPI text is ambiguous; the scorer may refine this when the LLM is available.",
    confidence: state.niaContext?.length ? "high" : kpiCombined.length ? "medium" : "medium"
  };
}

function recommendedCreatorAction(objective: ResolvedCampaignObjective, creatorName: string, tier: PerformanceTier): string {
  if (tier === "high") return `Scale ${creatorName} with more budget or additional content variations.`;
  if (objective === "sales") return `Tighten CTA and product proof points before scaling ${creatorName}.`;
  if (objective === "engagement") return `Give ${creatorName} prompts that invite comments, saves, and shares.`;
  return `Improve the first three seconds and brand cue clarity for ${creatorName}.`;
}

export function blendFrameworkScores(state: CampaignAgentState): Partial<CampaignAgentState> {
  const objectiveBlend = state.objectiveBlend ?? defaultObjectiveBlend(state.normalizedBrief?.objective ?? "awareness");
  const frameworkEvaluations = state.frameworkEvaluations ?? [];
  const creatorNames = new Set<string>();

  for (const framework of frameworkEvaluations) {
    for (const creator of framework.creatorEvaluations) creatorNames.add(creator.creatorName);
  }

  const draftedComposite = [...creatorNames].map((creatorName) => {
    let weightedScore = 0;
    let appliedWeight = 0;
    const strongest: Array<{ objective: ResolvedCampaignObjective; metric: string; weight: number }> = [];
    const weakest: Array<{ objective: ResolvedCampaignObjective; metric: string; weight: number }> = [];
    const missing = new Set<string>();

    for (const framework of frameworkEvaluations) {
      const weight = objectiveBlend.weights[framework.objective];
      const creator = framework.creatorEvaluations.find((item) => item.creatorName === creatorName);
      if (!creator || weight <= 0) continue;

      weightedScore += creator.score * weight;
      appliedWeight += weight;
      for (const metric of creator.strongestMetrics) strongest.push({ objective: framework.objective, metric, weight });
      for (const metric of creator.weakestMetrics) weakest.push({ objective: framework.objective, metric, weight });
      for (const metric of creator.missingMetrics) missing.add(metric);
    }

    const score = appliedWeight > 0 ? Math.round(weightedScore / appliedWeight) : 0;
    const primaryDriver =
      strongest.sort((a, b) => objectiveBlend.weights[b.objective] - objectiveBlend.weights[a.objective])[0];
    const primaryDrag = weakest.sort((a, b) => objectiveBlend.weights[b.objective] - objectiveBlend.weights[a.objective])[0];
    const confidence: FrameworkCreatorEvaluation["confidence"] = missing.size > 2 ? "medium" : "high";

    return {
      creatorName,
      score,
      strongest,
      weakest,
      missing,
      primaryDriver,
      primaryDrag,
      confidence
    };
  });

  const compositeTiers = cohortPerformanceTiersForScores(draftedComposite.map((row) => row.score));

  const creatorEvaluations: CreatorEvaluation[] = draftedComposite
    .map((row, index) => {
      const performanceTier = compositeTiers[index]!;
      return {
        creatorName: row.creatorName,
        score: row.score,
        rank: 1,
        performanceTier,
        tierRationale: `${tierLabel(performanceTier)} on the blended goal mix (awareness ${objectiveBlend.weights.awareness}%, engagement ${objectiveBlend.weights.engagement}%, sales ${objectiveBlend.weights.sales}%) — tiers are cohort-relative among ${creatorNames.size} creators.`,
        strengths: row.strongest.length
          ? row.strongest.slice(0, 3).map((item) => `${item.metric} supported the ${item.objective} framework`)
          : ["Performance was directionally balanced across available frameworks."],
        weaknesses: [
          ...row.weakest.slice(0, 2).map((item) => `${item.metric} limited the ${item.objective} framework`),
          ...[...row.missing].slice(0, 2).map((metric) => `${metric} was missing`)
        ],
        primaryDriver: row.primaryDriver ? `${row.primaryDriver.objective}:${row.primaryDriver.metric}` : "insufficient data",
        primaryDrag: row.primaryDrag ? `${row.primaryDrag.objective}:${row.primaryDrag.metric}` : "insufficient data",
        recommendedAction: recommendedCreatorAction(state.normalizedBrief?.objective ?? "awareness", row.creatorName, performanceTier),
        confidence: row.confidence
      } satisfies CreatorEvaluation;
    })
    .sort((a, b) => b.score - a.score)
    .map((evaluation, index) => ({ ...evaluation, rank: index + 1 }));

  return { creatorEvaluations, objectiveBlend };
}

export function metricDefinitionsFor(metrics: WeightedMetric[]): MetricDefinition[] {
  return metrics.map((metric) => metricDefinitionFor(metric.name));
}
