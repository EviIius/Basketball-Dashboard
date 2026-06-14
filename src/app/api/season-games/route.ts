import { NextResponse } from "next/server";
import { currentSeason, fetchSeasonGames, isCompletedModelGame, isModelEligibleGame } from "@/lib/season";

export const dynamic = "force-dynamic";

const cache = new Map<string, { ts: number; data: Awaited<ReturnType<typeof fetchSeasonGames>> }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const teamId = Number(searchParams.get("teamId") ?? 0);

  try {
    const hit = cache.get(season);
    const allGames = hit && Date.now() - hit.ts < CACHE_TTL_MS ? hit.data : await fetchSeasonGames(season);
    if (!hit || Date.now() - hit.ts >= CACHE_TTL_MS) {
      cache.set(season, { ts: Date.now(), data: allGames });
    }

    let games = allGames;
    if (status) games = games.filter((game) => game.status === status);
    if (type) games = games.filter((game) => game.gameType === type);
    if (teamId) {
      games = games.filter((game) => game.homeTeam.teamId === teamId || game.awayTeam.teamId === teamId);
    }

    const modelEligible = allGames.filter(isModelEligibleGame);
    const completedModelGames = modelEligible.filter(isCompletedModelGame);
    const upcomingModelGames = modelEligible.filter((game) => game.status !== "final");

    return NextResponse.json(
      {
        season,
        counts: {
          total: allGames.length,
          modelEligible: modelEligible.length,
          completedModelGames: completedModelGames.length,
          upcomingModelGames: upcomingModelGames.length,
          returned: games.length,
        },
        games,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch season games" },
      { status: 500 }
    );
  }
}
