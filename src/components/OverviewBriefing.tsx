"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { CalendarDays, CheckCircle2, Radio, ShieldCheck, Target } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Destination = "forecast" | "schedule" | "lab" | "league" | "research" | "postseason";

interface BoardTeam {
  teamCity: string;
  teamName: string;
  teamTricode: string;
}

interface BoardPrediction {
  status: "scheduled" | "live";
  gameDateTimeUTC: string;
  homeTeam: BoardTeam;
  awayTeam: BoardTeam;
  favorite: {
    tricode: string;
    winProb: number;
  };
}

interface PredictionBoardResponse {
  mode: "live" | "scheduled" | "mixed" | "empty";
  liveCount: number;
  scheduledCount: number;
  completedCount: number;
  predictions: BoardPrediction[];
  error?: string;
}

interface ValidationResponse {
  status: "pass" | "warn" | "fail";
  score: number;
  season: string;
  generatedAt: string;
  summary: {
    totalGames: number;
    modelEligible: number;
    completedModelGames: number;
    upcomingModelGames: number;
    latestCompletedGame?: string;
    recordMismatches: number;
  };
  audit: {
    accuracy: number;
    homeBaselineAccuracy: number;
  };
  checks: { id: string; label: string; status: "pass" | "warn" | "fail"; value: string }[];
  error?: string;
}

function pct(value: number | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function shortDate(value?: string) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dateTime(value?: string) {
  if (!value) return "Schedule watch";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status?: ValidationResponse["status"]) {
  if (status === "pass") return "text-court-live";
  if (status === "warn") return "text-court-amber";
  if (status === "fail") return "text-court-red";
  return "text-court-muted";
}

function BriefCard({
  icon,
  eyebrow,
  title,
  value,
  detail,
  action,
  onClick,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="rounded-lg border border-court-border bg-court-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-court-muted">
          {icon}
          {eyebrow}
        </div>
        <div className="rounded-md border border-court-border bg-court-surface px-2 py-1 font-mono text-sm font-black text-white">
          {value}
        </div>
      </div>
      <h3 className="mt-4 truncate text-lg font-black text-white">{title}</h3>
      <p className="mt-2 min-h-10 text-sm leading-5 text-court-muted">{detail}</p>
      <button
        type="button"
        onClick={onClick}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-court-border bg-court-surface px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-accent"
      >
        {action}
      </button>
    </article>
  );
}

export default function OverviewBriefing({ onNavigate }: { onNavigate: (view: Destination) => void }) {
  const { data: board } = useSWR<PredictionBoardResponse>("/api/prediction-board?limit=1&days=7", fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });
  const { data: validation } = useSWR<ValidationResponse>("/api/stat-validation", fetcher, {
    refreshInterval: 900_000,
    revalidateOnFocus: false,
  });

  const spotlight = board?.predictions?.[0];
  const gameCount = (board?.liveCount ?? 0) + (board?.scheduledCount ?? 0);
  const passedChecks = validation?.checks.filter((check) => check.status === "pass").length;
  const baselineLift =
    validation && !validation.error ? validation.audit.accuracy - validation.audit.homeBaselineAccuracy : undefined;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <BriefCard
        icon={<Radio className="h-4 w-4 text-court-accent" />}
        eyebrow="Slate"
        title={spotlight ? `${spotlight.awayTeam.teamTricode} at ${spotlight.homeTeam.teamTricode}` : "Quiet slate"}
        value={spotlight ? `${spotlight.favorite.tricode} ${(spotlight.favorite.winProb * 100).toFixed(0)}%` : `${gameCount}`}
        detail={
          spotlight
            ? `${spotlight.status === "live" ? "Live" : "Scheduled"} for ${dateTime(spotlight.gameDateTimeUTC)}.`
            : "No live or scheduled games found in the current lookahead."
        }
        action="Games & Picks"
        onClick={() => onNavigate("forecast")}
      />
      <BriefCard
        icon={<ShieldCheck className={`h-4 w-4 ${statusClass(validation?.status)}`} />}
        eyebrow="Data Trust"
        title={validation?.status === "pass" ? "Official feeds match" : "Checking data"}
        value={validation ? `${validation.score}%` : "--"}
        detail={
          validation
            ? `${passedChecks}/${validation.checks.length} checks passed, ${validation.summary.recordMismatches} record mismatches.`
            : "Validating schedule, standings, final scores, and replay metrics."
        }
        action="League Tables"
        onClick={() => onNavigate("league")}
      />
      <BriefCard
        icon={<CalendarDays className="h-4 w-4 text-court-amber" />}
        eyebrow="Season Feed"
        title={validation ? `${validation.season} season` : "Loading season"}
        value={validation ? validation.summary.totalGames.toLocaleString() : "--"}
        detail={
          validation
            ? `${validation.summary.completedModelGames.toLocaleString()} final model games. Latest final ${shortDate(validation.summary.latestCompletedGame)}.`
            : "Loading the full official schedule feed."
        }
        action="Schedule"
        onClick={() => onNavigate("schedule")}
      />
      <div className="rounded-lg border border-court-border bg-court-card p-4 lg:col-span-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-court-muted">
          <span className="inline-flex items-center gap-2 font-semibold text-white">
            <CheckCircle2 className="h-4 w-4 text-court-live" />
            Overview read
          </span>
          <span>Slate: {board?.mode === "empty" ? "quiet" : board?.mode ?? "checking"}</span>
          <span className="hidden text-court-border sm:inline">/</span>
          <span>Replay: {pct(validation?.audit.accuracy)}</span>
          <span className="hidden text-court-border sm:inline">/</span>
          <span>Lift: {baselineLift == null ? "--" : `+${(baselineLift * 100).toFixed(1)} pts`}</span>
          <span className="hidden text-court-border sm:inline">/</span>
          <span>Model games: {validation?.summary.completedModelGames.toLocaleString() ?? "--"}</span>
          <span className="ml-auto inline-flex items-center gap-2 text-court-muted">
            <Target className="h-4 w-4 text-court-accent" />
            Live board refreshes automatically
          </span>
        </div>
      </div>
    </section>
  );
}
