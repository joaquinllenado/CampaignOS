import type { CampaignIntakeFields } from "../lib/campaignTypes";
import type { CampaignRunBuildOptions, CreatorMetricsForAgentRun } from "../lib/campaignPayload";
import { DEMO_CAMPAIGN_CREATORS } from "./demoCreators.fixture";

/**
 * Reacher sandbox: shop “Grocery Stars” (shop_id 1183) with dummy TikTok Shop metrics.
 * `campaignId` is the portal automation id for the Target Collab named “Target Collab 5/1/26”
 * (latest row as of fixture authoring — used for provenance only; API filters use date range).
 */
export const DEMO_REACHER_SAMPLE_TARGET_COLLAB_5_1_26: CampaignRunBuildOptions = {
  reacher: {
    shopId: "1183",
    campaignId: "66330"
  },
  campaignStart: "2026-05-01",
  campaignEnd: "2026-05-14"
};

/** Sample narrative aligned with Reacher “Grocery Stars” dummy shop and the 5/1/26 Target Collab window. */
export const DEMO_CAMPAIGN_FIELDS: CampaignIntakeFields = {
  name: "Target Collab 5/1/26",
  brand: "Grocery Stars",
  product: "Food and Beverages",
  audience:
    "18–34, with a secondary band of 35–44 for grocery/home shoppers.",
  budget: "500",
  brief: [
    "Program goal: grow GMV and shoppable video volume through the May 1 Target Collab push on food and beverage SKUs while keeping fulfillment and sample workflows healthy.",
    "Creative: tastings, pantry/stocking hooks, recipes, hauls, price-deal urgency; native short-form product-in-hand.",
    "Ops: respect Target Collab invite caps; prioritize creators with completed sample history where possible.",
    "Measurement window: early May sprint — focus on views, engaged comments/saves, outbound CTR, add-to-cart, and GMV by SKU cohort; compare against Reacher dashboard aggregates for the same shop/date range."
  ].join("\n\n"),
};

export function demoAgentCreatorsPayload(): CreatorMetricsForAgentRun[] {
  return DEMO_CAMPAIGN_CREATORS.map((row) => ({ ...row }));
}
