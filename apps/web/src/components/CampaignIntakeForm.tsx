import { FormEvent, useCallback, useState } from "react";
import { BrandContextDropzone } from "./BrandContextDropzone";
import type { CampaignIntakeFields } from "../lib/campaignTypes";
import { submitAgentRun } from "../lib/api";
import type { AgentRunSuccess } from "../lib/campaignTypes";
import { buildCampaignRunPayload } from "../lib/campaignPayload";

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Basics", "Audience", "Strategy", "Documents"];

const STEP_META = [
  { title: "Campaign Basics", sub: "Give your campaign an identity." },
  { title: "Product & Audience", sub: "Define what you're promoting and who you're reaching." },
  {
    title: "Campaign Strategy",
    sub: "Upload a brief file if you have one, then add a written summary. We infer the business objective and KPI model from everything you shared."
  },
  {
    title: "Additional documents",
    sub: "Optional: add decks, reports, or past campaign files—indexed into Nia for the agent to search alongside your brief."
  }
];

const defaultFields: CampaignIntakeFields = {
  name: "",
  brand: "",
  product: "",
  audience: "",
  budget: "",
  brief: ""
};

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-600 dark:focus:ring-zinc-800";
const labelCls = "block text-sm text-zinc-600 mb-1.5 dark:text-zinc-400";
const textareaCls = `${inputCls} min-h-28 resize-y py-3`;

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignIntakeForm() {
  const [step, setStep] = useState(0);
  const [campaign, setCampaign] = useState<CampaignIntakeFields>({ ...defaultFields });
  const [niaSourceIds, setNiaSourceIds] = useState<string[]>([]);
  const [result, setResult] = useState<AgentRunSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateCampaign = useCallback((patch: Partial<CampaignIntakeFields>) => {
    setCampaign((prev) => ({ ...prev, ...patch }));
  }, []);

  function canAdvance() {
    if (step === 0) return campaign.name.trim() !== "" && campaign.brand.trim() !== "";
    if (step === 1) return campaign.product.trim() !== "" && campaign.audience.trim() !== "";
    if (step === 2) return campaign.brief.trim() !== "";
    return true;
  }

  function resetAll() {
    setCampaign({ ...defaultFields });
    setNiaSourceIds([]);
    setStep(0);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const payload = buildCampaignRunPayload(campaign, niaSourceIds);
      const next = await submitAgentRun(payload);
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (result?.mode === "intake") {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center py-8">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl dark:bg-emerald-950/40 dark:border-emerald-800">
            🚀
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2 dark:text-zinc-100">Campaign queued!</h2>
          <p className="text-zinc-500 text-sm dark:text-zinc-400">
            Received{" "}
            <time dateTime={result.receivedAt} className="text-zinc-700 dark:text-zinc-300">
              {new Date(result.receivedAt).toLocaleString()}
            </time>
          </p>
        </div>

        {result.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 dark:text-amber-400">Heads-up</p>
            <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
              {result.warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          </div>
        )}

        {result.kpiPriorityNotes.length > 0 && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 dark:text-zinc-400">KPI Notes</p>
            <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {result.kpiPriorityNotes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          </div>
        )}

        <details className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <summary className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">View normalized payload</summary>
          <pre className="mt-3 max-h-64 overflow-auto text-xs text-zinc-500 leading-relaxed dark:text-zinc-400">
            {JSON.stringify(result.intake, null, 2)}
          </pre>
        </details>

        <button
          type="button"
          onClick={resetAll}
          className="w-full rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-stone-50 hover:border-zinc-300 transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Start a new campaign
        </button>
      </div>
    );
  }

  // ── Progress bar ────────────────────────────────────────────────────────────
  const progressBar = (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Step {step + 1} of {STEPS.length}</p>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{STEPS[step]}</p>
      </div>
      {/* Thin single-bar progress — Notion/Reacher clean style */}
      <div className="h-[2px] bg-stone-200 rounded-full overflow-hidden dark:bg-zinc-800">
        <div
          className="h-full bg-zinc-900 rounded-full transition-all duration-500 ease-out dark:bg-zinc-100"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );

  // ── Step 0 — Campaign Basics ────────────────────────────────────────────────
  const step0 = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Campaign name *</label>
          <input
            required value={campaign.name}
            onChange={(e) => updateCampaign({ name: e.target.value })}
            className={inputCls} placeholder="Summer launch / creators"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Brand name *</label>
          <input
            required value={campaign.brand}
            onChange={(e) => updateCampaign({ brand: e.target.value })}
            className={inputCls} placeholder="Your brand"
          />
        </div>
      </div>
    </div>
  );

  // ── Step 1 — Product & Audience ────────────────────────────────────────────
  const step1 = (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Product or category *</label>
        <input
          required value={campaign.product}
          onChange={(e) => updateCampaign({ product: e.target.value })}
          className={inputCls} placeholder="e.g. Skincare serum, SaaS platform"
        />
      </div>
      <div>
        <label className={labelCls}>
          Budget{" "}
          <span className="font-normal text-zinc-400 dark:text-zinc-500">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm select-none">$</span>
          <input
            inputMode="decimal" value={campaign.budget}
            onChange={(e) => updateCampaign({ budget: e.target.value })}
            className={`${inputCls} pl-8`} placeholder="50,000"
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Target audience *</label>
        <textarea
          required value={campaign.audience}
          onChange={(e) => updateCampaign({ audience: e.target.value })}
          className={textareaCls}
          placeholder="Segments, demographics, regions you're reaching..."
        />
      </div>
    </div>
  );

  // ── Step 2 — Strategy (brief) ───────────────────────────────────────────────
  const step2 = (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <BrandContextDropzone
          campaignLabel={campaign.name}
          indexedSourceIds={niaSourceIds}
          onIndexedSourceIdsChange={setNiaSourceIds}
          title="Brief file"
          description="If your strategy lives in a deck or doc, upload it here. We index it into Nia and use it together with the written summary below—add notes in the box if something is not in the file."
          fileInputLabel="Upload campaign brief files"
        />
      </div>
      <div>
        <label className={labelCls}>Campaign brief *</label>
        <textarea
          required value={campaign.brief}
          onChange={(e) => updateCampaign({ brief: e.target.value })}
          className={`${textareaCls} min-h-36`}
          placeholder="Goals, messaging, timelines, hooks, mandatory CTAs..."
        />
      </div>
    </div>
  );

  // ── Step 3 — Additional documents (optional) ────────────────────────────────
  const step3 = (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <BrandContextDropzone
        campaignLabel={campaign.name}
        indexedSourceIds={niaSourceIds}
        onIndexedSourceIdsChange={setNiaSourceIds}
      />
    </div>
  );

  const stepContent = [step0, step1, step2, step3][step];
  const isLastStep = step === STEPS.length - 1;

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      {progressBar}

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-900 mb-1 dark:text-zinc-100">{STEP_META[step].title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{STEP_META[step].sub}</p>
      </div>

      {stepContent}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-7 flex gap-2.5">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-stone-50 hover:border-zinc-300 transition dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ← Back
          </button>
        )}
        {!isLastStep ? (
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Continue →
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isLoading ? "Launching…" : "Launch campaign →"}
          </button>
        )}
      </div>
    </form>
  );
}
