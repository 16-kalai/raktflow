import { config } from "dotenv";
import { DEMO_FESTIVE_SEASON_BY_STATE, toDateNumber } from "@raktflow/core";
import { FlagsmithAdmin, adminConfigFromEnv } from "./admin";
import { DEFAULT_FORECAST_CONFIG, DEFAULT_HEALTH_QUESTIONS, FLAG } from "./definitions";

config({ path: new URL("../../../.env.local", import.meta.url).pathname });

/**
 * Creates every RaktFlow flag and the festive-season segments in Flagsmith.
 * Safe to run twice: existing flags and segments are left alone.
 */
const cfg = adminConfigFromEnv();
if (!cfg) {
  console.error("Set FLAGSMITH_ADMIN_API_KEY, FLAGSMITH_PROJECT_ID and FLAGSMITH_ENVIRONMENT_KEY in .env.local");
  process.exit(1);
}
const admin = new FlagsmithAdmin(cfg);

const flags = [
  { name: FLAG.festiveMode, description: "Festive-season planning mode. Switched on per state by date segments.", defaultEnabled: false },
  { name: FLAG.surgeMode, description: "Shortage campaign running. Written by the NudgeBee workflow after the medical officer approves.", defaultEnabled: false },
  { name: FLAG.outboundCallsEnabled, description: "Kill switch for every outbound donor call.", defaultEnabled: true },
  { name: FLAG.maxConcurrentCalls, description: "Global limit on calls in progress across all worker pods.", defaultEnabled: true, initialValue: 4 },
  { name: FLAG.forecastConfig, description: "Forecast assumptions: horizon, safe stock days, expected yield, festival factors.", defaultEnabled: true, initialValue: JSON.stringify(DEFAULT_FORECAST_CONFIG) },
  { name: FLAG.callScript, description: "Call script variant per donor: festive or standard.", defaultEnabled: true, initialValue: "festive" },
  { name: FLAG.healthQuestions, description: "Pre-check questions asked on the call. Clinical: change only with medical officer approval.", defaultEnabled: true, initialValue: JSON.stringify(DEFAULT_HEALTH_QUESTIONS) },
];

for (const f of flags) {
  if (await admin.findFeature(f.name)) {
    console.log(`= ${f.name} exists`);
    continue;
  }
  await admin.createFeature(f);
  console.log(`+ ${f.name}`);
}

const existing = await admin.listSegments();
for (const [state, window] of Object.entries(DEMO_FESTIVE_SEASON_BY_STATE)) {
  const name = `festive_season_${state}`;
  let segment = existing.find((s) => s.name === name);
  if (!segment) {
    const created = await admin.createSegment(name, `Festive season for banks in ${state} (${window.start} → ${window.end})`, [
      { property: "state", operator: "EQUAL", value: state },
      { property: "today", operator: "GREATER_THAN_INCLUSIVE", value: String(toDateNumber(window.start)) },
      { property: "today", operator: "LESS_THAN_INCLUSIVE", value: String(toDateNumber(window.end)) },
    ]);
    segment = { id: created.id, name };
    console.log(`+ segment ${name}`);
  } else {
    console.log(`= segment ${name} exists`);
  }
  await admin.setSegmentOverride(FLAG.festiveMode, segment.id, true);
  console.log(`  festive_mode ON for ${name}`);
}
console.log("Flagsmith is ready.");
