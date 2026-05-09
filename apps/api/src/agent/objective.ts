import type {
  CampaignAgentBody,
  CampaignAgentState,
  NormalizedCampaignBrief,
  NiaContextResult,
  ResolvedCampaignObjective
} from "./schema";

function resolveObjectiveFromSignals(input: CampaignAgentBody, extraContext: string): ResolvedCampaignObjective {
  if (input.campaign.objective !== "auto") return input.campaign.objective;

  const text = [
    input.campaign.brief,
    input.campaign.product,
    input.campaign.audience,
    ...input.campaign.kpiPriorities,
    extraContext
  ]
    .join(" ")
    .toLowerCase();

  const salesSignals = ["gmv", "conversion", "roas", "cpa", "revenue", "sales", "purchase"];
  const engagementSignals = ["comment", "save", "share", "engagement", "conversation", "community"];

  if (salesSignals.some((signal) => text.includes(signal))) return "sales";
  if (engagementSignals.some((signal) => text.includes(signal))) return "engagement";
  return "awareness";
}

/** Heuristic objective from form fields only (before Nia text is available). */
export function detectObjective(input: CampaignAgentBody): ResolvedCampaignObjective {
  return resolveObjectiveFromSignals(input, "");
}

/** Re-run detection after Nia excerpts so uploaded briefs/docs inform `auto`. */
export function detectObjectiveAfterNia(input: CampaignAgentBody, niaContext: NiaContextResult[]): ResolvedCampaignObjective {
  const extra = niaContext.map((c) => c.excerpt).join("\n");
  return resolveObjectiveFromSignals(input, extra);
}

export function normalizeInput(state: CampaignAgentState): NormalizedCampaignBrief {
  const { campaign } = state.input;
  const missingInputs: string[] = [];

  if (!state.input.nia?.sourceIds?.length && !state.input.nia?.sourceNames?.length) {
    missingInputs.push("niaSources");
  }
  if (!state.input.creators?.length && !state.input.reacher) missingInputs.push("creatorMetrics");

  return {
    name: campaign.name,
    brand: campaign.brand,
    objective: detectObjective(state.input),
    product: campaign.product,
    audience: campaign.audience,
    budget: campaign.budget,
    kpiPriorities: campaign.kpiPriorities,
    brief: campaign.brief,
    brandVoice: campaign.brandVoice,
    competitors: campaign.competitors ?? [],
    campaignDates:
      campaign.campaignStart || campaign.campaignEnd
        ? `${campaign.campaignStart ?? "unknown"} to ${campaign.campaignEnd ?? "unknown"}`
        : undefined,
    knownCreatorPreferences: campaign.knownCreatorPreferences,
    existingCreativeDirection: campaign.existingCreativeDirection,
    complianceNotes: campaign.complianceNotes,
    missingInputs,
    confidence: missingInputs.length > 2 ? "low" : missingInputs.length ? "medium" : "high"
  };
}
