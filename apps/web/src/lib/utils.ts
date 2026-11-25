import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
/** "2026-11-11" → "11 Nov" */
export function shortDate(iso: string): string {
  return dateFmt.format(new Date(`${iso}T00:00:00Z`));
}

const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export function istTime(d: Date | string): string {
  return timeFmt.format(typeof d === "string" ? new Date(d) : d);
}
