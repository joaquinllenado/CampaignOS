import type { CampaignAgentState } from "./schema";
import { retrieveNiaContextWithTool } from "./niaContextTool";
import { fetchReacherMetrics } from "../integrations/reacher";
import { detectObjective, detectObjectiveAfterNia, normalizeInput } from "./objective";
import {
  composeReport,
  evaluateCreators,
  generateKpiFramework,
  reasonAboutAttribution,
  recommendOptimizations
} from "./deterministicAnalysis";
import { runCampaignStrategistAgent } from "./campaignStrategistAgent";

export function normalizeInputNode(state: CampaignAgentState): Partial<CampaignAgentState> {
  return { normalizedBrief: normalizeInput(state) };
}

export async function retrieveNiaContextNode(
  state: CampaignAgentState
): Promise<Partial<CampaignAgentState>> {
  const result = await retrieveNiaContextWithTool(state.input);
  const missingInputs = state.normalizedBrief?.missingInputs ?? [];

  const normalizedBrief =
    state.normalizedBrief && state.input.campaign.objective === "auto"
      ? {
          ...state.normalizedBrief,
          objective: detectObjectiveAfterNia(state.input, result.context)
        }
      : state.normalizedBrief;

  return {
    niaContext: result.context,
    normalizedBrief,
    dataProvenance: {
      contextSource: result.context.length ? "nia" : "brief_only",
      metricsSource: "demo",
      niaSourcesUsed: result.sourcesUsed,
      reacherObjectsUsed: [],
      missingInputs
    },
    errors: result.errors
  };
}

export async function fetchReacherMetricsNode(
  state: CampaignAgentState
): Promise<Partial<CampaignAgentState>> {
  const objective = state.normalizedBrief?.objective ?? detectObjective(state.input);
  const result = await fetchReacherMetrics(state.input, objective);
  const previousProvenance = state.dataProvenance;

  return {
    reacherMetrics: result.metrics,
    dataProvenance: {
      contextSource: previousProvenance?.contextSource ?? "brief_only",
      metricsSource: result.source,
      niaSourcesUsed: previousProvenance?.niaSourcesUsed ?? [],
      reacherObjectsUsed: result.objectsUsed,
      missingInputs: previousProvenance?.missingInputs ?? []
    },
    errors: result.errors
  };
}

export const generateKpiFrameworkNode = generateKpiFramework;
export const evaluateCreatorsNode = evaluateCreators;
export const campaignStrategistAgentNode = runCampaignStrategistAgent;
export const reasonAboutAttributionNode = reasonAboutAttribution;
export const recommendOptimizationsNode = recommendOptimizations;
export const composeReportNode = composeReport;
