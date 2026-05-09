import { FormEvent, useState } from "react";
import { runAgent } from "../lib/api";

type AgentResult = Awaited<ReturnType<typeof runAgent>>;

export function AgentPanel() {
  const [prompt, setPrompt] = useState("Summarize what this scaffold can do.");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const nextResult = await runAgent(prompt);
      setResult(nextResult);
    } catch (caughtError) {
      setResult(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 dark:shadow-black/20">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Agent prompt
          </span>
          <textarea
            className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none ring-blue-500/20 transition focus:border-blue-500 focus:ring-4 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>

        <button
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Running..." : "Run agent"}
        </button>
      </form>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
          <p className="text-sm text-emerald-950 dark:text-emerald-100">{result.answer}</p>
          <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">
            {result.model} · {new Date(result.createdAt).toLocaleString()}
          </p>
        </div>
      ) : null}
    </section>
  );
}
