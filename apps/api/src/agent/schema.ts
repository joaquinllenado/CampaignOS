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
    objective: z.enum(["awareness", "engagement", "sales", "auto"]),
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

export type CampaignIntakePayload = z.infer<typeof campaignIntakeSchema>;
export type CreatorMetricInputPayload = z.infer<typeof creatorMetricInputSchema>;
export type CampaignAgentBody = z.infer<typeof intakeBodySchema>;

export function formatValidationIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
