"use client";

import { Fragment } from "react";
import useSWR from "swr";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StandingTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  conference: string;
  conferenceRecord: string;
  playoffRank: number;
  clinchIndicator: string;
  division: string;
  wins: number;
  losses: number;
  winPct: number;
  homeRecord: string;
  roadRecord: string;
  last10: string;
  streak: string;
  gamesBack: number;
}

interface StandingsResponse {
  season: string;
  teams: StandingTeam[];
}

function ConferenceTable({ teams, conference }: { teams: StandingTeam[]; conference: "East" | "West" }) {
  const sorted = teams
    .filter((t) => t.conference === conference)
    .sort((a, b) => a.playoffRank - b.playoffRank);

  return (
    <div className="bg-court-card border border-court-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-court-border flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">
          {conference}ern Conference
        </h3>
        <span className="text-court-muted text-xs">Updated every 5 min</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-court-surface">
            <tr>
              <th className="px-2 py-2 text-left text-court-muted font-semibold uppercase tracking-wider w-8">#</th>
              <th className="px-2 py-2 text-left text-court-muted font-semibold uppercase tracking-wider">Team</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono">W</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono">L</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono">PCT</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono hidden sm:table-cell">GB</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono hidden md:table-cell">HOME</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono hidden md:table-cell">ROAD</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono hidden lg:table-cell">L10</th>
              <th className="px-2 py-2 text-right text-court-muted font-mono">STRK</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const inPlayoffs = t.playoffRank <= 6;
              const inPlayIn = t.playoffRank >= 7 && t.playoffRank <= 10;
              const showPlayInLine = i === 5 || i === 9;
              const color = TEAM_COLORS[
                Object.keys(TEAM_COLORS).find(
                  (tc) => tc === t.teamCity.slice(0, 3).toUpperCase()
                ) ?? ""
              ]?.primary;
              const streakWins = t.streak?.startsWith("W");

              return (
                <Fragment key={t.teamId}>
                  <tr
                    className={`border-t border-court-border hover:bg-court-surface/40 transition-colors ${
                      inPlayoffs ? "" : inPlayIn ? "opacity-90" : "opacity-60"
                    }`}
                  >
                    <td className="px-2 py-2 font-mono text-white font-bold text-center">
                      {t.playoffRank}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1 h-6 rounded" style={{ backgroundColor: color ?? "#6b7280" }} />
                        <span className="text-white font-semibold whitespace-nowrap">
                          {t.teamCity} {t.teamName}
                        </span>
                        {t.clinchIndicator?.trim() && (
                          <span className="text-court-accent text-[10px] font-bold">
                            {t.clinchIndicator.trim()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-court-live font-semibold">{t.wins}</td>
                    <td className="px-2 py-2 text-right font-mono text-red-400">{t.losses}</td>
                    <td className="px-2 py-2 text-right font-mono text-white">{(t.winPct * 1000).toFixed(0).padStart(3, "0").replace(/^(\d)(\d\d)$/, ".$1$2")}</td>
                    <td className="px-2 py-2 text-right font-mono text-court-muted hidden sm:table-cell">
                      {t.gamesBack === 0 ? "—" : t.gamesBack.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-court-muted hidden md:table-cell">{t.homeRecord}</td>
                    <td className="px-2 py-2 text-right font-mono text-court-muted hidden md:table-cell">{t.roadRecord}</td>
                    <td className="px-2 py-2 text-right font-mono text-court-muted hidden lg:table-cell">{t.last10}</td>
                    <td className={`px-2 py-2 text-right font-mono font-semibold ${streakWins ? "text-court-live" : "text-red-400"}`}>
                      {t.streak || "—"}
                    </td>
                  </tr>
                  {showPlayInLine && (
                    <tr>
                      <td colSpan={10} className="px-3 py-1 border-t-2 border-dashed border-court-accent/40">
                        <span className="text-court-accent text-[10px] uppercase tracking-wider font-semibold">
                          {i === 5 ? "↑ Playoffs · Play-in ↓" : "↑ Play-in · Out ↓"}
                        </span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StandingsPanel() {
  const { data, error, isLoading } = useSWR<StandingsResponse>("/api/standings", fetcher, {
    refreshInterval: 300_000, // 5 min
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-court-card border border-court-border rounded-xl p-6">
            <div className="h-4 bg-court-border rounded w-1/3 mb-4 animate-pulse" />
            {Array.from({ length: 15 }).map((_, j) => (
              <div key={j} className="h-6 bg-court-border/40 rounded mb-1 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error || !data?.teams) {
    return (
      <div className="text-center py-12 text-court-muted">
        Could not load standings — stats.nba.com may be unreachable
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-court-muted text-sm">
        Season {data.season} · Updated live
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConferenceTable teams={data.teams} conference="East" />
        <ConferenceTable teams={data.teams} conference="West" />
      </div>
    </div>
  );
}
