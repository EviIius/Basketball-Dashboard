import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const apiKey = process.env.BALLDONTLIE_API_KEY;

  if (!apiKey || apiKey === "your_api_key_here") {
    return NextResponse.json({ error: "BALLDONTLIE_API_KEY missing" }, { status: 503 });
  }

  if (search.length < 2) {
    return NextResponse.json({ data: [], message: "Search needs ≥2 chars" });
  }

  try {
    const url = `https://api.balldontlie.io/v1/players?search=${encodeURIComponent(search)}&per_page=25`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Status ${res.status}` }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
