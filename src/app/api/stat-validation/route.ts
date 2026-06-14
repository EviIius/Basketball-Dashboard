import { NextResponse } from "next/server";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";
import { NBA_TEAMS } from "@/lib/nbaTeams";
import { backtest } from "@/lib/predict";
import { currentSeason, fetchSeasonGames, isCompletedModelGame, isModelEligibleGame } from "@/lib/season";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CheckStatus = "pass" | "warn" | "fail";

interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  value: string;
  detail: string;
}

interface StandingRecord {
  teamId: number;
  wins: number;
  losses: number;
}

const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

const idx = (headers: string[], name: string) => headers.indexOf(name);

function makeCheck(
  id: string,
  label: string,
  status: CheckStatus,
  value: string,
  detail: string,
): ValidationCheck {
  return { id, label, status, value, detail };
}

async function fetchStandingsRecords(season: string): Promise<StandingRecord[]> {
  const url = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${encodeURIComponent(
    season,
  )}&SeasonType=Regular+Season`;

  const res = await fetch(url, {
    headers: NBA_STATS_HEADERS,
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`NBA standings returned ${res.status}`);
  }

  const json = await res.json();
  const set = json.resultSets?.[0];
  if (!set) return [];

  const headers: string[] = set.headers;
  const cols = {
    id: idx(headers, "TeamID"),
    wins: idx(headers, "WINS"),
    losses: idx(headers, "LOSSES"),
  };

  return (set.rowSet as unknown[][]).map((row) => ({
    teamId: row[cols.id] as number,
    wins: row[cols.wins] as number,
    losses: row[cols.losses] as number,
  }));
}

function validationScore(checks: ValidationCheck[]) {
  if (!checks.length) return 0;
  const raw = checks.reduce((sum, check) => {
    if (check.status === "pass") return sum + 1;
    if (check.status === "warn") return sum + 0.5;
    return sum;
  }, 0);

  return Math.round((raw / checks.length) * 100);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();

  const cached = cache.get(season);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const games = await fetchSeasonGames(season);
    const knownTeamIds = new Set(NBA_TEAMS.map((team) => team.id));
    const modelEligible = games.filter(isModelEligibleGame);
    const modelTeamIds = modelEligible.flatMap((game) => [game.homeTeam.teamId, game.awayTeam.teamId]);
    const unknownTeamIds = Array.from(new Set(modelTeamIds.filter((teamId) => !knownTeamIds.has(teamId))));
    const completedModelGames = modelEligible.filter(isCompletedModelGame);
    const badFinalScores = games.filter(
      (game) =>
        game.status === "final" &&
        (!Number.isFinite(game.homeTeam.score) ||
          !Number.isFinite(game.awayTeam.score) ||
          game.homeTeam.score === game.awayTeam.score),
    );

    const computedRegularRecords = new Map<number, { wins: number; losses: number }>();
    for (const game of games.filter((item) => item.gameType === "regular" && isCompletedModelGame(item))) {
      const homeWon = game.homeTeam.score > game.awayTeam.score;
      const home = computedRegularRecords.get(game.homeTeam.teamId) ?? { wins: 0, losses: 0 };
      const away = computedRegularRecords.get(game.awayTeam.teamId) ?? { wins: 0, losses: 0 };
      home.wins += homeWon ? 1 : 0;
      home.losses += homeWon ? 0 : 1;
      away.wins += homeWon ? 0 : 1;
      away.losses += homeWon ? 1 : 0;
      computedRegularRecords.set(game.homeTeam.teamId, home);
      computedRegularRecords.set(game.awayTeam.teamId, away);
    }

    const checks: ValidationCheck[] = [
      makeCheck(
        "schedule-feed",
        "Schedule feed",
        games.length > 0 ? "pass" : "fail",
        games.length.toLocaleString(),
        games.length > 0 ? "Official NBA schedule loaded." : "No games returned from the schedule feed.",
      ),
      makeCheck(
        "team-catalog",
        "Team catalog",
        unknownTeamIds.length === 0 ? "pass" : "fail",
        unknownTeamIds.length === 0 ? "30 teams" : `${unknownTeamIds.length} unknown`,
        unknownTeamIds.length === 0
          ? "Every model-eligible team maps to the local NBA team catalog."
          : `Unknown team ids: ${unknownTeamIds.slice(0, 6).join(", ")}`,
      ),
      makeCheck(
        "score-integrity",
        "Final scores",
        badFinalScores.length === 0 ? "pass" : "fail",
        badFinalScores.length === 0 ? "clean" : `${badFinalScores.length} issues`,
        badFinalScores.length === 0
          ? "All final games have finite, non-tied scores."
          : "Some final games have missing, non-finite, or tied scores.",
      ),
      makeCheck(
        "model-sample",
        "Model sample",
        completedModelGames.length >= 150 ? "pass" : completedModelGames.length > 0 ? "warn" : "fail",
        completedModelGames.length.toLocaleString(),
        completedModelGames.length >= 150
          ? "Enough completed games for high-context team snapshots."
          : "The model can run, but early-season predictions should be treated carefully.",
      ),
    ];

    let recordMismatches: { teamId: number; expected: string; observed: string }[] = [];
    try {
      const standings = await fetchStandingsRecords(season);
      recordMismatches = standings
        .map((standing) => {
          const computed = computedRegularRecords.get(standing.teamId) ?? { wins: 0, losses: 0 };
          return {
            teamId: standing.teamId,
            expected: `${standing.wins}-${standing.losses}`,
            observed: `${computed.wins}-${computed.losses}`,
          };
        })
        .filter((row) => row.expected !== row.observed);

      checks.push(
        makeCheck(
          "standings-parity",
          "Standings parity",
          recordMismatches.length === 0 ? "pass" : recordMismatches.length <= 2 ? "warn" : "fail",
          recordMismatches.length === 0 ? "matched" : `${recordMismatches.length} off`,
          recordMismatches.length === 0
            ? "Computed regular-season records match NBA standings."
            : `First mismatch: ${recordMismatches[0].teamId} NBA ${recordMismatches[0].expected}, schedule ${recordMismatches[0].observed}.`,
        ),
      );
    } catch (error) {
      checks.push(
        makeCheck(
          "standings-parity",
          "Standings parity",
          "warn",
          "unchecked",
          error instanceof Error ? error.message : "Could not validate standings.",
        ),
      );
    }

    const audit = backtest(games);
    checks.push(
      makeCheck(
        "prediction-replay",
        "Prediction replay",
        audit.total === completedModelGames.length && audit.total > 0 ? "pass" : audit.total > 0 ? "warn" : "fail",
        audit.total ? `${(audit.accuracy * 100).toFixed(1)}%` : "no sample",
        audit.total
          ? `${audit.correct}/${audit.total} chronological replay, ${(audit.homeBaselineAccuracy * 100).toFixed(1)}% home baseline.`
          : "No completed games available for backtesting.",
      ),
    );

    const score = validationScore(checks);
    const status: CheckStatus = checks.some((check) => check.status === "fail")
      ? "fail"
      : checks.some((check) => check.status === "warn")
      ? "warn"
      : "pass";
    const latestCompletedGame = completedModelGames
      .map((game) => game.gameDate)
      .sort((a, b) => b.localeCompare(a))[0];

    const payload = {
      season,
      generatedAt: new Date().toISOString(),
      status,
      score,
      source: "NBA CDN schedule + NBA Stats standings",
      summary: {
        totalGames: games.length,
        modelEligible: modelEligible.length,
        completedModelGames: completedModelGames.length,
        upcomingModelGames: modelEligible.length - completedModelGames.length,
        regularSeasonRecordsChecked: computedRegularRecords.size,
        recordMismatches: recordMismatches.length,
        latestCompletedGame,
      },
      audit: {
        total: audit.total,
        correct: audit.correct,
        accuracy: audit.accuracy,
        brierScore: audit.brierScore,
        logLoss: audit.logLoss,
        homeBaselineAccuracy: audit.homeBaselineAccuracy,
        warmupGames: audit.warmupGames,
      },
      checks,
    };

    cache.set(season, { ts: Date.now(), data: payload });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to validate stats" },
      { status: 500 },
    );
  }
}
