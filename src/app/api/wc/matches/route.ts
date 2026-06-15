import { NextResponse } from "next/server";
import { fdFetch, RateLimitError } from "@/lib/footballData";

export const dynamic = "force-dynamic";

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

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
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

export interface WCMatch {
  id: number;
  utcDate: string;
  status: "live" | "upcoming" | "finished" | "other";
  minute: number | null;
  injuryTime: number | null;
  venue: string | null;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: "home" | "away" | "draw" | null;
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

function parseMatch(m: FDMatch): WCMatch {
  const status = normalizeStatus(m.status);
  let winner: WCMatch["winner"] = null;
  if (m.score.winner === "HOME_TEAM") winner = "home";
  else if (m.score.winner === "AWAY_TEAM") winner = "away";
  else if (m.score.winner === "DRAW") winner = "draw";

  return {
    id: m.id,
    utcDate: m.utcDate,
    status,
    minute: m.minute,
    injuryTime: m.injuryTime,
    venue: m.venue,
    stage: m.stage,
    group: m.group,
    matchday: m.matchday,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    halfTimeHome: m.score.halfTime.home,
    halfTimeAway: m.score.halfTime.away,
    winner,
  };
}

export async function GET() {
  const key = "wc-matches";
  const hit = cache.get(key);
  const ttl = hit?.hasLive ? LIVE_TTL_MS : STATIC_TTL_MS;
  if (hit && Date.now() - hit.ts < ttl) {
    return NextResponse.json(hit.data);
  }

  try {
    const json = (await fdFetch("/competitions/WC/matches")) as { matches: FDMatch[] };
    const all = (json.matches ?? []).map(parseMatch);

    const todayStr = new Date().toISOString().slice(0, 10);
    const live = all.filter((m) => m.status === "live");
    const today = all.filter((m) => m.status === "upcoming" && m.utcDate.slice(0, 10) === todayStr);
    const recent = all
      .filter((m) => m.status === "finished")
      .slice(-12)
      .reverse();
    const upcoming = all
      .filter((m) => m.status === "upcoming" && m.utcDate.slice(0, 10) > todayStr)
      .slice(0, 12);

    const data = { live, today, recent, upcoming };
    cache.set(key, { ts: Date.now(), data, hasLive: live.length > 0 });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: e.message, retryAfterSeconds: e.retryAfterSeconds },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch WC matches" },
      { status: 500 }
    );
  }
}
