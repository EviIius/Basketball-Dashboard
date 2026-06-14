import { NextResponse } from "next/server";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";

export const dynamic = "force-dynamic";

const idx = (h: string[], n: string) => h.indexOf(n);

function currentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = month >= 9 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const VALID_CATEGORIES = ["PTS", "REB", "AST", "STL", "BLK", "FG3M", "FG_PCT", "FG3_PCT", "FT_PCT", "MIN", "EFF"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();
  const stat = (searchParams.get("stat") ?? "PTS").toUpperCase();

  if (!VALID_CATEGORIES.includes(stat)) {
    return NextResponse.json({ error: "Invalid stat category" }, { status: 400 });
  }

  const url =
    `https://stats.nba.com/stats/leagueleaders?` +
    `LeagueID=00&PerMode=PerGame&Scope=S&Season=${encodeURIComponent(season)}` +
    `&SeasonType=Regular+Season&StatCategory=${stat}`;

  try {
    const res = await fetch(url, { headers: NBA_STATS_HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) return NextResponse.json({ error: `Status ${res.status}` }, { status: res.status });

    const json = await res.json();
    const set = json.resultSet ?? json.resultSets?.[0];
    if (!set) return NextResponse.json({ error: "No data" }, { status: 404 });

    const h: string[] = set.headers;
    const c = {
      playerId: idx(h, "PLAYER_ID"),
      rank: idx(h, "RANK"),
      player: idx(h, "PLAYER"),
      teamId: idx(h, "TEAM_ID"),
      team: idx(h, "TEAM"),
      gp: idx(h, "GP"),
      min: idx(h, "MIN"),
      pts: idx(h, "PTS"),
      reb: idx(h, "REB"),
      ast: idx(h, "AST"),
      stl: idx(h, "STL"),
      blk: idx(h, "BLK"),
      fgPct: idx(h, "FG_PCT"),
      fg3m: idx(h, "FG3M"),
      fg3Pct: idx(h, "FG3_PCT"),
      ftPct: idx(h, "FT_PCT"),
      eff: idx(h, "EFF"),
    };

    const leaders = (set.rowSet as unknown[][]).slice(0, 25).map((row) => ({
      playerId: row[c.playerId] as number,
      rank: row[c.rank] as number,
      playerName: row[c.player] as string,
      teamId: row[c.teamId] as number,
      teamTricode: row[c.team] as string,
      gp: row[c.gp] as number,
      minutes: row[c.min] as number,
      pts: row[c.pts] as number,
      reb: row[c.reb] as number,
      ast: row[c.ast] as number,
      stl: row[c.stl] as number,
      blk: row[c.blk] as number,
      fgPct: row[c.fgPct] as number,
      fg3m: row[c.fg3m] as number,
      fg3Pct: row[c.fg3Pct] as number,
      ftPct: row[c.ftPct] as number,
      eff: row[c.eff] as number,
    }));

    return NextResponse.json({ season, stat, leaders });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
