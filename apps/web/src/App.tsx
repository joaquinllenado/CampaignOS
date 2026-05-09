import { CampaignIntakeForm } from "./components/CampaignIntakeForm";

export function App() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_32rem)] px-6 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="max-w-3xl space-y-5">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
            Bun + Elysia + React + Tailwind
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Campaign intelligence scaffold
            </h1>
            <p className="text-lg leading-8 text-slate-600 dark:text-slate-300">
              Submit structured campaign context for the intelligence agent API. Intake is
              validated on the server; LangGraph orchestration plugs in next.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <CampaignIntakeForm />

          <aside className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-white/5 dark:shadow-black/20">
            <h2 className="text-lg font-semibold">Included</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Workspace scripts for running API and web together.</li>
              <li>Elysia routes for health checks and agent execution.</li>
              <li>React UI styled with Tailwind CSS and dark-mode defaults.</li>
              <li>Strict TypeScript configuration shared across apps.</li>
            </ul>
          </aside>
        </div>
      </div>
    </main>
  );
}
