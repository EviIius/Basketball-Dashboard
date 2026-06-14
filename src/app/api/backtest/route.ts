import { NextResponse } from "next/server";
import { backtest, predict, TeamSnapshot } from "@/lib/predict";
import { computeElo, EloGame } from "@/lib/elo";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";
import { NBA_TEAMS } from "@/lib/nbaTeams";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const idx = (h: string[], n: string) => h.indexOf(n);

// In-memory cache. Backtest is expensive, so cache aggressively.
const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? "2024-25";
  const seasonYear = Number(season.slice(0, 4));

  const cached = cache.get(season);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const apiKey = process.env.BALLDONTLIE_API_KEY;
  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "BALLDONTLIE_API_KEY missing" }, { status: 503 });
  }

  try {
    // 1. Get the season's advanced stats (one-shot, for snapshot)
    const advUrl =
      `https://stats.nba.com/stats/leaguedashteamstats?` +
      `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&LastNGames=0` +
      `&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=` +
      `&PORound=0&PaceAdjust=N&PerMode=Per100Possessions&Period=0&PlusMinus=N&Rank=N` +
      `&Season=${encodeURIComponent(season)}&SeasonSegment=&SeasonType=Regular+Season` +
      `&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

    const advRes = await fetch(advUrl, { headers: NBA_STATS_HEADERS });
    if (!advRes.ok) {
      return NextResponse.json({ error: "stats.nba.com unreachable" }, { status: 502 });
    }

    const advJson = await advRes.json();
    const set = advJson.resultSets?.[0];
    if (!set) return NextResponse.json({ error: "No advanced data" }, { status: 404 });

    const h: string[] = set.headers;
    const cId = idx(h, "TEAM_ID");
    const cNet = idx(h, "NET_RATING");
    const cPace = idx(h, "PACE");

    const teamSnap = new Map<number, TeamSnapshot>();
    for (const row of set.rowSet as unknown[][]) {
      const id = row[cId] as number;
      teamSnap.set(id, {
        teamId: id,
        netRating: (row[cNet] as number) ?? 0,
        pace: (row[cPace] as number) ?? 100,
      });
    }

    // 2. Get balldontlie games for the season
    type BDLRow = {
      date: string;
      status: string;
      postseason: boolean;
      home_team_score: number;
      visitor_team_score: number;
      home_team: { id: number; abbreviation: string };
      visitor_team: { id: number; abbreviation: string };
    };

    const games: EloGame[] = [];
    let cursor: number | null = null;
    let pages = 0;

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

    // Map balldontlie team IDs → NBA stats IDs via tricode
    const tricodeToNbaId = new Map(NBA_TEAMS.map((t) => [t.tricode, t.id]));
    const remappedGames: EloGame[] = games
      .map((g) => {
        const homeNba = tricodeToNbaId.get(g.homeAbbr);
        const awayNba = tricodeToNbaId.get(g.awayAbbr);
        if (!homeNba || !awayNba) return null;
        return { ...g, homeId: homeNba, awayId: awayNba };
      })
      .filter((g): g is EloGame => g !== null);

    // 3. Walk games chronologically, predicting BEFORE each one with then-current Elo
    let correct = 0;
    let brier = 0;
    const byMonth = new Map<string, { total: number; correct: number; brier: number }>();
    const sampleGames: { date: string; away: string; home: string; predHomeWin: number; actualHome: number; actualAway: number; correct: boolean }[] = [];

    // Run Elo incrementally, predicting each game first
    const eloState = new Map<number, { rating: number; games: number }>();
    const K = 20;
    const HOME_ELO = 100;

    let runningTotal = 0;

    for (const g of remappedGames) {
      const home = teamSnap.get(g.homeId);
      const away = teamSnap.get(g.awayId);
      if (!home || !away) continue;

      // Snapshot Elo into the team snapshot for prediction
      const homeElo = eloState.get(g.homeId)?.rating ?? 1500;
      const awayElo = eloState.get(g.awayId)?.rating ?? 1500;

      const homeWithElo = { ...home, elo: homeElo };
      const awayWithElo = { ...away, elo: awayElo };

      const pred = predict(homeWithElo, awayWithElo);

      const homeWon = g.homeScore > g.awayScore;
      const predictedHome = pred.homeWinProb > 0.5;
      if (homeWon === predictedHome) correct++;

      const actual = homeWon ? 1 : 0;
      const brierGame = Math.pow(pred.homeWinProb - actual, 2);
      brier += brierGame;
      runningTotal++;

      const month = g.date.slice(0, 7);
      const m = byMonth.get(month) ?? { total: 0, correct: 0, brier: 0 };
      m.total++;
      if (homeWon === predictedHome) m.correct++;
      m.brier += brierGame;
      byMonth.set(month, m);

      if (sampleGames.length < 30 && Math.random() < 0.03) {
        sampleGames.push({
          date: g.date,
          home: g.homeAbbr,
          away: g.awayAbbr,
          predHomeWin: pred.homeWinProb,
          actualHome: g.homeScore,
          actualAway: g.awayScore,
          correct: homeWon === predictedHome,
        });
      }

      // Now update Elo with the actual result
      const expected = 1 / (1 + Math.pow(10, -(homeElo + HOME_ELO - awayElo) / 400));
      const actualScore = homeWon ? 1 : 0;
      const margin = Math.abs(g.homeScore - g.awayScore);
      const mov = Math.log(margin + 1) * (2.2 / (Math.abs(homeElo + HOME_ELO - awayElo) * 0.001 + 2.2));
      const delta = K * mov * (actualScore - expected);
      eloState.set(g.homeId, { rating: homeElo + delta, games: (eloState.get(g.homeId)?.games ?? 0) + 1 });
      eloState.set(g.awayId, { rating: awayElo - delta, games: (eloState.get(g.awayId)?.games ?? 0) + 1 });
    }

    const result = {
      season,
      total: runningTotal,
      correct,
      accuracy: runningTotal > 0 ? correct / runningTotal : 0,
      brierScore: runningTotal > 0 ? brier / runningTotal : 0,
      byMonth: Array.from(byMonth.entries())
        .map(([month, v]) => ({
          month,
          total: v.total,
          correct: v.correct,
          accuracy: v.correct / v.total,
          brier: v.brier / v.total,
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      sampleGames,
    };

    cache.set(season, { ts: Date.now(), data: result });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
