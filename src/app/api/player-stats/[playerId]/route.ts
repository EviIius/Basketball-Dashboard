import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function currentSeasonStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

// Returns season averages + career averages across the last N seasons for a player.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const apiKey = process.env.BALLDONTLIE_API_KEY;

  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "BALLDONTLIE_API_KEY missing" }, { status: 503 });
  }

  try {
    // Pull this season's averages
    const currentSeason = currentSeasonStartYear();
    const seasonsToTry = [currentSeason, currentSeason - 1, currentSeason - 2];
    const playerUrl = `https://api.balldontlie.io/v1/players/${playerId}`;
    const playerRes = await fetch(playerUrl, {
      headers: { Authorization: apiKey },
      next: { revalidate: 3600 },
    });
    const playerJson = playerRes.ok ? await playerRes.json() : { data: null };

    const seasonAverages: unknown[] = [];
    for (const season of seasonsToTry) {
      const url = `https://api.balldontlie.io/v1/season_averages?season=${season}&player_ids[]=${playerId}`;
      const res = await fetch(url, {
        headers: { Authorization: apiKey },
        next: { revalidate: 1800 },
      });
      if (res.ok) {
        const j = await res.json();
        if (j.data?.length) seasonAverages.push({ season, ...j.data[0] });
      }
    }

    return NextResponse.json({
      player: playerJson.data,
      seasonAverages,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
