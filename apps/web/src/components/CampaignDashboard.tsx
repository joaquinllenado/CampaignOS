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
} from "../lib/campaignTypes";
import {
  recommendationSimulationId,
  simulateCampaignFuture,
  sortRecommendations,
  SIMULATION_HORIZONS,
  type SimulationHorizon,
  type RecommendationContribution,
} from "../lib/futureSimulation";

type DraftTier = "high" | "average" | "low";

type Props = {
  campaign: CampaignIntakeFields;
  report: CampaignIntelligenceReport;
  onStartNew: () => void;
  initialSection?: AllSection;
  demoAutonomousPulse?: boolean;
};

type DashboardSection = "overview" | "simulation" | "actions" | "activity" | "outreach";
type ReportSection = "kpis" | "summary" | "creators" | "attribution";
export type AllSection = DashboardSection | ReportSection;

const neutralPillChip =
  "bg-stone-100 text-zinc-800 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600";

const healthStyles: Record<ActionHealth["status"], { bg: string; dot: string; label: string; accent: string }> = {
  green: { bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/60", dot: "bg-emerald-500", label: "Healthy", accent: "text-emerald-700 dark:text-emerald-300" },
  yellow: { bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/60", dot: "bg-amber-500", label: "Needs attention", accent: "text-amber-700 dark:text-amber-300" },
  red: { bg: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/60", dot: "bg-red-500", label: "Urgent", accent: "text-red-700 dark:text-red-300" },
};

const objectiveOrder = ["sales", "engagement", "awareness"] as const;

const overviewMiniPanelClass =
  "flex h-full min-h-0 flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const overviewMiniPanelHeaderClass = "mb-3 flex min-h-[1.125rem] items-center justify-between gap-2";
const overviewMiniChipClass =
  "flex min-h-0 min-w-0 flex-col justify-between rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40";
const overviewObjectiveChipGridClass = "grid flex-1 auto-rows-fr gap-2";

/** Shared chip for Goal weights vs Objective scores so layout, type scale, and row rhythm match exactly. */
function OverviewObjectivePairChip({
  label,
  primary,
  caption,
  primarySuffix,
}: {
  label: string;
  primary: ReactNode;
  caption?: string;
  primarySuffix?: ReactNode;
}) {
  return (
    <div className={overviewMiniChipClass}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <div>
        <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-0">
          <span className="text-3xl font-bold tabular-nums leading-none tracking-tight text-zinc-900 dark:text-zinc-100">
            {primary}
          </span>
          {primarySuffix != null ? (
            <span className="text-[11px] font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">{primarySuffix}</span>
          ) : null}
        </div>
        <p className="mt-1.5 min-h-[14px] text-[10px] capitalize leading-none text-zinc-400 dark:text-zinc-500">
          {caption ? caption : "\u00a0"}
        </p>
      </div>
    </div>
  );
}
const tierStyles = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800",
  average: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800",
  low: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800",
};

export function initialDraftBodies(drafts: CreatorMessageDraft[]) {
  return Object.fromEntries(drafts.map((draft) => [draft.id, draft.body]));
}

export function updatedDraftBodies(current: Record<string, string>, draftId: string, body: string) {
  return { ...current, [draftId]: body };
}

export function draftTextForCopy(draft: CreatorMessageDraft, draftBodies: Record<string, string>) {
  return draftBodies[draft.id] ?? draft.body;
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

function formatSignedPoints(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(1)} pts`;
}


function summaryMetricCards(summary: CampaignMetricSummary) {
  return [
    summary.totalViews !== undefined && { label: "Views", value: formatCompactNumber(summary.totalViews) },
    summary.avgDailyViews !== undefined && { label: "Daily Views", value: formatCompactNumber(summary.avgDailyViews) },
    summary.peakVisibilityViews !== undefined && { label: "Peak Views", value: formatCompactNumber(summary.peakVisibilityViews) },
    summary.totalLikes !== undefined && { label: "Likes", value: formatCompactNumber(summary.totalLikes) },
    summary.totalComments !== undefined && { label: "Comments", value: formatCompactNumber(summary.totalComments) },
    summary.avgEngagementRate !== undefined && { label: "Eng. Rate", value: formatPercent(summary.avgEngagementRate) },
    summary.totalOrders !== undefined && { label: "Orders", value: formatCompactNumber(summary.totalOrders) },
    summary.postingCreators !== undefined && { label: "Posting", value: formatCompactNumber(summary.postingCreators) },
    summary.videosPosted !== undefined && { label: "Videos", value: formatCompactNumber(summary.videosPosted) },
    summary.creatorsMessaged !== undefined && { label: "Messaged", value: formatCompactNumber(summary.creatorsMessaged) }
  ].filter((item): item is { label: string; value: string } => Boolean(item));
}

function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </section>
  );
}

function SectionHeading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</h3>
      {sub && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{sub}</p>}
    </div>
  );
}

function Icon({ path, className = "h-4 w-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

const ICONS = {
  overview:    "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z",
  simulation:  "M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941",
  actions:     "m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z",
  activity:    "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  outreach:    "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
  summary:     "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  creators:    "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  attribution: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z",
  new:         "M12 4.5v15m7.5-7.5h-15",
  chevLeft:    "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5",
  chevRight:   "M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5",
};

function FrameworkMetricList({ framework }: { framework: FrameworkEvaluation }) {
  const definitions = new Map(framework.metricDefinitions.map((d) => [d.name, d]));
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{titleCase(framework.objective)}</p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{framework.confidence} confidence</p>
        </div>
        <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{framework.campaignScore}</span>
      </div>
      <ul className="mt-3 max-h-[20rem] space-y-2.5 overflow-y-auto pr-1">
        {framework.framework.metrics.map((metric) => {
          const def = definitions.get(metric.name);
          return (
            <li key={`${framework.objective}-${metric.name}`} className="border-t border-stone-200/70 pt-2.5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {def?.displayName ?? titleCase(metric.name)}
                </span>
                <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
                  {metric.weight}%
                </span>
              </div>
              {def?.definition && (
                <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{def.definition}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ContributionRow({
  contribution,
  maxAbsContribution
}: {
  contribution: RecommendationContribution;
  maxAbsContribution: number;
}) {
  const widthPercent = Math.min(100, (Math.abs(contribution.compositePoints) / maxAbsContribution) * 100);
  const positive = contribution.compositePoints >= 0;
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-zinc-100 dark:text-zinc-900">
              {contribution.recommendation.priority}
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
              {titleCase(contribution.recommendation.category)}
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100">{contribution.recommendation.action}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${positive ? "bg-stone-100 text-zinc-800 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-600" : "bg-stone-100 text-zinc-500 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700"}`}>
          {formatSignedPoints(contribution.compositePoints)}
        </span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full ${positive ? "bg-zinc-600 dark:bg-zinc-400" : "bg-stone-300 dark:bg-zinc-600"}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        {contribution.perFrameworkPoints.filter((e) => Math.abs(e.points) >= 0.05).map((e) => (
          <span key={e.objective}>{titleCase(e.objective)} {formatSignedPoints(e.points)}</span>
        ))}
        {contribution.unmodeled && <span className="text-zinc-600 dark:text-zinc-400">Outside framework</span>}
      </div>
      {contribution.perMetricLifts.length ? (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <span className="group-open:hidden">Show math ↓</span>
            <span className="hidden group-open:inline">Hide ↑</span>
          </summary>
          <table className="mt-2 w-full text-left text-[11px]">
            <thead className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <tr>
                <th className="py-1 pr-2 font-semibold">Framework</th>
                <th className="py-1 pr-2 font-semibold">Metric</th>
                <th className="py-1 pr-2 font-semibold">Wt</th>
                <th className="py-1 pr-2 font-semibold">Sub-score</th>
                <th className="py-1 text-right font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody className="text-zinc-600 dark:text-zinc-300">
              {contribution.perMetricLifts.map((lift) => (
                <tr key={`${lift.objective}-${lift.metricName}`} className="border-t border-stone-100 dark:border-zinc-800">
                  <td className="py-1 pr-2">{titleCase(lift.objective)}</td>
                  <td className="py-1 pr-2">{titleCase(lift.metricName)}</td>
                  <td className="py-1 pr-2">{lift.weight}%</td>
                  <td className="py-1 pr-2">{lift.subScoreBefore}→{lift.subScoreAfter}</td>
                  <td className="py-1 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatSignedPoints(lift.pointContributionToFramework)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </li>
  );
}

export function CampaignDashboard({
  campaign,
  report,
  onStartNew,
  initialSection = "overview",
  demoAutonomousPulse = false
}: Props) {
  const [activeSection, setActiveSection] = useState<AllSection>(initialSection);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const sortedRecommendations = useMemo(() => sortRecommendations(report.recommendations), [report.recommendations]);
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

  const evaluationByObjective = useMemo(
    () => new Map(report.frameworkEvaluations.map((fw) => [fw.objective, fw])),
    [report.frameworkEvaluations]
  );

  async function copyDraft(draft: CreatorMessageDraft) {
    await navigator.clipboard.writeText(draftTextForCopy(draft, draftBodies));
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
    window.setTimeout(() => setSavedDraftId((c) => (c === draftId ? null : c)), 1600);
  }

  async function sendBatch(tier: DraftTier) {
    const tierDrafts = draftsByTier[tier].filter((d) => selectedDraftIds.has(d.id));
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
        drafts: tierDrafts.map((d) => ({ creatorName: d.creatorName, creatorHandle: d.creatorHandle, body: draftTextForCopy(d, draftBodies) }))
      });
      setBatchFeedback((prev) => ({ ...prev, [tier]: { ok: result.ok, message: result.message } }));
    } catch (error) {
      setBatchFeedback((prev) => ({ ...prev, [tier]: { ok: false, message: error instanceof Error ? error.message : "Failed to send batch." } }));
    } finally {
      setSendingTier(null);
    }
  }

  // ── Section content ──────────────────────────────────────────────────────────

  const recPriorityStyles = {
    high: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    medium: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
    low: "bg-stone-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  } as const;

  const overviewSection = (
    <div className="space-y-4">
      {/* Health banner — compact inline strip */}
      <section className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${health.bg}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${health.dot}`} />
        <p className={`flex-1 text-xs font-medium text-zinc-700 dark:text-zinc-300`}>
          <span className={`font-semibold ${health.accent}`}>{health.label} · </span>
          {report.actionHealth.message}
        </p>
        <button type="button" onClick={() => setActiveSection("actions")} className={`shrink-0 text-xs font-semibold underline underline-offset-4 ${health.accent}`}>
          View actions →
        </button>
      </section>

      {/* Metric stat cards row — auto-fill so cards always span full width */}
      {campaignSummaryCards.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(campaignSummaryCards.length, 8)}, minmax(0, 1fr))` }}>
          {campaignSummaryCards.slice(0, 8).map((metric) => (
            <div key={metric.label} className="rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">{metric.label}</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{metric.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Performance snapshot — full width */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Performance snapshot</span>
          <span className="text-[11px] capitalize text-zinc-400 dark:text-zinc-500">{report.confidence} confidence</span>
        </div>
        <p className="text-base font-medium leading-7 text-zinc-900 dark:text-zinc-100">{report.performanceSnapshot}</p>
      </Card>

      {/* Goal weights · Objective scores: equal-width panels; columns locked to sales→engagement→awareness */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className={overviewMiniPanelClass}>
          <div className={overviewMiniPanelHeaderClass}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              Goal weights
            </span>
            <span className="text-[11px] capitalize text-zinc-400 dark:text-zinc-500">{report.objectiveBlend.confidence}</span>
          </div>
          <div
            className={overviewObjectiveChipGridClass}
            style={{
              gridTemplateColumns: `repeat(${objectiveOrder.length}, minmax(0, 1fr))`,
            }}
          >
            {objectiveOrder.map((objective) => (
              <OverviewObjectivePairChip
                key={objective}
                label={titleCase(objective)}
                primary={`${report.objectiveBlend.weights[objective]}%`}
              />
            ))}
          </div>
        </section>

        <section className={overviewMiniPanelClass}>
          <div className={overviewMiniPanelHeaderClass}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              Objective scores
            </span>
            <span className="text-[11px] capitalize text-zinc-400 dark:text-zinc-500">{report.confidence}</span>
          </div>
          <div
            className={overviewObjectiveChipGridClass}
            style={{
              gridTemplateColumns: `repeat(${objectiveOrder.length}, minmax(0, 1fr))`,
            }}
          >
            {objectiveOrder.map((objective) => {
              const fw = evaluationByObjective.get(objective);
              return (
                <OverviewObjectivePairChip
                  key={objective}
                  label={titleCase(objective)}
                  primary={fw != null ? String(fw.campaignScore) : "—"}
                  caption={fw?.confidence}
                  primarySuffix={fw != null ? "/100" : undefined}
                />
              );
            })}
          </div>
        </section>
      </div>

      {/* Score trajectory — full width */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Score trajectory · {simulationHorizon}d</span>
          <button type="button" onClick={() => setActiveSection("simulation")} className="text-xs font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">Simulate →</button>
        </div>
        <div className="flex items-end gap-3">
          <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {futureSimulation.baselineCompositeScore}
            <span className="mx-2 text-xl font-normal text-zinc-400">→</span>
            {futureSimulation.projectedCompositeScore}
          </p>
          <span className="mb-0.5 text-base font-semibold text-emerald-600 dark:text-emerald-400">
            {formatSignedPoints(futureSimulation.projectedCompositeScore - futureSimulation.baselineCompositeScore)}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{futureSimulation.narrative}</p>
      </Card>

      {/* Bottom 3-col row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Top actions */}
        <Card className="flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Top actions</span>
            <button type="button" onClick={() => setActiveSection("actions")} className="text-xs font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">All →</button>
          </div>
          <ul className="flex-1 space-y-2.5">
            {sortedRecommendations.slice(0, 5).map((rec, idx) => (
              <li key={`${idx}-${rec.action}`} className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <div className="flex items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${recPriorityStyles[rec.priority]}`}>{rec.priority}</span>
                  <span className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">{titleCase(rec.category)}</span>
                </div>
                <p className="mt-1.5 text-xs font-medium leading-4 text-zinc-900 dark:text-zinc-100 line-clamp-2">{rec.action}</p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Creators preview */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Top creators</span>
            <button type="button" onClick={() => setActiveSection("creators")} className="text-xs font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">All →</button>
          </div>
          <ul className="space-y-2">
            {[...report.creatorEvaluations].sort((a, b) => a.rank - b.rank).slice(0, 4).map((creator) => (
              <li key={creator.creatorName} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                <span className="min-w-0 text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  <span className="mr-1.5 text-zinc-400">#{creator.rank}</span>{creator.creatorName}
                </span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${tierStyles[creator.performanceTier]}`}>
                  {creator.performanceTier}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Activity preview */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Recent activity</span>
            <button type="button" onClick={() => setActiveSection("activity")} className="text-xs font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">All →</button>
          </div>
          <ol className="space-y-3">
            {activityTimeline.slice(0, 4).map((item) => (
              <li key={item.id} className="border-l-2 border-stone-200 pl-3 dark:border-zinc-700">
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">{item.title}</p>
                <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{new Date(item.occurredAt).toLocaleDateString()}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400 line-clamp-2">{item.description}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );

  const simulationSection = (() => {
    const expectedDelta = futureSimulation.projectedCompositeScore - futureSimulation.baselineCompositeScore;
    const conservativeDelta = futureSimulation.compositeBand.conservative - futureSimulation.baselineCompositeScore;
    const optimisticDelta = futureSimulation.compositeBand.optimistic - futureSimulation.baselineCompositeScore;
    const maxAbsContribution = Math.max(1, ...futureSimulation.contributions.map((c) => Math.abs(c.compositePoints)));

    return (
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] xl:grid-cols-[5fr_3fr]">
        {/* Left: score hero + framework projections + KPI breakdown */}
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Score projection</p>
                <div className="mt-2 flex items-end gap-3">
                  <p className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {futureSimulation.baselineCompositeScore}
                    <span className="mx-2 text-2xl font-normal text-zinc-400">→</span>
                    {futureSimulation.projectedCompositeScore}
                  </p>
                  <span className="mb-1 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800">
                    {formatSignedPoints(expectedDelta)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Range {futureSimulation.compositeBand.conservative}–{futureSimulation.compositeBand.optimistic} · {formatSignedPoints(conservativeDelta)} to {formatSignedPoints(optimisticDelta)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SIMULATION_HORIZONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSimulationHorizon(value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      simulationHorizon === value
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-stone-100 text-zinc-600 ring-1 ring-stone-200 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {value}d
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{futureSimulation.narrative}</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {futureSimulation.frameworkProjections.map((projection) => {
                const delta = projection.projectedCampaignScore - projection.baselineCampaignScore;
                return (
                  <div key={projection.objective} className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">{titleCase(projection.objective)}</p>
                    <p className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                      {projection.baselineCampaignScore}<span className="mx-1 text-sm font-normal text-zinc-400">→</span>{projection.projectedCampaignScore}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{formatSignedPoints(delta)} · {projection.band.conservative}–{projection.band.optimistic}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHeading label="KPI frameworks" sub="Metrics and weights per objective" />
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${report.frameworkEvaluations.length}, minmax(0, 1fr))` }}>
              {report.frameworkEvaluations.map((framework) => (
                <FrameworkMetricList key={framework.objective} framework={framework} />
              ))}
            </div>
          </Card>
        </div>

        {/* Right: contribution waterfall */}
        <Card className="flex flex-col">
          <SectionHeading label="Contribution waterfall" sub={`${futureSimulation.contributions.length} actions · ${formatSignedPoints(expectedDelta)} total`} />
          {futureSimulation.contributions.length ? (
            <ul className="flex-1 space-y-3 overflow-y-auto">
              {futureSimulation.contributions.map((contribution) => (
                <ContributionRow key={contribution.simulationId} contribution={contribution} maxAbsContribution={maxAbsContribution} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-stone-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
              Toggle actions to see projections here.
            </p>
          )}
        </Card>
      </div>
    );
  })();

  const actionsSection = (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <SectionHeading label="Recommended actions" sub={`${sortedRecommendations.length} actions · toggle to include in simulation`} />
        {sortedRecommendations.length ? (
          <ul className="space-y-3">
            {sortedRecommendations.map((rec, index) => {
              const simulationId = recommendationSimulationId(rec, index);
              const checked = selectedSimulationRecommendationIds.has(simulationId);
              const priorityColors = {
                high: neutralPillChip,
                medium: neutralPillChip,
                low: neutralPillChip,
              };
              return (
                <li
                  key={simulationId}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 transition hover:border-stone-300 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityColors[rec.priority]}`}>
                        {rec.priority}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
                        {titleCase(rec.category)}
                      </span>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecommendationSimulation(simulationId)}
                        className="h-3.5 w-3.5 rounded border-stone-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                      />
                      Simulate
                    </label>
                  </div>
                  <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{rec.action}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{rec.rationale}</p>
                  <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">Impact: {rec.expectedImpact}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-stone-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">No actions right now.</p>
        )}
      </Card>

      <div className="space-y-5">
        <Card>
          <SectionHeading label="Goal weights" />
          <div className="space-y-3">
            {objectiveOrder.map((objective) => (
              <div key={objective} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{titleCase(objective)}</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{report.objectiveBlend.weights[objective]}%</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{report.objectiveBlend.rationale}</p>
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionHeading label="Score projection" />
            <button
              type="button"
              onClick={() => setActiveSection("simulation")}
              className="mb-4 shrink-0 text-xs font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Full view
            </button>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">Score · {simulationHorizon}d horizon</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {futureSimulation.baselineCompositeScore}
              <span className="mx-1.5 text-lg font-normal text-zinc-400">→</span>
              {futureSimulation.projectedCompositeScore}
              <span className="ml-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatSignedPoints(futureSimulation.projectedCompositeScore - futureSimulation.baselineCompositeScore)}
              </span>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );

  const activitySection = (
    <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
      <Card>
        <SectionHeading label="Agent activity" sub={`${activityTimeline.length} events`} />
        <ol className="space-y-0">
          {activityTimeline.map((item, i) => (
            <li key={item.id} className="relative flex gap-4 pb-5">
              <div className="flex flex-col items-center">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                </span>
                {i < activityTimeline.length - 1 && (
                  <div className="mt-1 w-px flex-1 bg-stone-200 dark:bg-zinc-800" />
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{new Date(item.occurredAt).toLocaleString()}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="space-y-4">
        {/* Outreach summary */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Outreach drafts</span>
            <button type="button" onClick={() => setActiveSection("outreach")} className="text-xs font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-700 dark:hover:text-zinc-200">Open →</button>
          </div>
          {draftTierOrder.map((tier) => {
            const n = draftsByTier[tier].length;
            return (
              <div key={tier} className="flex items-center justify-between border-b border-stone-100 py-2.5 last:border-0 dark:border-zinc-800">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tierStyles[tier]}`}>{tierLabel(tier)}</span>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{n}</span>
              </div>
            );
          })}
        </Card>

        {/* Metric summary */}
        {campaignSummaryCards.length > 0 && (
          <Card>
            <div className="mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Key metrics</span>
            </div>
            <div className="space-y-2">
              {campaignSummaryCards.slice(0, 5).map((metric) => (
                <div key={metric.label} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{metric.label}</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{metric.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );

  const outreachSection = (
    <Card>
      <SectionHeading
        label="Draft messages by tier"
        sub="Select drafts, edit as needed, then send via Reacher."
      />
      {report.creatorMessageDrafts.length ? (
        <div className="space-y-3">
          {draftTierOrder.map((tier) => {
            const tierDrafts = draftsByTier[tier];
            const selectedCount = tierDrafts.filter((d) => selectedDraftIds.has(d.id)).length;
            const feedback = batchFeedback[tier];
            return (
              <details
                key={tier}
                open={tier === "high"}
                className="group rounded-xl border border-stone-200 bg-stone-50/70 open:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:open:bg-zinc-900"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${tierStyles[tier]}`}>
                      {tierLabel(tier)}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {tierDrafts.length} draft{tierDrafts.length !== 1 && "s"}
                      {selectedCount > 0 && ` · ${selectedCount} selected`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); void sendBatch(tier); }}
                    disabled={sendingTier === tier || !tierDrafts.length}
                    className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                  >
                    {sendingTier === tier ? "Sending…" : `Send (${selectedCount})`}
                  </button>
                </summary>
                <div className="px-4 pb-4">
                  {feedback && (
                    <p
                      className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
                        feedback.ok
                          ? "border-stone-200 bg-stone-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200"
                          : "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      }`}
                    >
                      {feedback.message}
                    </p>
                  )}
                  {tierDrafts.length ? (
                    <div className="grid max-h-[36rem] min-w-0 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                      {tierDrafts.map((draft) => (
                        <article key={draft.id} className="min-w-0 rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                          <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selectedDraftIds.has(draft.id)}
                                onChange={() => toggleDraftSelected(draft.id)}
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-stone-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                              />
                              <span className="min-w-0">
                                <span className="block break-words text-sm font-semibold text-zinc-900 dark:text-zinc-100">{draft.creatorName ?? "Broadcast"}</span>
                                {draft.creatorHandle && <span className="block break-all text-[11px] text-zinc-400 dark:text-zinc-500">{draft.creatorHandle}</span>}
                              </span>
                            </label>
                            <span className="max-w-full rounded-full bg-stone-100 px-2 py-0.5 text-right text-[10px] font-medium uppercase leading-tight tracking-wide text-zinc-500 whitespace-normal break-words dark:bg-zinc-800 dark:text-zinc-400">
                              {titleCase(draft.suggestionType)}
                            </span>
                          </div>
                          <textarea
                            value={draftBodies[draft.id] ?? draft.body}
                            onChange={(e) => setDraftBodies((prev) => updatedDraftBodies(prev, draft.id, e.target.value))}
                            className="min-h-28 min-w-0 w-full max-w-full resize-y rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-6 text-zinc-700 outline-none transition focus:border-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
                          />
                          <p className="mt-2 break-words text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{draft.rationale}</p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveDraft(draft.id)}
                              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              {savedDraftId === draft.id ? "Saved" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void copyDraft(draft)}
                              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                            >
                              {copiedDraftId === draft.id ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">No drafts in this tier.</p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-stone-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">No creator drafts yet.</p>
      )}
    </Card>
  );

  // ── Report sections ──────────────────────────────────────────────────────────

  const kpisSection = (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <SectionHeading
          label="KPI framework"
          sub={`${report.kpiFramework.metrics.length} metrics · ${report.kpiFramework.confidence} confidence`}
        />
        <p className="mb-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{report.kpiFramework.summary}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {report.kpiFramework.metrics.map((metric) => (
            <div key={metric.name} className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{titleCase(metric.name)}</p>
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{metric.weight}%</span>
              </div>
              <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{metric.reason}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="space-y-4">
        {report.frameworkEvaluations.map((fw) => (
          <FrameworkMetricList key={fw.objective} framework={fw} />
        ))}
      </div>
    </div>
  );

  const reportSummarySection = (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <SectionHeading label="Executive summary" />
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{report.executiveSummary}</p>
      </Card>
      <Card>
        <SectionHeading label="Data provenance" sub={`${report.dataProvenance.metricsSource} metrics · ${report.dataProvenance.contextSource.replace("_"," ")} context`} />
        <div className="space-y-2">
          {report.dataProvenance.reacherObjectsUsed.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">Reacher objects</p>
              {report.dataProvenance.reacherObjectsUsed.map((obj) => (
                <p key={obj} className="text-xs text-zinc-600 dark:text-zinc-300 py-1 border-b border-stone-100 dark:border-zinc-800 last:border-0">{obj}</p>
              ))}
            </div>
          )}
          {report.dataProvenance.niaSourcesUsed.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">NIA sources</p>
              {report.dataProvenance.niaSourcesUsed.map((src) => (
                <p key={src} className="text-xs text-zinc-600 dark:text-zinc-300 py-1 border-b border-stone-100 dark:border-zinc-800 last:border-0">{src}</p>
              ))}
            </div>
          )}
          {report.dataProvenance.missingInputs.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">Missing inputs</p>
              {report.dataProvenance.missingInputs.map((m) => (
                <p key={m} className="text-xs text-zinc-600 dark:text-zinc-300 py-1 border-b border-stone-100 dark:border-zinc-800 last:border-0">{m}</p>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const reportCreatorsSection = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {report.creatorEvaluations.map((creator) => (
        <Card key={creator.creatorName}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <span className="mr-2 text-zinc-400 dark:text-zinc-500">#{creator.rank}</span>
              {creator.creatorName}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tierStyles[creator.performanceTier]}`}>
              {tierLabel(creator.performanceTier)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{creator.tierRationale}</p>
          <div className="mt-2 flex gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>Driver: <span className="font-medium text-zinc-700 dark:text-zinc-300">{creator.primaryDriver}</span></span>
            <span>Drag: <span className="font-medium text-zinc-700 dark:text-zinc-300">{creator.primaryDrag}</span></span>
          </div>
        </Card>
      ))}
    </div>
  );

  const reportAttributionSection = (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <Card>
        <SectionHeading label="Attribution insights" sub="Why results happened" />
        <ul className="grid gap-3 sm:grid-cols-2">
          {report.attributionInsights.map((insight) => (
            <li key={insight.claim} className="rounded-lg border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{insight.claim}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">{insight.businessImplication}</p>
              <span className="mt-2 inline-block text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {insight.confidence} confidence
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <details className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-sm font-medium text-zinc-600 dark:text-zinc-400">Raw payload</summary>
        <pre className="mt-4 max-h-[600px] overflow-auto rounded-lg bg-stone-50 p-4 text-[11px] leading-relaxed text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </div>
  );

  // ── Nav config ───────────────────────────────────────────────────────────────

  const dashboardNav: { id: DashboardSection; label: string; icon: string }[] = [
    { id: "overview",    label: "Overview",    icon: ICONS.overview },
    { id: "simulation",  label: "Simulate",    icon: ICONS.simulation },
    { id: "actions",     label: "Actions",     icon: ICONS.actions },
    { id: "activity",    label: "Activity",    icon: ICONS.activity },
    { id: "outreach",    label: "Outreach",    icon: ICONS.outreach },
  ];

  const reportNav: { id: ReportSection; label: string; icon: string }[] = [
    { id: "kpis",        label: "KPIs",        icon: ICONS.summary },
    { id: "summary",     label: "Summary",     icon: ICONS.attribution },
    { id: "creators",    label: "Creators",    icon: ICONS.creators },
    { id: "attribution", label: "Attribution", icon: ICONS.attribution },
  ];

  const allNav = [...dashboardNav, ...reportNav];

  function renderContent() {
    switch (activeSection) {
      case "overview":     return overviewSection;
      case "simulation":   return simulationSection;
      case "actions":      return actionsSection;
      case "activity":     return activitySection;
      case "outreach":     return outreachSection;
      case "kpis":         return kpisSection;
      case "summary":      return reportSummarySection;
      case "creators":     return reportCreatorsSection;
      case "attribution":  return reportAttributionSection;
    }
  }

  const sidebarW = sidebarCollapsed ? "w-14" : "w-52";
  const mainPl = sidebarCollapsed ? "pl-14" : "pl-52";

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-zinc-950">
      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-stone-200 bg-white transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${sidebarW}`}>
        {/* Logo + collapse */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-3 dark:border-zinc-800">
          {!sidebarCollapsed && <CampaignLogo size="xs" className="rounded-lg" />}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-stone-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${sidebarCollapsed ? "mx-auto" : ""}`}
          >
            <Icon path={sidebarCollapsed ? ICONS.chevRight : ICONS.chevLeft} className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Campaign info */}
        {!sidebarCollapsed && (
          <div className="shrink-0 border-b border-stone-200 px-4 py-3 dark:border-zinc-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Campaign</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100" title={campaign.name || "Campaign"}>
              {campaign.name || "Campaign"}
            </p>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{campaign.brand}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2">
          {/* Dashboard sections */}
          <div className={`pt-2 ${!sidebarCollapsed ? "px-2" : ""}`}>
            {!sidebarCollapsed && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Dashboard</p>
            )}
            {dashboardNav.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition ${
                    active
                      ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-stone-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <Icon path={item.icon} />
                  {!sidebarCollapsed && item.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mx-2 my-3 border-t border-stone-200 dark:border-zinc-800" />

          {/* Report sections */}
          <div className={`${!sidebarCollapsed ? "px-2" : ""}`}>
            {!sidebarCollapsed && (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">Report</p>
            )}
            {reportNav.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition ${
                    active
                      ? "bg-zinc-900 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:bg-stone-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <Icon path={item.icon} />
                  {!sidebarCollapsed && item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* New campaign */}
        <div className="shrink-0 border-t border-stone-200 p-2 dark:border-zinc-800">
          <button
            type="button"
            title={sidebarCollapsed ? "New campaign" : undefined}
            onClick={onStartNew}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-zinc-500 transition hover:bg-stone-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <Icon path={ICONS.new} />
            {!sidebarCollapsed && "New campaign"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className={`flex min-h-screen w-full flex-col transition-all duration-200 ${mainPl}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="flex w-full items-center justify-between px-6 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                {allNav.find((n) => n.id === activeSection)?.label}
              </p>
              <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {campaign.name || "Campaign"}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${health.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${health.dot}`} />
                <span className={`text-[11px] font-medium ${health.accent}`}>{health.label}</span>
              </div>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {new Date(report.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="w-full px-6 py-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
