import type {
  CampaignAgentBody,
  CreatorMetricInputPayload,
  ResolvedCampaignObjective
} from "../agent/schema";

export type ReacherMetricsResult = {
  metrics: CreatorMetricInputPayload[];
  source: "reacher" | "manual" | "demo";
  objectsUsed: string[];
  errors: string[];
};

function withManualSource(metric: CreatorMetricInputPayload): CreatorMetricInputPayload {
  return {
    ...metric,
    source: metric.source ?? "manual"
  };
}

function sampleMetrics(objective: ResolvedCampaignObjective): CreatorMetricInputPayload[] {
  const shared: CreatorMetricInputPayload[] = [
    {
      name: "Maya Chen",
      handle: "@mayamakes",
      archetype: "tutorial educator",
      contentFormat: "product tutorial",
      audienceSegment: "ingredient-conscious shoppers",
      reach: 182_000,
      impressions: 241_000,
      completionRate: 0.61,
      likes: 13_900,
      comments: 880,
      shares: 1_940,
      saves: 3_180,
      ctr: 0.042,
      addToCart: 1_230,
      conversionRate: 0.083,
      gmv: 48_500,
      cpa: 18.5,
      roas: 4.6,
      sentimentScore: 0.82,
      representativeComments: ["This explains exactly how I would use it.", "The before and after helped."],
      source: "demo"
    },
    {
      name: "Jay Brooks",
      handle: "@jaytries",
      archetype: "entertainment reviewer",
      contentFormat: "trend skit",
      audienceSegment: "deal-seeking Gen Z",
      reach: 418_000,
      impressions: 520_000,
      completionRate: 0.44,
      likes: 21_200,
      comments: 540,
      shares: 1_120,
      saves: 710,
      ctr: 0.015,
      addToCart: 420,
      conversionRate: 0.027,
      gmv: 15_400,
      cpa: 42.1,
      roas: 1.8,
      sentimentScore: 0.56,
      representativeComments: ["Funny but what does it do?", "I missed the shop link."],
      source: "demo"
    },
    {
      name: "Sofia Ramos",
      handle: "@sofiaselects",
      archetype: "lifestyle curator",
      contentFormat: "routine integration",
      audienceSegment: "busy young professionals",
      reach: 236_000,
      impressions: 302_000,
      completionRate: 0.57,
      likes: 17_700,
      comments: 1_260,
      shares: 2_420,
      saves: 2_680,
      ctr: 0.031,
      addToCart: 860,
      conversionRate: 0.052,
      gmv: 31_900,
      cpa: 24.4,
      roas: 3.3,
      sentimentScore: 0.74,
      representativeComments: ["This fits my morning routine.", "Saving this for later."],
      source: "demo"
    }
  ];

  if (objective === "awareness") {
    return shared.map((metric) => ({
      ...metric,
      gmv: undefined,
      cpa: undefined,
      roas: undefined,
      conversionRate: metric.conversionRate ? metric.conversionRate / 2 : undefined
    }));
  }

  if (objective === "engagement") {
    return shared.map((metric) => ({
      ...metric,
      addToCart: undefined,
      gmv: undefined,
      cpa: undefined,
      roas: undefined
    }));
  }

  return shared;
}

function collectReacherObjectIds(input: CampaignAgentBody): string[] {
  const reacher = input.reacher;
  if (!reacher) return [];

  return [
    reacher.shopId && `shop:${reacher.shopId}`,
    reacher.productId && `product:${reacher.productId}`,
    reacher.sellerId && `seller:${reacher.sellerId}`,
    reacher.campaignId && `campaign:${reacher.campaignId}`,
    ...(reacher.creatorIds?.map((id) => `creator:${id}`) ?? []),
    ...(reacher.contentIds?.map((id) => `content:${id}`) ?? [])
  ].filter((value): value is string => Boolean(value));
}

export async function fetchReacherMetrics(
  input: CampaignAgentBody,
  objective: ResolvedCampaignObjective
): Promise<ReacherMetricsResult> {
  if (input.creators?.length) {
    return {
      metrics: input.creators.map(withManualSource),
      source: "manual",
      objectsUsed: [],
      errors: []
    };
  }

  const objectsUsed = collectReacherObjectIds(input);
  const canCallReacher = Boolean(Bun.env.REACHER_API_KEY?.trim() && Bun.env.REACHER_BASE_URL?.trim());

  if (objectsUsed.length && canCallReacher) {
    return {
      metrics: sampleMetrics(objective),
      source: "demo",
      objectsUsed,
      errors: [
        "Reacher adapter is configured but exact authenticated response contracts are not finalized; demo-normalized metrics were used."
      ]
    };
  }

  return {
    metrics: sampleMetrics(objective),
    source: "demo",
    objectsUsed,
    errors: objectsUsed.length
      ? ["Reacher credentials are missing, so demo metrics were used for the selected Reacher objects."]
      : ["No creator metrics or Reacher identifiers were supplied, so demo metrics were used."]
  };
}
