import { NextResponse } from "next/server";
import { NBA_STATS_HEADERS } from "@/lib/nbaHeaders";
import { currentSeason } from "@/lib/season";

export const dynamic = "force-dynamic";

type RawRow = unknown[];

interface PlayerSearchResult {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  fromYear: number;
  toYear: number;
  isActive: boolean;
  playerCode: string;
  slug: string;
  team: {
    id: number;
    city: string;
    name: string;
    abbreviation: string;
    fullName: string;
  };
}

const cache = new Map<string, { ts: number; players: PlayerSearchResult[] }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const idx = (headers: string[], name: string) => headers.indexOf(name);

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

async function fetchPlayers(season: string): Promise<PlayerSearchResult[]> {
  const hit = cache.get(season);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.players;

  const url = `https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=${encodeURIComponent(
    season
  )}&IsOnlyCurrentSeason=0`;

  const res = await fetch(url, {
    headers: NBA_STATS_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`NBA player index returned ${res.status}`);
  }

  const json = await res.json();
  const set = json.resultSets?.[0] ?? json.resultSet;
  if (!set) return [];

  const headers: string[] = set.headers;
  const columns = {
    id: idx(headers, "PERSON_ID"),
    display: idx(headers, "DISPLAY_FIRST_LAST"),
    rosterStatus: idx(headers, "ROSTERSTATUS"),
    fromYear: idx(headers, "FROM_YEAR"),
    toYear: idx(headers, "TO_YEAR"),
    playerCode: idx(headers, "PLAYERCODE"),
    slug: idx(headers, "PLAYER_SLUG"),
    teamId: idx(headers, "TEAM_ID"),
    teamCity: idx(headers, "TEAM_CITY"),
    teamName: idx(headers, "TEAM_NAME"),
    teamAbbr: idx(headers, "TEAM_ABBREVIATION"),
  };

  const players = (set.rowSet as RawRow[]).map((row) => {
    const fullName = text(row[columns.display]);
    const split = splitName(fullName);
    const city = text(row[columns.teamCity]);
    const name = text(row[columns.teamName]);
    const abbreviation = text(row[columns.teamAbbr]);

    return {
      id: num(row[columns.id]),
      fullName,
      firstName: split.firstName,
      lastName: split.lastName,
      fromYear: num(row[columns.fromYear]),
      toYear: num(row[columns.toYear]),
      isActive: num(row[columns.rosterStatus]) === 1,
      playerCode: text(row[columns.playerCode]),
      slug: text(row[columns.slug]),
      team: {
        id: num(row[columns.teamId]),
        city,
        name,
        abbreviation,
        fullName: [city, name].filter(Boolean).join(" "),
      },
    };
  });

  cache.set(season, { ts: Date.now(), players });
  return players;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const season = searchParams.get("season") ?? currentSeason();

  if (search.length < 2) {
    return NextResponse.json({ season, data: [], message: "Search needs at least 2 characters" });
  }

  try {
    const query = search.toLowerCase();
    const players = await fetchPlayers(season);
    const data = players
      .filter((player) => {
        const haystack = `${player.fullName} ${player.team.fullName} ${player.team.abbreviation}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        const aStarts = a.fullName.toLowerCase().startsWith(query);
        const bStarts = b.fullName.toLowerCase().startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return b.toYear - a.toYear || a.fullName.localeCompare(b.fullName);
      })
      .slice(0, 30);

    return NextResponse.json({ season, data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to search players" },
      { status: 500 }
    );
  }
}
