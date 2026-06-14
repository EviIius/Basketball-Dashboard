import { NextResponse } from "next/server";
import { NBA_TEAMS } from "@/lib/nbaTeams";

export async function GET() {
  return NextResponse.json(NBA_TEAMS);
}
