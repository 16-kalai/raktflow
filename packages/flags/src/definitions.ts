import { z } from "zod";
import {
  DEMO_FESTIVALS_BY_STATE,
  DEMO_HORIZON_DAYS,
  DEMO_SAFE_STOCK_DAYS,
  DEMO_YIELD,
} from "@raktflow/core";

/**
 * Every Flagsmith feature RaktFlow reads, with its type and the value we use
 * when Flagsmith can't be reached. Defaults fail closed: no flags, no calls.
 */
export const FLAG = {
  festiveMode: "festive_mode",
  surgeMode: "surge_mode",
  outboundCallsEnabled: "outbound_calls_enabled",
  maxConcurrentCalls: "max_concurrent_calls",
  forecastConfig: "forecast_config",
  callScript: "call_script",
  healthQuestions: "health_questions",
} as const;

export type FlagName = (typeof FLAG)[keyof typeof FLAG];

export const forecastConfigSchema = z.object({
  horizonDays: z.number().int().min(7).max(60).default(DEMO_HORIZON_DAYS),
  safeStockDays: z.number().min(1).max(10).default(DEMO_SAFE_STOCK_DAYS),
  shelfLifeDays: z.number().int().min(21).max(42).default(42),
  yield: z
    .object({ showUp: z.number().min(0).max(1), passScreening: z.number().min(0).max(1) })
    .default(DEMO_YIELD),
  /** Collection factor per festival name; overrides the database fallback. */
  festivalFactors: z.record(z.string(), z.number().min(0).max(1.5)).default({}),
});
export type ForecastConfig = z.infer<typeof forecastConfigSchema>;

export const healthQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  /** Answer that means "defer, don't book". */
  deferOn: z.enum(["yes", "no"]).default("yes"),
  deferralDays: z.number().int().min(0),
});
export const healthQuestionsSchema = z.object({
  version: z.string(),
  questions: z.array(healthQuestionSchema).min(1),
});
export type HealthQuestions = z.infer<typeof healthQuestionsSchema>;

export const DEFAULT_FORECAST_CONFIG: ForecastConfig = forecastConfigSchema.parse({
  festivalFactors: Object.fromEntries(
    Object.values(DEMO_FESTIVALS_BY_STATE)
      .flat()
      .map((f) => [f.name, f.collectionFactor]),
  ),
});

export const DEFAULT_HEALTH_QUESTIONS: HealthQuestions = {
  version: "v2",
  questions: [
    { id: "fever", question: "Any fever or illness in the last two weeks?", deferOn: "yes", deferralDays: 14 },
    { id: "tattoo_surgery", question: "Any tattoo, piercing or surgery in the past year?", deferOn: "yes", deferralDays: 365 },
    { id: "antibiotics", question: "Are you taking any antibiotics right now?", deferOn: "yes", deferralDays: 7 },
  ],
};

export type CallScript = "festive" | "standard";

export interface BankFlags {
  festiveMode: boolean;
  surgeMode: boolean;
  outboundCallsEnabled: boolean;
  maxConcurrentCalls: number;
  forecastConfig: ForecastConfig;
  healthQuestions: HealthQuestions;
  /** "flagsmith" when values are live, "defaults" when Flagsmith isn't configured or reachable. */
  source: "flagsmith" | "defaults";
}

export interface DonorFlags {
  language: string;
  callScript: CallScript;
  source: "flagsmith" | "defaults";
}

export const FAIL_CLOSED_BANK_FLAGS: BankFlags = {
  festiveMode: false,
  surgeMode: false,
  outboundCallsEnabled: false,
  maxConcurrentCalls: 0,
  forecastConfig: DEFAULT_FORECAST_CONFIG,
  healthQuestions: DEFAULT_HEALTH_QUESTIONS,
  source: "defaults",
};
