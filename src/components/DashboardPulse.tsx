"use client";

import useSWR from "swr";
import type { ReactNode } from "react";
import { Activity, BadgeCheck, Gauge, Radio, ShieldCheck, Sparkles } from "lucide-react";
import type { NBAScoreboard } from "@/lib/types";
import type { Prediction } from "@/lib/predict";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ValidationResponse {
  status: "pass" | "warn" | "fail";
  score: number;
  season: string;
  summary: {
    totalGames: number;
    completedModelGames: number;
    upcomingModelGames: number;
    latestCompletedGame?: string;
    recordMismatches: number;
  };
  audit: {
    total: number;
    correct: number;
    accuracy: number;
    brierScore: number;
    homeBaselineAccuracy: number;
  };
  checks: { id: string; label: string; status: "pass" | "warn" | "fail"; value: string; detail: string }[];
  error?: string;
}

interface BoardTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
}

type BoardMode = "live" | "scheduled" | "mixed" | "empty";

interface BoardPrediction {
  status: "scheduled" | "live";
  gameDateTimeUTC: string;
  homeTeam: BoardTeam;
  awayTeam: BoardTeam;
  currentHomeScore?: number;
  currentAwayScore?: number;
  favorite: { tricode: string; winProb: number; side: "home" | "away" };
  live?: {
    homeWinProb: number;
    awayWinProb: number;
    expectedHomeMargin: number;
  };
  prediction: Prediction;
}

interface PredictionBoardResponse {
  mode: BoardMode;
  liveCount: number;
  scheduledCount: number;
  completedCount: number;
  predictions: BoardPrediction[];
  error?: string;
}

function teamColor(tricode?: string) {
  return tricode ? TEAM_COLORS[tricode]?.primary ?? "#6b7280" : "#6b7280";
}

function formatPct(value: number | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatDate(value?: string) {
  if (!value) return "--";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function statusTone(status?: ValidationResponse["status"]) {
  if (status === "pass") return "text-court-live";
  if (status === "warn") return "text-court-amber";
  if (status === "fail") return "text-court-red";
  return "text-court-muted";
}

function statusDot(status: "pass" | "warn" | "fail") {
  if (status === "pass") return "bg-court-live";
  if (status === "warn") return "bg-court-amber";
  return "bg-court-red";
}

function modeLabel(mode?: BoardMode) {
  if (mode === "live") return "Live board";
  if (mode === "mixed") return "Live and scheduled";
  if (mode === "scheduled") return "Schedule board";
  if (mode === "empty") return "No scheduled games";
  return "Schedule watch";
}

function Cell({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 border-l border-t border-court-border/80 p-3 first:border-l-0 sm:p-4">
      <div className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-court-muted sm:mb-3 sm:text-[10px] sm:tracking-[0.16em]">
        <span className={tone}>{icon}</span>
        {label}
      </div>
      <div className="truncate text-xl font-black tabular-nums text-white sm:text-2xl">{value}</div>
      <div className="mt-1 hidden min-h-8 text-xs leading-snug text-court-muted sm:block">{detail}</div>
    </div>
  );
}

export default function DashboardPulse() {
  const { data: live } = useSWR<NBAScoreboard>("/api/live-games", fetcher, {
    refreshInterval: 30_000,
  });
  const { data: validation } = useSWR<ValidationResponse>("/api/stat-validation", fetcher, {
    refreshInterval: 900_000,
    revalidateOnFocus: false,
  });
  const { data: board } = useSWR<PredictionBoardResponse>("/api/prediction-board?limit=1", fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const games = live?.games ?? [];
  const liveCount = games.filter((game) => game.gameStatus === 2).length;
  const finalCount = games.filter((game) => game.gameStatus === 3).length;
  const upcomingCount = games.filter((game) => game.gameStatus === 1).length;
  const spotlight = board?.predictions?.[0];
  const awayColor = teamColor(spotlight?.awayTeam.teamTricode);
  const homeColor = teamColor(spotlight?.homeTeam.teamTricode);
  const homePct = ((spotlight?.live?.homeWinProb ?? spotlight?.prediction.homeWinProb) ?? 0.5) * 100;
  const awayPct = ((spotlight?.live?.awayWinProb ?? spotlight?.prediction.awayWinProb) ?? 0.5) * 100;
  const favorite = spotlight?.favorite.tricode ?? "--";
  const favoritePct = formatPct(spotlight?.favorite.winProb, 0);
  const pulseTitle = spotlight
    ? `${favorite} ${spotlight.status === "live" ? "live edge" : "game edge"}`
    : board?.mode === "empty"
    ? "No games on the board"
    : "Model spotlight loading";
  const projected =
    spotlight?.status === "live"
      ? `${spotlight.awayTeam.teamTricode} ${spotlight.currentAwayScore ?? 0} - ${spotlight.currentHomeScore ?? 0} ${spotlight.homeTeam.teamTricode} now`
      : spotlight?.prediction.predictedAwayScore != null && spotlight.prediction.predictedHomeScore != null
      ? `${spotlight.awayTeam.teamTricode} ${spotlight.prediction.predictedAwayScore} - ${spotlight.prediction.predictedHomeScore} ${spotlight.homeTeam.teamTricode}`
      : "Waiting for forecast";

  return (
    <section className="dashboard-pulse spotlight-surface relative overflow-hidden rounded-lg">
      <div className="relative grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_14rem] md:items-end lg:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-court-accent">
              <Sparkles className="h-4 w-4" />
              Dashboard Pulse
            </div>
            <span className="rounded-md border border-court-border bg-court-card/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-court-muted">
              {validation?.season ?? "NBA"} data
            </span>
          </div>

          <h2 className="mt-4 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
            {pulseTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-court-muted">
            {spotlight
              ? `${spotlight.awayTeam.teamTricode} at ${spotlight.homeTeam.teamTricode}, ${projected}, ${spotlight.prediction.confidence} confidence.`
              : board?.mode === "empty"
              ? "No live or scheduled NBA games are available in the current lookahead window."
              : "Loading the strongest current model signal."}
          </p>
        </div>

        <div className="score-lane rounded-lg border border-white/10 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Favorite</div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-2xl font-black text-white">{favorite}</span>
            <span className="font-mono text-xl font-black text-court-amber">{favoritePct}</span>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-court-border">
            <div style={{ width: `${awayPct}%`, backgroundColor: awayColor, opacity: awayPct >= homePct ? 1 : 0.56 }} />
            <div style={{ width: `${homePct}%`, backgroundColor: homeColor, opacity: homePct >= awayPct ? 1 : 0.56 }} />
          </div>
        </div>
      </div>

      <div className="relative grid grid-cols-3">
        <Cell
          icon={<Radio className="h-4 w-4" />}
          label="Today"
          value={liveCount > 0 ? `${liveCount} live` : `${games.length} games`}
          detail={`${upcomingCount} upcoming, ${finalCount} final on the live scoreboard.`}
          tone={liveCount > 0 ? "text-court-live" : "text-court-accent"}
        />
        <Cell
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Validation"
          value={validation?.error ? "Issue" : `${validation?.score ?? "--"}%`}
          detail={
            validation
              ? `${validation.checks.filter((check) => check.status === "pass").length}/${validation.checks.length} checks passed, ${validation.summary.recordMismatches} record mismatches.`
              : "Checking official NBA feeds."
          }
          tone={statusTone(validation?.status)}
        />
        <Cell
          icon={<Gauge className="h-4 w-4" />}
          label="Replay"
          value={formatPct(validation?.audit.accuracy)}
          detail={
            validation
              ? `${validation.audit.correct}/${validation.audit.total} hits, ${formatPct(validation.audit.homeBaselineAccuracy)} home baseline.`
              : "Chronological model audit loading."
          }
          tone="text-court-amber"
        />
      </div>
      <div className="relative border-t border-court-border/80 px-5 py-3 text-xs text-court-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <BadgeCheck className="h-3.5 w-3.5 text-court-live" />
            Official NBA feeds
          </span>
          <span className="text-court-border">/</span>
          <span>{validation?.summary.completedModelGames?.toLocaleString() ?? "--"} completed model games</span>
          <span className="text-court-border">/</span>
          <span>Latest final {formatDate(validation?.summary.latestCompletedGame)}</span>
          <span className="ml-auto flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-court-accent" />
            {modeLabel(board?.mode)}
          </span>
        </div>
        {validation?.checks && (
          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            {validation.checks.map((check) => (
              <span key={check.id} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(check.status)}`} />
                <span className="font-semibold text-white">{check.label}</span>
                <span>{check.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
