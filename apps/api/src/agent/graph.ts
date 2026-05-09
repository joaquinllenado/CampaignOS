import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  type AttributionInsight,
  type CampaignAgentBody,
  type CampaignAgentState,
  type CampaignIntelligenceReport,
  type CampaignMetricSummary,
  type CreatorEvaluation,
  type CreatorMessageDraft,
  type CreatorMetricInputPayload,
  type DataProvenance,
  type FrameworkEvaluation,
  type KpiFramework,
  type NiaContextResult,
  type NormalizedCampaignBrief,
  type ObjectiveBlend,
  type Recommendation
} from "./schema";
import {
  blendFrameworkScoresNode,
  calculateObjectiveBlendNode,
  campaignStrategistAgentNode,
  composeReportNode,
  fetchReacherMetricsNode,
  normalizeInputNode,
  reasonAboutAttributionNode,
  recommendOptimizationsNode,
  runFrameworkAgentsNode,
  retrieveNiaContextNode
} from "./graphNodes";

const CAMPAIGN_GRAPH_PROGRESS_LABELS: Record<string, string> = {
  normalizeInput: "Parsing campaign brief",
  retrieveNiaContext: "Retrieving context from your documents",
  fetchReacherMetrics: "Gathering creator performance signals",
  runFrameworkAgents: "Running awareness, engagement, and sales frameworks",
  calculateObjectiveBlend: "Calculating campaign goal mix",
  blendFrameworkScores: "Labeling creator performance tiers",
  campaignStrategistAgent: "Determining market strategy",
  reasonAboutAttribution: "Analyzing attribution",
  recommendOptimizations: "Surfacing optimizations",
  composeReport: "Assembling your campaign report"
};

const CAMPAIGN_GRAPH_STEPS = [
  { node: "normalizeInput", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.normalizeInput, run: normalizeInputNode },
  { node: "retrieveNiaContext", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.retrieveNiaContext, run: retrieveNiaContextNode },
  { node: "fetchReacherMetrics", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.fetchReacherMetrics, run: fetchReacherMetricsNode },
  { node: "runFrameworkAgents", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.runFrameworkAgents, run: runFrameworkAgentsNode },
  { node: "calculateObjectiveBlend", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.calculateObjectiveBlend, run: calculateObjectiveBlendNode },
  { node: "blendFrameworkScores", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.blendFrameworkScores, run: blendFrameworkScoresNode },
  { node: "campaignStrategistAgent", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.campaignStrategistAgent, run: campaignStrategistAgentNode },
  { node: "reasonAboutAttribution", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.reasonAboutAttribution, run: reasonAboutAttributionNode },
  { node: "recommendOptimizations", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.recommendOptimizations, run: recommendOptimizationsNode },
  { node: "composeReport", label: CAMPAIGN_GRAPH_PROGRESS_LABELS.composeReport, run: composeReportNode }
] as const;

const CampaignAgentAnnotation = Annotation.Root({
  input: Annotation<CampaignAgentBody>(),
  normalizedBrief: Annotation<NormalizedCampaignBrief | undefined>(),
  niaContext: Annotation<NiaContextResult[] | undefined>(),
  reacherMetrics: Annotation<CreatorMetricInputPayload[] | undefined>(),
  campaignSummary: Annotation<CampaignMetricSummary | undefined>(),
  kpiFramework: Annotation<KpiFramework | undefined>(),
  objectiveBlend: Annotation<ObjectiveBlend | undefined>(),
  frameworkEvaluations: Annotation<FrameworkEvaluation[] | undefined>(),
  creatorEvaluations: Annotation<CreatorEvaluation[] | undefined>(),
  attributionInsights: Annotation<AttributionInsight[] | undefined>(),
  recommendations: Annotation<Recommendation[] | undefined>(),
  creatorMessageDrafts: Annotation<CreatorMessageDraft[] | undefined>(),
  report: Annotation<CampaignIntelligenceReport | undefined>(),
  dataProvenance: Annotation<DataProvenance | undefined>(),
  errors: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  })
});

const graph = new StateGraph(CampaignAgentAnnotation)
  .addNode("normalizeInput", normalizeInputNode)
  .addNode("retrieveNiaContext", retrieveNiaContextNode)
  .addNode("fetchReacherMetrics", fetchReacherMetricsNode)
  .addNode("runFrameworkAgents", runFrameworkAgentsNode)
  .addNode("calculateObjectiveBlend", calculateObjectiveBlendNode)
  .addNode("blendFrameworkScores", blendFrameworkScoresNode)
  .addNode("campaignStrategistAgent", campaignStrategistAgentNode)
  .addNode("reasonAboutAttribution", reasonAboutAttributionNode)
  .addNode("recommendOptimizations", recommendOptimizationsNode)
  .addNode("composeReport", composeReportNode)
  .addEdge(START, "normalizeInput")
  .addEdge("normalizeInput", "retrieveNiaContext")
  .addEdge("retrieveNiaContext", "fetchReacherMetrics")
  .addEdge("fetchReacherMetrics", "runFrameworkAgents")
  .addEdge("runFrameworkAgents", "calculateObjectiveBlend")
  .addEdge("calculateObjectiveBlend", "blendFrameworkScores")
  .addEdge("blendFrameworkScores", "campaignStrategistAgent")
  .addEdge("campaignStrategistAgent", "reasonAboutAttribution")
  .addEdge("reasonAboutAttribution", "recommendOptimizations")
  .addEdge("recommendOptimizations", "composeReport")
  .addEdge("composeReport", END)
  .compile();

export async function runCampaignGraph(input: CampaignAgentBody): Promise<CampaignIntelligenceReport> {
  const finalState = await graph.invoke({ input, errors: [] });

  if (!finalState.report) {
    throw new Error("Agent graph completed without a report.");
  }

  return finalState.report;
}

export async function streamCampaignGraphRun(
  input: CampaignAgentBody,
  onProgress: (event: { node: string; label: string }) => void
): Promise<CampaignIntelligenceReport> {
  let state: CampaignAgentState = { input, errors: [] };

  for (const step of CAMPAIGN_GRAPH_STEPS) {
    onProgress({ node: step.node, label: step.label });
    const update = await step.run(state);
    state = {
      ...state,
      ...update,
      errors: update.errors ? [...state.errors, ...update.errors] : state.errors
    };
  }

  if (!state.report) {
    throw new Error("Agent graph completed without a report.");
  }

  return state.report;
}
