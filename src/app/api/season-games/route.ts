import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fetches ALL completed games for a season from balldontlie, paginating cursor-style.
// Used by the Elo model. Heavy endpoint — cached for an hour.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = Number(searchParams.get("season") ?? "2024");
  const apiKey = process.env.BALLDONTLIE_API_KEY;

  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "BALLDONTLIE_API_KEY missing" }, { status: 503 });
  }

  try {
    type BDLGameRow = {
      id: number;
      date: string;
      season: number;
      status: string;
      postseason: boolean;
      home_team_score: number;
      visitor_team_score: number;
      home_team: { id: number; abbreviation: string };
      visitor_team: { id: number; abbreviation: string };
    };

    type SimplifiedGame = {
      id: number;
      date: string;
      postseason: boolean;
      homeId: number;
      homeAbbr: string;
      homeScore: number;
      awayId: number;
      awayAbbr: string;
      awayScore: number;
    };

    const allGames: SimplifiedGame[] = [];
    let cursor: number | null = null;
    let pages = 0;
    const maxPages = 15; // safety cap: 15 * 100 = 1500 games (full season ≈ 1230)

    do {
      const url: string = `https://api.balldontlie.io/v1/games?seasons[]=${season}&per_page=100${
        cursor ? `&cursor=${cursor}` : ""
      }`;
      const res: Response = await fetch(url, {
        headers: { Authorization: apiKey },
        next: { revalidate: 3600 },
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Balldontlie returned ${res.status}` },
          { status: res.status }
        );
      }
      const json: { data: BDLGameRow[]; meta: { next_cursor: number | null } } = await res.json();
      for (const g of json.data) {
        if (g.status === "Final") {
          allGames.push({
            id: g.id,
            date: g.date,
            postseason: g.postseason,
            homeId: g.home_team.id,
            homeAbbr: g.home_team.abbreviation,
            homeScore: g.home_team_score,
            awayId: g.visitor_team.id,
            awayAbbr: g.visitor_team.abbreviation,
            awayScore: g.visitor_team_score,
          });
        }
      }
      cursor = json.meta?.next_cursor ?? null;
      pages++;
    } while (cursor && pages < maxPages);

    allGames.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(
      { season, gameCount: allGames.length, games: allGames },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
