import type { AgentRunErrorResponse, AgentRunSuccess } from "./campaignTypes";

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

  const response = await fetch("/api/nia/ingest", {
    method: "POST",
    body: fd
  });

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

export async function submitAgentRun(payload: unknown): Promise<AgentRunSuccess> {
  const response = await fetch("/api/agent/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const typed = await readJsonResponse<AgentRunSuccess | AgentRunErrorResponse>(response);

  if (!response.ok || !("mode" in typed)) {
    const err = typed as AgentRunErrorResponse;
    throw new Error(typeof err.error === "string" ? err.error : "Agent request failed.");
  }

  return typed;
}
