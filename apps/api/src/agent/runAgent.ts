import {
  formatValidationIssues,
  intakeBodySchema,
  legacyPromptSchema,
  SUPPORTED_KPI_METRIC_NAMES
} from "./schema";
import type { CampaignAgentBody } from "./schema";

export type LegacyAgentRequest = {
  prompt: string;
};

export type LegacyAgentResponse = {
  mode: "legacy_prompt";
  answer: string;
  createdAt: string;
  model: string;
};

export type IntakeAckResponse = {
  mode: "intake";
  receivedAt: string;
  intake: CampaignAgentBody;
  warnings: string[];
  kpiPriorityNotes: string[];
};

export type AgentRunResponse = LegacyAgentResponse | IntakeAckResponse;

const normalizedMetricSet = new Set<string>(SUPPORTED_KPI_METRIC_NAMES);

function collectIntakeWarnings(intake: CampaignAgentBody): string[] {
  const warnings: string[] = [];

  if (intake.campaign.objective === "auto") {
    warnings.push(
      'Campaign objective is "auto". The agent will infer the resolved objective during normalization.'
    );
  }

  return warnings;
}

function collectKpiPriorityNotes(intake: CampaignAgentBody): string[] {
  const priorities = intake.campaign.kpiPriorities;
  if (!priorities.length) {
    return ["No KPI priorities listed; the framework generator will infer emphasis from the brief and objective."];
  }

  const unknown = priorities.filter((p) => !normalizedMetricSet.has(p));
  if (unknown.length === 0) {
    return ["All listed KPI priorities match known framework metric keys."];
  }

  return [
    `Some KPI priorities are free-text or custom labels and will be passed as context: ${unknown.join(", ")}.`
  ];
}

function buildIntakeAck(intake: CampaignAgentBody): IntakeAckResponse {
  return {
    mode: "intake",
    receivedAt: new Date().toISOString(),
    intake,
    warnings: collectIntakeWarnings(intake),
    kpiPriorityNotes: collectKpiPriorityNotes(intake)
  };
}

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

export function runAgent(body: unknown): AgentRunResponse {
  if (typeof body === "object" && body !== null && "campaign" in body) {
    const parsed = intakeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(formatValidationIssues(parsed.error));
    }
    return buildIntakeAck(parsed.data);
  }

  const legacy = legacyPromptSchema.safeParse(body);
  if (!legacy.success) {
    throw new Error(formatValidationIssues(legacy.error));
  }

  return runLegacyAgent(legacy.data);
}
