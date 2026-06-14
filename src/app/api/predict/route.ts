import { NextResponse } from "next/server";
import { predict, TeamSnapshot } from "@/lib/predict";
import { computeElo, EloGame } from "@/lib/elo";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";

export const dynamic = "force-dynamic";

const idx = (h: string[], n: string) => h.indexOf(n);

function currentSeason(): string {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  const start = m >= 9 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

// In-memory cache keyed by season. Lives for the lifetime of the lambda.
type CachedSnapshots = { advanced: Map<number, { netRating: number; pace: number }>; standings: Map<number, { last10Wins: number }>; elo: Map<number, number> };
const cache = new Map<string, { ts: number; data: CachedSnapshots }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

async function buildSnapshots(season: string): Promise<CachedSnapshots> {
  const hit = cache.get(season);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  // 1. Advanced stats (net rating + pace)
  const advUrl =
    `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&LastNGames=0` +
    `&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=` +
    `&PORound=0&PaceAdjust=N&PerMode=Per100Possessions&Period=0&PlusMinus=N&Rank=N` +
    `&Season=${encodeURIComponent(season)}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

  const stUrl = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${encodeURIComponent(
    season
  )}&SeasonType=Regular+Season`;

  const [advRes, stRes] = await Promise.all([
    fetch(advUrl, { headers: NBA_STATS_HEADERS }),
    fetch(stUrl, { headers: NBA_STATS_HEADERS }),
  ]);

  const advanced = new Map<number, { netRating: number; pace: number }>();
  if (advRes.ok) {
    const advJson = await advRes.json();
    const set = advJson.resultSets?.[0];
    if (set) {
      const h: string[] = set.headers;
      const cId = idx(h, "TEAM_ID");
      const cNet = idx(h, "NET_RATING");
      const cPace = idx(h, "PACE");
      for (const row of set.rowSet as unknown[][]) {
        advanced.set(row[cId] as number, {
          netRating: (row[cNet] as number) ?? 0,
          pace: (row[cPace] as number) ?? 100,
        });
      }
    }
  }

  const standings = new Map<number, { last10Wins: number }>();
  if (stRes.ok) {
    const stJson = await stRes.json();
    const set = stJson.resultSets?.[0];
    if (set) {
      const h: string[] = set.headers;
      const cId = idx(h, "TeamID");
      const cL10 = idx(h, "L10");
      for (const row of set.rowSet as unknown[][]) {
        const l10 = String(row[cL10] ?? "0-0");
        const wins = Number(l10.split("-")[0]);
        standings.set(row[cId] as number, { last10Wins: isNaN(wins) ? 5 : wins });
      }
    }
  }

  // 3. Elo from balldontlie game-by-game. The team IDs from balldontlie are 1-30, not
  // the NBA stats IDs (1610612737+). We use abbreviation to bridge.
  const elo = new Map<number, number>();
  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (apiKey && apiKey !== "your_api_key_here") {
    try {
      const seasonYear = Number(season.slice(0, 4));
      const games: EloGame[] = [];
      let cursor: number | null = null;
      let pages = 0;
      type BDLRow = {
        date: string;
        status: string;
        postseason: boolean;
        home_team_score: number;
        visitor_team_score: number;
        home_team: { id: number; abbreviation: string };
        visitor_team: { id: number; abbreviation: string };
      };

      do {
        const u: string = `https://api.balldontlie.io/v1/games?seasons[]=${seasonYear}&per_page=100${
          cursor ? `&cursor=${cursor}` : ""
        }`;
        const r: Response = await fetch(u, { headers: { Authorization: apiKey } });
        if (!r.ok) break;
        const j: { data: BDLRow[]; meta: { next_cursor: number | null } } = await r.json();
        for (const g of j.data) {
          if (g.status === "Final") {
            games.push({
              date: g.date,
              homeId: g.home_team.id,
              homeAbbr: g.home_team.abbreviation,
              homeScore: g.home_team_score,
              awayId: g.visitor_team.id,
              awayAbbr: g.visitor_team.abbreviation,
              awayScore: g.visitor_team_score,
              postseason: g.postseason,
            });
          }
        }
        cursor = j.meta?.next_cursor ?? null;
        pages++;
      } while (cursor && pages < 15);

      games.sort((a, b) => a.date.localeCompare(b.date));

      // balldontlie team IDs 1-30 don't match NBA's. Build abbreviation → NBA ID lookup
      // from the standings/advanced data we already have, and map via abbreviation present in
      // the static team list.
      const { NBA_TEAMS } = await import("@/lib/nbaTeams");
      const tricodeToNbaId = new Map<string, number>(
        NBA_TEAMS.map((t) => [t.tricode, t.id])
      );

      // remap game IDs from balldontlie → NBA stats IDs
      const remapped: EloGame[] = games
        .map((g) => {
          const homeId = tricodeToNbaId.get(g.homeAbbr);
          const awayId = tricodeToNbaId.get(g.awayAbbr);
          if (!homeId || !awayId) return null;
          return { ...g, homeId, awayId };
        })
        .filter((g): g is EloGame => g !== null);

      const { finalRatings } = computeElo(remapped);
      for (const [id, r] of finalRatings.entries()) elo.set(id, r.rating);
    } catch {
      // Elo is optional — predict() still works without it
    }
  }

  const data = { advanced, standings, elo };
  cache.set(season, { ts: Date.now(), data });
  return data;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const homeId = Number(searchParams.get("homeId"));
  const awayId = Number(searchParams.get("awayId"));
  const season = searchParams.get("season") ?? currentSeason();
  const homeRest = searchParams.get("homeRest");
  const awayRest = searchParams.get("awayRest");

  if (!homeId || !awayId) {
    return NextResponse.json({ error: "homeId and awayId required" }, { status: 400 });
  }

  try {
    const snap = await buildSnapshots(season);
    const buildSnap = (id: number, restDays?: number): TeamSnapshot | null => {
      const adv = snap.advanced.get(id);
      const st = snap.standings.get(id);
      const elo = snap.elo.get(id);
      if (!adv) return null;
      return {
        teamId: id,
        netRating: adv.netRating,
        pace: adv.pace,
        elo,
        last10Wins: st?.last10Wins,
        restDays,
      };
    };

    const home = buildSnap(homeId, homeRest != null ? Number(homeRest) : undefined);
    const away = buildSnap(awayId, awayRest != null ? Number(awayRest) : undefined);

    if (!home || !away) {
      return NextResponse.json(
        { error: "No advanced stats for one or both teams in this season" },
        { status: 404 }
      );
    }

    const prediction = predict(home, away);
    return NextResponse.json({
      season,
      home,
      away,
      prediction,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
