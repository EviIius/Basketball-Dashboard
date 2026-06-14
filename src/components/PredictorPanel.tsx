"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftRight, CalendarClock, ChevronsUpDown, Gauge, RefreshCcw, Target, TestTube2 } from "lucide-react";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import TeamSelector from "./TeamSelector";
import type { NBAStaticTeam } from "@/lib/types";
import type { Prediction, PredictionDriver, TeamSnapshot } from "@/lib/predict";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PredictResponse {
  season: string;
  scope: "current" | "lifetime";
  asOf: string;
  gamesUsed: number;
  prediction: Prediction;
  home: TeamSnapshot;
  away: TeamSnapshot;
  error?: string;
}

interface BacktestResponse {
  season: string;
  type: string;
  total: number;
  correct: number;
  accuracy: number;
  brierScore: number;
  logLoss: number;
  homeBaselineAccuracy: number;
  warmupGames: number;
  byMonth: { month: string; total: number; correct: number; accuracy: number; brier: number }[];
  byConfidence: { confidence: Prediction["confidence"]; total: number; correct: number; accuracy: number; brier: number }[];
  calibration: { bucket: string; total: number; expectedHomeWins: number; actualHomeWins: number }[];
  sampleGames: { gameId: string; date: string; away: string; home: string; predHomeWin: number; actualHome: number; actualAway: number; correct: boolean; confidence: string; margin: number }[];
  error?: string;
}

interface SeasonTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
}

interface SeasonGame {
  gameId: string;
  gameDate: string;
  gameDateTimeUTC: string;
  status: "scheduled" | "live" | "final";
  gameType: "preseason" | "regular" | "play-in" | "playoffs" | "other";
  homeTeam: SeasonTeam;
  awayTeam: SeasonTeam;
  neutralSite: boolean;
}

interface SeasonGamesResponse {
  season: string;
  counts: { completedModelGames: number };
  games: SeasonGame[];
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function teamColor(team: NBAStaticTeam) {
  return TEAM_COLORS[team.tricode]?.primary ?? "#6b7280";
}

function TeamButton({
  label,
  team,
  align,
  onClick,
}: {
  label: string;
  team: NBAStaticTeam;
  align: "left" | "right";
  onClick: () => void;
}) {
  const color = teamColor(team);
  return (
    <button
      onClick={onClick}
      className={`flex min-h-32 w-full items-center gap-3 rounded-lg border border-court-border bg-court-card p-4 text-left transition-colors hover:border-court-accent ${
        align === "right" ? "sm:flex-row-reverse sm:text-right" : ""
      }`}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white" style={{ backgroundColor: color }}>
        {team.tricode}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-court-muted">{label}</div>
        <div className="mt-1 truncate text-xl font-black text-white">{team.city}</div>
        <div className="truncate text-sm text-court-muted">{team.name}</div>
      </div>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-court-muted" />
    </button>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-court-border bg-court-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-court-muted">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums text-white">{value}</div>
      {detail && <div className="mt-1 text-xs text-court-muted">{detail}</div>}
    </div>
  );
}

function DriverRow({ d, awayColor, homeColor }: { d: PredictionDriver; awayColor: string; homeColor: string }) {
  const favorsHome = d.net >= 0;
  const pct = Math.min(100, (Math.abs(d.net) / 5) * 100);
  return (
    <div className="border-b border-court-border/70 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{d.label}</span>
        <span className="text-right text-xs text-court-muted">{d.detail}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-end">
          {!favorsHome && <div className="h-2 rounded-l-full" style={{ width: `${pct}%`, backgroundColor: awayColor }} />}
        </div>
        <div className="w-12 text-center font-mono text-xs text-court-muted">{d.net > 0 ? "+" : ""}{d.net.toFixed(1)}</div>
        <div>
          {favorsHome && <div className="h-2 rounded-r-full" style={{ width: `${pct}%`, backgroundColor: homeColor }} />}
        </div>
      </div>
    </div>
  );
}

function SnapshotCard({ label, team, snapshot }: { label: string; team: NBAStaticTeam; snapshot?: TeamSnapshot }) {
  const color = teamColor(team);
  const last10 =
    snapshot && snapshot.gamesPlayed > 0
      ? `${snapshot.last10Wins}-${Math.max(0, Math.min(10, snapshot.gamesPlayed) - snapshot.last10Wins)}`
      : "--";
  return (
    <div className="rounded-lg border border-court-border bg-court-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="ml-auto text-xs text-court-muted">{team.tricode}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Record" value={snapshot ? `${snapshot.wins}-${snapshot.losses}` : "--"} />
        <MetricCard label="Elo" value={snapshot ? Math.round(snapshot.elo).toString() : "--"} />
        <MetricCard label="Net" value={snapshot ? `${snapshot.netRating >= 0 ? "+" : ""}${snapshot.netRating.toFixed(1)}` : "--"} />
        <MetricCard label="Last 10" value={last10} />
      </div>
    </div>
  );
}

function RecentGameRow({ game, focusIds }: { game: SeasonGame; focusIds: Set<number> }) {
  const homeWon = game.homeTeam.score > game.awayTeam.score;
  const focusHome = focusIds.has(game.homeTeam.teamId);
  const focusWon = focusHome ? homeWon : !homeWon;
  const focusTeam = focusHome ? game.homeTeam : game.awayTeam;
  const opponent = focusHome ? game.awayTeam : game.homeTeam;
  return (
    <div className="grid grid-cols-[4.25rem_3rem_1fr_5.5rem] items-center gap-2 border-b border-court-border/60 py-2 text-xs last:border-b-0">
      <span className="font-mono text-court-muted">{game.gameDate.slice(5)}</span>
      <span className={`rounded-md px-2 py-1 text-center font-black ${focusWon ? "bg-court-live/15 text-court-live" : "bg-court-red/15 text-court-red"}`}>
        {focusWon ? "W" : "L"}
      </span>
      <span className="truncate text-white">
        {focusTeam.teamTricode} {focusHome ? "vs" : "at"} {opponent.teamTricode}
      </span>
      <span className="text-right font-mono text-court-muted">
        {game.awayTeam.score}-{game.homeTeam.score}
      </span>
    </div>
  );
}

export default function PredictorPanel() {
  const [home, setHome] = useState<NBAStaticTeam>(NBA_TEAMS.find((t) => t.tricode === "BOS") ?? NBA_TEAMS[0]);
  const [away, setAway] = useState<NBAStaticTeam>(NBA_TEAMS.find((t) => t.tricode === "NYK") ?? NBA_TEAMS[1]);
  const [gameDate, setGameDate] = useState(todayInputValue());
  const [neutralSite, setNeutralSite] = useState(false);
  const [modelScope, setModelScope] = useState<"current" | "lifetime">("current");
  const [pickingFor, setPickingFor] = useState<"home" | "away" | null>(null);
  const [showBacktest, setShowBacktest] = useState(false);

  const predictUrl =
    `/api/predict?homeId=${home.id}&awayId=${away.id}` +
    `&gameDate=${encodeURIComponent(`${gameDate}T17:00:00.000Z`)}` +
    `&neutral=${neutralSite ? "true" : "false"}` +
    `&scope=${modelScope}`;

  const { data: pred, isLoading } = useSWR<PredictResponse>(predictUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const { data: seasonGames } = useSWR<SeasonGamesResponse>("/api/season-games", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 900_000,
  });

  const { data: bt, isLoading: btLoading } = useSWR<BacktestResponse>(
    showBacktest ? "/api/backtest" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const homeColor = teamColor(home);
  const awayColor = teamColor(away);
  const prediction = pred?.prediction;
  const focusIds = useMemo(() => new Set([home.id, away.id]), [away.id, home.id]);
  const recentGames = useMemo(() => {
    return (seasonGames?.games ?? [])
      .filter((game) => game.status === "final" && game.gameType !== "preseason" && game.gameType !== "other")
      .filter((game) => focusIds.has(game.homeTeam.teamId) || focusIds.has(game.awayTeam.teamId))
      .sort((a, b) => b.gameDateTimeUTC.localeCompare(a.gameDateTimeUTC))
      .slice(0, 10);
  }, [focusIds, seasonGames?.games]);

  const swap = () => {
    setHome(away);
    setAway(home);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <TeamButton label="Away" team={away} align="left" onClick={() => setPickingFor("away")} />
          <button
            onClick={swap}
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-court-border bg-court-card text-court-muted transition-colors hover:border-court-accent hover:text-court-accent"
            title="Swap home and away"
          >
            <ArrowLeftRight className="h-5 w-5" />
          </button>
          <TeamButton label="Home" team={home} align="right" onClick={() => setPickingFor("home")} />
        </div>

        <div className="rounded-lg border border-court-border bg-court-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <CalendarClock className="h-4 w-4 text-court-accent" />
              Game context
            </div>
            <input
              type="date"
              value={gameDate}
              onChange={(event) => setGameDate(event.target.value)}
              className="rounded-md border border-court-border bg-court-surface px-3 py-2 text-sm text-white outline-none focus:border-court-accent"
            />
            <label className="flex items-center gap-2 rounded-md border border-court-border bg-court-surface px-3 py-2 text-sm text-court-muted">
              <input
                type="checkbox"
                checked={neutralSite}
                onChange={(event) => setNeutralSite(event.target.checked)}
                className="accent-court-accent"
              />
              Neutral site
            </label>
            <div className="flex rounded-md bg-court-surface p-1">
              {[
                { id: "current", label: "Current season only" },
                { id: "lifetime", label: "Lifetime prior" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setModelScope(item.id as "current" | "lifetime")}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                    modelScope === item.id
                      ? "bg-court-accent text-court-bg"
                      : "text-court-muted hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setGameDate(todayInputValue())}
              className="flex items-center gap-2 rounded-md border border-court-border px-3 py-2 text-sm font-semibold text-court-muted transition-colors hover:border-court-accent hover:text-white"
            >
              <RefreshCcw className="h-4 w-4" />
              Today
            </button>
          </div>
        </div>

        {pickingFor && (
          <div className="rounded-lg border border-court-border bg-court-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Pick {pickingFor === "home" ? "home team" : "away team"}</h3>
              <button onClick={() => setPickingFor(null)} className="rounded-md px-2 py-1 text-sm text-court-muted hover:bg-court-surface hover:text-white">
                Close
              </button>
            </div>
            <TeamSelector
              selected={pickingFor === "home" ? home : away}
              onChange={(team) => {
                if (pickingFor === "home") setHome(team);
                else setAway(team);
                setPickingFor(null);
              }}
            />
          </div>
        )}

        <div className="rounded-lg border border-court-border bg-court-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-court-accent" />
              <h3 className="text-base font-black text-white">Win Probability</h3>
            </div>
            {pred && !pred.error && (
              <div className="text-xs text-court-muted">
                {pred.gamesUsed} games in state
              </div>
            )}
          </div>

          {isLoading && <div className="py-10 text-center text-sm text-court-muted">Computing matchup...</div>}
          {!isLoading && pred?.error && <div className="py-10 text-center text-sm text-court-muted">{pred.error}</div>}

          {prediction && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[7rem_1fr_7rem] sm:items-center">
                <div>
                  <div className="text-3xl font-black tabular-nums text-white">{(prediction.awayWinProb * 100).toFixed(0)}%</div>
                  <div className="text-xs font-semibold text-court-muted">{away.tricode}</div>
                </div>
                <div className="flex h-4 overflow-hidden rounded-full bg-court-surface">
                  <div style={{ width: `${prediction.awayWinProb * 100}%`, backgroundColor: awayColor, opacity: prediction.awayWinProb >= 0.5 ? 1 : 0.55 }} />
                  <div style={{ width: `${prediction.homeWinProb * 100}%`, backgroundColor: homeColor, opacity: prediction.homeWinProb >= 0.5 ? 1 : 0.55 }} />
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-3xl font-black tabular-nums text-white">{(prediction.homeWinProb * 100).toFixed(0)}%</div>
                  <div className="text-xs font-semibold text-court-muted">{home.tricode}</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Projected Score" value={`${away.tricode} ${prediction.predictedAwayScore} - ${prediction.predictedHomeScore} ${home.tricode}`} />
                <MetricCard label="Home Margin" value={`${prediction.predictedMargin > 0 ? "+" : ""}${prediction.predictedMargin.toFixed(1)}`} />
                <MetricCard label="Confidence" value={prediction.confidence.toUpperCase()} detail={`Data: ${prediction.dataQuality}`} />
                <MetricCard
                  label="Model"
                  value="Rolling v3"
                  detail={pred?.scope === "lifetime" ? `${pred.season} + lifetime prior` : `${pred?.season} only`}
                />
              </div>

              <div>
                {prediction.drivers.map((driver) => (
                  <DriverRow key={driver.label} d={driver} awayColor={awayColor} homeColor={homeColor} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SnapshotCard label="Away State" team={away} snapshot={pred?.away} />
          <SnapshotCard label="Home State" team={home} snapshot={pred?.home} />
        </div>

        <div className="rounded-lg border border-court-border bg-court-card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-court-accent" />
              <h3 className="text-base font-black text-white">Backtest Audit</h3>
            </div>
            <button
              onClick={() => setShowBacktest((value) => !value)}
              className="rounded-md border border-court-border px-3 py-2 text-xs font-semibold text-court-muted transition-colors hover:border-court-accent hover:text-white"
            >
              {showBacktest ? "Hide" : "Run audit"}
            </button>
          </div>

          {!showBacktest && (
            <div className="text-sm text-court-muted">
              Replays completed current-season games in order and predicts each game before its result is applied.
              The audit uses the current-season-only scope.
            </div>
          )}

          {showBacktest && btLoading && <div className="py-8 text-center text-sm text-court-muted">Replaying season...</div>}
          {showBacktest && bt?.error && <div className="text-sm text-court-muted">{bt.error}</div>}

          {showBacktest && bt && !bt.error && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Accuracy" value={`${(bt.accuracy * 100).toFixed(1)}%`} detail={`${bt.correct}/${bt.total}`} />
                <MetricCard label="Brier" value={bt.brierScore.toFixed(3)} detail="Lower is better" />
                <MetricCard label="Log Loss" value={bt.logLoss.toFixed(3)} />
                <MetricCard label="Home Baseline" value={`${(bt.homeBaselineAccuracy * 100).toFixed(1)}%`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-court-muted">Monthly Accuracy</div>
                  <div className="space-y-2">
                    {bt.byMonth.map((month) => (
                      <div key={month.month} className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-2 text-xs">
                        <span className="font-mono text-court-muted">{month.month}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-court-surface">
                          <div className="h-full bg-court-accent" style={{ width: `${month.accuracy * 100}%` }} />
                        </div>
                        <span className="text-right font-mono text-white">{(month.accuracy * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-court-muted">Recent Audited Games</div>
                  <div className="space-y-1">
                    {bt.sampleGames.slice(0, 8).map((game) => (
                      <div key={game.gameId} className="grid grid-cols-[4.25rem_1fr_4rem_2rem] items-center gap-2 text-xs">
                        <span className="font-mono text-court-muted">{game.date.slice(5)}</span>
                        <span className="truncate text-white">{game.away} @ {game.home}</span>
                        <span className="text-right font-mono text-court-muted">{(game.predHomeWin * 100).toFixed(0)}%</span>
                        <span className={game.correct ? "text-court-live" : "text-court-red"}>{game.correct ? "Hit" : "Miss"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-lg border border-court-border bg-court-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-court-accent" />
            <h3 className="text-base font-black text-white">Model Inputs</h3>
          </div>
          <div className="space-y-2 text-sm text-court-muted">
            <div className="flex justify-between gap-4">
              <span>Rolling Elo</span>
              <span className="font-mono text-white">38%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Adjusted margin</span>
              <span className="font-mono text-white">26%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Recent form</span>
              <span className="font-mono text-white">16%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Venue split</span>
              <span className="font-mono text-white">10%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Record and schedule</span>
              <span className="font-mono text-white">8%</span>
            </div>
            <div className="border-t border-court-border pt-2 text-xs">
              Head-to-head, home court, rest, neutral-site handling, postseason pace, and volatility shrinkage are applied after the weighted team signals.
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-court-border bg-court-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-black text-white">Current Season Inputs</h3>
            <span className="text-xs text-court-muted">{seasonGames?.counts.completedModelGames ?? "--"} games</span>
          </div>
          {recentGames.length === 0 ? (
            <div className="text-sm text-court-muted">No completed model games found for this matchup yet.</div>
          ) : (
            recentGames.map((game) => <RecentGameRow key={game.gameId} game={game} focusIds={focusIds} />)
          )}
        </div>
      </aside>
    </div>
  );
}
