export type CampaignObjective = "awareness" | "engagement" | "sales" | "auto";

/** Aligned with server `SUPPORTED_KPI_METRIC_NAMES` for UX hints — custom labels are still allowed. */
export const KPI_METRIC_HINTS = [
  "reach",
  "impressions",
  "completion_rate",
  "share_velocity",
  "brand_sentiment",
  "comment_depth",
  "saves",
  "shares",
  "cta_intent",
  "gmv",
  "conversion_rate",
  "ctr",
  "add_to_cart",
  "cpa",
  "roas"
] as const;

/** Fields collected in the user-facing intake form (required + common campaign inputs). */
export type CampaignIntakeFields = {
  name: string;
  brand: string;
  objective: CampaignObjective;
  product: string;
  audience: string;
  budget: string;
  kpiPriorities: string;
  brief: string;
};

export type AgentRunSuccess =
  | {
      mode: "legacy_prompt";
      answer: string;
      createdAt: string;
      model: string;
    }
  | {
      mode: "intake";
      receivedAt: string;
      intake: unknown;
      warnings: string[];
      kpiPriorityNotes: string[];
    };

export type AgentRunErrorResponse = {
  error: string;
};
