import type { AgentRunErrorResponse, AgentRunSuccess, CampaignIntelligenceReport } from "./campaignTypes";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`Empty response from server (${response.status}).`);
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
    throw new Error(
      response.ok
        ? `Server returned non-JSON: ${preview}`
        : `Request failed (${response.status}): ${preview}`
    );
  }
}

/** Slightly above API default `NIA_INGEST_TIMEOUT_MS` (180s) so the server can return a JSON error first. */
const NIA_INGEST_FETCH_MS = 210_000;

export type NiaBrandIngestOk = {
  indexed: Array<{
    filename: string;
    sourceId: string;
    displayName: string | null;
    status: string | null;
    method: string;
  }>;
  errors: Array<{ filename: string; message: string }>;
};

export async function ingestNiaBrandFiles(
  files: File[],
  campaignLabel?: string
): Promise<NiaBrandIngestOk> {
  if (!files.length) {
    throw new Error("Choose at least one file to upload.");
  }

  const fd = new FormData();
  const label = campaignLabel?.trim();
  if (label) fd.append("campaignLabel", label);
  for (const file of files) {
    fd.append("files", file);
  }

  let response: Response;
  try {
    response = await fetch("/api/nia/ingest", {
      method: "POST",
      body: fd,
      signal: AbortSignal.timeout(NIA_INGEST_FETCH_MS)
    });
  } catch (caught) {
    if (caught instanceof Error && caught.name === "AbortError") {
      throw new Error(
        "Indexing timed out in the browser. Try a smaller file or ensure the API finishes within a few minutes (see NIA_INGEST_TIMEOUT_MS)."
      );
    }
    throw caught;
  }

  const data = await readJsonResponse<NiaBrandIngestOk | AgentRunErrorResponse>(response);

  if (!response.ok || "error" in data) {
    throw new Error(
      "error" in data && typeof data.error === "string"
        ? data.error
        : "Upload to Nia failed."
    );
  }

  return data;
}

type AgentStreamMessage =
  | { type: "progress"; label: string }
  | { type: "complete"; report: CampaignIntelligenceReport }
  | { type: "error"; error: string };

export async function submitAgentRunWithProgress(
  payload: unknown,
  onProgress: (label: string) => void
): Promise<CampaignIntelligenceReport> {
  const response = await fetch("/api/agent/run/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const typed = await readJsonResponse<AgentRunErrorResponse | AgentRunSuccess>(response);
    if ("error" in typed && typeof typed.error === "string") {
      throw new Error(typed.error);
    }
    throw new Error(`Agent stream failed (${response.status}).`);
  }

  if (!response.body) {
    throw new Error("No response body from agent stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let report: CampaignIntelligenceReport | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const msg = JSON.parse(trimmed) as AgentStreamMessage;
    if (msg.type === "progress") onProgress(msg.label);
    else if (msg.type === "complete") report = msg.report;
    else if (msg.type === "error") throw new Error(msg.error);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const nl = buffer.indexOf("\n");
      if (nl < 0) break;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      handleLine(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    handleLine(buffer);
  }

  if (!report) {
    throw new Error("Stream ended without a campaign report.");
  }

  return report;
}

export async function submitAgentRun(payload: unknown): Promise<AgentRunSuccess> {
  const response = await fetch("/api/agent/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const typed = await readJsonResponse<AgentRunSuccess | AgentRunErrorResponse>(response);

  if (!response.ok || "error" in typed) {
    const err = typed as AgentRunErrorResponse;
    throw new Error(typeof err.error === "string" ? err.error : "Agent request failed.");
  }

  return typed;
}

export type OutreachBatchPayload = {
  tier: "high" | "average" | "low";
  campaignName: string;
  subject?: string;
  drafts: Array<{
    creatorName?: string;
    creatorHandle?: string;
    body: string;
  }>;
  recipientEmails?: string[];
};

export type OutreachBatchResult = {
  ok: boolean;
  dryRun: boolean;
  automationId?: number;
  message: string;
};

export async function sendOutreachBatch(payload: OutreachBatchPayload): Promise<OutreachBatchResult> {
  const response = await fetch("/api/outreach/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await readJsonResponse<OutreachBatchResult | AgentRunErrorResponse>(response);

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as OutreachBatchResult;
}
