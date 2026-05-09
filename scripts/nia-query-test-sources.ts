#!/usr/bin/env bun
/**
 * Run a scoped Nia search against source IDs (from ingest or env).
 *
 * Usage:
 *   bun run scripts/nia-query-test-sources.ts <sourceId> [sourceId...]
 *   NIA_SOURCE_IDS=id1,id2 bun run scripts/nia-query-test-sources.ts
 *
 * Optional:
 *   NIA_TEST_QUERY="your question"  (default: campaign / brand question)
 *
 * By default uses skip_llm=false so you see `content` + `sources` (tree-guided chunks for PDFs).
 * Set NIA_SEARCH_SKIP_LLM=1 for retrieval-only (often empty until indexes are warm).
 */

import { createNiaSdk, parseSourceIdsFromArgv, parseSourceIdsFromEnv } from "./nia-test-utils.ts";

const DEFAULT_QUERY =
  "Summarize brand positioning, campaign objectives, and any KPIs or outcomes mentioned in these documents.";

async function main() {
  const argvIds = parseSourceIdsFromArgv(process.argv.slice(2).filter((a) => !a.startsWith("-")));
  const envIds = parseSourceIdsFromEnv();
  const sourceIds = argvIds.length ? argvIds : envIds;

  if (!sourceIds.length) {
    console.error(
      "Pass source IDs as arguments, or set NIA_SOURCE_IDS=id1,id2\n" +
        "Example: bun run scripts/nia-query-test-sources.ts abc-123 def-456"
    );
    process.exit(1);
  }

  const query = process.env.NIA_TEST_QUERY?.trim() || DEFAULT_QUERY;
  const sdk = createNiaSdk();
  const skipLlm = process.env.NIA_SEARCH_SKIP_LLM === "1";

  console.log(`Query: ${query}`);
  console.log(`data_sources: ${sourceIds.join(", ")}`);
  console.log(`skip_llm: ${skipLlm} (set NIA_SEARCH_SKIP_LLM=1 for retrieval-only)\n`);

  const body = {
    messages: [{ role: "user", content: query }],
    data_sources: sourceIds.map((id) => ({ source_id: id })),
    skip_llm: skipLlm,
    include_sources: true,
    fast_mode: true,
    search_mode: "unified"
  };

  const raw = await sdk.search.query(body);

  console.log("=== Nia search response (raw JSON) ===\n");
  console.log(JSON.stringify(raw, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
