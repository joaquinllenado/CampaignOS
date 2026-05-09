import {
  attributionInsightSchema,
  campaignIntelligenceReportSchema,
  kpiFrameworkSchema,
  recommendationSchema,
  type ActionHealth,
  type AgentActivityItem,
  type AttributionInsight,
  type CampaignAgentState,
  type CreatorEvaluation,
  type CreatorMessageDraft,
  type CreatorMetricInputPayload,
  type KpiFramework,
  type NormalizedCampaignBrief,
  type Recommendation,
  type ResolvedCampaignObjective
} from "./schema";
import { createModel, getModelName } from "./model";
import { normalizeInput } from "./objective";
import {
  compactCampaignSummaryForLlm,
  compactCompositeCreatorEvaluationsForLlm,
  compactCreatorMetricsForLlm,
  compactNormalizedBriefForLlm,
  compactNiaContextForLlm
} from "./llmContextCompact";
import { cohortPerformanceTiersForScores, type PerformanceTier } from "./performanceTiering";
import { normalizeMetricValue } from "./scoringNormalization";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function performanceTierLabel(tier: PerformanceTier): string {
  if (tier === "high") return "High performer";
  if (tier === "average") return "Average performer";
  return "Low performer";
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
          normalizedBrief: compactNormalizedBriefForLlm(normalizedBrief),
          niaContext: compactNiaContextForLlm(state.niaContext ?? []),
          availableMetrics: compactCreatorMetricsForLlm(state.reacherMetrics ?? []),
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

  const draftRows = metrics.map((creator) => {
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
      .sort((a, b) => b.score * b.weight - a.score * b.weight)
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

    const confidence: CreatorEvaluation["confidence"] =
      availableMetricNames(creator, metrics, framework).length >= framework.metrics.length - 1
        ? "high"
        : "medium";

    return {
      creatorName: creator.name,
      creator,
      score,
      strengths: strengths.length ? strengths : ["Performance was directionally balanced."],
      weaknesses: weaknesses.length ? weaknesses : ["No major weakness in supplied metrics."],
      primaryDriver: sortedContributions[0]?.name ?? "insufficient data",
      primaryDrag: sortedContributions.at(-1)?.name ?? "insufficient data",
      confidence
    };
  });
  const draftTiers = cohortPerformanceTiersForScores(draftRows.map((row) => row.score));

  const evaluations = draftRows
    .map((row, index) => {
      const performanceTier = draftTiers[index]!;
      return {
        creatorName: row.creatorName,
        score: row.score,
        rank: 1,
        performanceTier,
        tierRationale: `${performanceTierLabel(performanceTier)} based on cohort-relative ranking (${row.score}/100 on the weighted ${framework.objective} scorecard vs ${metrics.length} creators).`,
        strengths: row.strengths,
        weaknesses: row.weaknesses,
        primaryDriver: row.primaryDriver,
        primaryDrag: row.primaryDrag,
        recommendedAction: recommendedCreatorAction(framework.objective, row.creator, performanceTier),
        confidence: row.confidence
      } satisfies CreatorEvaluation;
    })
    .sort((a, b) => b.score - a.score)
    .map((evaluation, index) => ({ ...evaluation, rank: index + 1 }));

  return { creatorEvaluations: evaluations };
}

function recommendedCreatorAction(
  objective: ResolvedCampaignObjective,
  creator: CreatorMetricInputPayload,
  tier: PerformanceTier
): string {
  if (tier === "high") return `Scale ${creator.name} with more budget or additional content variations.`;
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
        `${topCreator.creatorName} ranked #${topCreator.rank} as a ${topCreator.performanceTier} performer.`,
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
          normalizedBrief: state.normalizedBrief ? compactNormalizedBriefForLlm(state.normalizedBrief) : undefined,
          niaContext: compactNiaContextForLlm(state.niaContext ?? []),
          metrics: compactCreatorMetricsForLlm(state.reacherMetrics ?? []),
          campaignSummary: compactCampaignSummaryForLlm(state.campaignSummary),
          kpiFramework: state.kpiFramework,
          creatorEvaluations: compactCompositeCreatorEvaluationsForLlm(state.creatorEvaluations ?? [])
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
          normalizedBrief: state.normalizedBrief ? compactNormalizedBriefForLlm(state.normalizedBrief) : undefined,
          niaContext: compactNiaContextForLlm(state.niaContext ?? []),
          campaignSummary: compactCampaignSummaryForLlm(state.campaignSummary),
          kpiFramework: state.kpiFramework,
          creatorEvaluations: compactCompositeCreatorEvaluationsForLlm(state.creatorEvaluations ?? []),
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

function recommendationId(index: number): string {
  return `rec-${index + 1}`;
}

function recommendationWithIds(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.map((recommendation, index) => ({
    ...recommendation,
    id: recommendation.id ?? recommendationId(index)
  }));
}

function actionHealth(recommendations: Recommendation[], missingInputs: string[]): ActionHealth {
  const highPriority = recommendations.filter((recommendation) => recommendation.priority === "high");
  const mediumPriority = recommendations.filter((recommendation) => recommendation.priority === "medium");

  if (highPriority.length) {
    return {
      status: "red",
      message: `${highPriority.length} high-priority follow-up${highPriority.length === 1 ? "" : "s"} need review before scaling this campaign.`,
      reasons: highPriority.map((recommendation) => recommendation.action)
    };
  }

  if (mediumPriority.length || missingInputs.length) {
    return {
      status: "yellow",
      message: "Medium-priority optimizations or missing inputs should be reviewed, but no critical blocker is currently flagged.",
      reasons: [...mediumPriority.map((recommendation) => recommendation.action), ...missingInputs]
    };
  }

  return {
    status: "green",
    message: "No high-priority open actions are flagged right now.",
    reasons: ["critical_items_cleared"]
  };
}

function performanceSnapshot(state: CampaignAgentState, executiveSummary: string): string {
  const topCreator = state.creatorEvaluations?.[0];
  const framework = state.kpiFramework;
  const summary = state.campaignSummary;

  if (!topCreator || !framework) {
    if (!summary) return executiveSummary;
    const views = summary.totalViews ? `${Math.round(summary.totalViews).toLocaleString()} views` : "campaign-level Reacher metrics";
    const orders = summary.totalOrders !== undefined ? ` and ${Math.round(summary.totalOrders).toLocaleString()} orders` : "";
    return `${executiveSummary} Reacher summary shows ${views}${orders}.`;
  }

  const goalMix = state.objectiveBlend
    ? ` Goal mix: awareness ${state.objectiveBlend.weights.awareness}%, engagement ${state.objectiveBlend.weights.engagement}%, sales ${state.objectiveBlend.weights.sales}%.`
    : "";
  const summaryCopy = summary
    ? ` Reacher summary captured ${summary.totalViews !== undefined ? `${Math.round(summary.totalViews).toLocaleString()} views` : "campaign visibility"}${summary.totalLikes !== undefined ? `, ${Math.round(summary.totalLikes).toLocaleString()} likes` : ""}${summary.totalComments !== undefined ? `, ${Math.round(summary.totalComments).toLocaleString()} comments` : ""}${summary.totalOrders !== undefined ? `, and ${Math.round(summary.totalOrders).toLocaleString()} orders` : ""}.`
    : "";
  return `${topCreator.creatorName} is currently a ${topCreator.performanceTier} performer for the composite campaign grade, with ${topCreator.primaryDriver} as the strongest signal.${summaryCopy}${goalMix} Next actions focus on closing ${topCreator.primaryDrag} gaps while preserving the weighted KPI mix.`.trim();
}

function activityItems(state: CampaignAgentState, generatedAt: string, draftCount: number): AgentActivityItem[] {
  const objective = state.kpiFramework?.objective ?? state.normalizedBrief?.objective ?? "awareness";
  const recommendationCount = state.recommendations?.length ?? 0;
  const at = (secondsAgo: number) => new Date(Date.parse(generatedAt) - secondsAgo * 1000).toISOString();

  return [
    {
      id: "activity-analysis-completed",
      kind: "analysis_completed",
      title: "Campaign analysis completed",
      description: `Evaluated the campaign against the ${objective} objective and assembled the dashboard snapshot.`,
      occurredAt: at(0)
    },
    {
      id: "activity-drafts-generated",
      kind: "drafts_generated",
      title: "Creator drafts prepared",
      description: `${draftCount} reviewable outreach draft${draftCount === 1 ? "" : "s"} created for human copy/edit.`,
      occurredAt: at(20)
    },
    {
      id: "activity-recommendations-ready",
      kind: "recommendations_ready",
      title: "Recommended actions prioritized",
      description: `${recommendationCount} campaign optimization action${recommendationCount === 1 ? "" : "s"} ranked by priority.`,
      occurredAt: at(40)
    },
    {
      id: "activity-kpi-framework-generated",
      kind: "kpi_framework_generated",
      title: "Specialized frameworks regenerated",
      description: "Awareness, engagement, and sales frameworks were weighted into a composite goal mix.",
      occurredAt: at(60)
    }
  ];
}

function suggestionTypeForRecommendation(recommendation: Recommendation): CreatorMessageDraft["suggestionType"] {
  if (recommendation.category === "cta") return "cta";
  if (recommendation.category === "creative_direction") return "creative_tweak";
  if (recommendation.category === "measurement") return "measurement_ask";
  if (recommendation.category === "creator_mix") return "messaging_alignment";
  return "other";
}

const RECOMMENDATION_PRIORITY_ORDER: Record<Recommendation["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2
};

function sortedRecommendationsForDraftLink(recommendations: Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => RECOMMENDATION_PRIORITY_ORDER[a.priority] - RECOMMENDATION_PRIORITY_ORDER[b.priority]);
}

function pickRecommendationForDraft(recommendations: Recommendation[], draftIndex: number): Recommendation | undefined {
  if (!recommendations.length) return undefined;
  const sorted = sortedRecommendationsForDraftLink(recommendations);
  return sorted[draftIndex % sorted.length];
}

function performanceSnapshotForDraft(evaluation: CreatorEvaluation): string {
  const tierLabel =
    evaluation.performanceTier === "high"
      ? "You're one of our standouts"
      : evaluation.performanceTier === "average"
        ? "You're in range with room to tighten"
        : "We see clear upside with a focused pass";
  return `${tierLabel} on our composite grade (#${evaluation.rank}, ${evaluation.score}/100 · ${evaluation.performanceTier} tier).`;
}

function evidenceLinesForDraft(evaluation: CreatorEvaluation): string {
  const strengths = evaluation.strengths.slice(0, 2).join("; ");
  const weaknesses = evaluation.weaknesses.slice(0, 2).join("; ");
  if (strengths && weaknesses) return `Signals working well include ${strengths}. Biggest deltas vs the set: ${weaknesses}.`;
  if (strengths) return `Signals working well include ${strengths}.`;
  if (weaknesses) return `Biggest deltas vs the set: ${weaknesses}.`;
  return `Composite read: strongest lever is ${evaluation.primaryDriver}; watch ${evaluation.primaryDrag} on the next posts.`;
}

function subjectForDraft(normalizedBrief: NormalizedCampaignBrief, evaluation?: CreatorEvaluation): string {
  if (evaluation?.performanceTier === "high") return `${normalizedBrief.brand}: thanks + next beat for "${normalizedBrief.name}"`;
  if (evaluation?.performanceTier === "low") return `${normalizedBrief.brand}: quick optimization pass for "${normalizedBrief.name}"`;
  return `${normalizedBrief.brand}: tweaks for "${normalizedBrief.name}"`;
}

/** One outreach draft per evaluated creator so the dashboard batches stay complete. */
function creatorDrafts(state: CampaignAgentState, recommendations: Recommendation[]): CreatorMessageDraft[] {
  const normalizedBrief = state.normalizedBrief;
  if (!normalizedBrief || !recommendations.length) return [];

  const metricsByName = new Map((state.reacherMetrics ?? []).map((metric) => [metric.name, metric]));
  const evaluations = state.creatorEvaluations ?? [];

  if (evaluations.length) {
    return evaluations.map((evaluation, index) => {
      const sourceMetric = metricsByName.get(evaluation.creatorName);
      const linked = pickRecommendationForDraft(recommendations, index)!;
      const greeting = sourceMetric?.handle
        ? `Hi ${evaluation.creatorName} (${sourceMetric.handle})`
        : `Hi ${evaluation.creatorName}`;
      const rationaleRaw = evaluation.tierRationale.trim();
      const tierSentence = rationaleRaw ? truncateText(rationaleRaw, 220).replace(/\.*$/, "").trimEnd() + "." : "";
      const brandVoiceCue = normalizedBrief.brandVoice?.trim()
        ? ` If it helps: ${truncateText(normalizedBrief.brandVoice.trim(), 180)}`
        : "";
      const objective = normalizedBrief.objective;
      const body = `${greeting} — appreciate you on ${normalizedBrief.name} with ${normalizedBrief.brand}.

${performanceSnapshotForDraft(evaluation)}
${tierSentence ? `${tierSentence}\n\n` : ""}
${evidenceLinesForDraft(evaluation)}
Your bespoke next beat: ${evaluation.recommendedAction}

Campaign-level note (ties to planner priority ${linked.priority}/${linked.category.replace("_", " ")}): ${linked.action}

Objective is ${objective}: keep hooks and CTAs honest to that while leaning into ${evaluation.primaryDriver} where it fits.${brandVoiceCue}

If anything feels off live, reply with what you're hearing from viewers.`;

      return {
        id: `draft-${index + 1}`,
        creatorName: evaluation.creatorName,
        creatorHandle: sourceMetric?.handle,
        subject: subjectForDraft(normalizedBrief, evaluation),
        body,
        rationale: `Uses ${evaluation.creatorName}'s ${evaluation.performanceTier}-tier composite score (${evaluation.score}), drivers/drags, and evaluation-derived action — linked to planner recommendation ${linked.id} for alignment with the broader ${normalizedBrief.objective} plan.`,
        suggestionType: suggestionTypeForRecommendation(linked),
        linkedRecommendationId: linked.id
      } satisfies CreatorMessageDraft;
    });
  }

  const metrics = state.reacherMetrics ?? [];
  if (!metrics.length) {
    const linked = pickRecommendationForDraft(recommendations, 0)!;
    const body = `Hi team — looping everyone on ${normalizedBrief.name} for ${normalizedBrief.brand}.

Top planner steer: ${linked.action}

Objective is ${normalizedBrief.objective}: keep it legible in hooks and CTAs, and ping us with what you're seeing.${normalizedBrief.brandVoice?.trim() ? ` Voice cue: ${truncateText(normalizedBrief.brandVoice.trim(), 220)}.` : ""}`;

    return [
      {
        id: "draft-1",
        creatorName: undefined,
        subject: `${normalizedBrief.brand}: squad note for "${normalizedBrief.name}"`,
        body,
        rationale: `No per-creator rows yet on this run — broadcast aligns with recommendation ${linked.id}.`,
        suggestionType: suggestionTypeForRecommendation(linked),
        linkedRecommendationId: linked.id
      }
    ];
  }

  return metrics.map((metric, index) => {
    const linked = pickRecommendationForDraft(recommendations, index)!;
    const greeting = metric.handle ? `Hi ${metric.name} (${metric.handle})` : `Hi ${metric.name}`;
    const body = `${greeting} — thanks for the work on ${normalizedBrief.name} with ${normalizedBrief.brand}.

We do not yet have composite grades attached to outreach, so here's the shared steer: ${linked.action.toLowerCase()}

Please keep ${normalizedBrief.objective} obvious in hooks and CTAs. Send performance cues you're seeing back to us.${normalizedBrief.brandVoice?.trim() ? ` Voice cue: ${truncateText(normalizedBrief.brandVoice.trim(), 140)}.` : ""}`;

    return {
      id: `draft-${index + 1}`,
      creatorName: metric.name,
      creatorHandle: metric.handle,
      subject: `${normalizedBrief.brand}: outreach for "${normalizedBrief.name}"`,
      body,
      rationale: `Shared guidance keyed to recommendation ${linked.id} until composites land.`,
      suggestionType: suggestionTypeForRecommendation(linked),
      linkedRecommendationId: linked.id
    } satisfies CreatorMessageDraft;
  });
}

function truncateText(value: string, maxChars: number): string {
  const t = value.trim();
  return t.length <= maxChars ? t : `${t.slice(0, maxChars - 1)}…`;
}

function reportConfidence(state: CampaignAgentState): "low" | "medium" | "high" {
  if (state.errors.length > 2 || state.dataProvenance?.contextSource === "brief_only") return "medium";
  if (state.creatorEvaluations?.some((evaluation) => evaluation.confidence === "low")) return "medium";
  return "high";
}

export function composeReport(state: CampaignAgentState): Partial<CampaignAgentState> {
  const normalizedBrief = state.normalizedBrief;
  const kpiFramework = state.kpiFramework;
  const dataProvenance = state.dataProvenance;

  if (!normalizedBrief || !kpiFramework || !dataProvenance) {
    return { errors: ["Report composition failed because graph state was incomplete."] };
  }

  const recommendationsSource =
    state.recommendations?.length ? state.recommendations : state.report?.recommendations ?? [];
  const recommendations = recommendationWithIds(recommendationsSource);
  const missingInputs = [...new Set([...dataProvenance.missingInputs, ...state.errors])];
  const creatorMessageDrafts = creatorDrafts(state, recommendations);

  if (state.report) {
    const generatedAt = state.report.generatedAt;
    const merged = campaignIntelligenceReportSchema.parse({
      ...state.report,
      recommendations,
      actionHealth: actionHealth(recommendations, missingInputs),
      creatorMessageDrafts,
      agentActivity: activityItems({ ...state, recommendations }, generatedAt, creatorMessageDrafts.length),
      dataProvenance: {
        ...state.report.dataProvenance,
        missingInputs
      }
    });
    return { report: merged, creatorMessageDrafts };
  }

  const topCreator = state.creatorEvaluations?.[0];
  const executiveSummary = topCreator
    ? `${normalizedBrief.brand}'s ${normalizedBrief.name} should be evaluated as a ${normalizedBrief.objective} campaign. ${topCreator.creatorName} currently leads the creator set as a ${topCreator.performanceTier} performer, driven by ${topCreator.primaryDriver}.`
    : `${normalizedBrief.brand}'s ${normalizedBrief.name} should be evaluated as a ${normalizedBrief.objective} campaign, but creator-level metrics are needed for performance ranking.`;
  const generatedAt = new Date().toISOString();

  const report = campaignIntelligenceReportSchema.parse({
    executiveSummary,
    performanceSnapshot: performanceSnapshot(state, executiveSummary),
    objective: normalizedBrief.objective,
    dataProvenance: {
      ...dataProvenance,
      missingInputs
    },
    campaignSummary: state.campaignSummary,
    kpiFramework,
    objectiveBlend: state.objectiveBlend ?? {
      weights: {
        awareness: normalizedBrief.objective === "awareness" ? 60 : 20,
        engagement: normalizedBrief.objective === "engagement" ? 60 : 20,
        sales: normalizedBrief.objective === "sales" ? 60 : 20
      },
      rationale: `The fallback goal mix prioritizes the ${normalizedBrief.objective} objective while keeping the rest of the funnel visible.`,
      confidence: "medium"
    },
    frameworkEvaluations: state.frameworkEvaluations ?? [],
    creatorEvaluations: state.creatorEvaluations ?? [],
    attributionInsights: state.attributionInsights ?? [],
    recommendations,
    actionHealth: actionHealth(recommendations, missingInputs),
    agentActivity: activityItems({ ...state, recommendations }, generatedAt, creatorMessageDrafts.length),
    creatorMessageDrafts,
    confidence: reportConfidence(state),
    generatedAt,
    model: createModel() ? getModelName() : "deterministic-fallback"
  });

  return { report, creatorMessageDrafts };
}
