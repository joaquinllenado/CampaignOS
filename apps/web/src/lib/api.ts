import type { AgentRunErrorResponse, AgentRunSuccess } from "./campaignTypes";

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

  const data = await response.json() as NiaBrandIngestOk | AgentRunErrorResponse;

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

  const typed = (await response.json()) as AgentRunSuccess | AgentRunErrorResponse;

  if (!response.ok || !("mode" in typed)) {
    const err = typed as AgentRunErrorResponse;
    throw new Error(typeof err.error === "string" ? err.error : "Agent request failed.");
  }

  return typed;
}
