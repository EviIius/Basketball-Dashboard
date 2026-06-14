"use client";

import useSWR from "swr";
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

const teamById = (id: number) => NBA_TEAMS.find((t) => t.id === id);

function SeriesCard({ s }: { s: Series }) {
  const teamA = teamById(s.teamAId);
  const teamB = teamById(s.teamBId);
  if (!teamA || !teamB) return null;

  const colorA = TEAM_COLORS[teamA.tricode]?.primary ?? "#6b7280";
  const colorB = TEAM_COLORS[teamB.tricode]?.primary ?? "#6b7280";
  const aWon = s.winnerId === s.teamAId;
  const bWon = s.winnerId === s.teamBId;

  return (
    <div className={`bg-court-card border rounded-xl overflow-hidden transition-all ${
      s.status === "active" ? "border-court-accent/40" : "border-court-border"
    }`}>
      <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
        s.status === "active" ? "bg-court-accent/10 text-court-accent" : "bg-court-surface text-court-muted"
      }`}>
        {s.status === "active" ? "● Active" : "Completed"}
      </div>
      <div>
        <div className={`flex items-center gap-2 p-2.5 ${aWon ? "" : bWon ? "opacity-50" : ""}`}>
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
            style={{ backgroundColor: colorA }}
          >
            {teamA.tricode}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{teamA.city}</div>
            <div className="text-court-muted text-[10px]">{teamA.name}</div>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < s.teamAWins ? "" : "bg-court-border"
                }`}
                style={i < s.teamAWins ? { backgroundColor: colorA } : {}}
              />
            ))}
          </div>
          <span className="text-white font-bold text-sm w-4 text-right">{s.teamAWins}</span>
        </div>
        <div className="h-px bg-court-border" />
        <div className={`flex items-center gap-2 p-2.5 ${bWon ? "" : aWon ? "opacity-50" : ""}`}>
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
            style={{ backgroundColor: colorB }}
          >
            {teamB.tricode}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold truncate">{teamB.city}</div>
            <div className="text-court-muted text-[10px]">{teamB.name}</div>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < s.teamBWins ? "" : "bg-court-border"
                }`}
                style={i < s.teamBWins ? { backgroundColor: colorB } : {}}
              />
            ))}
          </div>
          <span className="text-white font-bold text-sm w-4 text-right">{s.teamBWins}</span>
        </div>
      </div>
    </div>
  );
}

const ROUND_LABELS: Record<number, string> = {
  1: "First Round",
  2: "Conf. Semifinals",
  3: "Conf. Finals",
  4: "NBA Finals",
};

export default function PlayoffBracket() {
  const { data, error, isLoading } = useSWR<BracketResponse>("/api/bracket", fetcher, {
    refreshInterval: 600_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 bg-court-border rounded animate-pulse w-3/4" />
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="h-24 bg-court-card border border-court-border rounded-xl animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.series) {
    return (
      <div className="text-center py-12 text-court-muted">
        Could not load playoff bracket
      </div>
    );
  }

  const byRound = new Map<number, Series[]>();
  for (const s of data.series) {
    const list = byRound.get(s.round) ?? [];
    list.push(s);
    byRound.set(s.round, list);
  }

  const allRounds = [1, 2, 3, 4];

  return (
    <div className="space-y-4">
      <div className="text-court-muted text-sm">
        Season {data.season} · {data.series.length} series · First to 4 wins
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {allRounds.map((round) => {
          const seriesInRound = byRound.get(round) ?? [];
          return (
            <div key={round} className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-court-border">
                <h3 className="text-white font-bold text-sm">{ROUND_LABELS[round]}</h3>
                <span className="text-court-muted text-xs ml-auto">
                  {seriesInRound.length} series
                </span>
              </div>
              {seriesInRound.length === 0 ? (
                <div className="text-court-muted text-xs italic p-4 text-center bg-court-card/30 border border-court-border/40 rounded-xl">
                  Not started yet
                </div>
              ) : (
                seriesInRound.map((s) => <SeriesCard key={s.seriesId} s={s} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
