/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CampaignIntelligenceReport, Recommendation } from "../lib/campaignTypes";
import {
  CampaignDashboard,
  draftTextForCopy,
  groupDraftsByTier,
  initialDraftBodies,
  nextDashboardView,
  recommendationSimulationId,
  simulateCampaignFuture,
  sortRecommendations,
  updatedDraftBodies
} from "./CampaignDashboard";

const campaign = {
  name: "Summer Serum Push",
  brand: "NovaSkin",
  product: "Hydrating serum",
  audience: "TikTok Shop skincare buyers",
  budget: "50000",
  brief: "Drive sales with tutorial creators."
};

const high: Recommendation = {
  id: "rec-high",
  priority: "high",
  category: "cta",
  action: "Move the TikTok Shop CTA earlier.",
  rationale: "Sales intent drops before the link appears.",
  expectedImpact: "Improves conversion rate."
};

const medium: Recommendation = {
  id: "rec-medium",
  priority: "medium",
  category: "creative_direction",
  action: "Test product-first hooks.",
  rationale: "Viewers need faster product proof.",
  expectedImpact: "Improves qualified traffic."
};

const low: Recommendation = {
  id: "rec-low",
  priority: "low",
  category: "measurement",
  action: "Add creator notes to the next report.",
  rationale: "Better qualitative evidence improves interpretation.",
  expectedImpact: "Raises future confidence."
};

function report(overrides: Partial<CampaignIntelligenceReport> = {}): CampaignIntelligenceReport {
  return {
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
      summary: "Sales framework",
      confidence: "high",
      metrics: [{ name: "gmv", weight: 100, reason: "Revenue contribution." }],
      evaluationLogic: ["Rank creators by weighted sales signals."]
    },
    objectiveBlend: {
      weights: { awareness: 20, engagement: 20, sales: 60 },
      rationale: "Sales is the primary goal, with engagement and awareness retained as supporting signals.",
      confidence: "high"
    },
    frameworkEvaluations: [{
      objective: "sales",
      framework: {
        objective: "sales",
        summary: "Sales framework",
        confidence: "high",
        metrics: [{ name: "gmv", weight: 100, reason: "Revenue contribution." }],
        evaluationLogic: ["Rank creators by weighted sales signals."]
      },
      metricDefinitions: [{
        name: "gmv",
        displayName: "GMV",
        definition: "Gross merchandise value attributed to the creator.",
        whyItMatters: "It directly measures commercial output.",
        sourceMetricKeys: ["gmv"]
      }],
      campaignScore: 88,
      creatorEvaluations: [{
        creatorName: "Maya Chen",
        score: 88,
        performanceTier: "high",
        tierRationale: "High performer for sales.",
        strongestMetrics: ["gmv"],
        weakestMetrics: [],
        missingMetrics: [],
        confidence: "high"
      }],
      takeaways: ["Maya Chen is the strongest sales performer."],
      confidence: "high"
    }],
    creatorEvaluations: [{
      creatorName: "Maya Chen",
      score: 88,
      rank: 1,
      performanceTier: "high",
      tierRationale: "High performer based on the sales-heavy goal mix.",
      strengths: ["GMV outperformed peers"],
      weaknesses: ["No major weakness"],
      primaryDriver: "gmv",
      primaryDrag: "cpa",
      recommendedAction: "Scale with a product tutorial.",
      confidence: "high"
    }],
    attributionInsights: [{
      claim: "Tutorial content converted best.",
      evidence: ["Maya ranked #1."],
      businessImplication: "Use tutorial creative as the benchmark.",
      confidence: "high"
    }],
    recommendations: [medium, high, low],
    actionHealth: { status: "red", message: "One urgent action needs review." },
    agentActivity: [{
      id: "activity-1",
      kind: "analysis_completed",
      title: "Campaign analysis completed",
      description: "Evaluated the campaign.",
      occurredAt: "2026-05-09T12:00:00.000Z"
    }],
    creatorMessageDrafts: [{
      id: "draft-1",
      creatorName: "Maya Chen",
      creatorHandle: "@mayamakes",
      subject: "Optimization note",
      body: "Original draft body",
      rationale: "Supports the sales objective.",
      suggestionType: "cta",
      linkedRecommendationId: "rec-high"
    }],
    confidence: "high",
    generatedAt: "2026-05-09T12:00:00.000Z",
    model: "deterministic-fallback",
    ...overrides
  };
}

function renderDashboard(nextReport = report(), initialView: "dashboard" | "report" = "dashboard") {
  return renderToStaticMarkup(
    <CampaignDashboard campaign={campaign} report={nextReport} onStartNew={() => undefined} initialView={initialView} />
  );
}

describe("CampaignDashboard", () => {
  test("renders the empty recommended actions state", () => {
    expect(renderDashboard(report({ recommendations: [] }))).toContain("No actions right now.");
  });

  test("renders green, yellow, and red action-health labels", () => {
    expect(renderDashboard(report({ actionHealth: { status: "green", message: "All clear." } }))).toContain("Healthy action health");
    expect(renderDashboard(report({ actionHealth: { status: "yellow", message: "Watch medium actions." } }))).toContain("Watch action health");
    expect(renderDashboard(report({ actionHealth: { status: "red", message: "Urgent action." } }))).toContain("Urgent action health");
  });

  test("orders recommendations by priority", () => {
    expect(sortRecommendations([low, medium, high]).map((item) => item.priority)).toEqual(["high", "medium", "low"]);
  });

  test("supports local draft editing before copy", () => {
    const draft = report().creatorMessageDrafts[0]!;
    const edited = updatedDraftBodies(initialDraftBodies([draft]), draft.id, "Edited draft body");
    expect(draftTextForCopy(draft, edited)).toBe("Edited draft body");
  });

  test("toggles between dashboard and full report views", () => {
    expect(nextDashboardView("dashboard")).toBe("report");
    expect(nextDashboardView("report")).toBe("dashboard");
    expect(renderDashboard(report(), "report")).toContain("Executive report");
  });

  test("renders goal mix, metric meanings, and creator performance tiers", () => {
    const markup = renderDashboard(report());
    expect(markup).toContain("What the scores mean");
    expect(markup).toContain("The percentages below are the goal mix.");
    expect(markup).toContain("60%");
    expect(markup).toContain("Gross merchandise value attributed to the creator.");
    expect(renderDashboard(report(), "report")).toContain("High performer");
  });

  test("renders the future simulation option", () => {
    const markup = renderDashboard(report({
      campaignSummary: {
        totalViews: 100_000,
        avgEngagementRate: 0.05,
        totalOrders: 1_000
      }
    }));
    expect(markup).toContain("Future simulation");
    expect(markup).toContain("What could improve if we take action?");
    expect(markup).toContain("Overall campaign score");
    expect(markup).toContain("This combines your awareness, engagement, and sales scores");
    expect(markup).toContain("Simulate");
  });

  test("projects future metrics and KPI scores from selected recommendations", () => {
    const nextReport = report({
      campaignSummary: {
        totalViews: 100_000,
        avgEngagementRate: 0.05,
        totalOrders: 1_000
      }
    });
    const sorted = sortRecommendations(nextReport.recommendations);
    const selected = new Set([recommendationSimulationId(sorted[0]!, 0)]);
    const simulation = simulateCampaignFuture(nextReport, selected, 60);

    expect(simulation.selectedRecommendations).toHaveLength(1);
    expect(simulation.projectedCompositeScore).toBeGreaterThan(simulation.baselineCompositeScore);
    expect(simulation.projectedSummary?.totalOrders).toBeGreaterThan(nextReport.campaignSummary?.totalOrders ?? 0);
    expect(simulation.metricProjections.some((metric) => metric.key === "totalOrders")).toBe(true);
  });

  test("groups drafts into performance tiers using creator evaluations", () => {
    const drafts = [
      { id: "d1", creatorName: "Maya Chen", body: "x", rationale: "", suggestionType: "cta" as const },
      { id: "d2", creatorName: "Unknown Creator", body: "y", rationale: "", suggestionType: "cta" as const },
      { id: "d3", body: "z", rationale: "", suggestionType: "other" as const }
    ];
    const grouped = groupDraftsByTier(drafts, report().creatorEvaluations);
    expect(grouped.high.map((d) => d.id)).toEqual(["d1"]);
    expect(grouped.average.map((d) => d.id)).toEqual(["d2", "d3"]);
    expect(grouped.low.map((d) => d.id)).toEqual([]);
  });
});