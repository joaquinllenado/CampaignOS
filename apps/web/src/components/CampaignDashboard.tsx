import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CampaignLogo } from "./CampaignLogo";
import { useDemoAutonomousActivity } from "../demo/demoAutonomousPulse";
import { sendOutreachBatch } from "../lib/api";
import type {
  ActionHealth,
  CampaignIntakeFields,
  CampaignIntelligenceReport,
  CampaignMetricSummary,
  CreatorEvaluation,
  CreatorMessageDraft,
  FrameworkEvaluation,
  Recommendation
} from "../lib/campaignTypes";

type DraftTier = "high" | "average" | "low";
type SimulationHorizon = 30 | 60 | 90;
type NumericCampaignMetricKey =
  | "postingCreators"
  | "videosPosted"
  | "totalViews"
  | "avgDailyViews"
  | "peakVisibilityViews"
  | "totalLikes"
  | "totalComments"
  | "avgEngagementRate"
  | "totalOrders"
  | "newCreatorsPosting"
  | "creatorsReached"
  | "creatorsMessaged"
  | "tcInvitesSent";

type SimulationMetricProjection = {
  key: NumericCampaignMetricKey;
  label: string;
  baseline: number;
  projected: number;
  deltaPercent: number;
};

type FutureSimulation = {
  selectedRecommendations: Recommendation[];
  projectedSummary?: CampaignMetricSummary;
  metricProjections: SimulationMetricProjection[];
  baselineCompositeScore: number;
  projectedCompositeScore: number;
  projectedFrameworkScores: Array<{
    objective: FrameworkEvaluation["objective"];
    baseline: number;
    projected: number;
  }>;
  narrative: string;
};

type Props = {
  campaign: CampaignIntakeFields;
  report: CampaignIntelligenceReport;
  onStartNew: () => void;
  initialView?: DashboardView;
  /** When enabled (dev toggle), periodically appends contextual activity alongside the baseline report timeline. */
  demoAutonomousPulse?: boolean;
};

export type DashboardView = "dashboard" | "report";

const healthStyles: Record<ActionHealth["status"], { bg: string; dot: string; label: string }> = {
  green: { bg: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100", dot: "bg-emerald-500", label: "Healthy" },
  yellow: { bg: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100", dot: "bg-amber-500", label: "Watch" },
  red: { bg: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-100", dot: "bg-red-500", label: "Urgent" }
};

const priorityRank: Record<Recommendation["priority"], number> = { high: 0, medium: 1, low: 2 };
const objectiveOrder = ["sales", "engagement", "awareness"] as const;
const simulationHorizons: SimulationHorizon[] = [30, 60, 90];
const simulationHorizonScale: Record<SimulationHorizon, number> = { 30: 0.75, 60: 1, 90: 1.25 };
const tierStyles = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800",
  average: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800",
  low: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800"
};

const prioritySimulationImpact: Record<Recommendation["priority"], number> = {
  high: 0.12,
  medium: 0.07,
  low: 0.035
};

const categoryMetricLift: Record<Recommendation["category"], Partial<Record<NumericCampaignMetricKey, number>>> = {
  creator_mix: {
    postingCreators: 1.15,
    newCreatorsPosting: 1.1,
    videosPosted: 0.9,
    totalViews: 0.85,
    peakVisibilityViews: 0.75,
    creatorsReached: 0.8,
    creatorsMessaged: 0.65
  },
  creative_direction: {
    totalViews: 1,
    avgDailyViews: 0.9,
    peakVisibilityViews: 0.8,
    totalLikes: 0.85,
    totalComments: 0.8,
    avgEngagementRate: 0.75,
    videosPosted: 0.35
  },
  cta: {
    totalOrders: 1.2,
    avgEngagementRate: 0.35,
    totalComments: 0.45,
    totalLikes: 0.25,
    totalViews: 0.2
  },
  budget: {
    totalViews: 0.9,
    avgDailyViews: 0.8,
    peakVisibilityViews: 0.75,
    totalOrders: 0.7,
    creatorsReached: 0.85,
    videosPosted: 0.6
  },
  audience: {
    totalViews: 0.65,
    avgEngagementRate: 0.8,
    totalLikes: 0.65,
    totalComments: 0.7,
    totalOrders: 0.55
  },
  measurement: {
    creatorsMessaged: 0.35,
    tcInvitesSent: 0.3
  }
};

const categoryObjectiveLift: Record<Recommendation["category"], Partial<Record<FrameworkEvaluation["objective"], number>>> = {
  creator_mix: { awareness: 0.9, engagement: 0.55, sales: 0.45 },
  creative_direction: { awareness: 0.8, engagement: 0.9, sales: 0.35 },
  cta: { sales: 1, engagement: 0.45 },
  budget: { awareness: 0.75, sales: 0.55, engagement: 0.35 },
  audience: { awareness: 0.55, engagement: 0.75, sales: 0.5 },
  measurement: { sales: 0.35, engagement: 0.3, awareness: 0.25 }
};

const simulationMetricLabels: Record<NumericCampaignMetricKey, string> = {
  postingCreators: "Posting Creators",
  videosPosted: "Videos Posted",
  totalViews: "Views",
  avgDailyViews: "Avg Daily Views",
  peakVisibilityViews: "Peak Visibility",
  totalLikes: "Likes",
  totalComments: "Comments",
  avgEngagementRate: "Engagement Rate",
  totalOrders: "Orders",
  newCreatorsPosting: "New Creators",
  creatorsReached: "Creators Reached",
  creatorsMessaged: "Creators Messaged",
  tcInvitesSent: "TC Invites"
};

const simulationMetricOrder: NumericCampaignMetricKey[] = [
  "totalViews",
  "avgDailyViews",
  "avgEngagementRate",
  "totalOrders",
  "totalLikes",
  "totalComments",
  "postingCreators",
  "videosPosted",
  "creatorsReached",
  "creatorsMessaged"
];

export function sortRecommendations(recommendations: Recommendation[]) {
  return [...recommendations].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

export function recommendationSimulationId(recommendation: Recommendation, index: number) {
  return recommendation.id ?? `${recommendation.priority}-${recommendation.category}-${index}`;
}

export function initialDraftBodies(drafts: CreatorMessageDraft[]) {
  return Object.fromEntries(drafts.map((draft) => [draft.id, draft.body]));
}

export function updatedDraftBodies(current: Record<string, string>, draftId: string, body: string) {
  return { ...current, [draftId]: body };
}

export function draftTextForCopy(draft: CreatorMessageDraft, draftBodies: Record<string, string>) {
  return draftBodies[draft.id] ?? draft.body;
}

export function nextDashboardView(view: DashboardView): DashboardView {
  return view === "dashboard" ? "report" : "dashboard";
}

const draftTierOrder: DraftTier[] = ["high", "average", "low"];

export function groupDraftsByTier(
  drafts: CreatorMessageDraft[],
  evaluations: CreatorEvaluation[]
): Record<DraftTier, CreatorMessageDraft[]> {
  const tierByName = new Map<string, DraftTier>();
  for (const evaluation of evaluations) {
    tierByName.set(evaluation.creatorName.trim().toLowerCase(), evaluation.performanceTier);
  }
  const groups: Record<DraftTier, CreatorMessageDraft[]> = { high: [], average: [], low: [] };
  for (const draft of drafts) {
    const key = draft.creatorName?.trim().toLowerCase();
    const tier: DraftTier = (key && tierByName.get(key)) || "average";
    groups[tier].push(draft);
  }
  return groups;
}

function titleCase(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function tierLabel(value: "low" | "average" | "high") {
  return `${titleCase(value)} performer`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function roundProjectedMetric(key: NumericCampaignMetricKey, value: number) {
  if (key === "avgEngagementRate") return Math.min(1, Number(value.toFixed(4)));
  return Math.round(value);
}

function formatSimulationMetricValue(key: NumericCampaignMetricKey, value: number) {
  return key === "avgEngagementRate" ? formatPercent(value) : formatCompactNumber(value);
}

function combineMetricLifts(recommendations: Recommendation[], horizon: SimulationHorizon) {
  const lifts: Partial<Record<NumericCampaignMetricKey, number>> = {};
  for (const recommendation of recommendations) {
    const impact = prioritySimulationImpact[recommendation.priority] * simulationHorizonScale[horizon];
    const metricLifts = categoryMetricLift[recommendation.category];
    for (const key of Object.keys(metricLifts) as NumericCampaignMetricKey[]) {
      lifts[key] = Math.min(0.45, (lifts[key] ?? 0) + impact * (metricLifts[key] ?? 0));
    }
  }
  return lifts;
}

function projectCampaignSummary(
  summary: CampaignMetricSummary | undefined,
  recommendations: Recommendation[],
  horizon: SimulationHorizon
): CampaignMetricSummary | undefined {
  if (!summary) return undefined;
  const lifts = combineMetricLifts(recommendations, horizon);
  const projected: CampaignMetricSummary & Partial<Record<NumericCampaignMetricKey, number>> = { ...summary };

  for (const key of Object.keys(lifts) as NumericCampaignMetricKey[]) {
    const baseline = summary[key];
    if (typeof baseline !== "number") continue;
    projected[key] = roundProjectedMetric(key, baseline * (1 + (lifts[key] ?? 0)));
  }

  return projected;
}

function weightedCompositeScore(
  evaluations: Array<{ objective: FrameworkEvaluation["objective"]; campaignScore: number }>,
  weights: CampaignIntelligenceReport["objectiveBlend"]["weights"]
) {
  const totalWeight = evaluations.reduce((sum, evaluation) => sum + (weights[evaluation.objective] ?? 0), 0);
  if (!evaluations.length || totalWeight <= 0) return 0;
  return Math.round(
    evaluations.reduce((sum, evaluation) => sum + evaluation.campaignScore * (weights[evaluation.objective] ?? 0), 0) /
      totalWeight
  );
}

function projectFrameworkScore(
  framework: FrameworkEvaluation,
  recommendations: Recommendation[],
  horizon: SimulationHorizon
) {
  const lift = recommendations.reduce((sum, recommendation) => {
    const priorityLift = prioritySimulationImpact[recommendation.priority] * 100 * 0.55;
    const categoryLift = categoryObjectiveLift[recommendation.category][framework.objective] ?? 0.2;
    return sum + priorityLift * categoryLift * simulationHorizonScale[horizon];
  }, 0);
  return Math.min(100, Math.round(framework.campaignScore + Math.min(16, lift)));
}

export function simulateCampaignFuture(
  report: CampaignIntelligenceReport,
  selectedRecommendationIds: Set<string>,
  horizon: SimulationHorizon
): FutureSimulation {
  const sorted = sortRecommendations(report.recommendations);
  const selectedRecommendations = sorted.filter((recommendation, index) =>
    selectedRecommendationIds.has(recommendationSimulationId(recommendation, index))
  );
  const projectedSummary = projectCampaignSummary(report.campaignSummary, selectedRecommendations, horizon);
  const projectedFrameworkScores = report.frameworkEvaluations.map((framework) => ({
    objective: framework.objective,
    baseline: framework.campaignScore,
    projected: selectedRecommendations.length
      ? projectFrameworkScore(framework, selectedRecommendations, horizon)
      : framework.campaignScore
  }));
  const baselineCompositeScore = weightedCompositeScore(report.frameworkEvaluations, report.objectiveBlend.weights);
  const projectedCompositeScore = weightedCompositeScore(
    projectedFrameworkScores.map((framework) => ({
      objective: framework.objective,
      campaignScore: framework.projected
    })),
    report.objectiveBlend.weights
  );

  const metricProjections = projectedSummary
    ? simulationMetricOrder.flatMap((key) => {
        const baseline = report.campaignSummary?.[key];
        const projected = projectedSummary[key];
        if (typeof baseline !== "number" || typeof projected !== "number" || baseline <= 0) return [];
        return [{
          key,
          label: simulationMetricLabels[key],
          baseline,
          projected,
          deltaPercent: projected / baseline - 1
        }];
      }).slice(0, 6)
    : [];

  const narrative = selectedRecommendations.length
    ? `Applying ${selectedRecommendations.length} recommendation${selectedRecommendations.length === 1 ? "" : "s"} over ${horizon} days projects a ${projectedCompositeScore - baselineCompositeScore >= 0 ? "+" : ""}${projectedCompositeScore - baselineCompositeScore} point move in the overall campaign score.`
    : "Select recommendations to simulate how actioning them could change future performance.";

  return {
    selectedRecommendations,
    projectedSummary,
    metricProjections,
    baselineCompositeScore,
    projectedCompositeScore,
    projectedFrameworkScores,
    narrative
  };
}

function summaryMetricCards(summary: CampaignMetricSummary) {
  return [
    summary.totalViews !== undefined && { label: "Views", value: formatCompactNumber(summary.totalViews) },
    summary.avgDailyViews !== undefined && { label: "Avg Daily Views", value: formatCompactNumber(summary.avgDailyViews) },
    summary.peakVisibilityViews !== undefined && { label: "Peak visibility", value: formatCompactNumber(summary.peakVisibilityViews) },
    summary.totalLikes !== undefined && { label: "Likes", value: formatCompactNumber(summary.totalLikes) },
    summary.totalComments !== undefined && { label: "Comments", value: formatCompactNumber(summary.totalComments) },
    summary.avgEngagementRate !== undefined && { label: "Engagement Rate", value: formatPercent(summary.avgEngagementRate) },
    summary.totalOrders !== undefined && { label: "Orders", value: formatCompactNumber(summary.totalOrders) },
    summary.postingCreators !== undefined && { label: "Posting Creators", value: formatCompactNumber(summary.postingCreators) },
    summary.videosPosted !== undefined && { label: "Videos Posted", value: formatCompactNumber(summary.videosPosted) },
    summary.creatorsMessaged !== undefined && { label: "Creators messaged", value: formatCompactNumber(summary.creatorsMessaged) }
  ].filter((item): item is { label: string; value: string } => Boolean(item));
}

function SectionHeader({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
      {hint ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-stone-200 bg-white p-7 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </section>
  );
}

function FrameworkMetricList({ framework }: { framework: FrameworkEvaluation }) {
  const definitions = new Map(framework.metricDefinitions.map((definition) => [definition.name, definition]));

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titleCase(framework.objective)}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {framework.campaignScore}/100 score · {framework.confidence} confidence
          </p>
        </div>
      </div>
      <ul className="mt-4 max-h-[22rem] space-y-4 overflow-y-auto pr-2">
        {framework.framework.metrics.map((metric) => {
          const definition = definitions.get(metric.name);
          return (
            <li key={`${framework.objective}-${metric.name}`} className="border-t border-stone-200/70 pt-4 text-xs dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {definition?.displayName ?? titleCase(metric.name)}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                  {metric.weight}%
                </span>
              </div>
              <p className="mt-2 leading-5 text-zinc-500 dark:text-zinc-400">
                {definition?.definition ?? metric.reason}
              </p>
              <p className="mt-1.5 leading-5 text-zinc-500 dark:text-zinc-400">
                Why it matters: {definition?.whyItMatters ?? metric.reason}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CampaignDashboard({
  campaign,
  report,
  onStartNew,
  initialView = "dashboard",
  demoAutonomousPulse = false
}: Props) {
  const [view, setView] = useState<DashboardView>(initialView);
  const [draftBodies, setDraftBodies] = useState<Record<string, string>>(() => initialDraftBodies(report.creatorMessageDrafts));
  const [copiedDraftId, setCopiedDraftId] = useState<string | null>(null);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(report.creatorMessageDrafts.map((draft) => draft.id))
  );
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [sendingTier, setSendingTier] = useState<DraftTier | null>(null);
  const [batchFeedback, setBatchFeedback] = useState<Partial<Record<DraftTier, { ok: boolean; message: string }>>>({});
  const [simulationHorizon, setSimulationHorizon] = useState<SimulationHorizon>(60);
  const [selectedSimulationRecommendationIds, setSelectedSimulationRecommendationIds] = useState<Set<string>>(
    () => new Set(sortRecommendations(report.recommendations).map(recommendationSimulationId))
  );

  const activityTimeline = useDemoAutonomousActivity(report.agentActivity, {
    enabled: demoAutonomousPulse,
    reportGeneratedAt: report.generatedAt
  });

  const sortedRecommendations = useMemo(
    () => sortRecommendations(report.recommendations),
    [report.recommendations]
  );
  const health = healthStyles[report.actionHealth.status];
  const campaignSummaryCards = report.campaignSummary ? summaryMetricCards(report.campaignSummary) : [];
  const futureSimulation = useMemo(
    () => simulateCampaignFuture(report, selectedSimulationRecommendationIds, simulationHorizon),
    [report, selectedSimulationRecommendationIds, simulationHorizon]
  );
  const draftsByTier = useMemo(
    () => groupDraftsByTier(report.creatorMessageDrafts, report.creatorEvaluations),
    [report.creatorMessageDrafts, report.creatorEvaluations]
  );

  async function copyDraft(draft: CreatorMessageDraft) {
    const text = draftTextForCopy(draft, draftBodies);
    await navigator.clipboard.writeText(text);
    setCopiedDraftId(draft.id);
    window.setTimeout(() => setCopiedDraftId(null), 1600);
  }

  function toggleDraftSelected(draftId: string) {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(draftId)) next.delete(draftId);
      else next.add(draftId);
      return next;
    });
  }

  function toggleRecommendationSimulation(recommendationId: string) {
    setSelectedSimulationRecommendationIds((prev) => {
      const next = new Set(prev);
      if (next.has(recommendationId)) next.delete(recommendationId);
      else next.add(recommendationId);
      return next;
    });
  }

  function saveDraft(draftId: string) {
    setSavedDraftId(draftId);
    window.setTimeout(() => setSavedDraftId((current) => (current === draftId ? null : current)), 1600);
  }

  async function sendBatch(tier: DraftTier) {
    const tierDrafts = draftsByTier[tier].filter((draft) => selectedDraftIds.has(draft.id));
    if (!tierDrafts.length) {
      setBatchFeedback((prev) => ({ ...prev, [tier]: { ok: false, message: "Select at least one draft to send." } }));
      return;
    }
    setSendingTier(tier);
    setBatchFeedback((prev) => ({ ...prev, [tier]: undefined as never }));
    try {
      const result = await sendOutreachBatch({
        tier,
        campaignName: campaign.name || "Untitled campaign",
        drafts: tierDrafts.map((draft) => ({
          creatorName: draft.creatorName,
          creatorHandle: draft.creatorHandle,
          body: draftTextForCopy(draft, draftBodies)
        }))
      });
      setBatchFeedback((prev) => ({ ...prev, [tier]: { ok: result.ok, message: result.message } }));
    } catch (error) {
      setBatchFeedback((prev) => ({
        ...prev,
        [tier]: { ok: false, message: error instanceof Error ? error.message : "Failed to send batch." }
      }));
    } finally {
      setSendingTier(null);
    }
  }

  const dashboardView = (
    <div className="space-y-6">
      {/* Action health — full width */}
      <section className={`rounded-2xl border p-6 ${health.bg}`}>
        <div className="flex items-start gap-4">
          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${health.dot}`} />
          <div>
            <p className="text-sm font-semibold">{health.label} action health</p>
            <p className="mt-1.5 text-sm leading-6">{report.actionHealth.message}</p>
            <a href="#recommended-actions" className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
              Review recommended actions
            </a>
          </div>
        </div>
      </section>

      {/* 2-column grid: left = snapshot / metrics / framework · right = actions / activity */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ── Left column ── */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
                Performance snapshot
              </span>
            </div>
            <p className="mt-5 text-xl font-medium leading-8 text-zinc-900 dark:text-zinc-100">
              {report.performanceSnapshot}
            </p>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Confidence: {report.confidence} · Data source: {report.dataProvenance.contextSource} context + {report.dataProvenance.metricsSource} metrics
            </p>
          </Card>

          {report.campaignSummary && campaignSummaryCards.length ? (
            <Card>
              <SectionHeader
                eyebrow="Reacher dashboard metrics"
                title="Campaign pull summary"
                hint={[
                  report.campaignSummary.campaignType,
                  report.campaignSummary.campaignWindow,
                  report.campaignSummary.status
                ].filter(Boolean).join(" · ")}
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {campaignSummaryCards.map((metric) => (
                  <div key={metric.label} className="min-w-0 rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{metric.value}</p>
                  </div>
                ))}
              </div>
              {report.campaignSummary.keyTakeaways?.length ? (
                <p className="mt-5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {report.campaignSummary.keyTakeaways[0]}
                </p>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <SectionHeader
              eyebrow="Future simulation"
              title="What could improve if we take action?"
              hint="This projects how selected recommendations could change campaign performance over the next 30, 60, or 90 days."
            />
            <div className="flex flex-wrap items-center gap-2">
              {simulationHorizons.map((horizon) => (
                <button
                  key={horizon}
                  type="button"
                  onClick={() => setSimulationHorizon(horizon)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    simulationHorizon === horizon
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-stone-100 text-zinc-600 ring-1 ring-stone-200 hover:bg-stone-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"
                  }`}
                >
                  {horizon} days
                </button>
              ))}
              <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                {futureSimulation.selectedRecommendations.length} action{futureSimulation.selectedRecommendations.length === 1 ? "" : "s"} selected
              </span>
            </div>
            <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                    Overall campaign score
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {futureSimulation.baselineCompositeScore} → {futureSimulation.projectedCompositeScore}
                  </p>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    This combines your awareness, engagement, and sales scores into one 0-100 score using the goal mix below.
                    A sales-focused campaign weights sales more heavily; an awareness-focused campaign weights reach and visibility more heavily.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800">
                  {futureSimulation.projectedCompositeScore - futureSimulation.baselineCompositeScore >= 0 ? "+" : ""}
                  {futureSimulation.projectedCompositeScore - futureSimulation.baselineCompositeScore} pts
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{futureSimulation.narrative}</p>
            </div>
            {futureSimulation.metricProjections.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {futureSimulation.metricProjections.map((metric) => (
                  <div key={metric.key} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">{metric.label}</p>
                    <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatSimulationMetricValue(metric.key, metric.baseline)} → {formatSimulationMetricValue(metric.key, metric.projected)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatSignedPercent(metric.deltaPercent)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
                Select at least one recommendation with available campaign metrics to see projected performance deltas.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {futureSimulation.projectedFrameworkScores.map((framework) => (
                <div key={framework.objective} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                    {titleCase(framework.objective)} score
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {framework.baseline} → {framework.projected}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Current → projected
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="How this was graded"
              title="What the scores mean"
              hint="The dashboard grades the campaign against three goals, then combines those goal scores based on what matters most for this campaign."
            />
            <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50/60 p-5 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
              <p>
                The percentages below are the goal mix. They explain how much each goal contributes to the overall campaign score.
              </p>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">{report.objectiveBlend.rationale}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {objectiveOrder.map((objective) => (
                <div key={objective} className="rounded-xl border border-stone-200 bg-stone-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {titleCase(objective)} weight
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {report.objectiveBlend.weights[objective]}%
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {report.frameworkEvaluations.map((framework) => (
                <FrameworkMetricList key={framework.objective} framework={framework} />
              ))}
            </div>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          <Card>
            <div id="recommended-actions" />
            <SectionHeader eyebrow="What should I do?" title="Recommended actions" />
            {sortedRecommendations.length ? (
              <ul className="max-h-[40rem] space-y-4 overflow-y-auto pr-2">
                {sortedRecommendations.map((rec, index) => {
                  const simulationId = recommendationSimulationId(rec, index);
                  const checked = selectedSimulationRecommendationIds.has(simulationId);
                  return (
                    <li
                      key={simulationId}
                      className="rounded-xl border border-stone-200 bg-stone-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
                            {rec.priority}
                          </span>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                            {titleCase(rec.category)}
                          </span>
                        </div>
                        <label className="flex shrink-0 items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecommendationSimulation(simulationId)}
                            className="h-4 w-4 rounded border-stone-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          Simulate
                        </label>
                      </div>
                      <p className="mt-3 text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">{rec.action}</p>
                      <p className="mt-1.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {rec.rationale} Expected impact: {rec.expectedImpact}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl bg-stone-50 p-5 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
                No actions right now.
              </p>
            )}
          </Card>

          <Card>
            <SectionHeader eyebrow="What has the agent done?" title="Agent activity" />
            <ol className="max-h-[28rem] space-y-5 overflow-y-auto pr-2">
              {activityTimeline.map((item) => (
                <li key={item.id} className="border-l-2 border-stone-200 pl-4 dark:border-zinc-800">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(item.occurredAt).toLocaleString()}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{item.description}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Drafts — full width */}
      <Card>
        <SectionHeader
          eyebrow="Creator outreach"
          title="Draft messages by performance tier"
          hint="Select the drafts you want to include in each batch, edit as needed, then send the tier through Reacher."
        />
        {report.creatorMessageDrafts.length ? (
          <div className="space-y-4">
            {draftTierOrder.map((tier) => {
              const tierDrafts = draftsByTier[tier];
              const selectedCount = tierDrafts.filter((draft) => selectedDraftIds.has(draft.id)).length;
              const feedback = batchFeedback[tier];
              return (
                <details
                  key={tier}
                  open={tier === "high"}
                  className="group rounded-xl border border-stone-200 bg-stone-50/60 p-4 open:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:open:bg-zinc-900"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${tierStyles[tier]}`}>
                        {tierLabel(tier)}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {tierDrafts.length} draft{tierDrafts.length === 1 ? "" : "s"} · {selectedCount} selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        void sendBatch(tier);
                      }}
                      disabled={sendingTier === tier || !tierDrafts.length}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                    >
                      {sendingTier === tier ? "Sending…" : `Send batch (${selectedCount})`}
                    </button>
                  </summary>
                  {feedback ? (
                    <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${feedback.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200"}`}>
                      {feedback.message}
                    </p>
                  ) : null}
                  {tierDrafts.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-h-[32rem] overflow-y-auto pr-2">
                      {tierDrafts.map((draft) => {
                        const checked = selectedDraftIds.has(draft.id);
                        return (
                          <article
                            key={draft.id}
                            className="rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <label className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleDraftSelected(draft.id)}
                                  className="mt-1 h-4 w-4 rounded border-stone-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                                />
                                <span>
                                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {draft.creatorName ?? "Broadcast"}
                                  </span>
                                  {draft.creatorHandle ? (
                                    <span className="block text-[11px] text-zinc-400 dark:text-zinc-500">{draft.creatorHandle}</span>
                                  ) : null}
                                </span>
                              </label>
                              <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                                {titleCase(draft.suggestionType)}
                              </span>
                            </div>
                            <textarea
                              value={draftBodies[draft.id] ?? draft.body}
                              onChange={(event) => setDraftBodies((prev) => updatedDraftBodies(prev, draft.id, event.target.value))}
                              className="min-h-28 w-full resize-y rounded-lg border border-stone-200 bg-white p-3 text-sm leading-6 text-zinc-700 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
                            />
                            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{draft.rationale}</p>
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveDraft(draft.id)}
                                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                              >
                                {savedDraftId === draft.id ? "Saved" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyDraft(draft)}
                                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                              >
                                {copiedDraftId === draft.id ? "Copied" : "Copy"}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">No drafts in this tier.</p>
                  )}
                </details>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-stone-50 p-5 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
            No creator drafts yet.
          </p>
        )}
      </Card>
    </div>
  );






  const fullReport = (
    <div className="space-y-8">
      <Card>
        <SectionHeader eyebrow="Executive report" title="Summary and KPI framework" />
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{report.executiveSummary}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {report.kpiFramework.metrics.map((metric) => (
            <div
              key={metric.name}
              className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{titleCase(metric.name)}</p>
                <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{metric.weight}%</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{metric.reason}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader eyebrow="Creator ranking" title="Weighted performance labels" />
          <ul className="max-h-[28rem] space-y-3 overflow-y-auto pr-2">
            {report.creatorEvaluations.map((creator) => (
              <li
                key={creator.creatorName}
                className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                  <span>#{creator.rank} {creator.creatorName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tierStyles[creator.performanceTier]}`}>
                    {tierLabel(creator.performanceTier)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{creator.tierRationale}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Driver: {creator.primaryDriver} · Drag: {creator.primaryDrag}
                </p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <SectionHeader eyebrow="Attribution" title="Why results happened" />
          <ul className="max-h-[28rem] space-y-4 overflow-y-auto pr-2">
            {report.attributionInsights.map((insight) => (
              <li key={insight.claim} className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{insight.claim}</span>
                <br />
                {insight.businessImplication}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <details className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Raw structured payload
        </summary>
        <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-stone-50 p-4 text-xs leading-relaxed text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-10">
          <CampaignLogo size="md" className="rounded-lg" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView(nextDashboardView(view))}
              className="rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-stone-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {view === "dashboard" ? "View full report" : "Back to dashboard"}
            </button>
            <button
              type="button"
              onClick={onStartNew}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              New campaign
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto max-w-7xl px-6 py-12 sm:px-10">
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            Post-onboarding dashboard
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
            {campaign.name || "Campaign"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {campaign.brand} · {titleCase(report.objective)} objective · Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>

        {view === "report" ? fullReport : dashboardView}
      </main>
    </div>
  );
}