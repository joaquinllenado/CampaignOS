import { useState } from "react";
import { CampaignIntakeForm } from "./components/CampaignIntakeForm";
import { CampaignDashboard } from "./components/CampaignDashboard";
import { CampaignLaunchSuccess } from "./components/CampaignLaunchSuccess";
import { CampaignLogo } from "./components/CampaignLogo";
import { isDemoPresentationEnabled } from "./demo/demoEnv";
import type { CampaignIntakeFields, CampaignIntelligenceReport } from "./lib/campaignTypes";

const FEATURES = [
  "AI-powered creator discovery & matching",
  "Autonomous campaign decisions in real time",
  "Continuous performance optimization",
];

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Completed = { campaign: CampaignIntakeFields; report: CampaignIntelligenceReport };
type PostOnboardingView = "success" | "dashboard";

export function App() {
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [postOnboardingView, setPostOnboardingView] = useState<PostOnboardingView>("success");

  const demoPresentation = isDemoPresentationEnabled();

  function startNewCampaign() {
    setCompleted(null);
    setPostOnboardingView("success");
  }

  if (completed) {
    if (postOnboardingView === "success") {
      return (
        <CampaignLaunchSuccess
          campaign={completed.campaign}
          report={completed.report}
          onContinue={() => setPostOnboardingView("dashboard")}
        />
      );
    }

    return (
      <CampaignDashboard
        campaign={completed.campaign}
        report={completed.report}
        onStartNew={startNewCampaign}
        demoAutonomousPulse={demoPresentation}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex dark:bg-zinc-950">
      {/* ── Left branding panel (onboarding only) ── */}
      <aside className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 flex-col p-10 border-r border-stone-200 bg-stone-50 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col h-full">
          <CampaignLogo size="lg" className="rounded-lg" />

          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-3 dark:text-zinc-500">
              Autonomous Influencer Marketing
            </p>
            <h1 className="text-2xl xl:text-[1.75rem] font-bold text-zinc-900 leading-snug mb-4 dark:text-zinc-100">
              Launch campaigns that run themselves.
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed dark:text-zinc-400">
              Describe your campaign once. CampaignOS autonomously discovers creators, manages
              outreach, and optimizes performance — so you can focus on strategy.
            </p>
          </div>

          <ul className="space-y-3 mt-2">
            {FEATURES.map((text) => (
              <li key={text} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-zinc-900/8 flex items-center justify-center text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                  <CheckIcon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ── Right form panel ── */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-white dark:bg-zinc-950">
        <header className="lg:hidden flex items-center px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <CampaignLogo size="sm" className="rounded-md" />
        </header>

        <div className="flex-1 flex items-start justify-center py-12 px-6 sm:px-10">
          <div className="w-full max-w-[1120px]">
            <CampaignIntakeForm
              onComplete={(report, campaign) => {
                setCompleted({ report, campaign });
                setPostOnboardingView("success");
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
