#!/usr/bin/env bun
/**
 * Ingest every file under test_documents/ into Nia (same path as /api/nia/ingest).
 *
 * Usage (from repo root):
 *   bun run scripts/nia-ingest-test-documents.ts
 *   bun run scripts/nia-ingest-test-documents.ts --poll
 *
 * Requires: NIA_API_KEY in .env
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ingestBrandContextFiles } from "../apps/api/src/integrations/nia/ingestBrandFiles.ts";
import { getRepoRoot, pollSourceUntilSettled } from "./nia-test-utils.ts";

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

async function filesFromTestDocuments(): Promise<File[]> {
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
    const mime =
      ext === "pdf"
        ? "application/pdf"
        : ext === "json"
          ? "application/json"
          : "text/plain";
    out.push(new File([buf], name, { type: mime }));
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const poll = process.argv.includes("--poll");
  const files = await filesFromTestDocuments();

  if (!files.length) {
    console.error("No supported files in test_documents/. Add PDF, CSV, or text files.");
    process.exit(1);
  }

  console.log(`Ingesting ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`);

  const result = await ingestBrandContextFiles(files, {
    campaignLabel: "test_documents-workflow"
  });

  console.log("\n=== Ingest result (API-shaped) ===\n");
  console.log(JSON.stringify(result, null, 2));

  if (result.errors.length) {
    console.error(`\n${result.errors.length} file(s) failed.`);
  }

  if (poll && result.indexed.length) {
    console.log("\n=== Poll source status ===\n");
    for (const item of result.indexed) {
      console.log(`Polling ${item.sourceId} (${item.filename})…`);
      const settled = await pollSourceUntilSettled(item.sourceId, {
        onTick: (s) => {
          console.log(`  status: ${s.status ?? "(none)"}`);
        }
      });
      console.log(`  final: ${settled.status} — display_name: ${settled.display_name ?? "—"}`);
    }
  } else if (result.indexed.length) {
    console.log("\nTip: run with --poll to wait for indexing, then:");
    console.log(
      `  bun run scripts/nia-query-test-sources.ts ${result.indexed.map((i) => i.sourceId).join(" ")}`
    );
  }

  process.exit(result.errors.length && !result.indexed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
