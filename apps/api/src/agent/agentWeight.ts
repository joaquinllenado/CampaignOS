import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const bundledPath = join(__dirname, "AgentWeight.txt");
const repoRootFallback = join(__dirname, "../../../..", "AgentWeight.txt");

/** Strategic blueprint: prefers repo-root `AgentWeight.txt` in dev when present; uses shipped copy beside this module in deployments. */
export const AGENT_WEIGHT_INSTRUCTIONS = readFileSync(
  existsSync(repoRootFallback) ? repoRootFallback : bundledPath,
  "utf8"
);
