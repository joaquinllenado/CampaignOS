import { FormEvent, useCallback, useState } from "react";
import { BrandContextDropzone } from "./BrandContextDropzone";
import type { CampaignIntakeFields } from "../lib/campaignTypes";
import { KPI_METRIC_HINTS } from "../lib/campaignTypes";
import { submitAgentRun } from "../lib/api";
import type { AgentRunSuccess } from "../lib/campaignTypes";
import { buildCampaignRunPayload } from "../lib/campaignPayload";

const defaultCampaignFields: CampaignIntakeFields = {
  name: "",
  brand: "",
  objective: "auto",
  product: "",
  audience: "",
  budget: "",
  kpiPriorities: "",
  brief: ""
};

const labelClass =
  "text-sm font-medium text-slate-700 dark:text-slate-300";
const inputClass =
  "mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-950 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50";
const textareaClass = `${inputClass} min-h-24 resize-y py-3`;

export function CampaignIntakeForm() {
  const [campaign, setCampaign] = useState<CampaignIntakeFields>(() => ({
    ...defaultCampaignFields
  }));
  const [niaSourceIds, setNiaSourceIds] = useState<string[]>([]);

  const [result, setResult] = useState<AgentRunSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateCampaign = useCallback(
    (patch: Partial<CampaignIntakeFields>) => {
      setCampaign((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = buildCampaignRunPayload(campaign, niaSourceIds);
      const next = await submitAgentRun(payload);
      setResult(next);
    } catch (caughtError) {
      setResult(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-black/20">
      <div className="mb-6 space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Campaign intake
        </h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Enter your campaign details. The API validates this payload before later agent stages
          run.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <fieldset className="space-y-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-800/80">
          <legend className="px-1 text-base font-semibold text-slate-900 dark:text-slate-100">
            Campaign details
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-1">
              <span className={labelClass}>Campaign name *</span>
              <input
                required
                className={inputClass}
                value={campaign.name}
                onChange={(e) => updateCampaign({ name: e.target.value })}
                placeholder="Summer launch / creators"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={labelClass}>Brand name *</span>
              <input
                required
                className={inputClass}
                value={campaign.brand}
                onChange={(e) => updateCampaign({ brand: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-1">
              <span className={labelClass}>Objective *</span>
              <select
                required
                className={inputClass}
                value={campaign.objective}
                onChange={(e) =>
                  updateCampaign({
                    objective: e.target.value as CampaignIntakeFields["objective"]
                  })
                }
              >
                <option value="awareness">Awareness</option>
                <option value="engagement">Engagement</option>
                <option value="sales">Sales</option>
                <option value="auto">Auto-detect</option>
              </select>
            </label>
            <label className="block sm:col-span-1">
              <span className={labelClass}>Budget (optional, positive)</span>
              <input
                className={inputClass}
                inputMode="decimal"
                value={campaign.budget}
                onChange={(e) => updateCampaign({ budget: e.target.value })}
                placeholder="e.g. 50000"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Product or category *</span>
              <input
                required
                className={inputClass}
                value={campaign.product}
                onChange={(e) => updateCampaign({ product: e.target.value })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Target audience *</span>
              <textarea
                required
                className={textareaClass}
                value={campaign.audience}
                onChange={(e) => updateCampaign({ audience: e.target.value })}
                placeholder="Who you are reaching; segments, geo, demos."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>
                KPI priorities (one per line or comma-separated; supports custom labels)
              </span>
              <textarea
                className={textareaClass}
                value={campaign.kpiPriorities}
                onChange={(e) => updateCampaign({ kpiPriorities: e.target.value })}
                placeholder={`${KPI_METRIC_HINTS.slice(0, 6).join(", ")}, …`}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Suggested tokens: {KPI_METRIC_HINTS.join(", ")}.
              </p>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Campaign brief *</span>
              <textarea
                required
                minLength={1}
                className={`${textareaClass} min-h-40`}
                value={campaign.brief}
                onChange={(e) => updateCampaign({ brief: e.target.value })}
                placeholder="Goals, messaging, timelines, hooks, mandatory CTAs..."
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-800/80">
          <BrandContextDropzone
            campaignLabel={campaign.name}
            indexedSourceIds={niaSourceIds}
            onIndexedSourceIdsChange={setNiaSourceIds}
          />
        </fieldset>

        <button
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Submitting intake…" : "Submit intake"}
        </button>
      </form>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {result?.mode === "intake" ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
          <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
            Intake validated
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-200/90">
            Received{" "}
            <time dateTime={result.receivedAt}>
              {new Date(result.receivedAt).toLocaleString()}
            </time>
          </p>
          {result.warnings.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Heads-up
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-emerald-900 dark:text-emerald-100/90">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.kpiPriorityNotes.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                KPI priorities
              </p>
              <ul className="mt-1 list-inside list-disc text-sm text-emerald-900 dark:text-emerald-100/90">
                {result.kpiPriorityNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <details className="rounded-xl border border-emerald-200/60 bg-white/60 p-3 dark:border-emerald-900/50 dark:bg-slate-950/40">
            <summary className="cursor-pointer text-sm font-medium text-emerald-900 dark:text-emerald-100">
              View normalized payload
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              {JSON.stringify(result.intake, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
