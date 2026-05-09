#!/usr/bin/env bun
/**
 * End-to-end agent smoke test for Nia-backed context retrieval.
 *
 * Usage:
 *   bun run test:agent:nia <sourceId> [sourceId...]
 *   NIA_SOURCE_IDS=id1,id2 bun run test:agent:nia
 *   bun run test:agent:nia:e2e
 *
 * Optional:
 *   AGENT_TEST_QUERY="What campaign objective and KPIs should we prioritize?"
 *   AGENT_TEST_OBJECTIVE=auto|awareness|engagement|sales
 *
 * This intentionally fails if the agent falls back to brief-only context.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { runAgent } from "../apps/api/src/agent/runAgent.ts";
import { retrieveNiaContext } from "../apps/api/src/integrations/nia/retrieveContext.ts";
import type { CampaignAgentBody, CampaignIntelligenceReport } from "../apps/api/src/agent/schema.ts";
import { ingestBrandContextFiles } from "../apps/api/src/integrations/nia/ingestBrandFiles.ts";
import {
  getRepoRoot,
  parseSourceIdsFromArgv,
  parseSourceIdsFromEnv,
  pollSourceUntilSettled,
  requireNiaApiKey
} from "./nia-test-utils.ts";

const DEFAULT_QUERY =
  "Using the uploaded Nia campaign context, what objective, KPI framework, and next actions should the brand prioritize?";
const SHOULD_INGEST_TEST_DOCS = process.argv.includes("--ingest-test-documents");
const SUPPORTED_TEST_DOC_EXTENSIONS = new Set([
  "pdf",
  "csv",
  "tsv",
  "xlsx",
  "xls",
  "txt",
  "md",
  "json",
  "html",
  "htm",
  "xml",
  "yaml",
  "yml"
]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isReport(value: Awaited<ReturnType<typeof runAgent>>): value is CampaignIntelligenceReport {
  return "executiveSummary" in value && "dataProvenance" in value;
}

function objectiveFromEnv(): CampaignAgentBody["campaign"]["objective"] {
  const raw = process.env.AGENT_TEST_OBJECTIVE?.trim();
  if (!raw) return "auto";
  if (raw === "auto" || raw === "awareness" || raw === "engagement" || raw === "sales") {
    return raw;
  }
  throw new Error("AGENT_TEST_OBJECTIVE must be one of: auto, awareness, engagement, sales.");
}

function buildAgentInput(sourceIds: string[], query: string): CampaignAgentBody {
  return {
    campaign: {
      name: "Nia Context Agent Test",
      brand: "Nozo Demo Brand",
      objective: objectiveFromEnv(),
      product: "TikTok Shop hero product",
      audience: "social commerce shoppers",
      budget: 25_000,
      kpiPriorities: ["gmv", "conversion_rate", "ctr", "engagement_quality"],
      brief: query
    },
    nia: {
      sourceIds,
      queryHints: [
        query,
        "Find source-backed campaign objectives, product positioning, audience context, benchmarks, and KPI implications."
      ]
    },
    creators: [
      {
        name: "Maya Chen",
        handle: "@mayamakes",
        archetype: "tutorial educator",
        contentFormat: "product tutorial",
        audienceSegment: "ingredient-conscious shoppers",
        reach: 182_000,
        impressions: 241_000,
        completionRate: 0.61,
        likes: 13_900,
        comments: 880,
        shares: 1_940,
        saves: 3_180,
        ctr: 0.042,
        addToCart: 1_230,
        conversionRate: 0.083,
        gmv: 48_500,
        cpa: 18.5,
        roas: 4.6,
        sentimentScore: 0.82,
        representativeComments: ["This explains exactly how I would use it.", "The before and after helped."],
        source: "manual"
      },
      {
        name: "Jay Brooks",
        handle: "@jaytries",
        archetype: "entertainment reviewer",
        contentFormat: "trend skit",
        audienceSegment: "deal-seeking Gen Z",
        reach: 418_000,
        impressions: 520_000,
        completionRate: 0.44,
        likes: 21_200,
        comments: 540,
        shares: 1_120,
        saves: 710,
        ctr: 0.015,
        addToCart: 420,
        conversionRate: 0.027,
        gmv: 15_400,
        cpa: 42.1,
        roas: 1.8,
        sentimentScore: 0.56,
        representativeComments: ["Funny but what does it do?", "I missed the shop link."],
        source: "manual"
      }
    ]
  };
}

async function filesFromTestDocuments(): Promise<File[]> {
  const dir = join(getRepoRoot(), "test_documents");
  const names = await readdir(dir);
  const files: File[] = [];

  for (const name of names) {
    if (name.startsWith(".")) continue;
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    if (!SUPPORTED_TEST_DOC_EXTENSIONS.has(ext)) continue;

    const path = join(dir, name);
    const buf = await Bun.file(path).arrayBuffer();
    const mime =
      ext === "pdf" ? "application/pdf" : ext === "json" ? "application/json" : "text/plain";
    files.push(new File([buf], name, { type: mime }));
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

async function ingestAndPollTestDocuments(): Promise<string[]> {
  const files = await filesFromTestDocuments();
  assert(files.length > 0, "No supported files found in test_documents/.");

  console.log(`Ingesting test documents: ${files.map((file) => file.name).join(", ")}`);
  const ingest = await ingestBrandContextFiles(files, {
    campaignLabel: "agent-nia-context-test"
  });

  if (ingest.errors.length) {
    console.log(`Ingest warnings: ${ingest.errors.map((error) => error.message).join("; ")}`);
  }

  assert(ingest.indexed.length > 0, "No test documents were indexed into Nia.");

  for (const item of ingest.indexed) {
    console.log(`Polling ${item.sourceId} (${item.filename})`);
    await pollSourceUntilSettled(item.sourceId, {
      onTick: (source) => console.log(`  status: ${source.status ?? "(unknown)"}`)
    });
  }

  return ingest.indexed.map((item) => item.sourceId);
}

async function resolveSourceIds(): Promise<string[]> {
  if (SHOULD_INGEST_TEST_DOCS) return ingestAndPollTestDocuments();

  const sourceIds = parseSourceIdsFromArgv(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));
  const envSourceIds = parseSourceIdsFromEnv();
  return sourceIds.length ? sourceIds : envSourceIds;
}

async function main() {
  requireNiaApiKey();

  const selectedSourceIds = await resolveSourceIds();

  assert(
    selectedSourceIds.length > 0,
    "Pass Nia source IDs as arguments, set NIA_SOURCE_IDS=id1,id2, or run test:agent:nia:e2e."
  );

  const query = process.env.AGENT_TEST_QUERY?.trim() || DEFAULT_QUERY;
  const input = buildAgentInput(selectedSourceIds, query);

  console.log("Step 1 - Verifying Nia retrieval adapter");
  console.log(`Query: ${query}`);
  console.log(`Nia source IDs: ${selectedSourceIds.join(", ")}`);

  const niaResult = await retrieveNiaContext(input);
  assert(niaResult.errors.length === 0, `Nia retrieval returned errors: ${niaResult.errors.join("; ")}`);
  assert(niaResult.context.length > 0, "Nia retrieval returned no context excerpts.");

  console.log(`Nia excerpts returned: ${niaResult.context.length}`);
  console.log(`First excerpt: ${niaResult.context[0]?.excerpt.slice(0, 300)}\n`);

  console.log("Step 2 - Running LangGraph agent");
  const result = await runAgent(input);
  assert(isReport(result), "Expected a structured campaign intelligence report.");
  assert(
    result.dataProvenance.contextSource === "nia",
    `Expected contextSource=nia, received ${result.dataProvenance.contextSource}.`
  );
  assert(
    selectedSourceIds.every((sourceId) => result.dataProvenance.niaSourcesUsed.includes(sourceId)),
    "Report provenance did not include every selected Nia source ID."
  );

  console.log("\n=== Agent Answer ===");
  console.log(result.executiveSummary);

  console.log("\n=== KPI Framework ===");
  console.log(`${result.objective}: ${result.kpiFramework.summary}`);
  for (const metric of result.kpiFramework.metrics) {
    console.log(`- ${metric.name}: ${metric.weight}% - ${metric.reason}`);
  }

  console.log("\n=== Recommendations ===");
  for (const recommendation of result.recommendations) {
    console.log(`- [${recommendation.priority}] ${recommendation.action}`);
  }

  console.log("\nPASS: Agent used Nia context and returned a structured answer.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
