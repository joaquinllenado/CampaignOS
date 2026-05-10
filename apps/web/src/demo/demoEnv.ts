/**
 * Optional presentation layer — off unless VITE_ENABLE_DEMO is set at build/dev time.
 * Use: VITE_ENABLE_DEMO=1 bun run dev (or add to apps/web/.env.local for demos only).
 * When enabled, the intake screen applies the bundled demo fixture once on load (`bun run demo`).
 */
export function isDemoPresentationEnabled(): boolean {
  const raw = import.meta.env.VITE_ENABLE_DEMO;
  if (raw === undefined || raw === "") return false;
  const v = String(raw).toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}
