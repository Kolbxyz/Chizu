// API list prices used to estimate the cost of a run (USD per million tokens).
// Source: Anthropic model table, 2026-10. Cache writes use the 5-minute rate.
export const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"] as const;
export type ApiModel = (typeof MODELS)[number];
export const DEFAULT_MODEL: ApiModel = "claude-opus-5-5";

const PRICES: Record<
  ApiModel,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
};
const WEB_SEARCH_USD = 0.01;

export interface UsageTotals {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  webSearches: number;
}

export const emptyUsage = (): UsageTotals => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  webSearches: 0,
});

export function estimateCost(model: ApiModel, usage: UsageTotals): number {
  const price = PRICES[model];
  return (
    (usage.input * price.input +
      usage.output * price.output +
      usage.cacheWrite * price.cacheWrite +
      usage.cacheRead * price.cacheRead) /
      1_000_000 +
    usage.webSearches * WEB_SEARCH_USD
  );
}
