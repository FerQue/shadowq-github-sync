import type { ReactNode } from "react";

const TONES = {
  green: "bg-green-100 text-green-900",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-900",
  grey: "bg-muted text-muted-foreground",
} as const;

export type Tone = keyof typeof TONES;

export function Chip({ tone = "grey", children }: { tone?: Tone | undefined; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export const STATUS_TONE: Record<string, Tone> = { approved: "green", under_review: "amber", unknown: "grey", prohibited: "red" };
export const RISK_TONE: Record<string, Tone> = { low: "green", medium: "amber", high: "red" };
export const ACTION_TONE: Record<string, Tone> = {
  allow: "green",
  allow_with_alert: "green",
  coach: "amber",
  redirect: "amber",
  request_approval: "amber",
  block: "red",
};

export function fmtDate(iso: string | null | undefined) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "—";
}
export function fmtTime(iso: string) {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
