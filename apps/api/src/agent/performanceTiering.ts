/** Composite / framework creator labels */
export type PerformanceTier = "low" | "average" | "high";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts parallel weighted scores (same order per creator) into tiers vs this cohort only.
 *
 * Inputs are derived from max-normalized metrics inside the scorer, which compresses averages;
 * tiers therefore use rank splits (~upper 45% high, middle average, bottom ~24% low) adjusted for tiny cohorts.
 */
export function cohortPerformanceTiersForScores(scores: readonly number[]): PerformanceTier[] {
  const n = scores.length;
  if (n === 0) return [];

  const indexed = scores.map((score, index) => ({ score, index }));
  indexed.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));

  if (n === 1) {
    return ["high"];
  }

  let lowSlots: number;
  let highSlots: number;

  if (n === 2) {
    lowSlots = 0;
    highSlots = 1;
  } else {
    lowSlots = clamp(Math.floor(n * 0.24), 1, n - 2);
    const maxHigh = Math.max(1, n - lowSlots - 1);
    highSlots = Math.min(maxHigh, Math.max(1, Math.ceil(n * 0.45)));
  }

  const byIndex: PerformanceTier[] = Array.from({ length: n }, () => "average");

  for (let sortedPos = 0; sortedPos < n; sortedPos += 1) {
    const originalIndex = indexed[sortedPos]!.index;
    let tier: PerformanceTier;
    if (sortedPos < highSlots) tier = "high";
    else if (lowSlots > 0 && sortedPos >= n - lowSlots) tier = "low";
    else tier = "average";
    byIndex[originalIndex] = tier;
  }

  return byIndex;
}
