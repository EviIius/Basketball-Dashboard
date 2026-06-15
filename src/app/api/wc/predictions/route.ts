import { NextResponse } from "next/server";
import { fdFetch, RateLimitError } from "@/lib/footballData";
import { buildSignals, predictMatch, type Standing, type WCMatch, type WCTeam } from "@/lib/wcModel";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 16), 48));
  const key = `wc-predictions:${limit}`;
  const hit = cache.get(key);
  const ttl = hit?.hasLive ? LIVE_TTL_MS : STATIC_TTL_MS;
  if (hit && Date.now() - hit.ts < ttl) return NextResponse.json(hit.data);

  try {
    const [matchesJson, standingsJson] = await Promise.all([
      fdFetch("/competitions/WC/matches") as Promise<{ matches: FDMatch[] }>,
      fdFetch("/competitions/WC/standings") as Promise<{ standings: Standing[] }>,
    ]);

    const matches = (matchesJson.matches ?? []).map(parseMatch);
    const standings = (standingsJson.standings ?? []).filter((standing) => standing.type === "TOTAL");
    const signals = buildSignals(standings, matches);
    const predictionMatches = matches
      .filter((match) => match.status === "live" || match.status === "upcoming")
      .sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (b.status === "live" && a.status !== "live") return 1;
        return a.utcDate.localeCompare(b.utcDate);
      })
      .slice(0, limit);
    const predictions = predictionMatches.map((match) => predictMatch(match, signals));
    const liveCount = predictions.filter((prediction) => prediction.match.status === "live").length;
    const upcomingCount = predictions.filter((prediction) => prediction.match.status === "upcoming").length;
    const favorites = predictions.filter((prediction) => prediction.confidence !== "low").length;
    const data = {
      generatedAt: new Date().toISOString(),
      modelVersion: "WC hybrid v1",
      summary: {
        liveCount,
        upcomingCount,
        favorites,
        matchesLoaded: matches.length,
        standingsLoaded: standings.length,
      },
      methodology: "Baseline country strength + current group form + live score/time adjustment.",
      predictions,
    };
    cache.set(key, { ts: Date.now(), data, hasLive: liveCount > 0 });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: e.message, retryAfterSeconds: e.retryAfterSeconds }, { status: 429 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build WC predictions" },
      { status: 500 },
    );
  }
}
