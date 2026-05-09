#!/usr/bin/env bun
/**
 * Full local workflow: ingest test_documents → poll each source → one scoped search.
 *
 * Usage:
 *   bun run scripts/nia-e2e-test-documents.ts
 *
 * Requires: NIA_API_KEY
 * Optional: NIA_TEST_QUERY, NIA_BASE_URL
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ingestBrandContextFiles } from "../apps/api/src/integrations/nia/ingestBrandFiles.ts";
import {
  createNiaSdk,
  getRepoRoot,
  pollSourceUntilSettled
} from "./nia-test-utils.ts";

const SUPPORTED_EXT = new Set([
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

const DEFAULT_QUERY =
  "What products, audiences, and past campaign results are described? List concrete metrics if present.";

async function loadTestFiles(): Promise<File[]> {
  const root = getRepoRoot();
  const dir = join(root, "test_documents");
  const names = await readdir(dir);
  const out: File[] = [];

  for (const name of names) {
    if (name.startsWith(".")) continue;
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    if (!SUPPORTED_EXT.has(ext)) continue;
    const path = join(dir, name);
    const buf = await Bun.file(path).arrayBuffer();
    const mime = ext === "pdf" ? "application/pdf" : "application/octet-stream";
    out.push(new File([buf], name, { type: mime }));
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const files = await loadTestFiles();
  if (!files.length) {
    console.error("No files in test_documents/.");
    process.exit(1);
  }

  console.log("Step 1 — Ingest\n");
  const ingest = await ingestBrandContextFiles(files, {
    campaignLabel: "e2e-test_documents"
  });
  console.log(JSON.stringify(ingest, null, 2));

  if (!ingest.indexed.length) {
    console.error("No sources indexed; fix errors above.");
    process.exit(1);
  }

  const ids = ingest.indexed.map((i) => i.sourceId);

  console.log("\nStep 2 — Poll until settled\n");
  for (const id of ids) {
    console.log(`  ${id}`);
    await pollSourceUntilSettled(id, {
      onTick: (s) => console.log(`    ${s.status}`)
    });
  }

  const query = process.env.NIA_TEST_QUERY?.trim() || DEFAULT_QUERY;
  const sdk = createNiaSdk();

  console.log("\nStep 3 — Search (skip_llm, include_sources)\n");
  console.log(`  query: ${query}`);

  const skipLlm = process.env.NIA_SEARCH_SKIP_LLM === "1";

  const raw = await sdk.search.query({
    messages: [{ role: "user", content: query }],
    data_sources: ids.map((id) => ({ source_id: id })),
    skip_llm: skipLlm,
    include_sources: true,
    fast_mode: true,
    search_mode: "unified"
  });

  console.log("\n=== Search response ===\n");
  console.log(JSON.stringify(raw, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
