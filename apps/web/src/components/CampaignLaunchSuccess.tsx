import type { CampaignIntakeFields, CampaignIntelligenceReport } from "../lib/campaignTypes";
import { CampaignLogo } from "./CampaignLogo";

type Props = {
  campaign: CampaignIntakeFields;
  report: CampaignIntelligenceReport;
  onContinue: () => void;
};

function titleCase(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

const metricAcronyms = new Set(["aov", "cac", "cpa", "cpc", "cpm", "cpv", "ctr", "cvr", "gmv", "kpi", "ltv", "roas", "roi", "rpm", "vtr"]);

function formatMetricName(value: string) {
  return value
    .split("_")
    .map((part) => metricAcronyms.has(part.toLowerCase()) ? part.toUpperCase() : titleCase(part))
    .join(" ");
}

export function CampaignLaunchSuccess({ campaign, report, onContinue }: Props) {
  const direction = titleCase(report.objective);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-zinc-950">
      <header className="border-b border-stone-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 sm:px-10">
          <CampaignLogo size="xs" className="rounded-lg" />
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800">
            Strategy generated
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 sm:px-10">
        <section className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            Onboarding complete
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                Your campaign direction is ready.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                CampaignOS generated a {direction.toLowerCase()}-led strategy for {campaign.name || "your campaign"} using
                the campaign brief, brand context, and available performance signals.
              </p>
            </div>
            <button
              type="button"
              onClick={onContinue}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Continue to dashboard
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              Campaign direction
            </p>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {direction}
            </p>
            <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {report.kpiFramework.summary}
            </p>
            <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Confidence
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                {report.kpiFramework.confidence}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                Generated KPIs
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Measurement framework
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {report.kpiFramework.metrics.map((metric) => (
                <article
                  key={metric.name}
                  className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatMetricName(metric.name)}
                    </h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                      {metric.weight}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {metric.reason}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
