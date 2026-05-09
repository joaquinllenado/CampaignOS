import { campaignIntelligenceReportSchema, type CampaignAgentState } from "./schema";
import { createModel, getModelName } from "./model";
import {
  errorMessage,
  fallbackAttribution,
  fallbackRecommendations
} from "./deterministicAnalysis";

const CAMPAIGN_STRATEGIST_SYSTEM_PROMPT = `
You are the AI-native influencer campaign intelligence agent described by the project specs.

Operating requirements from REQUIREMENTS.md:
- Use Nia context as source-backed campaign context and Reacher/manual metrics as observed performance data.
- Evaluate campaigns against the business objective, not vanity metrics alone.
- Produce a dynamic KPI framework, creator evaluation, attribution reasoning, and optimization recommendations.
- Distinguish observed metrics, Nia-sourced context, and strategic interpretation.
- Do not fabricate exact numbers or claim access to data that was not supplied.

Awareness framework guidance from AWARENESS_FRAMEWORK.md:
- Awareness is about visibility, audience penetration, creator amplification, attention capture, and sustained reach momentum.
- Separate baseline visibility, strong awareness, and breakout amplification.
- Consider reach quality, engagement density, amplification efficiency, consistency, and breakout potential.
- Views/reach alone are insufficient without resonance, amplification, and sustained attention.

Architecture guidance from SYS_ARCHITECTURE.md:
- Reacher is the data layer for creator metrics, video metrics, GMV attribution, funnel stages, automation performance, and social intelligence.
- Nia is the context layer for campaign briefs, historical learnings, strategy documents, product positioning, creator briefs, benchmark reports, and objective interpretation.
- The intelligence layer performs objective-aware scoring, creator evaluation, funnel diagnostics, attribution analysis, predictive insights, and optimization recommendations.

Return a complete structured campaign intelligence report. Keep the answer concise, evidence-backed, and directly usable by the UI.
`;

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
            "Act as the campaign strategist agent. Nia has already been force-run and its context is in niaContext. Reacher/manual metrics are in metrics. Use the deterministic scorecard as calculation support, then decide the final KPI framework, attribution, and recommendations.",
          input: state.input,
          normalizedBrief,
          niaContext: state.niaContext ?? [],
          metrics: state.reacherMetrics ?? [],
          deterministicKpiFramework: kpiFramework,
          deterministicCreatorEvaluations: state.creatorEvaluations ?? [],
          dataProvenance,
          graphErrors: state.errors
        })
      }
    ]);

    const report = campaignIntelligenceReportSchema.parse({
      ...agentReport,
      objective: normalizedBrief.objective,
      dataProvenance: {
        ...dataProvenance,
        missingInputs: [...new Set([...dataProvenance.missingInputs, ...state.errors])]
      },
      generatedAt: new Date().toISOString(),
      model: getModelName()
    });

    return {
      report,
      kpiFramework: report.kpiFramework,
      attributionInsights: report.attributionInsights,
      recommendations: report.recommendations
    };
  } catch (error) {
    return {
      attributionInsights: fallbackAttribution(state),
      recommendations: fallbackRecommendations(state),
      errors: [`Campaign strategist agent failed, so deterministic fallbacks were used: ${errorMessage(error)}`]
    };
  }
}
