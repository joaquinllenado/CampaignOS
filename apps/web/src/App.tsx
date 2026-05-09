import { CampaignIntakeForm } from "./components/CampaignIntakeForm";

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

export function App() {
  return (
    <div className="min-h-screen bg-stone-50 flex dark:bg-zinc-950">
      {/* ── Left branding panel ── */}
      <aside className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 flex-col p-10 border-r border-stone-200 bg-stone-50 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-col h-full">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 flex items-center justify-center dark:bg-zinc-100">
              <span className="text-white font-bold text-xs leading-none dark:text-zinc-900">N</span>
            </div>
            <span className="text-zinc-900 font-semibold text-base tracking-tight dark:text-zinc-100">Nozo</span>
          </div>

          {/* Hero copy */}
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-[11px] font-semibold text-zinc-400 tracking-widest uppercase mb-3 dark:text-zinc-500">
              Autonomous Influencer Marketing
            </p>
            <h1 className="text-2xl xl:text-[1.75rem] font-bold text-zinc-900 leading-snug mb-4 dark:text-zinc-100">
              Launch campaigns that run themselves.
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed dark:text-zinc-400">
              Describe your campaign once. Nozo's AI autonomously discovers creators, manages
              outreach, and optimizes performance — so you can focus on strategy.
            </p>
          </div>

          {/* Feature list */}
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

        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-2 px-6 py-4 border-b border-stone-200 dark:border-zinc-800">
          <div className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center dark:bg-zinc-100">
            <span className="text-white font-bold text-[10px] leading-none dark:text-zinc-900">N</span>
          </div>
          <span className="text-zinc-900 font-semibold text-sm dark:text-zinc-100">Nozo</span>
        </header>

        <div className="flex-1 flex items-start justify-center py-12 px-6 sm:px-10">
          <div className="w-full max-w-[520px]">
            <CampaignIntakeForm />
          </div>
        </div>

      </main>
    </div>
  );
}
