import { NextResponse } from "next/server";
import { NBA_CDN_HEADERS } from "@/lib/nbaHeaders";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: NBA_CDN_HEADERS,
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Box score not available" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data.game, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch box score" }, { status: 500 });
  }
}
