import { NextResponse } from "next/server";
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

interface SeriesGame {
  gameId: string;
  homeTeamId: number;
  awayTeamId: number;
  gameNum: number;
}

interface Series {
  seriesId: string;
  round: number; // 1=first round, 2=semis, 3=conf finals, 4=finals
  teamAId: number;
  teamBId: number;
  teamAWins: number;
  teamBWins: number;
  games: SeriesGame[];
  status: "active" | "completed";
  winnerId: number | null;
}

// Parse a playoff game ID to extract the round.
// NBA playoff game IDs are formatted as: 0042500{R}{SS}{GG}
//   004 = playoff prefix, 25 = season (2025-26), 00 = subset,
//   R = round (1=first round, 2=conf semis, 3=conf finals, 4=finals)
//   SS = series within round, GG = game number
// e.g. 0042500101 = round 1, series 01, game 01
//      0042500405 = round 4 (NBA Finals), series 01... wait this would be game 05 of series 04.
// Position 7 (8th char) holds the round digit.
function inferRoundFromGameId(gameId: string): number {
  const ch = gameId.charAt(7);
  const r = Number(ch);
  if (r >= 1 && r <= 4) return r;
  return 1;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();

  try {
    // Get all playoff games
    const url = `https://stats.nba.com/stats/commonplayoffseries?LeagueID=00&Season=${encodeURIComponent(season)}`;
    const res = await fetch(url, { headers: NBA_STATS_HEADERS, next: { revalidate: 600 } });
    if (!res.ok) return NextResponse.json({ error: `Status ${res.status}` }, { status: res.status });

    const json = await res.json();
    const set = json.resultSets?.[0];
    if (!set) return NextResponse.json({ error: "No playoff data" }, { status: 404 });

    const h: string[] = set.headers;
    const cGameId = idx(h, "GAME_ID");
    const cHome = idx(h, "HOME_TEAM_ID");
    const cVisitor = idx(h, "VISITOR_TEAM_ID");
    const cSeries = idx(h, "SERIES_ID");
    const cGameNum = idx(h, "GAME_NUM");

    // Group games by series
    const seriesMap = new Map<string, SeriesGame[]>();
    for (const row of set.rowSet as unknown[][]) {
      const seriesId = row[cSeries] as string;
      const list = seriesMap.get(seriesId) ?? [];
      list.push({
        gameId: row[cGameId] as string,
        homeTeamId: row[cHome] as number,
        awayTeamId: row[cVisitor] as number,
        gameNum: row[cGameNum] as number,
      });
      seriesMap.set(seriesId, list);
    }

    // For game results, we need scores from the boxscores endpoint.
    // Since fetching every game would be very slow, we use leaguegamelog instead.
    const logUrl =
      `https://stats.nba.com/stats/leaguegamelog?Counter=1000&DateFrom=&DateTo=` +
      `&Direction=DESC&LeagueID=00&PlayerOrTeam=T&Season=${encodeURIComponent(season)}` +
      `&SeasonType=Playoffs&Sorter=DATE`;
    const logRes = await fetch(logUrl, { headers: NBA_STATS_HEADERS, next: { revalidate: 600 } });

    const gameResults = new Map<string, { winnerId: number; loserId: number }>();
    if (logRes.ok) {
      const logJson = await logRes.json();
      const logSet = logJson.resultSets?.[0];
      if (logSet) {
        const lh: string[] = logSet.headers;
        const lcId = idx(lh, "GAME_ID");
        const lcTeam = idx(lh, "TEAM_ID");
        const lcWl = idx(lh, "WL");
        // Each game appears twice (once per team). Pick the winner.
        for (const row of logSet.rowSet as unknown[][]) {
          const gid = row[lcId] as string;
          const team = row[lcTeam] as number;
          const wl = row[lcWl] as string;
          if (wl === "W") {
            const existing = gameResults.get(gid);
            gameResults.set(gid, { winnerId: team, loserId: existing?.loserId ?? 0 });
          } else if (wl === "L") {
            const existing = gameResults.get(gid);
            gameResults.set(gid, { winnerId: existing?.winnerId ?? 0, loserId: team });
          }
        }
      }
    }

    // Build series objects with win counts
    const series: Series[] = [];
    for (const [seriesId, games] of seriesMap.entries()) {
      games.sort((a, b) => a.gameNum - b.gameNum);

      // Find the two distinct team IDs in this series
      const teamIds = new Set<number>();
      for (const g of games) {
        teamIds.add(g.homeTeamId);
        teamIds.add(g.awayTeamId);
      }
      const [teamAId, teamBId] = Array.from(teamIds);

      let teamAWins = 0;
      let teamBWins = 0;
      for (const g of games) {
        const result = gameResults.get(g.gameId);
        if (result?.winnerId === teamAId) teamAWins++;
        else if (result?.winnerId === teamBId) teamBWins++;
      }

      const round = inferRoundFromGameId(games[0].gameId);
      const seriesWon = teamAWins >= 4 || teamBWins >= 4;
      const winnerId = teamAWins >= 4 ? teamAId : teamBWins >= 4 ? teamBId : null;

      series.push({
        seriesId,
        round,
        teamAId,
        teamBId,
        teamAWins,
        teamBWins,
        games,
        status: seriesWon ? "completed" : "active",
        winnerId,
      });
    }

    series.sort((a, b) => a.round - b.round || a.seriesId.localeCompare(b.seriesId));

    return NextResponse.json({ season, series });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
