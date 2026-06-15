"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  CalendarClock,
  CheckCircle2,
  Filter,
  MapPin,
  Radio,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import type { Prediction } from "@/lib/predict";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import CustomMatchupCard from "./CustomMatchupCard";
import ModelHealthPanel from "./ModelHealthPanel";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type BoardStatus = "scheduled" | "live";
type BoardMode = "live" | "scheduled" | "mixed" | "empty";

interface BoardTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
}

interface LiveAdjustment {
  homeWinProb: number;
  awayWinProb: number;
  expectedHomeMargin: number;
  currentHomeMargin: number;
  elapsedPct: number;
  period: number;
  clock: string;
}

interface BoardPrediction {
  gameId: string;
  gameDate: string;
  gameDateTimeUTC: string;
  gameLabel: string;
  gameSubLabel: string;
  seriesText: string;
  arenaName: string;
  arenaCity: string;
  arenaState: string;
  status: BoardStatus;
  statusText: string;
  period?: number;
  gameClock?: string;
  currentHomeScore?: number;
  currentAwayScore?: number;
  homeTeam: BoardTeam;
  awayTeam: BoardTeam;
  gamesUsed: number;
  favorite: {
    teamId: number;
    tricode: string;
    winProb: number;
    side: "home" | "away";
  };
  live?: LiveAdjustment;
  prediction: Prediction;
}

interface PredictionBoardResponse {
  season: string;
  mode: BoardMode;
  days: number;
  teamId: number;
  liveCount: number;
  scheduledCount: number;
  completedCount: number;
  returnedCount: number;
  predictions: BoardPrediction[];
  error?: string;
}

interface Props {
  limit?: number;
  compact?: boolean;
  fallbackTools?: boolean;
}

const WINDOWS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

function colorFor(tricode: string) {
  return TEAM_COLORS[tricode]?.primary ?? "#6b7280";
}

function formatClock(clock: string | undefined) {
  const match = clock?.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return "";
  return `${match[1]}:${Math.floor(Number(match[2])).toString().padStart(2, "0")}`;
}

function formatDateTime(item: BoardPrediction) {
  if (item.status === "live") {
    const period = item.period && item.period > 4 ? `OT${item.period - 4}` : `Q${item.period ?? 1}`;
    const clock = formatClock(item.gameClock);
    return clock ? `Live ${period} ${clock}` : `Live ${period}`;
  }

  return new Date(item.gameDateTimeUTC).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function confidenceTone(confidence: Prediction["confidence"]) {
  if (confidence === "high") return "text-court-live";
  if (confidence === "medium") return "text-court-accent";
  return "text-court-muted";
}

function boardTitle(mode?: BoardMode) {
  if (mode === "live") return "Live win calls";
  if (mode === "mixed") return "Live and upcoming";
  if (mode === "scheduled") return "Upcoming win calls";
  return "Schedule watch";
}

function teamLabel(team: BoardTeam) {
  return `${team.teamCity} ${team.teamName}`;
}

function probabilityFor(item: BoardPrediction, side: "home" | "away") {
  if (side === "home") return item.live?.homeWinProb ?? item.prediction.homeWinProb;
  return item.live?.awayWinProb ?? item.prediction.awayWinProb;
}

function predictedWinnerName(item: BoardPrediction) {
  return item.favorite.side === "home" ? teamLabel(item.homeTeam) : teamLabel(item.awayTeam);
}

function ForecastCard({ item, onOpen }: { item: BoardPrediction; onOpen: (item: BoardPrediction) => void }) {
  const awayColor = colorFor(item.awayTeam.teamTricode);
  const homeColor = colorFor(item.homeTeam.teamTricode);
  const homeProb = probabilityFor(item, "home") * 100;
  const awayProb = probabilityFor(item, "away") * 100;
  const margin = item.live?.expectedHomeMargin ?? item.prediction.predictedMargin;
  const gameContext =
    item.status === "live"
      ? `${item.awayTeam.teamTricode} ${item.currentAwayScore ?? 0} - ${item.currentHomeScore ?? 0} ${item.homeTeam.teamTricode}`
      : item.prediction.predictedAwayScore != null && item.prediction.predictedHomeScore != null
      ? `${item.awayTeam.teamTricode} ${item.prediction.predictedAwayScore} - ${item.prediction.predictedHomeScore} ${item.homeTeam.teamTricode}`
      : "No score";
  const topDrivers = item.prediction.drivers
    .slice()
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, 2);

  return (
    <article className="surface-card-quiet group overflow-hidden rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-court-accent/70">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${awayColor}, ${homeColor})` }} />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-court-muted">
              {item.status === "live" ? (
                <Radio className="h-3.5 w-3.5 text-court-live" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5 text-court-accent" />
              )}
              {formatDateTime(item)}
            </div>
            <h3 className="mt-1 truncate text-lg font-black text-white">
              {item.awayTeam.teamTricode} at {item.homeTeam.teamTricode}
            </h3>
            <div className="truncate text-xs text-court-muted">
              {item.seriesText || item.gameLabel || item.statusText || "Scheduled matchup"}
            </div>
          </div>
          <div className="shrink-0 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-right">
            <div className="text-[10px] uppercase tracking-wider text-court-muted">Predicted winner</div>
            <div className="font-mono text-sm font-black text-white">{item.favorite.tricode}</div>
            <div className="text-[10px] font-bold text-court-amber">{(item.favorite.winProb * 100).toFixed(0)}%</div>
          </div>
        </div>

        <div className="grid grid-cols-[3.25rem_1fr_3.25rem] items-center gap-2">
          <div className="text-right">
            <div className="font-mono text-sm font-black text-white">{awayProb.toFixed(0)}%</div>
            <div className="text-[10px] font-bold text-court-muted">{item.awayTeam.teamTricode}</div>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-court-border">
            <div style={{ width: `${awayProb}%`, backgroundColor: awayColor, opacity: awayProb >= homeProb ? 1 : 0.58 }} />
            <div style={{ width: `${homeProb}%`, backgroundColor: homeColor, opacity: homeProb >= awayProb ? 1 : 0.58 }} />
          </div>
          <div>
            <div className="font-mono text-sm font-black text-white">{homeProb.toFixed(0)}%</div>
            <div className="text-[10px] font-bold text-court-muted">{item.homeTeam.teamTricode}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] uppercase tracking-wider text-court-muted">Pick</div>
            <div className="mt-0.5 font-black text-white">{item.favorite.tricode}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] uppercase tracking-wider text-court-muted">
              {item.status === "live" ? "Live margin" : "Margin"}
            </div>
            <div className="mt-0.5 font-mono font-black text-white">
              {margin > 0 ? "+" : ""}
              {margin.toFixed(1)}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-2">
            <div className="text-[10px] uppercase tracking-wider text-court-muted">Trust</div>
            <div className={`mt-0.5 font-black uppercase ${confidenceTone(item.prediction.confidence)}`}>
              {item.prediction.confidence}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
          <span className="truncate font-mono text-white">{gameContext}</span>
          <span className="shrink-0 text-court-muted">{item.gamesUsed.toLocaleString()} games</span>
        </div>

        {topDrivers.length > 0 && (
          <div className="space-y-1 border-t border-white/10 pt-3">
            {topDrivers.map((driver) => (
              <div key={driver.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-court-muted">{driver.label}</span>
                <span className={`font-mono font-bold ${driver.net >= 0 ? "text-court-live" : "text-court-red"}`}>
                  {driver.net > 0 ? "+" : ""}
                  {driver.net.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpen(item)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-court-accent/25 bg-court-accent/5 px-3 py-2 text-sm font-bold text-white transition-colors hover:border-court-accent hover:bg-court-accent/10"
        >
          <Target className="h-4 w-4 text-court-accent" />
          View game detail
        </button>
      </div>
    </article>
  );
}

function PredictionDrawer({ item, onClose }: { item: BoardPrediction; onClose: () => void }) {
  const awayColor = colorFor(item.awayTeam.teamTricode);
  const homeColor = colorFor(item.homeTeam.teamTricode);
  const awayProb = probabilityFor(item, "away") * 100;
  const homeProb = probabilityFor(item, "home") * 100;
  const margin = item.live?.expectedHomeMargin ?? item.prediction.predictedMargin;
  const projectedScore =
    item.status === "live"
      ? `${item.awayTeam.teamTricode} ${item.currentAwayScore ?? 0} - ${item.currentHomeScore ?? 0} ${item.homeTeam.teamTricode}`
      : item.prediction.predictedAwayScore != null && item.prediction.predictedHomeScore != null
      ? `${item.awayTeam.teamTricode} ${item.prediction.predictedAwayScore} - ${item.prediction.predictedHomeScore} ${item.homeTeam.teamTricode}`
      : "Projection unavailable";
  const drivers = item.prediction.drivers
    .slice()
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  return (
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close game detail" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-court-bg/95 shadow-2xl backdrop-blur-xl">
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${awayColor}, ${homeColor})` }} />
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-accent">
              {item.status === "live" ? <Radio className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
              {formatDateTime(item)}
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">
              {item.awayTeam.teamTricode} at {item.homeTeam.teamTricode}
            </h2>
            <div className="mt-1 text-sm text-court-muted">
              {item.seriesText || item.gameLabel || item.statusText || "Scheduled matchup"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-court-muted transition-colors hover:border-court-accent hover:text-white"
            aria-label="Close game detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="spotlight-surface rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-muted">
              <CheckCircle2 className="h-4 w-4 text-court-live" />
              Predicted winner
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-black text-white">{predictedWinnerName(item)}</div>
                <div className="mt-1 text-sm text-court-muted">
                  {item.favorite.side === "home" ? "Home" : "Away"} side, {item.favorite.tricode}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Win probability</div>
                <div className="font-mono text-2xl font-black text-court-amber">
                  {(item.favorite.winProb * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[3.75rem_1fr_3.75rem] items-center gap-2">
              <div className="text-right">
                <div className="font-mono text-lg font-black text-white">{awayProb.toFixed(0)}%</div>
                <div className="text-xs font-bold text-court-muted">{item.awayTeam.teamTricode}</div>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-court-border">
                <div style={{ width: `${awayProb}%`, backgroundColor: awayColor, opacity: awayProb >= homeProb ? 1 : 0.56 }} />
                <div style={{ width: `${homeProb}%`, backgroundColor: homeColor, opacity: homeProb >= awayProb ? 1 : 0.56 }} />
              </div>
              <div>
                <div className="font-mono text-lg font-black text-white">{homeProb.toFixed(0)}%</div>
                <div className="text-xs font-bold text-court-muted">{item.homeTeam.teamTricode}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="surface-card-quiet rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Projected score</div>
              <div className="mt-1 font-mono text-lg font-black text-white">{projectedScore}</div>
            </div>
            <div className="surface-card-quiet rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">
                {item.status === "live" ? "Live margin" : "Home margin"}
              </div>
              <div className="mt-1 font-mono text-lg font-black text-white">
                {margin > 0 ? "+" : ""}
                {margin.toFixed(1)}
              </div>
            </div>
            <div className="surface-card-quiet rounded-lg p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Confidence</div>
              <div className={`mt-1 text-lg font-black uppercase ${confidenceTone(item.prediction.confidence)}`}>
                {item.prediction.confidence}
              </div>
            </div>
          </div>

          <div className="surface-card-quiet mt-4 rounded-lg p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <MapPin className="h-4 w-4 text-court-accent" />
              Game context
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-court-muted">Away</div>
                <div className="font-bold text-white">{teamLabel(item.awayTeam)}</div>
                <div className="text-court-muted">{item.awayTeam.wins}-{item.awayTeam.losses}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-court-muted">Home</div>
                <div className="font-bold text-white">{teamLabel(item.homeTeam)}</div>
                <div className="text-court-muted">{item.homeTeam.wins}-{item.homeTeam.losses}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-court-muted">Venue</div>
                <div className="font-bold text-white">{item.arenaName || "Arena TBD"}</div>
                <div className="text-court-muted">
                  {[item.arenaCity, item.arenaState].filter(Boolean).join(", ") || "Location TBD"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-court-muted">Model sample</div>
                <div className="font-bold text-white">{item.gamesUsed.toLocaleString()} games</div>
                <div className="text-court-muted">Data quality: {item.prediction.dataQuality}</div>
              </div>
            </div>
          </div>

          {drivers.length > 0 && (
            <div className="surface-card-quiet mt-4 rounded-lg p-4">
              <div className="mb-3 text-sm font-black text-white">Why the model picked it</div>
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <div key={driver.label} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">{driver.label}</div>
                        <div className="text-xs text-court-muted">{driver.detail}</div>
                      </div>
                      <div className={`font-mono text-sm font-black ${driver.net >= 0 ? "text-court-live" : "text-court-red"}`}>
                        {driver.net > 0 ? "+" : ""}
                        {driver.net.toFixed(1)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function SkeletonCard() {
  return <div className="surface-card-quiet loading-shimmer h-56 rounded-lg" />;
}

export default function PredictionBoard({ limit = 12, compact = false, fallbackTools = true }: Props) {
  const [days, setDays] = useState(7);
  const [teamId, setTeamId] = useState(0);
  const [selectedGame, setSelectedGame] = useState<BoardPrediction | null>(null);
  const selectedTeam = useMemo(() => NBA_TEAMS.find((team) => team.id === teamId), [teamId]);
  const query = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(limit),
      days: String(days),
    });
    if (teamId) params.set("teamId", String(teamId));
    return params.toString();
  }, [days, limit, teamId]);
  const { data, error, isLoading } = useSWR<PredictionBoardResponse>(
    `/api/prediction-board?${query}`,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    },
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-accent">
            <Sparkles className="h-4 w-4" />
            Forecast Board
          </div>
          {!compact && <h3 className="mt-1 text-xl font-black text-white">{boardTitle(data?.mode)}</h3>}
        </div>
        <div className="flex items-center gap-2 text-xs text-court-muted">
          <Target className="h-4 w-4 text-court-amber" />
          {(data?.liveCount ?? 0) > 0
            ? `${data?.liveCount} live`
            : `${data?.scheduledCount ?? 0} scheduled`}
        </div>
      </div>

      {!compact && (
        <div className="surface-card-quiet rounded-lg p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Filter className="h-4 w-4 text-court-accent" />
              Filters
            </div>
            <div className="flex flex-wrap gap-1">
              {WINDOWS.map((window) => (
                <button
                  key={window.days}
                  onClick={() => setDays(window.days)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    days === window.days
                      ? "bg-court-accent text-court-bg"
                      : "bg-black/20 text-court-muted hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {window.label}
                </button>
              ))}
            </div>
            <select
              value={teamId}
              onChange={(event) => setTeamId(Number(event.target.value))}
              className="min-w-48 rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-court-accent sm:ml-auto"
            >
              <option value={0}>All teams</option>
              {NBA_TEAMS.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.city} {team.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="stagger-in grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: Math.min(limit, 6) }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      )}

      {(error || data?.error) && (
        <div className="surface-card-quiet rounded-lg p-5 text-sm text-court-muted">
          Could not load model forecasts.
        </div>
      )}

      {!isLoading && data && !data.error && data.predictions.length === 0 && (
        compact ? (
          <div className="surface-card-quiet rounded-lg p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-accent">
              <CalendarClock className="h-4 w-4" />
              Slate status
            </div>
            <h3 className="mt-2 text-xl font-black text-white">No live or scheduled games</h3>
            <p className="mt-2 text-sm leading-6 text-court-muted">
              Official NBA feed checked for {days === 1 ? "today" : `the next ${days} days`}.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Games found</div>
                <div className="mt-1 font-mono text-lg font-black text-white">
                  {(data.liveCount + data.scheduledCount).toLocaleString()}
                </div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Model sample</div>
                <div className="mt-1 font-mono text-lg font-black text-white">
                  {data.completedCount.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="spotlight-surface overflow-hidden rounded-lg">
              <div className="h-1 bg-gradient-to-r from-court-accent via-court-live to-court-amber" />
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-accent">
                      <CalendarClock className="h-4 w-4" />
                      Official feed checked
                    </div>
                    <h3 className="mt-2 text-2xl font-black text-white">No games in this window</h3>
                    <p className="mt-2 text-sm leading-6 text-court-muted">
                      The NBA schedule feed returned 0 live or upcoming games for{" "}
                      {selectedTeam ? `${selectedTeam.city} ${selectedTeam.name}` : "all teams"} across the next{" "}
                      {days === 1 ? "day" : `${days} days`}.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {days !== 30 && (
                      <button
                        type="button"
                        onClick={() => setDays(30)}
                        className="inline-flex items-center gap-2 rounded-md border border-court-accent/25 bg-court-accent/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-accent hover:bg-court-accent/10"
                      >
                        <CalendarClock className="h-4 w-4 text-court-accent" />
                        30 days
                      </button>
                    )}
                    {teamId !== 0 && (
                      <button
                        type="button"
                        onClick={() => setTeamId(0)}
                        className="inline-flex items-center gap-2 rounded-md border border-court-accent/25 bg-court-accent/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-accent hover:bg-court-accent/10"
                      >
                        <Filter className="h-4 w-4 text-court-accent" />
                        All teams
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Checked</div>
                    <div className="mt-1 font-mono text-lg font-black text-white">
                      {(data.liveCount + data.scheduledCount).toLocaleString()}
                    </div>
                    <div className="text-xs text-court-muted">live or scheduled games</div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Model sample</div>
                    <div className="mt-1 font-mono text-lg font-black text-white">
                      {data.completedCount.toLocaleString()}
                    </div>
                    <div className="text-xs text-court-muted">completed games loaded</div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Next useful move</div>
                    <div className="mt-1 text-sm font-black text-white">Open Matchup Lab</div>
                    <div className="text-xs text-court-muted">Run a custom team-vs-team forecast.</div>
                  </div>
                </div>
              </div>
            </div>
            {fallbackTools && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
                <CustomMatchupCard />
                <ModelHealthPanel compact />
              </div>
            )}
          </div>
        )
      )}

      {!isLoading && data && !data.error && data.predictions.length > 0 && (
        <div className="stagger-in grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.predictions.map((item) => (
            <ForecastCard key={`${item.status}-${item.gameId}`} item={item} onOpen={setSelectedGame} />
          ))}
        </div>
      )}

      {selectedGame && <PredictionDrawer item={selectedGame} onClose={() => setSelectedGame(null)} />}
    </section>
  );
}
