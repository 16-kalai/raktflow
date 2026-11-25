"use client";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DIWALI_2026 } from "@raktflow/core";
import { shortDate } from "@/lib/utils";
import type { OverviewData } from "./types";

export function ForecastChart({ data }: { data: OverviewData }) {
  const { days, safeLevel, shortageDate, bookedCount, group } = data.focus;
  if (days.length === 0) return null;
  const first = days[0]!.date;
  const last = days.at(-1)!.date;
  const clamp = (d: string) => (d < first ? first : d > last ? last : d);
  const shortage = shortageDate ? days.find((d) => d.date === shortageDate) : null;
  const showWith = bookedCount > 0;

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={days} margin={{ top: 24, right: 16, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--muted-foreground)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--muted-foreground)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          {data.festivals
            .filter((f) => f.end >= first && f.start <= last)
            .map((f) => (
              <ReferenceArea
                key={f.name}
                x1={clamp(f.start)}
                x2={clamp(f.end)}
                fill="var(--warning)"
                fillOpacity={0.12}
                label={{ value: `🪔 ${f.name}`, position: "insideTop", fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            ))}
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            labelFormatter={(d) => shortDate(String(d))}
            formatter={(v, name) => [`${Number(v).toFixed(1)} units`, name]}
            contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
          />
          <ReferenceLine y={safeLevel} stroke="var(--destructive)" strokeDasharray="6 4" label={{ value: "Safe stock", position: "insideTopRight", fontSize: 11, fill: "var(--destructive)" }} />
          {DIWALI_2026 >= first && DIWALI_2026 <= last && (
            <ReferenceLine x={DIWALI_2026} stroke="var(--warning)" label={{ value: "Diwali", position: "top", fontSize: 11 }} />
          )}
          {data.transfusions.map((t) =>
            t.date >= first && t.date <= last ? (
              <ReferenceLine key={t.label} x={t.date} stroke="var(--primary)" strokeDasharray="2 2" label={{ value: `${t.label.split(" ·")[0]}'s transfusion`, position: "insideBottomLeft", fontSize: 11, fill: "var(--primary)" }} />
            ) : null,
          )}
          <Area type="monotone" dataKey="stock" name={`${group} if nothing changes`} stroke="var(--muted-foreground)" strokeWidth={2} fill="url(#stockFill)" isAnimationActive />
          {showWith && <Line type="monotone" dataKey="withBookings" name={`${group} with RaktFlow`} stroke="var(--success)" strokeWidth={3} dot={false} isAnimationActive />}
          {shortage && <ReferenceDot x={shortage.date} y={shortage.stock} r={6} fill="var(--destructive)" stroke="white" strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
