import { useEffect, useState } from "react";
import type { AgentActivityItem } from "../lib/campaignTypes";

const DEMO_PULSE_MESSAGES: readonly { title: string; description: string }[] = [
  {
    title: "Background scan: engagement velocity",
    description:
      "Recomputed short-window engagement deltas against the weighted KPI ladder so recommendations stay prioritized."
  },
  {
    title: "Outbound hygiene check",
    description:
      "Flagged creators who fell below tier benchmarks while holding budget-neutral alternatives in reserve."
  },
  {
    title: "Context refresh queue",
    description:
      "Staged refreshed brief hooks for creatives where completion rate softened but CTR remained strong."
  },
  {
    title: "Portfolio balance pass",
    description:
      "Verified goal-mix drift across awareness, engagement, and sales objectives before the next pacing cycle."
  }
];

/** Keeps Agent activity timelines moving when optional demo pacing is enabled in dev. */
export function useDemoAutonomousActivity(
  baseline: AgentActivityItem[],
  options: { enabled: boolean; reportGeneratedAt: string }
): AgentActivityItem[] {
  const { enabled, reportGeneratedAt } = options;
  const [extras, setExtras] = useState<AgentActivityItem[]>([]);

  useEffect(() => {
    setExtras([]);
  }, [reportGeneratedAt]);

  useEffect(() => {
    if (!enabled) return;
    let rotation = 0;
    let seq = 0;
    const pump = () => {
      const tpl = DEMO_PULSE_MESSAGES[rotation % DEMO_PULSE_MESSAGES.length];
      rotation += 1;
      seq += 1;
      const item: AgentActivityItem = {
        id: `activity-${Date.now()}-${seq}`,
        kind: "context_refreshed",
        title: tpl.title,
        description: tpl.description,
        occurredAt: new Date().toISOString()
      };
      setExtras((prev) => [item, ...prev].slice(0, 16));
    };
    const first = window.setTimeout(pump, 9_000);
    const repeat = window.setInterval(pump, 52_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(repeat);
    };
  }, [enabled]);

  return enabled ? [...extras, ...baseline] : baseline;
}
