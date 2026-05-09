import type { CreatorMetricsForAgentRun } from "../lib/campaignPayload";

export type DemoCreatorMetricSeed = CreatorMetricsForAgentRun;

export const DEMO_CAMPAIGN_CREATORS: readonly DemoCreatorMetricSeed[] = [
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
    representativeComments: [
      "This explains exactly how I would use it.",
      "The before and after helped."
    ]
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
    representativeComments: ["Funny but what does it do?", "I missed the shop link."]
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
    representativeComments: ["This fits my morning routine.", "Saving this for later."]
  }
] as const;
