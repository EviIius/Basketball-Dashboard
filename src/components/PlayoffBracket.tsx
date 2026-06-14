"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { Brackets, CalendarDays, CheckCircle2, Trophy } from "lucide-react";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Series {
  seriesId: string;
  round: number;
  teamAId: number;
  teamBId: number;
  teamAWins: number;
  teamBWins: number;
  games: { gameId: string; gameNum: number; homeTeamId: number; awayTeamId: number }[];
  status: "active" | "completed";
  winnerId: number | null;
}

interface BracketResponse {
  season: string;
  series: Series[];
  error?: string;
}

const ROUND_LABELS: Record<number, string> = {
  1: "First Round",
  2: "Conf. Semifinals",
  3: "Conf. Finals",
  4: "NBA Finals",
};

function currentSeason() {
  const now = new Date();
  const start = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function seasonOptions() {
  const current = currentSeason();
  const startYear = Number(current.slice(0, 4));
  return Array.from({ length: 12 }, (_, index) => {
    const start = startYear - index;
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  });
}

function teamById(id: number) {
  return NBA_TEAMS.find((team) => team.id === id);
}

function teamName(id: number) {
  const team = teamById(id);
  return team ? `${team.city} ${team.name}` : "TBD";
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
      <div className={`flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${series.status === "active" ? "bg-court-accent/10 text-court-accent" : "bg-court-surface text-court-muted"}`}>
        <span>{series.status === "active" ? "Active" : "Completed"}</span>
        <span>Best of 7</span>
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
      <div className="border-t border-court-border px-3 py-2 text-[11px] text-court-muted">
        {series.games.length} games listed
      </div>
    </div>
  );
}

function BracketToolbar({
  season,
  seasons,
  onSeasonChange,
}: {
  season: string;
  seasons: string[];
  onSeasonChange: (season: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-court-border bg-court-card p-3">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Brackets className="h-4 w-4 text-court-accent" />
        Postseason bracket
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-court-muted">
        <CalendarDays className="h-4 w-4 text-court-amber" />
        Season
        <select
          value={season}
          onChange={(event) => onSeasonChange(event.target.value)}
          className="rounded-md border border-court-border bg-court-surface px-3 py-2 text-xs font-bold text-white outline-none focus:border-court-accent"
        >
          {seasons.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-court-border bg-court-card p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-muted">
        <CheckCircle2 className="h-4 w-4 text-court-live" />
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-court-muted">{detail}</div>
    </div>
  );
}

export default function PlayoffBracket() {
  const seasons = useMemo(() => seasonOptions(), []);
  const [season, setSeason] = useState(seasons[0]);
  const { data, error, isLoading } = useSWR<BracketResponse>(`/api/bracket?season=${encodeURIComponent(season)}`, fetcher, {
    refreshInterval: 600_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <BracketToolbar season={season} seasons={seasons} onSeasonChange={setSeason} />
        <div className="h-28 animate-pulse rounded-lg border border-court-border bg-court-card" />
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
      </div>
    );
  }

  if (error || data?.error || !data?.series) {
    return (
      <div className="space-y-4">
        <BracketToolbar season={season} seasons={seasons} onSeasonChange={setSeason} />
        <div className="rounded-lg border border-court-border bg-court-card p-10 text-center text-court-muted">
          Could not load playoff bracket for {season}.
        </div>
      </div>
    );
  }

  const byRound = new Map<number, Series[]>();
  for (const series of data.series) {
    const list = byRound.get(series.round) ?? [];
    list.push(series);
    byRound.set(series.round, list);
  }

  const completedSeries = data.series.filter((item) => item.status === "completed");
  const activeSeries = data.series.filter((item) => item.status === "active");
  const finals = data.series.find((item) => item.round === 4);
  const championId = finals?.winnerId ?? null;
  const champion = championId ? teamName(championId) : "Not decided";

  return (
    <div className="space-y-4">
      <BracketToolbar season={season} seasons={seasons} onSeasonChange={setSeason} />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-court-border bg-court-card p-4 md:col-span-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-accent">
            <Trophy className="h-4 w-4" />
            Postseason result
          </div>
          <div className="mt-2 text-2xl font-black text-white">{champion}</div>
          <div className="mt-1 text-sm text-court-muted">
            {championId ? `${data.season} NBA champion` : `Season ${data.season}, first to 4 wins per series.`}
          </div>
        </div>
        <SummaryStat label="Series" value={data.series.length.toString()} detail={`${completedSeries.length} completed`} />
        <SummaryStat label="Live state" value={activeSeries.length.toString()} detail="active series" />
      </section>

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
