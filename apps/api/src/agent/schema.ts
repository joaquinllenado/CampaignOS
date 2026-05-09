import { z } from "zod";

/** Metric names the KPI framework may weight; intake accepts free-text too. */
export const SUPPORTED_KPI_METRIC_NAMES = [
  "reach",
  "impressions",
  "completion_rate",
  "share_velocity",
  "audience_penetration",
  "brand_sentiment",
  "comment_depth",
  "saves",
  "shares",
  "engagement_quality",
  "sentiment",
  "conversation_themes",
  "cta_intent",
  "gmv",
  "conversion_rate",
  "ctr",
  "add_to_cart",
  "cpa",
  "roas",
  "funnel_drop_off"
] as const;

const trimmedNonEmpty = z.string().trim().min(1);
const confidenceSchema = z.enum(["low", "medium", "high"]);
const resolvedObjectiveSchema = z.enum(["awareness", "engagement", "sales"]);
export const campaignObjectiveSchema = z.enum(["awareness", "engagement", "sales", "auto"]);

const reacherMetricSourceSchema = z
  .object({
    shopId: z.string().optional(),
    productId: z.string().optional(),
    sellerId: z.string().optional(),
    campaignId: z.string().optional(),
    creatorId: z.string().optional(),
    contentId: z.string().optional(),
    fetchedAt: z.string().optional(),
    rawMetricKeys: z.array(z.string()).optional()
  })
  .strict();

const creatorMetricSourceSchema = z.union([
  z.literal("manual"),
  z.literal("demo"),
  reacherMetricSourceSchema
]);

export const creatorMetricInputSchema = z
  .object({
    name: trimmedNonEmpty,
    handle: z.string().trim().optional(),
    archetype: z.string().trim().optional(),
    contentFormat: z.string().trim().optional(),
    audienceSegment: z.string().trim().optional(),
    reach: z.number().nonnegative().optional(),
    impressions: z.number().nonnegative().optional(),
    completionRate: z.number().nonnegative().optional(),
    likes: z.number().nonnegative().optional(),
    comments: z.number().nonnegative().optional(),
    shares: z.number().nonnegative().optional(),
    saves: z.number().nonnegative().optional(),
    ctr: z.number().nonnegative().optional(),
    addToCart: z.number().nonnegative().optional(),
    conversionRate: z.number().nonnegative().optional(),
    gmv: z.number().nonnegative().optional(),
    cpa: z.number().nonnegative().optional(),
    roas: z.number().nonnegative().optional(),
    sentimentScore: z.number().optional(),
    representativeComments: z.array(z.string().trim().min(1)).optional(),
    source: creatorMetricSourceSchema.optional()
  })
  .strict();

export const campaignIntakeSchema = z
  .object({
    name: trimmedNonEmpty,
    brand: trimmedNonEmpty,
    objective: campaignObjectiveSchema,
    product: trimmedNonEmpty,
    audience: trimmedNonEmpty,
    budget: z.number().positive().optional(),
    kpiPriorities: z
      .array(trimmedNonEmpty)
      .optional()
      .transform((priorities) => priorities ?? []),
    brief: trimmedNonEmpty.describe("campaign_brief"),
    brandVoice: z.string().trim().optional(),
    competitors: z.array(trimmedNonEmpty).optional(),
    campaignStart: z.string().trim().optional(),
    campaignEnd: z.string().trim().optional(),
    knownCreatorPreferences: z.string().trim().optional(),
    existingCreativeDirection: z.string().trim().optional(),
    complianceNotes: z.string().trim().optional()
  })
  .strict();

export const niaInputSchema = z
  .object({
    sourceIds: z.array(trimmedNonEmpty).optional(),
    sourceNames: z.array(trimmedNonEmpty).optional(),
    queryHints: z.array(trimmedNonEmpty).optional()
  })
  .strict();

export const reacherInputSchema = z
  .object({
    shopId: z.string().trim().optional(),
    productId: z.string().trim().optional(),
    sellerId: z.string().trim().optional(),
    campaignId: z.string().trim().optional(),
    creatorIds: z.array(z.string().trim().min(1)).optional(),
    contentIds: z.array(z.string().trim().min(1)).optional()
  })
  .strict();

export const intakeBodySchema = z
  .object({
    campaign: campaignIntakeSchema,
    nia: niaInputSchema.optional(),
    reacher: reacherInputSchema.optional(),
    creators: z.array(creatorMetricInputSchema).optional()
  })
  .strict();

export const legacyPromptSchema = z.object({
  prompt: z.string().min(1, "Prompt is required.")
});

export const niaContextResultSchema = z
  .object({
    sourceId: z.string(),
    sourceName: z.string().optional(),
    title: z.string().optional(),
    excerpt: z.string(),
    url: z.string().optional(),
    relevanceScore: z.number().optional()
  })
  .strict();

export const dataProvenanceSchema = z
  .object({
    contextSource: z.enum(["nia", "brief_only"]),
    metricsSource: z.enum(["reacher", "manual", "demo"]),
    niaSourcesUsed: z.array(z.string()),
    reacherObjectsUsed: z.array(z.string()),
    missingInputs: z.array(z.string())
  })
  .strict();

export const weightedMetricSchema = z
  .object({
    name: z.string(),
    weight: z.number().min(0).max(100),
    reason: z.string()
  })
  .strict();

export const kpiFrameworkSchema = z
  .object({
    objective: resolvedObjectiveSchema,
    summary: z.string(),
    metrics: z.array(weightedMetricSchema).min(1),
    evaluationLogic: z.array(z.string()).min(1),
    confidence: confidenceSchema
  })
  .strict();

export const creatorEvaluationSchema = z
  .object({
    creatorName: z.string(),
    score: z.number().min(0).max(100),
    rank: z.number().int().positive(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    primaryDriver: z.string(),
    primaryDrag: z.string(),
    recommendedAction: z.string(),
    confidence: confidenceSchema
  })
  .strict();

export const attributionInsightSchema = z
  .object({
    claim: z.string(),
    evidence: z.array(z.string()),
    businessImplication: z.string(),
    confidence: confidenceSchema
  })
  .strict();

export const recommendationSchema = z
  .object({
    priority: z.enum(["high", "medium", "low"]),
    category: z.enum([
      "creator_mix",
      "creative_direction",
      "cta",
      "budget",
      "audience",
      "measurement"
    ]),
    action: z.string(),
    rationale: z.string(),
    expectedImpact: z.string(),
    followUpDataNeeded: z.array(z.string()).optional()
  })
  .strict();

export const campaignIntelligenceReportSchema = z
  .object({
    executiveSummary: z.string(),
    objective: resolvedObjectiveSchema,
    dataProvenance: dataProvenanceSchema,
    kpiFramework: kpiFrameworkSchema,
    creatorEvaluations: z.array(creatorEvaluationSchema),
    attributionInsights: z.array(attributionInsightSchema),
    recommendations: z.array(recommendationSchema),
    confidence: confidenceSchema,
    generatedAt: z.string(),
    model: z.string()
  })
  .strict();

export type CampaignObjective = z.infer<typeof campaignObjectiveSchema>;
export type ResolvedCampaignObjective = z.infer<typeof resolvedObjectiveSchema>;
export type CampaignIntakePayload = z.infer<typeof campaignIntakeSchema>;
export type CreatorMetricInputPayload = z.infer<typeof creatorMetricInputSchema>;
export type CampaignAgentBody = z.infer<typeof intakeBodySchema>;
export type NiaContextResult = z.infer<typeof niaContextResultSchema>;
export type DataProvenance = z.infer<typeof dataProvenanceSchema>;
export type WeightedMetric = z.infer<typeof weightedMetricSchema>;
export type KpiFramework = z.infer<typeof kpiFrameworkSchema>;
export type CreatorEvaluation = z.infer<typeof creatorEvaluationSchema>;
export type AttributionInsight = z.infer<typeof attributionInsightSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type CampaignIntelligenceReport = z.infer<typeof campaignIntelligenceReportSchema>;

export type NormalizedCampaignBrief = {
  name: string;
  brand: string;
  objective: ResolvedCampaignObjective;
  product: string;
  audience: string;
  budget?: number;
  kpiPriorities: string[];
  brief: string;
  brandVoice?: string;
  competitors: string[];
  campaignDates?: string;
  knownCreatorPreferences?: string;
  existingCreativeDirection?: string;
  complianceNotes?: string;
  missingInputs: string[];
  confidence: z.infer<typeof confidenceSchema>;
};

export type CampaignAgentState = {
  input: CampaignAgentBody;
  normalizedBrief?: NormalizedCampaignBrief;
  niaContext?: NiaContextResult[];
  reacherMetrics?: CreatorMetricInputPayload[];
  kpiFramework?: KpiFramework;
  creatorEvaluations?: CreatorEvaluation[];
  attributionInsights?: AttributionInsight[];
  recommendations?: Recommendation[];
  report?: CampaignIntelligenceReport;
  dataProvenance?: DataProvenance;
  errors: string[];
};

export function formatValidationIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
