import { NextResponse } from "next/server";
import { fdFetch, RateLimitError } from "@/lib/footballData";

export const dynamic = "force-dynamic";

const cache = new Map<string, { ts: number; data: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const key = "wc-scorers";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return NextResponse.json(hit.data);

  try {
    const json = (await fdFetch("/competitions/WC/scorers?limit=25")) as { scorers: unknown[] };
    const data = { scorers: json.scorers ?? [] };
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
      { error: e instanceof Error ? e.message : "Failed to fetch WC scorers" },
      { status: 500 }
    );
  }
}
