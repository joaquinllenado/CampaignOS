import { ApiError, NiaSDK } from "nia-ai-ts";
import type { CampaignAgentBody, NiaContextResult } from "../../agent/schema";

export type NiaRetrievalResult = {
  context: NiaContextResult[];
  sourcesUsed: string[];
  errors: string[];
};

const DEFAULT_NIA_BASE_URL = "https://apigcp.trynia.ai/v2";
const MAX_CONTEXT_RESULTS = 8;
const MAX_EXCERPT_CHARS = 1_200;

function createNiaSdk(): NiaSDK | null {
  const apiKey = Bun.env.NIA_API_KEY?.trim();
  if (!apiKey) return null;

  return new NiaSDK({
    apiKey,
    baseUrl: Bun.env.NIA_BASE_URL?.trim() || DEFAULT_NIA_BASE_URL
  });
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function numberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function truncateExcerpt(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > MAX_EXCERPT_CHARS
    ? `${compact.slice(0, MAX_EXCERPT_CHARS - 3)}...`
    : compact;
}

function normalizeSource(raw: unknown, fallbackIndex: number): NiaContextResult | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const excerpt = stringField(record, [
    "excerpt",
    "content",
    "text",
    "chunk",
    "snippet",
    "preview",
    "summary"
  ]);

  if (!excerpt) return null;

  return {
    sourceId:
      stringField(record, ["source_id", "sourceId", "id", "source"]) ?? `nia-result-${fallbackIndex + 1}`,
    sourceName: stringField(record, ["source_name", "sourceName", "display_name", "name"]),
    title: stringField(record, ["title", "path", "file_name", "filename"]),
    excerpt: truncateExcerpt(excerpt),
    url: stringField(record, ["url", "uri", "source_url"]),
    relevanceScore: numberField(record, ["score", "relevance_score", "relevanceScore"])
  };
}

function normalizeNiaResponse(raw: unknown): NiaContextResult[] {
  if (!raw || typeof raw !== "object") return [];

  const record = raw as Record<string, unknown>;
  const normalized: NiaContextResult[] = [];

  const sourceArrays = ["sources", "results", "documents", "contexts"]
    .map((key) => record[key])
    .filter(Array.isArray) as unknown[][];

  for (const sourceArray of sourceArrays) {
    for (const source of sourceArray) {
      const result = normalizeSource(source, normalized.length);
      if (result) normalized.push(result);
      if (normalized.length >= MAX_CONTEXT_RESULTS) return normalized;
    }
  }

  const content = stringField(record, ["content", "answer", "response", "message"]);
  if (content) {
    normalized.push({
      sourceId: "nia-synthesized-context",
      title: "Nia synthesized context",
      excerpt: truncateExcerpt(content)
    });
  }

  return normalized.slice(0, MAX_CONTEXT_RESULTS);
}

function buildNiaQuery(input: CampaignAgentBody): string {
  const { campaign, nia } = input;
  const hints = nia?.queryHints?.length ? ` Query hints: ${nia.queryHints.join("; ")}.` : "";

  return [
    `Retrieve source-backed campaign context for ${campaign.brand}'s ${campaign.name} campaign.`,
    `Product/category: ${campaign.product}.`,
    `Audience: ${campaign.audience}.`,
    `Objective: ${campaign.objective}.`,
    `Brief: ${campaign.brief}`,
    hints,
    "Focus on brand positioning, audience insight, objective interpretation, historical learnings, benchmarks, constraints, and KPI implications."
  ]
    .filter(Boolean)
    .join(" ");
}

function niaErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail =
      error.body === undefined
        ? ""
        : typeof error.body === "string"
          ? error.body
          : JSON.stringify(error.body);
    return detail ? `${error.message} ${detail}` : error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

export async function retrieveNiaContext(input: CampaignAgentBody): Promise<NiaRetrievalResult> {
  const requestedSourceIds = input.nia?.sourceIds ?? [];
  const requestedSourceNames = input.nia?.sourceNames ?? [];
  const sourcesUsed = [...requestedSourceIds, ...requestedSourceNames];

  if (!sourcesUsed.length) {
    return {
      context: [],
      sourcesUsed: [],
      errors: ["No Nia sources were selected, so the report uses campaign brief context only."]
    };
  }

  const sdk = createNiaSdk();
  if (!sdk) {
    return {
      context: [],
      sourcesUsed,
      errors: ["NIA_API_KEY is not configured, so Nia retrieval was skipped."]
    };
  }

  try {
    const raw = await sdk.search.query({
      messages: [{ role: "user", content: buildNiaQuery(input) }],
      data_sources: requestedSourceIds.map((sourceId) => ({ source_id: sourceId })),
      skip_llm: false,
      include_sources: true,
      fast_mode: true,
      search_mode: "unified"
    });

    return {
      context: normalizeNiaResponse(raw),
      sourcesUsed,
      errors: []
    };
  } catch (error) {
    return {
      context: [],
      sourcesUsed,
      errors: [`Nia retrieval failed: ${niaErrorMessage(error)}`]
    };
  }
}
