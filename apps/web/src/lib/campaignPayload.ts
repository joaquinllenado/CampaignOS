import type { CampaignIntakeFields } from "./campaignTypes";

/** Mirrors API `creatorMetricInput` subset for seeded runs (fixtures, spreadsheets, etc.). */
export type CreatorMetricsForAgentRun = {
  name: string;
  handle?: string;
  archetype?: string;
  contentFormat?: string;
  audienceSegment?: string;
  reach?: number;
  impressions?: number;
  completionRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  ctr?: number;
  addToCart?: number;
  conversionRate?: number;
  gmv?: number;
  cpa?: number;
  roas?: number;
  sentimentScore?: number;
  representativeComments?: string[];
};

function parseOptionalPositiveNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Budget must be a positive number when provided.");
  }
  return n;
}

export type CampaignRunBuildOptions = {
  creators?: readonly CreatorMetricsForAgentRun[];
  reacher?: {
    shopId?: string;
    productId?: string;
    sellerId?: string;
    campaignId?: string;
    creatorIds?: string[];
    contentIds?: string[];
  };
  /** YYYY-MM-DD — forwarded to Reacher list endpoints and /metrics/summary. */
  campaignStart?: string;
  /** YYYY-MM-DD — forwarded to Reacher list endpoints and /metrics/summary. */
  campaignEnd?: string;
};

function compactReach(r: NonNullable<CampaignRunBuildOptions["reacher"]>): NonNullable<CampaignRunBuildOptions["reacher"]> {
  const reacher: NonNullable<CampaignRunBuildOptions["reacher"]> = {};
  if (r.shopId?.trim()) reacher.shopId = r.shopId.trim();
  if (r.productId?.trim()) reacher.productId = r.productId.trim();
  if (r.sellerId?.trim()) reacher.sellerId = r.sellerId.trim();
  if (r.campaignId?.trim()) reacher.campaignId = r.campaignId.trim();
  if (r.creatorIds?.length) {
    const ids = r.creatorIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length) reacher.creatorIds = ids;
  }
  if (r.contentIds?.length) {
    const ids = r.contentIds.map((id) => id.trim()).filter(Boolean);
    if (ids.length) reacher.contentIds = ids;
  }
  return reacher;
}

/** Builds intake body for `/api/agent/run` from the visible campaign form (and optional seeds). */
export function buildCampaignRunPayload(
  campaign: CampaignIntakeFields,
  niaSourceIds: string[] = [],
  options: CampaignRunBuildOptions = {}
) {
  const budget = parseOptionalPositiveNumber(campaign.budget);
  const uniqueIds = [...new Set(niaSourceIds.map((id) => id.trim()).filter(Boolean))];

  const { creators, reacher, campaignStart, campaignEnd } = options;
  const reacherPayload = reacher ? compactReach(reacher) : {};
  const hasReach = Object.keys(reacherPayload).length > 0;

  return {
    campaign: {
      name: campaign.name.trim(),
      brand: campaign.brand.trim(),
      objective: "auto" as const,
      product: campaign.product.trim(),
      audience: campaign.audience.trim(),
      ...(budget !== undefined ? { budget } : {}),
      kpiPriorities: [] as string[],
      brief: campaign.brief.trim(),
      ...(campaignStart?.trim() ? { campaignStart: campaignStart.trim() } : {}),
      ...(campaignEnd?.trim() ? { campaignEnd: campaignEnd.trim() } : {})
    },
    ...(uniqueIds.length > 0 ? { nia: { sourceIds: uniqueIds } } : {}),
    ...(hasReach ? { reacher: reacherPayload } : {}),
    ...(creators && creators.length ? { creators: [...creators] } : {}),
  };
}
