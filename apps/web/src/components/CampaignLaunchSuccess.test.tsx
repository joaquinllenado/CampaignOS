/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CampaignIntelligenceReport } from "../lib/campaignTypes";
import { CampaignLaunchSuccess } from "./CampaignLaunchSuccess";

const campaign = {
  name: "Summer Serum Push",
  brand: "NovaSkin",
  product: "Hydrating serum",
  audience: "TikTok Shop skincare buyers",
  budget: "50000",
  brief: "Drive sales with tutorial creators."
};

const report: CampaignIntelligenceReport = {
  executiveSummary: "Maya leads the sales campaign.",
  performanceSnapshot: "Maya leads the sales scorecard at 88/100 using demo metrics.",
  objective: "sales",
  dataProvenance: {
    contextSource: "brief_only",
    metricsSource: "demo",
    niaSourcesUsed: [],
    reacherObjectsUsed: [],
    missingInputs: []
  },
  kpiFramework: {
    objective: "sales",
    summary: "Sales framework focused on revenue-producing creator actions.",
    confidence: "high",
    metrics: [
      { name: "gmv", weight: 70, reason: "Revenue contribution." },
      { name: "orders", weight: 30, reason: "Purchase volume." }
    ],
    evaluationLogic: ["Rank creators by weighted sales signals."]
  },
  objectiveBlend: {
    weights: { awareness: 20, engagement: 20, sales: 60 },
    rationale: "Sales is the primary goal.",
    confidence: "high"
  },
  frameworkEvaluations: [],
  creatorEvaluations: [],
  attributionInsights: [],
  recommendations: [],
  actionHealth: { status: "green", message: "All clear." },
  agentActivity: [],
  creatorMessageDrafts: [],
  confidence: "high",
  generatedAt: "2026-05-09T12:00:00.000Z",
  model: "deterministic-fallback"
};

describe("CampaignLaunchSuccess", () => {
  test("renders campaign direction, generated KPIs, and dashboard CTA", () => {
    const markup = renderToStaticMarkup(
      <CampaignLaunchSuccess campaign={campaign} report={report} onContinue={() => undefined} />
    );

    expect(markup).toContain("Campaign direction");
    expect(markup).toContain("Sales");
    expect(markup).toContain("Generated KPIs");
    expect(markup).toContain("GMV");
    expect(markup).toContain("Orders");
    expect(markup).toContain("Continue to dashboard");
  });
});
