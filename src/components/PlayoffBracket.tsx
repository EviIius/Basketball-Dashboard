"use client";

import useSWR from "swr";
import { Trophy } from "lucide-react";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Series {
  seriesId: string;
  round: number;
  teamAId: number;
  teamBId: number;
  teamAWins: number;
  teamBWins: number;
  status: "active" | "completed";
  winnerId: number | null;
}

interface BracketResponse {
  season: string;
  series: Series[];
}

const ROUND_LABELS: Record<number, string> = {
  1: "First Round",
  2: "Conf. Semifinals",
  3: "Conf. Finals",
  4: "NBA Finals",
};

function teamById(id: number) {
  return NBA_TEAMS.find((team) => team.id === id);
}

function SeriesCard({ series }: { series: Series }) {
  const teamA = teamById(series.teamAId);
  const teamB = teamById(series.teamBId);
  if (!teamA || !teamB) return null;

  const colorA = TEAM_COLORS[teamA.tricode]?.primary ?? "#6b7280";
  const colorB = TEAM_COLORS[teamB.tricode]?.primary ?? "#6b7280";
  const aWon = series.winnerId === series.teamAId;
  const bWon = series.winnerId === series.teamBId;

  const rows = [
    { team: teamA, color: colorA, wins: series.teamAWins, won: aWon, faded: bWon },
    { team: teamB, color: colorB, wins: series.teamBWins, won: bWon, faded: aWon },
  ];

  return (
    <div className={`overflow-hidden rounded-lg border bg-court-card ${series.status === "active" ? "border-court-accent/70" : "border-court-border"}`}>
      <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${series.status === "active" ? "bg-court-accent/10 text-court-accent" : "bg-court-surface text-court-muted"}`}>
        {series.status === "active" ? "Active" : "Completed"}
      </div>
      <div>
        {rows.map((row, index) => (
          <div key={row.team.id}>
            <div className={`flex items-center gap-2 p-2.5 ${row.faded ? "opacity-50" : ""}`}>
              <div className="flex h-7 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white" style={{ backgroundColor: row.color }}>
                {row.team.tricode}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-white">{row.team.city}</div>
                <div className="text-[10px] text-court-muted">{row.team.name}</div>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 4 }).map((_, dot) => (
                  <div key={dot} className={`h-2 w-2 rounded-full ${dot < row.wins ? "" : "bg-court-border"}`} style={dot < row.wins ? { backgroundColor: row.color } : {}} />
                ))}
              </div>
              <span className="w-4 text-right text-sm font-bold text-white">{row.wins}</span>
              {row.won && <Trophy className="h-3.5 w-3.5 text-court-amber" />}
            </div>
            {index === 0 && <div className="h-px bg-court-border" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayoffBracket() {
  const { data, error, isLoading } = useSWR<BracketResponse>("/api/bracket", fetcher, {
    refreshInterval: 600_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-court-border" />
            {Array.from({ length: 2 }).map((_, row) => (
              <div key={row} className="h-24 animate-pulse rounded-lg border border-court-border bg-court-card" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.series) {
    return (
      <div className="rounded-lg border border-court-border bg-court-card p-10 text-center text-court-muted">
        Could not load playoff bracket.
      </div>
    );
  }

  const byRound = new Map<number, Series[]>();
  for (const series of data.series) {
    const list = byRound.get(series.round) ?? [];
    list.push(series);
    byRound.set(series.round, list);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-court-muted">Season {data.season} / First to 4 wins</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((round) => {
          const roundSeries = byRound.get(round) ?? [];
          return (
            <div key={round} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-court-border pb-2">
                <h3 className="text-sm font-black text-white">{ROUND_LABELS[round]}</h3>
                <span className="ml-auto text-xs text-court-muted">{roundSeries.length}</span>
              </div>
              {roundSeries.length === 0 ? (
                <div className="rounded-lg border border-court-border/70 bg-court-card/50 p-4 text-center text-xs text-court-muted">
                  Not started
                </div>
              ) : (
                roundSeries.map((series) => <SeriesCard key={series.seriesId} series={series} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
