import { formatValidationIssues, intakeBodySchema, legacyPromptSchema } from "./schema";
import type { CampaignIntelligenceReport } from "./schema";
import { runCampaignGraph } from "./graph";

export type LegacyAgentRequest = {
  prompt: string;
};

export type LegacyAgentResponse = {
  mode: "legacy_prompt";
  answer: string;
  createdAt: string;
  model: string;
};

export type CampaignAgentRunResponse = LegacyAgentResponse | CampaignIntelligenceReport;

function runLegacyAgent({ prompt }: LegacyAgentRequest): LegacyAgentResponse {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  return {
    mode: "legacy_prompt",
    answer: `You asked: "${normalizedPrompt}". The agent service is wired and ready for real tools, memory, or model calls.`,
    createdAt: new Date().toISOString(),
    model: "local-scaffold"
  };
}

export async function runAgent(body: unknown): Promise<CampaignAgentRunResponse> {
  if (typeof body === "object" && body !== null && "campaign" in body) {
    const parsed = intakeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(formatValidationIssues(parsed.error));
    }
    return runCampaignGraph(parsed.data);
  }

  const legacy = legacyPromptSchema.safeParse(body);
  if (!legacy.success) {
    throw new Error(formatValidationIssues(legacy.error));
  }

  return runLegacyAgent(legacy.data);
}
