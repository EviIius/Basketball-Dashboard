import { NextResponse } from "next/server";
import { NBA_CDN_HEADERS } from "@/lib/nbaHeaders";

const NBA_CDN_SCOREBOARD =
  "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(NBA_CDN_SCOREBOARD, {
      cache: "no-store",
      headers: NBA_CDN_HEADERS,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `NBA CDN returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data.scoreboard, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch live games" },
      { status: 500 }
    );
  }
}
