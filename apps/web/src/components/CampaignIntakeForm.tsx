import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BrandContextDropzone } from "./BrandContextDropzone";
import type { AgentRunSuccess, CampaignIntakeFields, CampaignIntelligenceReport } from "../lib/campaignTypes";
import { ingestNiaBrandFiles, submitAgentRunWithProgress } from "../lib/api";
import { buildCampaignRunPayload, type CampaignRunBuildOptions, type CreatorMetricsForAgentRun } from "../lib/campaignPayload";
import { DEMO_CAMPAIGN_FIELDS, DEMO_REACHER_SAMPLE_TARGET_COLLAB_5_1_26 } from "../demo/demoCampaign.fixture";
import { fetchDemoBrandContextFiles } from "../demo/demoDocuments";
import { isDemoPresentationEnabled } from "../demo/demoEnv";

type Props = {
  onComplete: (report: CampaignIntelligenceReport, campaign: CampaignIntakeFields) => void;
};

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Basics", "Audience", "Context"];

const STEP_META = [
  { title: "Campaign Basics", sub: "Give your campaign an identity." },
  { title: "Product & Audience", sub: "Define what you're promoting and who you're reaching." },
  {
    title: "Campaign context",
    sub: "Write a short brief. Optionally attach decks or past-campaign docs — they index automatically."
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

function isCampaignReport(result: AgentRunSuccess | null): result is CampaignIntelligenceReport {
  return Boolean(result && "kpiFramework" in result);
}

/** Survives React Strict Mode remount so demo autoload/ingest does not run twice per page load. */
let demoPresentationHydratedOncePerPageLoad = false;

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignIntakeForm({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [campaign, setCampaign] = useState<CampaignIntakeFields>({ ...defaultFields });
  const [niaSourceIds, setNiaSourceIds] = useState<string[]>([]);
  const [fixtureCreators, setFixtureCreators] = useState<CreatorMetricsForAgentRun[] | null>(null);
  const [sampleRunOptions, setSampleRunOptions] = useState<CampaignRunBuildOptions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progressLog, setProgressLog] = useState<{ id: number; label: string }[]>([]);
  const progressSeq = useRef(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const demoToolkit = isDemoPresentationEnabled();

  const ingestDemoBrandPdfs = useCallback(async () => {
    setError(null);
    try {
      const files = await fetchDemoBrandContextFiles();
      const result = await ingestNiaBrandFiles(files, DEMO_CAMPAIGN_FIELDS.name);
      const newIds = result.indexed.map((i) => i.sourceId).filter(Boolean);
      if (newIds.length) {
        setNiaSourceIds(newIds);
      }
      if (result.errors.length && !newIds.length) {
        const first = result.errors[0];
        setError(`${first.filename}: ${first.message}`);
      } else if (result.errors.length) {
        setError(
          `Some files failed: ${result.errors.map((e) => `${e.filename}: ${e.message}`).join(" · ")}`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo documents failed to index.");
    }
  }, []);

  const applyPresentationFixture = useCallback(() => {
    setCampaign({ ...DEMO_CAMPAIGN_FIELDS });
    setFixtureCreators(null);
    setSampleRunOptions({ ...DEMO_REACHER_SAMPLE_TARGET_COLLAB_5_1_26 });
    setNiaSourceIds([]);
    setStep(0);
    setError(null);
    void ingestDemoBrandPdfs();
  }, [ingestDemoBrandPdfs]);

  useEffect(() => {
    if (!demoToolkit || demoPresentationHydratedOncePerPageLoad) return;
    demoPresentationHydratedOncePerPageLoad = true;
    applyPresentationFixture();
  }, [demoToolkit, applyPresentationFixture]);

  useEffect(() => {
    if (!isLoading || progressLog.length === 0) return;
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progressLog, isLoading]);

  const updateCampaign = useCallback((patch: Partial<CampaignIntakeFields>) => {
    setCampaign((prev) => ({ ...prev, ...patch }));
  }, []);

  function canAdvance() {
    if (step === 0) return campaign.name.trim() !== "" && campaign.brand.trim() !== "";
    if (step === 1) return campaign.product.trim() !== "" && campaign.audience.trim() !== "";
    if (step === 2) return campaign.brief.trim() !== "";
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    /* Pressing Enter in a single-line field submits the <form>; only “Launch campaign”
       on the final step should run the agent — otherwise intermediate steps would fire
       the agent too early. */
    const finalStepIndex = STEPS.length - 1;
    if (step !== finalStepIndex) {
      if (canAdvance()) {
        setStep((s) => Math.min(s + 1, finalStepIndex));
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    progressSeq.current = 0;
    setProgressLog([]);
    try {
      const payload = buildCampaignRunPayload(campaign, niaSourceIds, {
        creators: fixtureCreators ?? undefined,
        ...(sampleRunOptions ?? {})
      });
      const next: AgentRunSuccess = await submitAgentRunWithProgress(payload, (label) => {
        progressSeq.current += 1;
        setProgressLog((prev) => [...prev, { id: progressSeq.current, label }]);
      });
      if (isCampaignReport(next)) {
        onComplete(next, campaign);
      } else {
        setError("Agent returned an unsupported response shape.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
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

  // ── Step 2 — Brief text + a single dropzone covering brief and supporting docs ──
  const step2 = (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Campaign brief *</label>
        <textarea
          required value={campaign.brief}
          onChange={(e) => updateCampaign({ brief: e.target.value })}
          className={`${textareaCls} min-h-36`}
          placeholder="Goals, messaging, timelines, hooks, mandatory CTAs..."
        />
      </div>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <BrandContextDropzone
          campaignLabel={campaign.name}
          indexedSourceIds={niaSourceIds}
          onIndexedSourceIdsChange={setNiaSourceIds}
          title="Brief & supporting documents"
          description="Optional. Drop your brief deck plus any past-campaign or brand context — PDFs, decks, spreadsheets, notes. Each file indexes to Nia automatically."
          fileInputLabel="Upload campaign documents"
        />
      </div>
    </div>
  );

  const stepContent = [step0, step1, step2][step];
  const isLastStep = step === STEPS.length - 1;

  const loadingPanel = (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Live run log</p>
      <p className="text-xs text-zinc-500 mt-1 dark:text-zinc-400">
        Each line appears when the agent finishes a pipeline stage — not an estimate.
      </p>
      <ul className="mt-4 max-h-56 overflow-y-auto space-y-2 pr-1">
        {progressLog.map((row, i) => {
          const latest = i === progressLog.length - 1;
          return (
            <li
              key={row.id}
              className={`flex gap-2.5 text-sm leading-snug ${
                latest
                  ? "text-zinc-900 dark:text-zinc-100 font-medium"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <span className="shrink-0 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums w-6 text-right pt-0.5">
                {i + 1}
              </span>
              <span>{row.label}</span>
            </li>
          );
        })}
      </ul>
      <div ref={logEndRef} className="h-0 w-full overflow-hidden" aria-hidden="true" />
      {progressLog.length === 0 && (
        <p className="mt-4 text-sm text-zinc-400 dark:text-zinc-500">Connecting to agent…</p>
      )}
    </div>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[520px]">
      {progressBar}

      <div className="mb-6">
        {isLastStep && isLoading ? (
          <>
            <h2 className="text-xl font-semibold text-zinc-900 mb-1 dark:text-zinc-100">
              Running campaign intelligence
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your brief is being analyzed. Stages below update as they complete.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-zinc-900 mb-1 dark:text-zinc-100">{STEP_META[step].title}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{STEP_META[step].sub}</p>
          </>
        )}
      </div>

      {isLastStep && isLoading ? loadingPanel : stepContent}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-7 flex gap-2.5">
        {step > 0 && (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-lg border border-stone-200 bg-white py-2.5 text-sm font-medium text-zinc-700 hover:bg-stone-50 hover:border-zinc-300 transition disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
