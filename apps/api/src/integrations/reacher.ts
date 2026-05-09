import type {
  CampaignAgentBody,
  CampaignMetricSummary,
  CreatorMetricInputPayload,
  ResolvedCampaignObjective
} from "../agent/schema";

export type ReacherMetricsResult = {
  metrics: CreatorMetricInputPayload[];
  summary?: CampaignMetricSummary;
  source: "reacher" | "manual" | "demo";
  objectsUsed: string[];
  errors: string[];
};

type ReacherRequest = {
  label: string;
  method?: "GET" | "POST";
  path: string;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  shopId?: string;
};

type ReacherResponse = {
  request: ReacherRequest;
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
};

const DEFAULT_REACHER_BASE_URL = "https://api.reacherapp.com/public/v1";
const SHOP_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedShopIds: { ids: string[]; expiresAt: number } | undefined;

function envTruthy(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  const v = raw.toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

function commaSeparatedHandles(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  const ids = raw.split(",").map((segment) => segment.trim()).filter(Boolean);
  return ids.length ? ids : undefined;
}

function envDefault(name: string): string | undefined {
  const trimmed = Bun.env[name as keyof Bun.Env]?.trim();
  return trimmed || undefined;
}

/**
 * Fills `reacher.*` from env when missing so you can bind a TikTok Shop without UI changes:
 * REACHER_DEFAULT_SHOP_ID, REACHER_DEFAULT_PRODUCT_ID, REACHER_DEFAULT_SELLER_ID, REACHER_DEFAULT_CAMPAIGN_ID (provenance only; /metrics/summary uses dates from the brief),
 * REACHER_DEFAULT_CREATOR_IDS (comma-separated creator_handle values).
 * Request payload still wins — only vacant fields read from env.
 */
export function withReacherEnvDefaults(input: CampaignAgentBody): CampaignAgentBody {
  const r = input.reacher ?? {};
  const envCreators = commaSeparatedHandles(Bun.env.REACHER_DEFAULT_CREATOR_IDS);
  const creatorIds = r.creatorIds?.length ? r.creatorIds : envCreators;

  const nextReach = {
    shopId: r.shopId ?? envDefault("REACHER_DEFAULT_SHOP_ID"),
    productId: r.productId ?? envDefault("REACHER_DEFAULT_PRODUCT_ID"),
    sellerId: r.sellerId ?? envDefault("REACHER_DEFAULT_SELLER_ID"),
    campaignId: r.campaignId ?? envDefault("REACHER_DEFAULT_CAMPAIGN_ID"),
    ...(creatorIds?.length ? { creatorIds } : {})
  };

  const hasReach =
    Boolean(nextReach.shopId) ||
    Boolean(nextReach.productId) ||
    Boolean(nextReach.sellerId) ||
    Boolean(nextReach.campaignId) ||
    Boolean(creatorIds?.length);
  if (!hasReach) return input;

  return {
    ...input,
    reacher: {
      ...nextReach
    }
  };
}

function brandedMockReacherRollup(
  input: CampaignAgentBody,
  objective: ResolvedCampaignObjective
): ReacherMetricsResult {
  const metrics = sampleMetrics(objective);
  const brand = input.campaign.brand.trim();
  const name = input.campaign.name.trim();
  const impressions = metrics.reduce((sum, metric) => sum + (metric.impressions ?? 0), 0);
  const likes = metrics.reduce((sum, metric) => sum + (metric.likes ?? 0), 0);
  const gmvTotal = metrics.reduce((sum, metric) => sum + (metric.gmv ?? 0), 0);
  const objectsUsed = collectReacherObjectIds(input);
  const label = objectsUsed.length > 0 ? objectsUsed : brand ? [`env:${brand}`] : [];

  const summary: CampaignMetricSummary = {
    campaignType: [brand || undefined, name || undefined].filter(Boolean).join(" · ") || undefined,
    keyTakeaways: [
      [
        brand && `${brand}: creator ladder reflects this brief's pacing window.`,
        `Focus product: ${input.campaign.product.trim() || "(not specified)"}.`
      ]
        .filter(Boolean)
        .join(" ")
    ],
    totalViews: impressions,
    totalLikes: likes,
    totalOrders: gmvTotal > 0 ? Math.max(180, Math.round(gmvTotal / 12_000)) : undefined,
    postingCreators: metrics.length,
    videosPosted: metrics.length * 3,
    peakVisibilityViews: impressions > 0 ? Math.round(impressions * 0.14) : undefined,
    creatorsMessaged: metrics.length > 0 ? metrics.length * 5 + 12 : undefined
  };

  return {
    metrics,
    summary,
    source: "demo",
    objectsUsed: label,
    errors: []
  };
}

function withManualSource(metric: CreatorMetricInputPayload): CreatorMetricInputPayload {
  return {
    ...metric,
    source: metric.source ?? "manual"
  };
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function reacherBaseUrl(): string {
  const configured = Bun.env.REACHER_BASE_URL?.trim() || DEFAULT_REACHER_BASE_URL;
  const url = new URL(configured);

  if (url.hostname === "portal.reacherapp.com") url.hostname = "api.reacherapp.com";
  if (url.hostname === "api.reacherapp.com" && !url.pathname.includes("/public/v1")) {
    url.pathname = `${trimSlashes(url.pathname) ? `/${trimSlashes(url.pathname)}` : ""}/public/v1`;
  }

  return url.toString();
}

function buildUrl(request: ReacherRequest): string {
  const url = new URL(`${trimSlashes(reacherBaseUrl())}/${trimSlashes(request.path)}`);

  for (const [key, value] of Object.entries(request.params ?? {})) {
    if (value?.trim()) url.searchParams.set(key, value.trim());
  }

  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reacherFetch(request: ReacherRequest): Promise<ReacherResponse> {
  const apiKey = Bun.env.REACHER_API_KEY?.trim();
  if (!apiKey) return { request, ok: false, error: "REACHER_API_KEY is not configured." };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(buildUrl(request), {
        method: request.method ?? "GET",
        signal: AbortSignal.timeout(8_000),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          ...(request.shopId ? { "x-shop-id": request.shopId } : {})
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {})
      });

      const text = await response.text();
      const data = text.trim() ? JSON.parse(text) : null;

      if (!response.ok) {
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 2_000 * (attempt + 1));
          continue;
        }
        return { request, ok: false, status: response.status, error: response.statusText || "Request failed.", data };
      }

      return { request, ok: true, status: response.status, data };
    } catch (error) {
      if (attempt < 2) {
        await sleep(1_000 * (attempt + 1));
        continue;
      }
      return { request, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  return { request, ok: false, error: "Reacher request failed after retries." };
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

/** Maps intake `campaignStart` / `campaignEnd` (YYYY-MM-DD) to Reacher list/aggregate bodies. */
function reacherDateFilter(input: CampaignAgentBody): { start_date?: string; end_date?: string } {
  const start = input.campaign.campaignStart?.trim();
  const end = input.campaign.campaignEnd?.trim();
  const out: { start_date?: string; end_date?: string } = {};
  if (start) out.start_date = start;
  if (end) out.end_date = end;
  return out;
}

function buildShopRequests(input: CampaignAgentBody, shopId: string): ReacherRequest[] {
  const reacher = input.reacher ?? {};
  const { productId } = reacher;
  const dateFilter = reacherDateFilter(input);
  const page = { page: 1, page_size: 50, ...dateFilter };
  const requests: ReacherRequest[] = [
    {
      label: "metrics summary",
      method: "POST",
      path: "/metrics/summary",
      shopId,
      body: {
        ...dateFilter
      }
    },
    { label: "creator lifetime metrics", method: "POST", path: "/creators/list", shopId, body: { ...page, sort_by: "shop_gmv", sort_dir: "desc" } },
    { label: "creator performance", method: "POST", path: "/creators/performance", shopId, body: { ...page, sort_by: "gmv", sort_dir: "desc" } },
    { label: "video list", method: "POST", path: "/videos/list", shopId, body: { ...page, sort_by: "video_gmv", sort_dir: "desc", product_id: productId || undefined } },
    { label: "video performance", method: "POST", path: "/videos/performance", shopId, body: { ...page, sort_by: "video_gmv", sort_dir: "desc" } },
    { label: "sample requests", method: "POST", path: "/samples/list", shopId, body: { ...page, sort_by: "gmv", sort_dir: "desc", product_id: productId || undefined } },
    { label: "samples by product", method: "POST", path: "/samples/by-product", shopId, body: { ...page, sort_by: "sample_gmv", sort_dir: "desc" } },
    {
      label: "products",
      method: "POST",
      path: "/products/list",
      shopId,
      body: { page: 1, page_size: 20, sort_by: "gmv", sort_dir: "desc", product_name: input.campaign.product, ...dateFilter }
    }
  ];

  if (productId) {
    requests.push(
      { label: "product creators", method: "POST", path: `/products/${encodeURIComponent(productId)}/creators`, shopId, body: page },
      { label: "product videos", method: "POST", path: `/products/${encodeURIComponent(productId)}/videos`, shopId, body: { ...page, sort_by: "video_gmv", sort_dir: "desc" } }
    );
  }

  for (const creatorId of reacher.creatorIds ?? []) {
    requests.push(
      { label: `creator ${creatorId} performance`, method: "POST", path: "/creators/performance", shopId, body: { ...page, creator_handle: creatorId, sort_by: "gmv", sort_dir: "desc" } },
      { label: `creator ${creatorId} videos`, method: "POST", path: "/videos/list", shopId, body: { ...page, creator_handle: creatorId, sort_by: "video_gmv", sort_dir: "desc" } }
    );
  }

  return requests;
}

function buildReacherRequests(input: CampaignAgentBody, shopIds: string[]): ReacherRequest[] {
  return [
    { label: "shops", path: "/shops" },
    ...shopIds.flatMap((shopId) => buildShopRequests(input, shopId))
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueAtPath(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, record);
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = valueAtPath(record, key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function numberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = valueAtPath(record, key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeRate(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return value > 1 ? value / 100 : value;
}

function stringArrayField(record: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = valueAtPath(record, key);
    if (Array.isArray(value)) {
      const items = value
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (isRecord(item)) return stringField(item, ["name", "label", "title", "value", "format", "trait", "action"]);
          return undefined;
        })
        .filter((item): item is string => Boolean(item));
      if (items.length) return [...new Set(items)];
    }
    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return undefined;
}

function flattenRecords(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.flatMap(flattenRecords);
  if (!isRecord(raw)) return [];

  const nestedKeys = [
    "data",
    "results",
    "items",
    "rows",
    "summary",
    "metrics",
    "dashboard",
    "timeSeries",
    "time_series",
    "funnel",
    "creators",
    "videos",
    "products",
    "campaigns",
    "sampleRequests",
    "sample_requests"
  ];
  const nestedRecords = nestedKeys.flatMap((key) => flattenRecords(raw[key]));

  return [raw, ...nestedRecords];
}

function rawMetricKeys(record: Record<string, unknown>): string[] {
  return Object.entries(record)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key]) => key)
    .slice(0, 40);
}

function normalizeReacherRecord(
  record: Record<string, unknown>,
  input: CampaignAgentBody
): CreatorMetricInputPayload | null {
  const views = numberField(record, ["views", "video_views", "videoViews", "view_count", "viewCount", "play_count"]);
  const reach = numberField(record, ["reach", "total_reach", "creators_reached", "video_views", "views"]) ?? views;
  const impressions = numberField(record, ["impressions", "video_views", "videoViews", "views"]) ?? views;
  const likes = numberField(record, ["likes", "like_count", "likeCount"]);
  const comments = numberField(record, ["comments", "comment_count", "commentCount"]);
  const shares = numberField(record, ["shares", "share_count", "shareCount"]);
  const saves = numberField(record, ["saves", "save_count", "saveCount"]);
  const orders = numberField(record, ["orders", "order_count", "orderCount"]);
  const conversionBase = views ?? reach ?? impressions;
  const conversionRate =
    normalizeRate(numberField(record, ["conversionRate", "conversion_rate", "purchase_conversion_rate"])) ??
    (orders !== undefined && conversionBase && conversionBase > 0 ? orders / conversionBase : undefined);
  const gmv = numberField(record, ["gmv", "shop_gmv", "video_gmv", "sample_gmv", "revenue", "sales", "total_gmv"]);
  const creatorId = stringField(record, ["creatorId", "creator_id", "creator.id", "id"]);
  const contentId = stringField(record, ["contentId", "content_id", "videoId", "video_id", "video.id"]);

  const metric: CreatorMetricInputPayload = {
    name:
      stringField(record, [
        "creatorName",
        "creator_name",
        "creator.name",
        "creator_handle",
        "authorName",
        "author.name",
        "name",
        "username",
        "handle"
      ]) ?? "Reacher aggregate",
    handle: stringField(record, ["handle", "creatorHandle", "creator_handle", "username", "creator.username"]),
    archetype: stringField(record, ["archetype", "creator_type", "creatorType", "category", "persona", "status"]),
    contentFormat: stringField(record, ["contentFormat", "content_format", "format", "hookType", "hook_type"]),
    audienceSegment: stringField(record, ["audienceSegment", "audience_segment", "audience", "niche"]),
    reach,
    impressions,
    completionRate: normalizeRate(numberField(record, ["completionRate", "completion_rate", "avg_completion_rate"])),
    likes,
    comments,
    shares,
    saves,
    ctr: normalizeRate(numberField(record, ["ctr", "click_through_rate", "clickThroughRate"])),
    addToCart: numberField(record, ["addToCart", "add_to_cart", "cart_adds", "add_to_cart_count"]),
    conversionRate,
    gmv,
    cpa: numberField(record, ["cpa", "cost_per_acquisition"]),
    roas: numberField(record, ["roas", "return_on_ad_spend"]),
    sentimentScore: normalizeRate(numberField(record, ["sentimentScore", "sentiment_score", "brand_sentiment"])),
    source: {
      ...input.reacher,
      creatorId,
      contentId,
      fetchedAt: new Date().toISOString(),
      rawMetricKeys: rawMetricKeys(record)
    }
  };

  const hasMetrics = [
    metric.reach,
    metric.impressions,
    metric.likes,
    metric.comments,
    metric.shares,
    metric.saves,
    metric.ctr,
    metric.addToCart,
    metric.conversionRate,
    metric.gmv,
    metric.cpa,
    metric.roas
  ].some((value) => value !== undefined);

  return hasMetrics ? metric : null;
}

function mergeMetricRows(rows: CreatorMetricInputPayload[]): CreatorMetricInputPayload[] {
  const additiveKeys = ["likes", "comments", "shares", "saves", "addToCart"] as const;
  const maxKeys = ["reach", "impressions", "gmv"] as const;
  const merged = new Map<string, CreatorMetricInputPayload>();

  for (const row of rows) {
    const key = (row.handle ?? row.name).toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, row);
      continue;
    }

    for (const metric of additiveKeys) {
      const current = existing[metric] ?? 0;
      const next = row[metric] ?? 0;
      if (existing[metric] !== undefined || row[metric] !== undefined) existing[metric] = current + next;
    }

    for (const metric of maxKeys) {
      const values = [existing[metric], row[metric]].filter((value): value is number => value !== undefined);
      if (values.length) existing[metric] = Math.max(...values);
    }

    existing.completionRate ??= row.completionRate;
    existing.ctr ??= row.ctr;
    existing.conversionRate ??= row.conversionRate;
    existing.cpa ??= row.cpa;
    existing.roas ??= row.roas;
    existing.sentimentScore ??= row.sentimentScore;
    existing.archetype ??= row.archetype;
    existing.contentFormat ??= row.contentFormat;
    existing.audienceSegment ??= row.audienceSegment;
  }

  return [...merged.values()];
}

function normalizeReacherResponses(
  responses: ReacherResponse[],
  input: CampaignAgentBody
): CreatorMetricInputPayload[] {
  const rows = responses
    .filter((response) => response.ok)
    .flatMap((response) => flattenRecords(response.data))
    .map((record) => normalizeReacherRecord(record, input))
    .filter((metric): metric is CreatorMetricInputPayload => Boolean(metric));

  return mergeMetricRows(rows);
}

function normalizeCampaignSummary(
  responses: ReacherResponse[]
): CampaignMetricSummary | undefined {
  const summaryRecords = responses
    .filter((response) => response.ok && response.request.label === "metrics summary")
    .flatMap((response) => flattenRecords(response.data));
  const record = summaryRecords.find((item) =>
    [
      "total_views",
      "totalViews",
      "views",
      "posting_creators",
      "postingCreators",
      "videos_posted",
      "videosPosted",
      "total_orders",
      "totalOrders"
    ].some((key) => valueAtPath(item, key) !== undefined)
  );

  if (!record) return undefined;

  const keyTakeaways = stringArrayField(record, [
    "keyTakeaways",
    "key_takeaways",
    "takeaways",
    "summary.keyTakeaways",
    "summary.key_takeaways"
  ]);
  const strongestFormats = stringArrayField(record, [
    "strongestFormats",
    "strongest_formats",
    "bestPerformingContentPatterns.strongestFormats",
    "best_performing_content_patterns.strongest_formats",
    "content_patterns.strongest_formats"
  ]);
  const strongestCreatorTraits = stringArrayField(record, [
    "strongestCreatorTraits",
    "strongest_creator_traits",
    "bestPerformingContentPatterns.strongestCreatorTraits",
    "best_performing_content_patterns.strongest_creator_traits",
    "creator_traits.strongest_traits"
  ]);

  const summary: CampaignMetricSummary = {
    campaignType: stringField(record, ["campaignType", "campaign_type", "type"]),
    campaignWindow: stringField(record, ["campaignWindow", "campaign_window", "window", "date_range"]),
    status: stringField(record, ["status", "campaign_status"]),
    postingCreators: numberField(record, ["postingCreators", "posting_creators", "activePostingCreators", "active_posting_creators"]),
    videosPosted: numberField(record, ["videosPosted", "videos_posted", "video_count", "videos"]),
    totalViews: numberField(record, ["totalViews", "total_views", "views", "video_views"]),
    avgDailyViews: numberField(record, ["avgDailyViews", "avg_daily_views", "average_daily_views"]),
    peakVisibilityViews: numberField(record, ["peakVisibilityViews", "peak_visibility_views", "peak_visibility_day_views", "peak_views"]),
    totalLikes: numberField(record, ["totalLikes", "total_likes", "likes"]),
    totalComments: numberField(record, ["totalComments", "total_comments", "comments"]),
    avgEngagementRate: normalizeRate(numberField(record, ["avgEngagementRate", "avg_engagement_rate", "engagement_rate"])),
    totalOrders: numberField(record, ["totalOrders", "total_orders", "orders", "order_count"]),
    newCreatorsPosting: numberField(record, ["newCreatorsPosting", "new_creators_posting", "new_creator_activation"]),
    creatorsReached: numberField(record, ["creatorsReached", "creators_reached"]),
    creatorsMessaged: numberField(record, ["creatorsMessaged", "creators_messaged"]),
    tcInvitesSent: numberField(record, ["tcInvitesSent", "tc_invites_sent", "target_collab_invites_sent"]),
    keyTakeaways,
    strongestFormats,
    strongestCreatorTraits,
    strengths: stringArrayField(record, ["strengths", "biggestStrengths", "biggest_strengths"]),
    weaknesses: stringArrayField(record, ["weaknesses", "biggestWeaknesses", "biggest_weaknesses"]),
    strategicRecommendations: stringArrayField(record, [
      "strategicRecommendations",
      "strategic_recommendations",
      "immediatePriorities",
      "immediate_priorities"
    ]),
    highestLeverageOpportunity: stringField(record, ["highestLeverageOpportunity", "highest_leverage_opportunity"]),
    fetchedAt: new Date().toISOString()
  };

  const hasSummary = Object.entries(summary).some(
    ([key, value]) => key !== "fetchedAt" && value !== undefined && (!Array.isArray(value) || value.length > 0)
  );

  return hasSummary ? summary : undefined;
}

function shopIdsFromResponse(response: ReacherResponse): string[] {
  const shops = flattenRecords(response.data)
    .flatMap((record) => {
      const id = stringField(record, ["shop_id", "shopId", "id"]);
      if (!id) return [];
      return [{ id, status: stringField(record, ["status"]) }];
    });

  const activeShops = shops.filter((shop) => shop.status?.toLowerCase() !== "inactive");
  const selected = activeShops.length ? activeShops : shops;

  return [...new Set(selected.map((shop) => shop.id))].slice(0, 5);
}

async function discoverShopIds(): Promise<{ ids: string[]; response: ReacherResponse }> {
  if (cachedShopIds && cachedShopIds.expiresAt > Date.now()) {
    return { ids: cachedShopIds.ids, response: { request: { label: "shops", path: "/shops" }, ok: true } };
  }

  const response = await reacherFetch({ label: "shops", path: "/shops" });
  const ids = response.ok ? shopIdsFromResponse(response) : [];
  if (ids.length) cachedShopIds = { ids, expiresAt: Date.now() + SHOP_CACHE_TTL_MS };

  return { ids, response };
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

  const routed = withReacherEnvDefaults(input);

  if (envTruthy(Bun.env.REACHER_MOCK_METRICS)) {
    return brandedMockReacherRollup(routed, objective);
  }

  const objectsUsed = collectReacherObjectIds(routed);
  const canCallReacher = Boolean(Bun.env.REACHER_API_KEY?.trim());

  if (canCallReacher) {
    const discovery = routed.reacher?.shopId ? undefined : await discoverShopIds();
    const discoveredShopIds = discovery?.ids ?? [];
    const shopIds = routed.reacher?.shopId ? [routed.reacher.shopId] : discoveredShopIds;
    const requests = buildReacherRequests(routed, shopIds);
    const responses = await Promise.all(requests.map(reacherFetch));
    const metrics = normalizeReacherResponses(responses, routed);
    const summary = normalizeCampaignSummary(responses);

    if (metrics.length || summary) {
      return {
        metrics,
        summary,
        source: "reacher",
        objectsUsed: objectsUsed.length ? objectsUsed : shopIds.length ? shopIds.map((id) => `shop:${id}`) : requests.map((request) => `endpoint:${request.label}`),
        errors: []
      };
    }

    const failedLabels = responses
      .filter((response) => !response.ok)
      .slice(0, 4)
      .map((response) => `${response.request.label}${response.status ? ` (${response.status})` : ""}`);

    return {
      metrics: sampleMetrics(objective),
      source: "demo",
      objectsUsed,
      errors: [
        failedLabels.length
          ? `Reacher calls did not return normalizable creator metrics from: ${failedLabels.join(", ")}. Demo metrics were used.`
          : "Reacher returned no normalizable creator metrics, so demo metrics were used."
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
