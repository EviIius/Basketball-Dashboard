import { NextResponse } from "next/server";
import { backtest } from "@/lib/predict";
import { currentSeason, fetchSeasonGames, isCompletedModelGame, isModelEligibleGame } from "@/lib/season";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();
  const type = searchParams.get("type") ?? "model";
  const key = `${season}:${type}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const allGames = await fetchSeasonGames(season);
    const games =
      type === "regular"
        ? allGames.filter((game) => game.gameType === "regular")
        : allGames.filter(isModelEligibleGame);
    const completedGames = games.filter(isCompletedModelGame);
    const result = backtest(games);
    const payload = {
      season,
      type,
      modelVersion: "rolling-elo-team-form-v3",
      scheduledGames: games.length,
      completedGames: completedGames.length,
      ...result,
    };

    cache.set(key, { ts: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to run backtest" },
      { status: 500 }
    );
  }
}
