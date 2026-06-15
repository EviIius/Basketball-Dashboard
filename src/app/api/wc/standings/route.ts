import { NextResponse } from "next/server";
import { fdFetch, RateLimitError } from "@/lib/footballData";

export const dynamic = "force-dynamic";

interface StandingRow {
  position: number;
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FDStanding {
  stage: string;
  type: string;
  group: string | null;
  table: StandingRow[];
}

const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const key = "wc-standings";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return NextResponse.json(hit.data);

  try {
    const json = (await fdFetch("/competitions/WC/standings")) as { standings: FDStanding[] };
    // Keep only the TOTAL type (vs HOME/AWAY splits) and filter to group stage
    const standings = (json.standings ?? []).filter((s) => s.type === "TOTAL");
    const data = { standings };
    cache.set(key, { ts: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json(
        { error: e.message, retryAfterSeconds: e.retryAfterSeconds },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch WC standings" },
      { status: 500 }
    );
  }
}
