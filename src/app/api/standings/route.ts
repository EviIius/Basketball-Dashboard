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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get("season") ?? currentSeason();

  const url = `https://stats.nba.com/stats/leaguestandingsv3?LeagueID=00&Season=${encodeURIComponent(
    season
  )}&SeasonType=Regular+Season`;

  try {
    const res = await fetch(url, { headers: NBA_STATS_HEADERS, next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json({ error: `Status ${res.status}` }, { status: res.status });

    const json = await res.json();
    const set = json.resultSets?.[0];
    if (!set) return NextResponse.json({ error: "No data" }, { status: 404 });

    const h: string[] = set.headers;
    const c = {
      id: idx(h, "TeamID"),
      city: idx(h, "TeamCity"),
      name: idx(h, "TeamName"),
      conference: idx(h, "Conference"),
      conferenceRecord: idx(h, "ConferenceRecord"),
      playoffRank: idx(h, "PlayoffRank"),
      clinch: idx(h, "ClinchIndicator"),
      division: idx(h, "Division"),
      divisionRecord: idx(h, "DivisionRecord"),
      wins: idx(h, "WINS"),
      losses: idx(h, "LOSSES"),
      winPct: idx(h, "WinPCT"),
      home: idx(h, "HOME"),
      road: idx(h, "ROAD"),
      last10: idx(h, "L10"),
      currentStreak: idx(h, "strCurrentStreak"),
      confGB: idx(h, "ConferenceGamesBack"),
    };

    const teams = (set.rowSet as unknown[][]).map((row) => ({
      teamId: row[c.id] as number,
      teamCity: row[c.city] as string,
      teamName: row[c.name] as string,
      conference: row[c.conference] as string,
      conferenceRecord: row[c.conferenceRecord] as string,
      playoffRank: row[c.playoffRank] as number,
      clinchIndicator: (row[c.clinch] as string) ?? "",
      division: row[c.division] as string,
      divisionRecord: row[c.divisionRecord] as string,
      wins: row[c.wins] as number,
      losses: row[c.losses] as number,
      winPct: row[c.winPct] as number,
      homeRecord: row[c.home] as string,
      roadRecord: row[c.road] as string,
      last10: row[c.last10] as string,
      streak: (row[c.currentStreak] as string) ?? "",
      gamesBack: row[c.confGB] as number,
    }));

    return NextResponse.json({ season, teams });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
