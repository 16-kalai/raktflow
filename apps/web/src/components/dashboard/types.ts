import type { Overview } from "@/server/overview";

// Dates arrive as strings over JSON.
type Jsonify<T> = T extends Date ? string : T extends (infer U)[] ? Jsonify<U>[] : T extends object ? { [K in keyof T]: Jsonify<T[K]> } : T;
export type OverviewData = Jsonify<Overview>;
