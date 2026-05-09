import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  type AttributionInsight,
  type CampaignAgentBody,
  type CampaignIntelligenceReport,
  type CreatorEvaluation,
  type CreatorMetricInputPayload,
  type DataProvenance,
  type KpiFramework,
  type NiaContextResult,
  type NormalizedCampaignBrief,
  type Recommendation
} from "./schema";
import {
  campaignStrategistAgentNode,
  composeReportNode,
  evaluateCreatorsNode,
  fetchReacherMetricsNode,
  generateKpiFrameworkNode,
  normalizeInputNode,
  reasonAboutAttributionNode,
  recommendOptimizationsNode,
  retrieveNiaContextNode
} from "./graphNodes";

const CampaignAgentAnnotation = Annotation.Root({
  input: Annotation<CampaignAgentBody>(),
  normalizedBrief: Annotation<NormalizedCampaignBrief | undefined>(),
  niaContext: Annotation<NiaContextResult[] | undefined>(),
  reacherMetrics: Annotation<CreatorMetricInputPayload[] | undefined>(),
  kpiFramework: Annotation<KpiFramework | undefined>(),
  creatorEvaluations: Annotation<CreatorEvaluation[] | undefined>(),
  attributionInsights: Annotation<AttributionInsight[] | undefined>(),
  recommendations: Annotation<Recommendation[] | undefined>(),
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
  .addNode("generateKpiFramework", generateKpiFrameworkNode)
  .addNode("evaluateCreators", evaluateCreatorsNode)
  .addNode("campaignStrategistAgent", campaignStrategistAgentNode)
  .addNode("reasonAboutAttribution", reasonAboutAttributionNode)
  .addNode("recommendOptimizations", recommendOptimizationsNode)
  .addNode("composeReport", composeReportNode)
  .addEdge(START, "normalizeInput")
  .addEdge("normalizeInput", "retrieveNiaContext")
  .addEdge("retrieveNiaContext", "fetchReacherMetrics")
  .addEdge("fetchReacherMetrics", "generateKpiFramework")
  .addEdge("generateKpiFramework", "evaluateCreators")
  .addEdge("evaluateCreators", "campaignStrategistAgent")
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
