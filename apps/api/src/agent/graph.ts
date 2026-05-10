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
  campaignStrategistAgentNode,
  composeReportNode,
  fetchReacherMetricsNode,
  normalizeInputNode,
  reasonAboutAttributionNode,
  recommendOptimizationsNode,
  runFrameworkAgentsNode,
  retrieveNiaContextNode
} from "./graphNodes";

const CAMPAIGN_GRAPH_PROGRESS_LABELS = {
  normalizeInput: "Parsing campaign brief",
  retrieveNiaContext: "Retrieving context from your documents",
  fetchReacherMetrics: "Gathering creator performance signals",
  runFrameworkAgents: "Running scorer (funnel weights + KPI frameworks)",
  blendFrameworkScores: "Labeling creator performance tiers",
  campaignStrategistAgent: "Determining market strategy",
  reasonAboutAttribution: "Analyzing attribution",
  recommendOptimizations: "Surfacing optimizations",
  composeReport: "Assembling your campaign report"
} as const;

const CAMPAIGN_GRAPH_STEPS = [
  { node: "normalizeInput" as const, run: normalizeInputNode },
  { node: "retrieveNiaContext" as const, run: retrieveNiaContextNode },
  { node: "fetchReacherMetrics" as const, run: fetchReacherMetricsNode },
  { node: "runFrameworkAgents" as const, run: runFrameworkAgentsNode },
  { node: "blendFrameworkScores" as const, run: blendFrameworkScoresNode },
  { node: "campaignStrategistAgent" as const, run: campaignStrategistAgentNode },
  { node: "reasonAboutAttribution" as const, run: reasonAboutAttributionNode },
  { node: "recommendOptimizations" as const, run: recommendOptimizationsNode },
  { node: "composeReport" as const, run: composeReportNode }
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
  .addNode("blendFrameworkScores", blendFrameworkScoresNode)
  .addNode("campaignStrategistAgent", campaignStrategistAgentNode)
  .addNode("reasonAboutAttribution", reasonAboutAttributionNode)
  .addNode("recommendOptimizations", recommendOptimizationsNode)
  .addNode("composeReport", composeReportNode)
  .addEdge(START, "normalizeInput")
  .addEdge("normalizeInput", "retrieveNiaContext")
  .addEdge("retrieveNiaContext", "fetchReacherMetrics")
  .addEdge("fetchReacherMetrics", "runFrameworkAgents")
  .addEdge("runFrameworkAgents", "blendFrameworkScores")
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
    onProgress({
      node: step.node,
      label: CAMPAIGN_GRAPH_PROGRESS_LABELS[step.node as keyof typeof CAMPAIGN_GRAPH_PROGRESS_LABELS]
    });
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
