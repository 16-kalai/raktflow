import { DEMO_TRANSFUSIONS } from "@raktflow/core";

/** Illustrative patients with planned transfusions (no real people). */
export const DEMO_PATIENTS = [
  { label: "Aarav, 9 · thalassemia (illustrative)", patientName: "Aarav", age: 9, condition: "Thalassemia major", hospital: "Sahyog day-care unit", everyDays: 21, bloodGroup: "O+", date: DEMO_TRANSFUSIONS[0]!.date, units: 1, notes: "Phenotype-matched units" },
  { label: "Diya, 7 · thalassemia (illustrative)", patientName: "Diya", age: 7, condition: "Thalassemia major", hospital: "Sahyog day-care unit", everyDays: 21, bloodGroup: "B+", date: "2026-11-09", units: 1, notes: null },
  { label: "Mr. Kulkarni, 61 · scheduled surgery (illustrative)", patientName: "Mr. Kulkarni", age: 61, condition: "Cardiac bypass (CABG)", hospital: "Partner hospital", everyDays: null, bloodGroup: "A+", date: "2026-11-12", units: 4, notes: "Cross-match 2 days before" },
];
