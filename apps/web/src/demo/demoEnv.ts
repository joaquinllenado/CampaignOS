/**
 * Optional presentation layer — off unless VITE_ENABLE_DEMO is set at build/dev time.
 * Use: VITE_ENABLE_DEMO=1 bun run dev (or add to apps/web/.env.local for demos only).
 * Optional URL hint when enabled: ?demo=1 auto-applies the fixture on the intake screen once.
 */
export function isDemoPresentationEnabled(): boolean {
  const raw = import.meta.env.VITE_ENABLE_DEMO;
  if (raw === undefined || raw === "") return false;
  const v = String(raw).toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

export function shouldAutoloadDemoFromQuery(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search).get("demo");
  if (!q) return false;
  return q === "1" || q.toLowerCase() === "true";
}
