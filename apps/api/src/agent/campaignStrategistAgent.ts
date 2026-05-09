import { campaignIntelligenceReportSchema, type CampaignAgentState } from "./schema";
import { createModel, getModelName } from "./model";
import {
  errorMessage,
  fallbackAttribution,
  fallbackRecommendations
} from "./deterministicAnalysis";
import {
  compactCampaignSummaryForLlm,
  compactCompositeCreatorEvaluationsForLlm,
  compactCreatorMetricsForLlm,
  compactGraphErrorsForLlm,
  compactNormalizedBriefForLlm,
  compactNiaContextForLlm,
  slimFrameworkEvaluationsForLlm
} from "./llmContextCompact";

const CAMPAIGN_STRATEGIST_SYSTEM_PROMPT = `CampaignOS strategist. You receive normalizedBrief, Nia excerpts, creator metrics (Reacher/manual), deterministic KPI framework, blended objective weights, slim per-framework evaluations, composite creator tiers, optional campaignSummary, provenance, and graphErrors.

Rules: Separate observed metrics vs sourced context vs inference. Tie evaluation to business objective—not vanity alone. Preserve deterministic objectiveBlend, frameworkEvaluations shape, and creator tiers unless schema-safe refinement is justified. Labels: low/average/high performer only. Fill dashboard fields including performanceSnapshot, actionHealth, agentActivity, creatorMessageDrafts—drafts are unsent suggestions (compose may regenerate per-creator outreach after recommendations land). Never invent numbers or data; use campaignSummary as campaign-level evidence only and keep rankings from creator-level metrics. Brief, evidence-grounded prose.`;

export async function runCampaignStrategistAgent(
  state: CampaignAgentState
): Promise<Partial<CampaignAgentState>> {
  const normalizedBrief = state.normalizedBrief;
  const kpiFramework = state.kpiFramework;
  const dataProvenance = state.dataProvenance;

  if (!normalizedBrief || !kpiFramework || !dataProvenance) {
    return { errors: ["Campaign strategist agent skipped because graph state was incomplete."] };
  }

  const model = createModel();
  if (!model) {
    return {
      attributionInsights: fallbackAttribution(state),
      recommendations: fallbackRecommendations(state)
    };
  }

  try {
    const structuredModel = model.withStructuredOutput(campaignIntelligenceReportSchema);
    const agentReport = await structuredModel.invoke([
      {
        role: "system",
        content: CAMPAIGN_STRATEGIST_SYSTEM_PROMPT
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Nia excerpts are niaContext; creator metrics are metrics. Use deterministicKpiFramework, deterministicObjectiveBlend, deterministicFrameworkEvaluationsSlim and deterministicCompositeCreatorEvaluations as the score baseline. objectiveBlend.weights must sum to 100. Keep metric definitions coherent with the KPI framework.",
          normalizedBrief: compactNormalizedBriefForLlm(normalizedBrief),
          niaContext: compactNiaContextForLlm(state.niaContext ?? []),
          metrics: compactCreatorMetricsForLlm(state.reacherMetrics ?? []),
          campaignSummary: compactCampaignSummaryForLlm(state.campaignSummary),
          deterministicKpiFramework: kpiFramework,
          deterministicObjectiveBlend: state.objectiveBlend,
          deterministicFrameworkEvaluationsSlim: slimFrameworkEvaluationsForLlm(state.frameworkEvaluations ?? []),
          deterministicCompositeCreatorEvaluations: compactCompositeCreatorEvaluationsForLlm(
            state.creatorEvaluations ?? []
          ),
          dataProvenance,
          graphErrors: compactGraphErrorsForLlm(state.errors)
        })
      }
    ]);

    const report = campaignIntelligenceReportSchema.parse({
      ...agentReport,
      objective: normalizedBrief.objective,
      kpiFramework,
      objectiveBlend: state.objectiveBlend ?? agentReport.objectiveBlend,
      frameworkEvaluations: state.frameworkEvaluations ?? agentReport.frameworkEvaluations,
      creatorEvaluations: state.creatorEvaluations ?? agentReport.creatorEvaluations,
      dataProvenance: {
        ...dataProvenance,
        missingInputs: [...new Set([...dataProvenance.missingInputs, ...state.errors])]
      },
      campaignSummary: state.campaignSummary,
      generatedAt: new Date().toISOString(),
      model: getModelName()
    });

    return {
      report,
      kpiFramework: report.kpiFramework,
      objectiveBlend: report.objectiveBlend,
      frameworkEvaluations: report.frameworkEvaluations,
      attributionInsights: report.attributionInsights,
      recommendations: report.recommendations,
      creatorMessageDrafts: report.creatorMessageDrafts
    };
  } catch (error) {
    return {
      attributionInsights: fallbackAttribution(state),
      recommendations: fallbackRecommendations(state),
      errors: [`Campaign strategist agent failed, so deterministic fallbacks were used: ${errorMessage(error)}`]
    };
  }
}
