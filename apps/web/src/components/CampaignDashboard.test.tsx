/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CampaignIntelligenceReport, Recommendation } from "../lib/campaignTypes";
import type { AllSection } from "./CampaignDashboard";
import {
  CampaignDashboard,
  draftTextForCopy,
  groupDraftsByTier,
  initialDraftBodies,
  updatedDraftBodies
} from "./CampaignDashboard";
import {
  estimatedFrameworkSubScores,
  recommendationSimulationId,
  simulateCampaignFuture,
  sortRecommendations
} from "../lib/futureSimulation";

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

function renderDashboard(nextReport = report(), initialSection: AllSection = "overview") {
  return renderToStaticMarkup(
    <CampaignDashboard campaign={campaign} report={nextReport} onStartNew={() => undefined} initialSection={initialSection} />
  );
}

describe("CampaignDashboard", () => {
  test("renders the empty recommended actions state", () => {
    expect(renderDashboard(report({ recommendations: [] }), "actions")).toContain("No actions right now.");
  });

  test("renders green, yellow, and red action-health labels", () => {
    expect(renderDashboard(report({ actionHealth: { status: "green", message: "All clear." } }))).toContain("Healthy");
    expect(renderDashboard(report({ actionHealth: { status: "yellow", message: "Watch medium actions." } }))).toContain("Needs attention");
    expect(renderDashboard(report({ actionHealth: { status: "red", message: "Urgent action." } }))).toContain("Urgent");
  });

  test("orders recommendations by priority", () => {
    expect(sortRecommendations([low, medium, high]).map((item) => item.priority)).toEqual(["high", "medium", "low"]);
  });

  test("supports local draft editing before copy", () => {
    const draft = report().creatorMessageDrafts[0]!;
    const edited = updatedDraftBodies(initialDraftBodies([draft]), draft.id, "Edited draft body");
    expect(draftTextForCopy(draft, edited)).toBe("Edited draft body");
  });

  test("renders report sections directly from sidebar sections", () => {
    expect(renderDashboard(report(), "summary")).toContain("Executive summary");
    expect(renderDashboard(report(), "creators")).toContain("High performer");
    expect(renderDashboard(report(), "attribution")).toContain("Attribution insights");
    expect(renderDashboard(report(), "kpis")).toContain("KPI framework");
  });

  test("renders goal mix and metric weights in the kpis section", () => {
    const markup = renderDashboard(report(), "kpis");
    expect(markup).toContain("KPI framework");
    expect(markup).toContain("Revenue contribution.");
    expect(markup).toContain("100%");
  });

  test("renders the future simulation section", () => {
    const markup = renderDashboard(report({
      campaignSummary: {
        totalViews: 100_000,
        avgEngagementRate: 0.05,
        totalOrders: 1_000
      }
    }), "simulation");
    expect(markup).toContain("Score projection");
    expect(markup).toContain("Contribution waterfall");
    expect(markup).toContain("KPI frameworks");
    expect(markup).toContain("Simulate");
  });

  test("projects framework scores upward when a relevant recommendation is selected", () => {
    const nextReport = report();
    const sorted = sortRecommendations(nextReport.recommendations);
    const selected = new Set([recommendationSimulationId(sorted[0]!, 0)]);
    const simulation = simulateCampaignFuture(nextReport, selected, 60);

    expect(simulation.selectedRecommendations).toHaveLength(1);
    expect(simulation.projectedCompositeScore).toBeGreaterThanOrEqual(simulation.baselineCompositeScore);
    const sales = simulation.frameworkProjections.find((projection) => projection.objective === "sales");
    expect(sales?.projectedCampaignScore).toBeGreaterThan(sales?.baselineCampaignScore ?? 0);
  });

  test("returns zero delta and the empty-state narrative when no recommendations are selected", () => {
    const simulation = simulateCampaignFuture(report(), new Set(), 60);
    expect(simulation.projectedCompositeScore).toBe(simulation.baselineCompositeScore);
    expect(simulation.contributions).toHaveLength(0);
    expect(simulation.narrative).toContain("Select recommendations");
  });

  test("respects headroom: a high baseline framework score moves less than a low one", () => {
    const sorted = sortRecommendations(report().recommendations);
    const selected = new Set(sorted.map((rec, index) => recommendationSimulationId(rec, index)));
    const high = simulateCampaignFuture(report({
      frameworkEvaluations: [{ ...report().frameworkEvaluations[0]!, campaignScore: 95 }]
    }), selected, 60);
    const low = simulateCampaignFuture(report({
      frameworkEvaluations: [{ ...report().frameworkEvaluations[0]!, campaignScore: 40 }]
    }), selected, 60);
    const highDelta = high.frameworkProjections[0]!.projectedCampaignScore - high.frameworkProjections[0]!.baselineCampaignScore;
    const lowDelta = low.frameworkProjections[0]!.projectedCampaignScore - low.frameworkProjections[0]!.baselineCampaignScore;
    expect(lowDelta).toBeGreaterThan(highDelta);
  });

  test("the confidence band brackets the expected projection", () => {
    const sorted = sortRecommendations(report().recommendations);
    const selected = new Set(sorted.map((rec, index) => recommendationSimulationId(rec, index)));
    const simulation = simulateCampaignFuture(report(), selected, 60);
    expect(simulation.compositeBand.conservative).toBeLessThanOrEqual(simulation.compositeBand.expected);
    expect(simulation.compositeBand.expected).toBeLessThanOrEqual(simulation.compositeBand.optimistic);
  });

  test("a longer horizon realises a larger projected lift", () => {
    const sorted = sortRecommendations(report().recommendations);
    const selected = new Set(sorted.map((rec, index) => recommendationSimulationId(rec, index)));
    const short = simulateCampaignFuture(report(), selected, 30);
    const long = simulateCampaignFuture(report(), selected, 90);
    expect(long.projectedCompositeScore).toBeGreaterThanOrEqual(short.projectedCompositeScore);
  });

  test("flags recommendations that target metrics not in any framework as unmodeled", () => {
    const measurement: Recommendation = {
      id: "rec-measure",
      priority: "low",
      category: "measurement",
      action: "Track add-to-cart drop-off",
      rationale: "Better attribution.",
      expectedImpact: "Improves clarity."
    };
    const reportWithUnmappedFramework = report({
      recommendations: [measurement],
      frameworkEvaluations: [{
        ...report().frameworkEvaluations[0]!,
        framework: {
          ...report().frameworkEvaluations[0]!.framework,
          metrics: [{ name: "gmv", weight: 100, reason: "Revenue contribution." }]
        }
      }]
    });
    const selected = new Set([recommendationSimulationId(measurement, 0)]);
    const simulation = simulateCampaignFuture(reportWithUnmappedFramework, selected, 60);
    expect(simulation.unmodeledRecommendations).toHaveLength(1);
    expect(simulation.contributions[0]?.unmodeled).toBe(true);
    expect(simulation.narrative).toContain("not weighted in this campaign's KPI frameworks");
  });

  test("estimates per-metric sub-scores from creator evidence flags", () => {
    const framework = report().frameworkEvaluations[0]!;
    const subScores = estimatedFrameworkSubScores(framework);
    expect(subScores).toHaveLength(framework.framework.metrics.length);
    const gmv = subScores.find((item) => item.metricName === "gmv")!;
    // gmv was flagged as a strength for the lone creator, so its sub-score should be at or above the framework score.
    expect(gmv.baselineSubScore).toBeGreaterThanOrEqual(framework.campaignScore);
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