import { NBA_STATS_HEADERS } from "./nbaHeaders";

export interface FranchisePrior {
  teamId: number;
  seasons: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  recentWinPct: number;
  priorWinPct: number;
  virtualGames: number;
  marginEquivalent: number;
}

type RawRow = unknown[];

const cache = new Map<number, { ts: number; data: FranchisePrior }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const idx = (headers: string[], name: string) => headers.indexOf(name);

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function weightedPct(rows: { wins: number; losses: number }[]): number {
  const wins = rows.reduce((sum, row) => sum + row.wins, 0);
  const losses = rows.reduce((sum, row) => sum + row.losses, 0);
  return wins + losses > 0 ? wins / (wins + losses) : 0.5;
}

export async function fetchFranchisePrior(teamId: number): Promise<FranchisePrior> {
  const hit = cache.get(teamId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const url = `https://stats.nba.com/stats/teamyearbyyearstats?LeagueID=00&PerMode=PerGame&SeasonType=Regular+Season&TeamID=${teamId}`;
  const res = await fetch(url, {
    headers: NBA_STATS_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`NBA franchise history returned ${res.status}`);
  }

  const json = await res.json();
  const set = json.resultSets?.[0];
  if (!set) {
    throw new Error("No franchise history returned");
  }

  const headers: string[] = set.headers;
  const columns = {
    wins: idx(headers, "WINS"),
    losses: idx(headers, "LOSSES"),
  };

  const rows = (set.rowSet as RawRow[])
    .map((row) => ({
      wins: num(row[columns.wins]),
      losses: num(row[columns.losses]),
    }))
    .filter((row) => row.wins + row.losses > 0);

  const wins = rows.reduce((sum, row) => sum + row.wins, 0);
  const losses = rows.reduce((sum, row) => sum + row.losses, 0);
  const recentRows = rows.slice(-10);
  const winPct = weightedPct(rows);
  const recentWinPct = weightedPct(recentRows);
  const priorWinPct = recentRows.length ? recentWinPct * 0.65 + winPct * 0.35 : winPct;
  const virtualGames = clamp(Math.round(Math.sqrt(wins + losses)), 20, 82);

  const prior: FranchisePrior = {
    teamId,
    seasons: rows.length,
    games: wins + losses,
    wins,
    losses,
    winPct,
    recentWinPct,
    priorWinPct,
    virtualGames,
    marginEquivalent: clamp((priorWinPct - 0.5) * 14, -4.5, 4.5),
  };

  cache.set(teamId, { ts: Date.now(), data: prior });
  return prior;
}
