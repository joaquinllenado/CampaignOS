import type { CampaignIntakeFields } from "./campaignTypes";

function splitLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseOptionalPositiveNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Budget must be a positive number when provided.");
  }
  return n;
}

/** Builds intake body for `/api/agent/run` from the visible campaign form only. */
export function buildCampaignRunPayload(
  campaign: CampaignIntakeFields,
  niaSourceIds: string[] = []
) {
  const budget = parseOptionalPositiveNumber(campaign.budget);
  const kpiPriorities = splitLines(campaign.kpiPriorities);
  const uniqueIds = [...new Set(niaSourceIds.map((id) => id.trim()).filter(Boolean))];

  return {
    campaign: {
      name: campaign.name.trim(),
      brand: campaign.brand.trim(),
      objective: campaign.objective,
      product: campaign.product.trim(),
      audience: campaign.audience.trim(),
      ...(budget !== undefined ? { budget } : {}),
      kpiPriorities,
      brief: campaign.brief.trim()
    },
    ...(uniqueIds.length > 0 ? { nia: { sourceIds: uniqueIds } } : {})
  };
}
