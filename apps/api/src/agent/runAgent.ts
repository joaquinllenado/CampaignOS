import { formatValidationIssues, intakeBodySchema, legacyPromptSchema } from "./schema";
import type { CampaignIntelligenceReport } from "./schema";
import { runCampaignGraph, streamCampaignGraphRun } from "./graph";

export type LegacyAgentRequest = {
  prompt: string;
};

export type LegacyAgentResponse = {
  mode: "legacy_prompt";
  answer: string;
  createdAt: string;
  model: string;
};

export type CampaignAgentRunResponse = LegacyAgentResponse | CampaignIntelligenceReport;

function runLegacyAgent({ prompt }: LegacyAgentRequest): LegacyAgentResponse {
  const normalizedPrompt = prompt.trim();

  if (!normalizedPrompt) {
    throw new Error("Prompt is required.");
  }

  return {
    mode: "legacy_prompt",
    answer: `You asked: "${normalizedPrompt}". The agent service is wired and ready for real tools, memory, or model calls.`,
    createdAt: new Date().toISOString(),
    model: "local-scaffold"
  };
}

export function createCampaignAgentNdjsonStream(body: unknown):
  | { ok: false; error: string }
  | { ok: true; stream: ReadableStream<Uint8Array> } {
  if (typeof body !== "object" || body === null || !("campaign" in body)) {
    return { ok: false, error: "Streaming is only available for campaign intake requests." };
  }

  const parsed = intakeBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: formatValidationIssues(parsed.error) };
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      try {
        send({ type: "progress", label: "Starting campaign analysis" });
        const report = await streamCampaignGraphRun(parsed.data, ({ label }) => {
          send({ type: "progress", label });
        });
        send({ type: "complete", report });
      } catch (error) {
        send({
          type: "error",
          error: error instanceof Error ? error.message : "Unable to run agent."
        });
      } finally {
        controller.close();
      }
    }
  });

  return { ok: true, stream };
}

export async function runAgent(body: unknown): Promise<CampaignAgentRunResponse> {
  if (typeof body === "object" && body !== null && "campaign" in body) {
    const parsed = intakeBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(formatValidationIssues(parsed.error));
    }
    return runCampaignGraph(parsed.data);
  }

  const legacy = legacyPromptSchema.safeParse(body);
  if (!legacy.success) {
    throw new Error(formatValidationIssues(legacy.error));
  }

  return runLegacyAgent(legacy.data);
}
