import { NextResponse } from "next/server";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";

export const dynamic = "force-dynamic";

const idx = (h: string[], n: string) => h.indexOf(n);

function currentSeason(): string {
  // NBA seasons run Oct to June; Oct-Dec is start year, Jan-Jun is end year.
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = month >= 9 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();

  const url =
    `https://stats.nba.com/stats/leaguedashteamstats?` +
    `Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&LastNGames=0` +
    `&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=` +
    `&PORound=0&PaceAdjust=N&PerMode=Per100Possessions&Period=0&PlusMinus=N&Rank=N` +
    `&Season=${encodeURIComponent(season)}&SeasonSegment=&SeasonType=Regular+Season` +
    `&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

  try {
    const res = await fetch(url, { headers: NBA_STATS_HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) return NextResponse.json({ error: `Status ${res.status}` }, { status: res.status });

    const json = await res.json();
    const set = json.resultSets?.[0];
    if (!set) return NextResponse.json({ error: "No data" }, { status: 404 });

    const h: string[] = set.headers;
    const cols = {
      id: idx(h, "TEAM_ID"),
      name: idx(h, "TEAM_NAME"),
      gp: idx(h, "GP"),
      w: idx(h, "W"),
      l: idx(h, "L"),
      off: idx(h, "OFF_RATING"),
      def: idx(h, "DEF_RATING"),
      net: idx(h, "NET_RATING"),
      pace: idx(h, "PACE"),
      eFg: idx(h, "EFG_PCT"),
      ts: idx(h, "TS_PCT"),
      pie: idx(h, "PIE"),
    };

    const teams = (set.rowSet as unknown[][]).map((row) => ({
      teamId: row[cols.id] as number,
      teamName: row[cols.name] as string,
      gp: row[cols.gp] as number,
      wins: row[cols.w] as number,
      losses: row[cols.l] as number,
      offRating: row[cols.off] as number,
      defRating: row[cols.def] as number,
      netRating: row[cols.net] as number,
      pace: row[cols.pace] as number,
      eFgPct: row[cols.eFg] as number,
      tsPct: row[cols.ts] as number,
      pie: row[cols.pie] as number,
    }));

    return NextResponse.json({ season, teams });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
