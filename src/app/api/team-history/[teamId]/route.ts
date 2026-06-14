import { NextResponse } from "next/server";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";
import type { TeamSeasonRecord } from "@/lib/types";

const idx = (headers: string[], name: string) => headers.indexOf(name);

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const url = `https://stats.nba.com/stats/teamyearbyyearstats?LeagueID=00&PerMode=PerGame&SeasonType=Regular+Season&TeamID=${teamId}`;

  try {
    const res = await fetch(url, {
      headers: NBA_STATS_HEADERS,
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch team history" }, { status: res.status });
    }

    const json = await res.json();
    const resultSet = json.resultSets?.[0];
    if (!resultSet) return NextResponse.json({ error: "No data returned" }, { status: 404 });

    const h: string[] = resultSet.headers;
    const rows: unknown[][] = resultSet.rowSet;

    const c = {
      year: idx(h, "YEAR"),
      gp: idx(h, "GP"),
      w: idx(h, "WINS"),
      l: idx(h, "LOSSES"),
      wPct: idx(h, "WIN_PCT"),
      confRank: idx(h, "CONF_RANK"),
      divRank: idx(h, "DIV_RANK"),
      poW: idx(h, "PO_WINS"),
      poL: idx(h, "PO_LOSSES"),
      finals: idx(h, "NBA_FINALS_APPEARANCE"),
      pts: idx(h, "PTS"),
      reb: idx(h, "REB"),
      ast: idx(h, "AST"),
      stl: idx(h, "STL"),
      blk: idx(h, "BLK"),
      tov: idx(h, "TOV"),
      fgPct: idx(h, "FG_PCT"),
      fg3Pct: idx(h, "FG3_PCT"),
      ftPct: idx(h, "FT_PCT"),
      ptsRank: idx(h, "PTS_RANK"),
    };

    const seasons: TeamSeasonRecord[] = rows.map((row) => {
      const num = (i: number) => (i >= 0 ? (row[i] as number | null) ?? 0 : 0);
      return {
        season: row[c.year] as string,
        gamesPlayed: num(c.gp),
        wins: num(c.w),
        losses: num(c.l),
        winPct: num(c.wPct),
        confRank: num(c.confRank),
        divRank: num(c.divRank),
        playoffWins: num(c.poW),
        playoffLosses: num(c.poL),
        finalsAppearance: c.finals >= 0 ? String(row[c.finals] ?? "N/A") : "N/A",
        ppg: num(c.pts),
        rpg: num(c.reb),
        apg: num(c.ast),
        spg: num(c.stl),
        bpg: num(c.blk),
        topg: num(c.tov),
        fgPct: num(c.fgPct),
        fg3Pct: num(c.fg3Pct),
        ftPct: num(c.ftPct),
        ptsRank: num(c.ptsRank),
      };
    });

    return NextResponse.json({ teamId: Number(teamId), seasons });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch team history" },
      { status: 500 }
    );
  }
}
