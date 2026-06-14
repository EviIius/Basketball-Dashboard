import { NextResponse } from "next/server";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";

export const dynamic = "force-dynamic";

type RawRow = unknown[];

interface PlayerBio {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  slug: string;
  birthdate: string;
  school: string;
  country: string;
  height: string;
  weight: string;
  experience: number;
  jersey: string;
  position: string;
  rosterStatus: string;
  fromYear: number;
  toYear: number;
  draftYear: string;
  draftRound: string;
  draftNumber: string;
  team: {
    id: number;
    city: string;
    name: string;
    abbreviation: string;
    fullName: string;
  };
}

interface PlayerSeasonStats {
  season: string;
  teamId: number;
  team: string;
  age: number;
  gp: number;
  gs: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  fgPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  ftm: number;
  fta: number;
  ftPct: number;
}

const cache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

const idx = (headers: string[], name: string) => headers.indexOf(name);

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function val(row: RawRow, index: number): unknown {
  return index >= 0 ? row[index] : undefined;
}

function parseBio(set: { headers: string[]; rowSet: RawRow[] } | undefined): PlayerBio | null {
  const row = set?.rowSet?.[0];
  if (!set || !row) return null;

  const h = set.headers;
  const c = {
    id: idx(h, "PERSON_ID"),
    firstName: idx(h, "FIRST_NAME"),
    lastName: idx(h, "LAST_NAME"),
    fullName: idx(h, "DISPLAY_FIRST_LAST"),
    slug: idx(h, "PLAYER_SLUG"),
    birthdate: idx(h, "BIRTHDATE"),
    school: idx(h, "SCHOOL"),
    country: idx(h, "COUNTRY"),
    height: idx(h, "HEIGHT"),
    weight: idx(h, "WEIGHT"),
    exp: idx(h, "SEASON_EXP"),
    jersey: idx(h, "JERSEY"),
    position: idx(h, "POSITION"),
    rosterStatus: idx(h, "ROSTERSTATUS"),
    teamId: idx(h, "TEAM_ID"),
    teamName: idx(h, "TEAM_NAME"),
    teamAbbr: idx(h, "TEAM_ABBREVIATION"),
    teamCity: idx(h, "TEAM_CITY"),
    fromYear: idx(h, "FROM_YEAR"),
    toYear: idx(h, "TO_YEAR"),
    draftYear: idx(h, "DRAFT_YEAR"),
    draftRound: idx(h, "DRAFT_ROUND"),
    draftNumber: idx(h, "DRAFT_NUMBER"),
  };

  const city = text(val(row, c.teamCity));
  const name = text(val(row, c.teamName));

  return {
    id: num(val(row, c.id)),
    fullName: text(val(row, c.fullName)),
    firstName: text(val(row, c.firstName)),
    lastName: text(val(row, c.lastName)),
    slug: text(val(row, c.slug)),
    birthdate: text(val(row, c.birthdate)),
    school: text(val(row, c.school)),
    country: text(val(row, c.country)),
    height: text(val(row, c.height)),
    weight: text(val(row, c.weight)),
    experience: num(val(row, c.exp)),
    jersey: text(val(row, c.jersey)),
    position: text(val(row, c.position)),
    rosterStatus: text(val(row, c.rosterStatus)),
    fromYear: num(val(row, c.fromYear)),
    toYear: num(val(row, c.toYear)),
    draftYear: text(val(row, c.draftYear)),
    draftRound: text(val(row, c.draftRound)),
    draftNumber: text(val(row, c.draftNumber)),
    team: {
      id: num(val(row, c.teamId)),
      city,
      name,
      abbreviation: text(val(row, c.teamAbbr)),
      fullName: [city, name].filter(Boolean).join(" "),
    },
  };
}

function parseSeasonRows(set: { headers: string[]; rowSet: RawRow[] } | undefined): PlayerSeasonStats[] {
  if (!set) return [];

  const h = set.headers;
  const c = {
    season: idx(h, "SEASON_ID"),
    teamId: idx(h, "TEAM_ID"),
    team: idx(h, "TEAM_ABBREVIATION"),
    age: idx(h, "PLAYER_AGE"),
    gp: idx(h, "GP"),
    gs: idx(h, "GS"),
    min: idx(h, "MIN"),
    fgm: idx(h, "FGM"),
    fga: idx(h, "FGA"),
    fgPct: idx(h, "FG_PCT"),
    fg3m: idx(h, "FG3M"),
    fg3a: idx(h, "FG3A"),
    fg3Pct: idx(h, "FG3_PCT"),
    ftm: idx(h, "FTM"),
    fta: idx(h, "FTA"),
    ftPct: idx(h, "FT_PCT"),
    reb: idx(h, "REB"),
    ast: idx(h, "AST"),
    stl: idx(h, "STL"),
    blk: idx(h, "BLK"),
    tov: idx(h, "TOV"),
    pf: idx(h, "PF"),
    pts: idx(h, "PTS"),
  };

  return set.rowSet.map((row) => ({
    season: text(val(row, c.season)),
    teamId: num(val(row, c.teamId)),
    team: text(val(row, c.team)),
    age: num(val(row, c.age)),
    gp: num(val(row, c.gp)),
    gs: num(val(row, c.gs)),
    min: num(val(row, c.min)),
    pts: num(val(row, c.pts)),
    reb: num(val(row, c.reb)),
    ast: num(val(row, c.ast)),
    stl: num(val(row, c.stl)),
    blk: num(val(row, c.blk)),
    tov: num(val(row, c.tov)),
    pf: num(val(row, c.pf)),
    fgm: num(val(row, c.fgm)),
    fga: num(val(row, c.fga)),
    fgPct: num(val(row, c.fgPct)),
    fg3m: num(val(row, c.fg3m)),
    fg3a: num(val(row, c.fg3a)),
    fg3Pct: num(val(row, c.fg3Pct)),
    ftm: num(val(row, c.ftm)),
    fta: num(val(row, c.fta)),
    ftPct: num(val(row, c.ftPct)),
  }));
}

function latestSeason(seasons: PlayerSeasonStats[]): PlayerSeasonStats | null {
  const rows = seasons.filter((season) => season.team !== "TOT");
  const source = rows.length ? rows : seasons;
  return [...source].sort((a, b) => b.season.localeCompare(a.season))[0] ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const key = String(playerId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return NextResponse.json(hit.data);

  try {
    const [infoRes, careerRes] = await Promise.all([
      fetch(`https://stats.nba.com/stats/commonplayerinfo?PlayerID=${encodeURIComponent(playerId)}`, {
        headers: NBA_STATS_HEADERS,
        cache: "no-store",
      }),
      fetch(`https://stats.nba.com/stats/playercareerstats?PlayerID=${encodeURIComponent(playerId)}&PerMode=PerGame`, {
        headers: NBA_STATS_HEADERS,
        cache: "no-store",
      }),
    ]);

    if (!infoRes.ok) throw new Error(`NBA player info returned ${infoRes.status}`);
    if (!careerRes.ok) throw new Error(`NBA career stats returned ${careerRes.status}`);

    const [infoJson, careerJson] = await Promise.all([infoRes.json(), careerRes.json()]);
    const infoSets = infoJson.resultSets ?? [];
    const careerSets = careerJson.resultSets ?? [];
    const setByName = (sets: { name: string; headers: string[]; rowSet: RawRow[] }[], name: string) =>
      sets.find((set) => set.name === name);

    const bio = parseBio(setByName(infoSets, "CommonPlayerInfo"));
    const headlineSet = setByName(infoSets, "PlayerHeadlineStats");
    const regularSeasons = parseSeasonRows(setByName(careerSets, "SeasonTotalsRegularSeason"));
    const playoffSeasons = parseSeasonRows(setByName(careerSets, "SeasonTotalsPostSeason"));
    const careerRegular = parseSeasonRows(setByName(careerSets, "CareerTotalsRegularSeason"))[0] ?? null;
    const careerPlayoffs = parseSeasonRows(setByName(careerSets, "CareerTotalsPostSeason"))[0] ?? null;
    const latest = latestSeason(regularSeasons);

    const payload = {
      player: bio,
      headline: headlineSet
        ? {
            headers: headlineSet.headers,
            row: headlineSet.rowSet?.[0] ?? [],
          }
        : null,
      latestSeason: latest,
      regularSeasons,
      playoffSeasons,
      careerRegular,
      careerPlayoffs,
    };

    cache.set(key, { ts: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch player stats" },
      { status: 500 }
    );
  }
}
