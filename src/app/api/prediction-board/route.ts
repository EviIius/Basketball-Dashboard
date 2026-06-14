import { NextResponse } from "next/server";
import { NBA_CDN_HEADERS } from "@/lib/nbaHeaders";
import { buildTeamState, headToHeadSnapshot, predict, snapshotForTeam } from "@/lib/predict";
import type { Prediction } from "@/lib/predict";
import type { NBAGame, NBATeamScore } from "@/lib/types";
import {
  currentSeason,
  fetchSeasonGames,
  isCompletedModelGame,
  isModelEligibleGame,
  type SeasonGame,
  type SeasonGameType,
} from "@/lib/season";

export const dynamic = "force-dynamic";

const NBA_CDN_SCOREBOARD =
  "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";
const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 90 * 1000;
const MS_PER_DAY = 86_400_000;

interface ForecastGame extends SeasonGame {
  period?: number;
  gameClock?: string;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampLimit(value: string | null) {
  const parsed = Number(value ?? 12);
  if (!Number.isFinite(parsed)) return 12;
  return Math.min(24, Math.max(1, Math.round(parsed)));
}

function clampDays(value: string | null) {
  const parsed = Number(value ?? 7);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(45, Math.max(1, Math.round(parsed)));
}

function parseTeamId(value: string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function gameTypeFromId(gameId: string): SeasonGameType {
  if (gameId.startsWith("001")) return "preseason";
  if (gameId.startsWith("002")) return "regular";
  if (gameId.startsWith("004")) return "playoffs";
  if (gameId.startsWith("005")) return "play-in";
  return "other";
}

function normalizeLiveTeam(team: NBATeamScore) {
  return {
    teamId: team.teamId,
    teamCity: team.teamCity,
    teamName: team.teamName,
    teamTricode: team.teamTricode,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    score: team.score ?? 0,
  };
}

function liveStatus(status: NBAGame["gameStatus"]): ForecastGame["status"] {
  return status === 2 ? "live" : "scheduled";
}

function liveGameToForecastGame(game: NBAGame): ForecastGame {
  return {
    gameId: game.gameId,
    gameCode: game.gameCode,
    gameDate: game.gameTimeUTC.slice(0, 10),
    gameDateTimeUTC: game.gameTimeUTC,
    gameDateTimeET: game.gameEt,
    status: liveStatus(game.gameStatus),
    statusText: game.gameStatusText,
    gameType: gameTypeFromId(game.gameId),
    gameLabel: game.gameLabel ?? "",
    gameSubLabel: game.gameSubLabel ?? "",
    seriesText: game.seriesText ?? "",
    arenaName: "",
    arenaCity: "",
    arenaState: "",
    neutralSite: false,
    homeTeam: normalizeLiveTeam(game.homeTeam),
    awayTeam: normalizeLiveTeam(game.awayTeam),
    period: game.period,
    gameClock: game.gameClock,
  };
}

async function fetchTodaysLiveAndScheduledGames(): Promise<ForecastGame[]> {
  const res = await fetch(NBA_CDN_SCOREBOARD, {
    cache: "no-store",
    headers: NBA_CDN_HEADERS,
  });

  if (!res.ok) return [];

  const data = await res.json();
  const games = (data.scoreboard?.games ?? []) as NBAGame[];
  return games
    .filter((game) => game.gameStatus === 1 || game.gameStatus === 2)
    .map(liveGameToForecastGame)
    .filter(isModelEligibleGame);
}

function gameTimeMs(game: ForecastGame) {
  const value = new Date(game.gameDateTimeUTC || `${game.gameDate}T17:00:00Z`).getTime();
  return Number.isFinite(value) ? value : 0;
}

function includeInWindow(game: ForecastGame, nowMs: number, days: number) {
  if (game.status === "live") return true;
  const startMs = nowMs - 8 * 60 * 60 * 1000;
  const endMs = nowMs + days * MS_PER_DAY;
  const timeMs = gameTimeMs(game);
  return timeMs >= startMs && timeMs <= endMs;
}

function matchesTeam(game: ForecastGame, teamId: number) {
  if (!teamId) return true;
  return game.homeTeam.teamId === teamId || game.awayTeam.teamId === teamId;
}

function parseClockMinutes(clock: string | undefined, period: number) {
  if (!clock) return period <= 4 ? 12 : 5;
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return period <= 4 ? 12 : 5;
  return Number(match[1]) + Number(match[2]) / 60;
}

function elapsedPct(period: number | undefined, clock: string | undefined) {
  if (!period || period <= 0) return 0;
  if (period <= 4) {
    const elapsed = (period - 1) * 12 + (12 - parseClockMinutes(clock, period));
    return clamp(elapsed / 48, 0, 0.995);
  }

  const overtimeElapsed = 48 + (period - 5) * 5 + (5 - parseClockMinutes(clock, period));
  return clamp(overtimeElapsed / Math.max(53, overtimeElapsed + 5), 0, 0.995);
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function liveAdjustment(game: ForecastGame, prediction: Prediction): LiveAdjustment | undefined {
  if (game.status !== "live") return undefined;
  if (!Number.isFinite(game.homeTeam.score) || !Number.isFinite(game.awayTeam.score)) return undefined;

  const elapsed = elapsedPct(game.period, game.gameClock);
  const remaining = 1 - elapsed;
  const currentHomeMargin = game.homeTeam.score - game.awayTeam.score;
  const expectedHomeMargin = currentHomeMargin + prediction.predictedMargin * remaining;
  const scale = 0.9 + 6.7 * clamp(remaining, 0.18, 1);
  const homeWinProb = logistic(expectedHomeMargin / scale);

  return {
    homeWinProb,
    awayWinProb: 1 - homeWinProb,
    expectedHomeMargin,
    currentHomeMargin,
    elapsedPct: elapsed,
    period: game.period ?? 0,
    clock: game.gameClock ?? "",
  };
}

function favoriteFor(game: ForecastGame, prediction: Prediction, live?: LiveAdjustment) {
  const homeWinProb = live?.homeWinProb ?? prediction.homeWinProb;
  const awayWinProb = live?.awayWinProb ?? prediction.awayWinProb;
  const homeFavorite = homeWinProb >= awayWinProb;

  return homeFavorite
    ? {
        teamId: game.homeTeam.teamId,
        tricode: game.homeTeam.teamTricode,
        winProb: homeWinProb,
        side: "home" as const,
      }
    : {
        teamId: game.awayTeam.teamId,
        tricode: game.awayTeam.teamTricode,
        winProb: awayWinProb,
        side: "away" as const,
      };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();
  const limit = clampLimit(searchParams.get("limit"));
  const days = clampDays(searchParams.get("days"));
  const teamId = parseTeamId(searchParams.get("teamId"));
  const key = `${season}:${limit}:${days}:${teamId}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const [seasonGames, todaysGames] = await Promise.all([
      fetchSeasonGames(season),
      fetchTodaysLiveAndScheduledGames(),
    ]);
    const nowIso = new Date().toISOString();
    const nowMs = new Date(nowIso).getTime();
    const modelEligible = seasonGames.filter(isModelEligibleGame);
    const completed = modelEligible
      .filter(isCompletedModelGame)
      .sort((a, b) => a.gameDateTimeUTC.localeCompare(b.gameDateTimeUTC));
    const futureSchedule = modelEligible
      .filter((game) => game.status !== "final")
      .map((game) => game as ForecastGame);

    const byGameId = new Map<string, ForecastGame>();
    for (const game of todaysGames) byGameId.set(game.gameId, game);
    for (const game of futureSchedule) {
      if (!byGameId.has(game.gameId)) byGameId.set(game.gameId, game);
    }

    const candidateGames = Array.from(byGameId.values())
      .filter((game) => includeInWindow(game, nowMs, days))
      .filter((game) => matchesTeam(game, teamId))
      .sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (a.status !== "live" && b.status === "live") return 1;
        return gameTimeMs(a) - gameTimeMs(b);
      });
    const selectedGames = candidateGames.slice(0, limit);

    const predictions = selectedGames.map((game) => {
      const targetDate = game.gameDateTimeUTC || nowIso;
      const completedBeforeTarget = seasonGames.filter(
        (item) =>
          isCompletedModelGame(item) &&
          item.gameId !== game.gameId &&
          (item.gameDateTimeUTC || item.gameDate).localeCompare(targetDate) < 0,
      );
      const snapshots = buildTeamState(seasonGames, {
        beforeDate: targetDate,
        excludeGameId: game.gameId,
      });
      const home = snapshotForTeam(snapshots, game.homeTeam.teamId, targetDate);
      const away = snapshotForTeam(snapshots, game.awayTeam.teamId, targetDate);
      const h2h = headToHeadSnapshot(completedBeforeTarget, game.homeTeam.teamId, game.awayTeam.teamId);
      const prediction = predict(home, away, {
        neutralSite: game.neutralSite,
        headToHead: h2h,
      });
      const live = liveAdjustment(game, prediction);

      return {
        gameId: game.gameId,
        gameDate: game.gameDate,
        gameDateTimeUTC: game.gameDateTimeUTC,
        gameType: game.gameType,
        gameLabel: game.gameLabel,
        gameSubLabel: game.gameSubLabel,
        seriesText: game.seriesText,
        arenaName: game.arenaName,
        arenaCity: game.arenaCity,
        arenaState: game.arenaState,
        neutralSite: game.neutralSite,
        status: game.status,
        statusText: game.statusText,
        period: game.period,
        gameClock: game.gameClock,
        currentHomeScore: game.status === "live" ? game.homeTeam.score : undefined,
        currentAwayScore: game.status === "live" ? game.awayTeam.score : undefined,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        gamesUsed: completedBeforeTarget.length,
        favorite: favoriteFor(game, prediction, live),
        live,
        prediction,
      };
    });

    const liveCount = candidateGames.filter((game) => game.status === "live").length;
    const scheduledCount = candidateGames.filter((game) => game.status === "scheduled").length;
    const mode =
      liveCount > 0 && scheduledCount > 0
        ? "mixed"
        : liveCount > 0
        ? "live"
        : scheduledCount > 0
        ? "scheduled"
        : "empty";

    const payload = {
      season,
      generatedAt: nowIso,
      mode,
      days,
      teamId,
      liveCount,
      scheduledCount,
      completedCount: completed.length,
      returnedCount: predictions.length,
      predictions,
    };

    cache.set(key, { ts: Date.now(), data: payload });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build prediction board" },
      { status: 500 },
    );
  }
}
