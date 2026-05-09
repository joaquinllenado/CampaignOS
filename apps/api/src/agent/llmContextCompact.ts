import type {
  CampaignMetricSummary,
  CreatorEvaluation,
  CreatorMetricInputPayload,
  FrameworkEvaluation,
  NiaContextResult,
  NormalizedCampaignBrief
} from "./schema";

const MAX_NORMALIZED_BRIEF_CHARS = 8_000;
const MAX_REPRESENTATIVE_COMMENTS = 3;
const MAX_SINGLE_COMMENT_CHARS = 280;
const MAX_ARRAY_ITEMS = 6;
const MAX_GRAPH_ERRORS_SHOWN = 12;
const MAX_SINGLE_ERROR_CHARS = 400;

/** Framework evaluations include large duplicated metricDefinitions; downstream LLM calls only need scores and framing. */
export type SlimFrameworkEvaluation = Pick<
  FrameworkEvaluation,
  "objective" | "campaignScore" | "confidence" | "takeaways"
> & {
  framework: Pick<FrameworkEvaluation["framework"], "objective" | "summary" | "confidence"> & {
    metrics: Array<{ name: string; weight: number; reason?: string }>;
    evaluationLogic: string[];
  };
  creatorEvaluations: Array<
    Pick<
      FrameworkEvaluation["creatorEvaluations"][number],
      | "creatorName"
      | "score"
      | "performanceTier"
      | "strongestMetrics"
      | "weakestMetrics"
      | "missingMetrics"
      | "confidence"
    >
  >;
};

function truncateText(value: string, maxChars: number): string {
  const t = value.trim();
  return t.length <= maxChars ? t : `${t.slice(0, maxChars - 3)}...`;
}

export function compactNormalizedBriefForLlm(brief: NormalizedCampaignBrief): NormalizedCampaignBrief {
  return {
    ...brief,
    brief: truncateText(brief.brief, MAX_NORMALIZED_BRIEF_CHARS),
    brandVoice: brief.brandVoice ? truncateText(brief.brandVoice, 600) : undefined,
    existingCreativeDirection: brief.existingCreativeDirection
      ? truncateText(brief.existingCreativeDirection, 600)
      : undefined,
    knownCreatorPreferences: brief.knownCreatorPreferences
      ? truncateText(brief.knownCreatorPreferences, 600)
      : undefined,
    complianceNotes: brief.complianceNotes ? truncateText(brief.complianceNotes, 600) : undefined
  };
}

export function slimFrameworkEvaluationsForLlm(evaluations: FrameworkEvaluation[]): SlimFrameworkEvaluation[] {
  return evaluations.map((evaluation) => ({
    objective: evaluation.objective,
    framework: {
      objective: evaluation.framework.objective,
      summary: evaluation.framework.summary,
      metrics: evaluation.framework.metrics.map((m) => ({
        name: m.name,
        weight: m.weight,
        reason: truncateText(m.reason, 240)
      })),
      evaluationLogic: evaluation.framework.evaluationLogic.map((line) => truncateText(line, 320)),
      confidence: evaluation.framework.confidence
    },
    campaignScore: evaluation.campaignScore,
    creatorEvaluations: evaluation.creatorEvaluations.map((row) => ({
      creatorName: row.creatorName,
      score: row.score,
      performanceTier: row.performanceTier,
      strongestMetrics: row.strongestMetrics.slice(0, 4),
      weakestMetrics: row.weakestMetrics.slice(0, 4),
      missingMetrics: row.missingMetrics.slice(0, 6),
      confidence: row.confidence
    })),
    takeaways: evaluation.takeaways.map((line) => truncateText(line, 360)),
    confidence: evaluation.confidence
  }));
}

export function compactCreatorMetricsForLlm(metrics: CreatorMetricInputPayload[]): CreatorMetricInputPayload[] {
  return metrics.map((metric) => ({
    ...metric,
    archetype: metric.archetype ? truncateText(metric.archetype, 120) : undefined,
    contentFormat: metric.contentFormat ? truncateText(metric.contentFormat, 120) : undefined,
    audienceSegment: metric.audienceSegment ? truncateText(metric.audienceSegment, 120) : undefined,
    representativeComments: metric.representativeComments?.length
      ? metric.representativeComments
          .slice(0, MAX_REPRESENTATIVE_COMMENTS)
          .map((comment) => truncateText(comment, MAX_SINGLE_COMMENT_CHARS))
      : undefined
  }));
}

export function compactCampaignSummaryForLlm(summary: CampaignMetricSummary | undefined): CampaignMetricSummary | undefined {
  if (!summary) return undefined;

  const sliceArr = (items: string[] | undefined, max = MAX_ARRAY_ITEMS) =>
    items?.slice(0, max).map((item) => truncateText(item, 280));

  return {
    campaignType: summary.campaignType,
    campaignWindow: summary.campaignWindow,
    status: summary.status,
    postingCreators: summary.postingCreators,
    videosPosted: summary.videosPosted,
    totalViews: summary.totalViews,
    avgDailyViews: summary.avgDailyViews,
    peakVisibilityViews: summary.peakVisibilityViews,
    totalLikes: summary.totalLikes,
    totalComments: summary.totalComments,
    avgEngagementRate: summary.avgEngagementRate,
    totalOrders: summary.totalOrders,
    newCreatorsPosting: summary.newCreatorsPosting,
    creatorsReached: summary.creatorsReached,
    creatorsMessaged: summary.creatorsMessaged,
    tcInvitesSent: summary.tcInvitesSent,
    keyTakeaways: sliceArr(summary.keyTakeaways),
    strongestFormats: sliceArr(summary.strongestFormats),
    strongestCreatorTraits: sliceArr(summary.strongestCreatorTraits),
    strengths: sliceArr(summary.strengths),
    weaknesses: sliceArr(summary.weaknesses),
    strategicRecommendations: sliceArr(summary.strategicRecommendations),
    highestLeverageOpportunity: summary.highestLeverageOpportunity
      ? truncateText(summary.highestLeverageOpportunity, 480)
      : undefined,
    fetchedAt: summary.fetchedAt
  };
}

/** Nia excerpts are capped during retrieval; this trims metadata noise for prompts. */
export function compactNiaContextForLlm(entries: NiaContextResult[]): NiaContextResult[] {
  return entries.map((entry) => ({
    sourceId: entry.sourceId,
    sourceName: entry.sourceName,
    title: entry.title ? truncateText(entry.title, 200) : undefined,
    excerpt: entry.excerpt,
    url: entry.url,
    relevanceScore: entry.relevanceScore
  }));
}

export function compactGraphErrorsForLlm(errors: string[]): string[] {
  return errors.slice(-MAX_GRAPH_ERRORS_SHOWN).map((e) => truncateText(e, MAX_SINGLE_ERROR_CHARS));
}

export function compactCompositeCreatorEvaluationsForLlm(rows: CreatorEvaluation[]): CreatorEvaluation[] {
  return rows.map((row) => ({
    ...row,
    tierRationale: truncateText(row.tierRationale, 420),
    strengths: row.strengths.slice(0, 4).map((s) => truncateText(s, 220)),
    weaknesses: row.weaknesses.slice(0, 4).map((s) => truncateText(s, 220)),
    primaryDriver: truncateText(row.primaryDriver, 140),
    primaryDrag: truncateText(row.primaryDrag, 140),
    recommendedAction: truncateText(row.recommendedAction, 260)
  }));
}
