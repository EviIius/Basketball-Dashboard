import { NextResponse } from "next/server";
import { fetchFranchisePrior } from "@/lib/franchise";
import { buildTeamState, headToHeadSnapshot, predict, snapshotForTeam } from "@/lib/predict";
import { currentSeason, fetchSeasonGames, isCompletedModelGame } from "@/lib/season";

export const dynamic = "force-dynamic";

const cache = new Map<string, { ts: number; data: Awaited<ReturnType<typeof fetchSeasonGames>> }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

async function cachedSeasonGames(season: string) {
  const hit = cache.get(season);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  const data = await fetchSeasonGames(season);
  cache.set(season, { ts: Date.now(), data });
  return data;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();
  const gameId = searchParams.get("gameId") ?? undefined;
  const gameDate = searchParams.get("gameDate") ?? undefined;
  const neutral = searchParams.get("neutral") === "true";
  const scope = searchParams.get("scope") === "lifetime" ? "lifetime" : "current";

  try {
    const games = await cachedSeasonGames(season);
    const targetGame = gameId ? games.find((game) => game.gameId === gameId) : undefined;
    const homeId = targetGame?.homeTeam.teamId ?? Number(searchParams.get("homeId"));
    const awayId = targetGame?.awayTeam.teamId ?? Number(searchParams.get("awayId"));
    const targetDate = targetGame?.gameDateTimeUTC ?? gameDate ?? new Date().toISOString();
    const neutralSite = targetGame?.neutralSite ?? neutral;

    if (!homeId || !awayId) {
      return NextResponse.json({ error: "homeId and awayId required" }, { status: 400 });
    }

    const completedBeforeTarget = games.filter(
      (game) =>
        isCompletedModelGame(game) &&
        game.gameId !== gameId &&
        (game.gameDateTimeUTC || game.gameDate).localeCompare(targetDate) < 0
    );
    const snapshots = buildTeamState(games, { beforeDate: targetDate, excludeGameId: gameId });
    const home = snapshotForTeam(snapshots, homeId, targetDate);
    const away = snapshotForTeam(snapshots, awayId, targetDate);
    const h2h = headToHeadSnapshot(completedBeforeTarget, homeId, awayId);
    const [homeFranchisePrior, awayFranchisePrior] =
      scope === "lifetime"
        ? await Promise.all([fetchFranchisePrior(homeId), fetchFranchisePrior(awayId)])
        : [undefined, undefined];
    const prediction = predict(home, away, {
      neutralSite,
      headToHead: h2h,
      homeFranchisePrior,
      awayFranchisePrior,
    });

    return NextResponse.json({
      season,
      scope,
      asOf: targetDate,
      gamesUsed: completedBeforeTarget.length,
      targetGame,
      home,
      away,
      headToHead: h2h,
      homeFranchisePrior,
      awayFranchisePrior,
      prediction,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build prediction" },
      { status: 500 }
    );
  }
}
