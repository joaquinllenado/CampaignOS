import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NiaSDK, V2ApiSourcesService } from "nia-ai-ts";
import type { Source } from "nia-ai-ts";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

export function getRepoRoot(): string {
  return join(scriptsDir, "..");
}

export function requireNiaApiKey(): string {
  const key = process.env.NIA_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "NIA_API_KEY is not set. Add it to .env at the repo root (Bun loads it automatically)."
    );
  }
  return key;
}

export function createNiaSdk(): NiaSDK {
  const baseUrl = process.env.NIA_BASE_URL?.trim() || "https://apigcp.trynia.ai/v2";
  return new NiaSDK({ apiKey: requireNiaApiKey(), baseUrl });
}

export async function fetchSource(sourceId: string): Promise<Source> {
  return V2ApiSourcesService.getSourceV2SourcesSourceIdGet(sourceId, null);
}

/** Poll until status leaves in-progress or hits ready/failed. */
export async function pollSourceUntilSettled(
  sourceId: string,
  options?: { intervalMs?: number; maxWaitMs?: number; onTick?: (s: Source) => void }
): Promise<Source> {
  const intervalMs = options?.intervalMs ?? 4000;
  const maxWaitMs = options?.maxWaitMs ?? 180_000;
  const deadline = Date.now() + maxWaitMs;
  let last: Source | null = null;

  const inProgress = new Set([
    "indexing",
    "pending",
    "queued",
    "processing",
    "running",
    "syncing"
  ]);

  while (Date.now() < deadline) {
    last = await fetchSource(sourceId);
    options?.onTick?.(last);
    const st = (last.status ?? "").toLowerCase();
    if (st === "failed" || st === "error") {
      throw new Error(`Source ${sourceId} indexing failed (status: ${last.status})`);
    }
    if (st === "ready" || st === "completed" || st === "indexed") {
      return last;
    }
    if (!inProgress.has(st) && st.length > 0) {
      return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  if (!last) throw new Error(`No response polling ${sourceId}`);
  return last;
}

export function parseSourceIdsFromArgv(argv: string[]): string[] {
  const ids: string[] = [];
  for (const arg of argv) {
    if (arg.includes(",")) {
      ids.push(...arg.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (arg.trim()) {
      ids.push(arg.trim());
    }
  }
  return [...new Set(ids)];
}

export function parseSourceIdsFromEnv(): string[] {
  const raw = process.env.NIA_SOURCE_IDS?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}
