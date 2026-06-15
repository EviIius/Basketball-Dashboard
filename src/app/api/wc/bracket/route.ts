import { NextResponse } from "next/server";
import { fdFetch, RateLimitError } from "@/lib/footballData";
import {
  buildSignals,
  groupLabel,
  predictMatch,
  type Standing,
  type StandingRow,
  type WCMatch,
  type WCTeam,
} from "@/lib/wcModel";

export const dynamic = "force-dynamic";

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  minute: number | null;
  injuryTime: number | null;
  venue: string | null;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: WCTeam;
  awayTeam: WCTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

interface ProjectedTeam {
  seed: number;
  group: string;
  groupRank: number;
  team: WCTeam;
  projectedPoints: number;
  projectedGoalDifference: number;
  rating: number;
}

interface BracketGame {
  id: string;
  home: ProjectedTeam;
  away: ProjectedTeam;
  winner: ProjectedTeam;
  homeWinProb: number;
  awayWinProb: number;
}

const cache = new Map<string, { ts: number; data: unknown; hasLive: boolean }>();
const LIVE_TTL_MS = 60 * 1000;
const STATIC_TTL_MS = 5 * 60 * 1000;

function normalizeStatus(raw: string): WCMatch["status"] {
  if (raw === "IN_PLAY" || raw === "PAUSED") return "live";
  if (raw === "SCHEDULED" || raw === "TIMED") return "upcoming";
  if (raw === "FINISHED") return "finished";
  return "other";
}

function parseMatch(match: FDMatch): WCMatch {
  const status = normalizeStatus(match.status);
  let winner: WCMatch["winner"] = null;
  if (match.score.winner === "HOME_TEAM") winner = "home";
  else if (match.score.winner === "AWAY_TEAM") winner = "away";
  else if (match.score.winner === "DRAW") winner = "draw";

  return {
    id: match.id,
    utcDate: match.utcDate,
    status,
    minute: match.minute,
    injuryTime: match.injuryTime,
    venue: match.venue,
    stage: match.stage,
    group: match.group,
    matchday: match.matchday,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.score.fullTime.home,
    awayScore: match.score.fullTime.away,
    halfTimeHome: match.score.halfTime.home,
    halfTimeAway: match.score.halfTime.away,
    winner,
  };
}

function cloneRows(standings: Standing[]) {
  const rows = new Map<number, StandingRow & { projectedPoints: number; projectedGoalDifference: number; projectedGoalsFor: number }>();
  for (const standing of standings) {
    for (const row of standing.table) {
      rows.set(row.team.id, {
        ...row,
        projectedPoints: row.points,
        projectedGoalDifference: row.goalDifference,
        projectedGoalsFor: row.goalsFor,
      });
    }
  }
  return rows;
}

function projectGroups(standings: Standing[], matches: WCMatch[]) {
  const signals = buildSignals(standings, matches);
  const projectedRows = cloneRows(standings);

  for (const match of matches.filter((item) => item.status === "upcoming" && item.group)) {
    const prediction = predictMatch(match, signals);
    const home = projectedRows.get(match.homeTeam.id);
    const away = projectedRows.get(match.awayTeam.id);
    if (!home || !away) continue;

    home.projectedPoints += prediction.homeWinProb * 3 + prediction.drawProb;
    away.projectedPoints += prediction.awayWinProb * 3 + prediction.drawProb;
    home.projectedGoalDifference += prediction.expectedGoalDiff;
    away.projectedGoalDifference -= prediction.expectedGoalDiff;
    home.projectedGoalsFor += prediction.expectedHomeGoals;
    away.projectedGoalsFor += prediction.expectedAwayGoals;
  }

  return standings
    .filter((standing) => standing.group)
    .map((standing) => {
      const table = standing.table
        .map((row) => projectedRows.get(row.team.id) ?? { ...row, projectedPoints: row.points, projectedGoalDifference: row.goalDifference, projectedGoalsFor: row.goalsFor })
        .sort((a, b) =>
          b.projectedPoints - a.projectedPoints ||
          b.projectedGoalDifference - a.projectedGoalDifference ||
          b.projectedGoalsFor - a.projectedGoalsFor ||
          a.team.name.localeCompare(b.team.name),
        );
      return { group: standing.group, label: groupLabel(standing.group), table };
    });
}

function projectedField(groupProjection: ReturnType<typeof projectGroups>, signals: ReturnType<typeof buildSignals>) {
  const automatic: ProjectedTeam[] = [];
  const thirds: ProjectedTeam[] = [];

  for (const group of groupProjection) {
    group.table.forEach((row, index) => {
      const projected: ProjectedTeam = {
        seed: 0,
        group: group.label,
        groupRank: index + 1,
        team: row.team,
        projectedPoints: row.projectedPoints,
        projectedGoalDifference: row.projectedGoalDifference,
        rating: signals.get(row.team.id)?.rating ?? 1660,
      };
      if (index < 2) automatic.push(projected);
      else if (index === 2) thirds.push(projected);
    });
  }

  const bestThirds = thirds
    .sort((a, b) =>
      b.projectedPoints - a.projectedPoints ||
      b.projectedGoalDifference - a.projectedGoalDifference ||
      b.rating - a.rating,
    )
    .slice(0, 8);

  return [...automatic, ...bestThirds]
    .sort((a, b) =>
      a.groupRank - b.groupRank ||
      b.projectedPoints - a.projectedPoints ||
      b.projectedGoalDifference - a.projectedGoalDifference ||
      b.rating - a.rating,
    )
    .map((team, index) => ({ ...team, seed: index + 1 }));
}

function fakeMatch(home: ProjectedTeam, away: ProjectedTeam): WCMatch {
  return {
    id: Number(`${home.seed}${away.seed}`),
    utcDate: new Date().toISOString(),
    status: "upcoming",
    minute: null,
    injuryTime: null,
    venue: null,
    stage: "KNOCKOUT",
    group: null,
    matchday: null,
    homeTeam: home.team,
    awayTeam: away.team,
    homeScore: null,
    awayScore: null,
    halfTimeHome: null,
    halfTimeAway: null,
    winner: null,
  };
}

function simulateRound(name: string, teams: ProjectedTeam[], signals: ReturnType<typeof buildSignals>) {
  const games: BracketGame[] = [];
  for (let index = 0; index < teams.length / 2; index++) {
    const home = teams[index];
    const away = teams[teams.length - 1 - index];
    const prediction = predictMatch(fakeMatch(home, away), signals);
    const winner = prediction.knockoutHomeWinProb >= prediction.knockoutAwayWinProb ? home : away;
    games.push({
      id: `${name}-${index + 1}`,
      home,
      away,
      winner,
      homeWinProb: prediction.knockoutHomeWinProb,
      awayWinProb: prediction.knockoutAwayWinProb,
    });
  }
  return games;
}

export async function GET() {
  const key = "wc-bracket";
  const hit = cache.get(key);
  const hasLive = Boolean(hit?.hasLive);
  const ttl = hasLive ? LIVE_TTL_MS : STATIC_TTL_MS;
  if (hit && Date.now() - hit.ts < ttl) return NextResponse.json(hit.data);

  try {
    const [matchesJson, standingsJson] = await Promise.all([
      fdFetch("/competitions/WC/matches") as Promise<{ matches: FDMatch[] }>,
      fdFetch("/competitions/WC/standings") as Promise<{ standings: Standing[] }>,
    ]);

    const matches = (matchesJson.matches ?? []).map(parseMatch);
    const standings = (standingsJson.standings ?? []).filter((standing) => standing.type === "TOTAL");
    const signals = buildSignals(standings, matches);
    const groups = projectGroups(standings, matches);
    const field = projectedField(groups, signals);
    const roundOf32 = simulateRound("Round of 32", field, signals);
    const roundOf16 = simulateRound("Round of 16", roundOf32.map((game) => game.winner), signals);
    const quarterfinals = simulateRound("Quarterfinals", roundOf16.map((game) => game.winner), signals);
    const semifinals = simulateRound("Semifinals", quarterfinals.map((game) => game.winner), signals);
    const final = simulateRound("Final", semifinals.map((game) => game.winner), signals);
    const champion = final[0]?.winner ?? field[0];
    const data = {
      generatedAt: new Date().toISOString(),
      modelVersion: "WC hybrid v1",
      methodology: "Projected group points from match probabilities, then knockout winners by no-draw win probability.",
      note: "The knockout pairing order is a model bracket seed path, not an official FIFA third-place allocation table.",
      groups,
      field,
      rounds: [
        { name: "Round of 32", games: roundOf32 },
        { name: "Round of 16", games: roundOf16 },
        { name: "Quarterfinals", games: quarterfinals },
        { name: "Semifinals", games: semifinals },
        { name: "Final", games: final },
      ],
      champion,
    };
    cache.set(key, { ts: Date.now(), data, hasLive: matches.some((match) => match.status === "live") });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds }, { status: 429 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build WC bracket" },
      { status: 500 },
    );
  }
}
