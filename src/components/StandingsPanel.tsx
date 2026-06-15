"use client";

import { Fragment } from "react";
import useSWR from "swr";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";

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

function tricodeForTeam(teamId: number) {
  return NBA_TEAMS.find((team) => team.id === teamId)?.tricode ?? "";
}

function formatPct(value: number) {
  return value.toFixed(3).replace(/^0/, "");
}

function ConferenceTable({ teams, conference }: { teams: StandingTeam[]; conference: "East" | "West" }) {
  const sorted = teams
    .filter((team) => team.conference === conference)
    .sort((a, b) => a.playoffRank - b.playoffRank);

  return (
    <div className="overflow-hidden rounded-lg border border-court-border bg-court-card">
      <div className="flex items-center justify-between border-b border-court-border px-4 py-3">
        <h3 className="text-sm font-black text-white">{conference}ern Conference</h3>
        <span className="text-xs text-court-muted">{sorted.length} teams</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-court-surface">
            <tr>
              <th className="w-8 px-2 py-2 text-left font-semibold uppercase tracking-wider text-court-muted">#</th>
              <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider text-court-muted">Team</th>
              <th className="px-2 py-2 text-right font-mono text-court-muted">W</th>
              <th className="px-2 py-2 text-right font-mono text-court-muted">L</th>
              <th className="px-2 py-2 text-right font-mono text-court-muted">PCT</th>
              <th className="hidden px-2 py-2 text-right font-mono text-court-muted sm:table-cell">GB</th>
              <th className="hidden px-2 py-2 text-right font-mono text-court-muted md:table-cell">HOME</th>
              <th className="hidden px-2 py-2 text-right font-mono text-court-muted md:table-cell">ROAD</th>
              <th className="hidden px-2 py-2 text-right font-mono text-court-muted lg:table-cell">L10</th>
              <th className="px-2 py-2 text-right font-mono text-court-muted">STRK</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team, index) => {
              const inPlayoffs = team.playoffRank <= 6;
              const inPlayIn = team.playoffRank >= 7 && team.playoffRank <= 10;
              const showCutLine = index === 5 || index === 9;
              const tricode = tricodeForTeam(team.teamId);
              const color = TEAM_COLORS[tricode]?.primary ?? "#6b7280";
              const streakWins = team.streak?.startsWith("W");

              return (
                <Fragment key={team.teamId}>
                  <tr
                    className={`border-t border-court-border transition-colors hover:bg-court-surface/60 ${
                      inPlayoffs ? "" : inPlayIn ? "opacity-90" : "opacity-60"
                    }`}
                  >
                    <td className="px-2 py-2 text-center font-mono font-bold text-white">{team.playoffRank}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-1 rounded-sm" style={{ backgroundColor: color }} />
                        <span className="whitespace-nowrap font-semibold text-white">
                          {team.teamCity} {team.teamName}
                        </span>
                        {team.clinchIndicator?.trim() && (
                          <span className="text-[10px] font-bold text-court-amber">{team.clinchIndicator.trim()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-court-live">{team.wins}</td>
                    <td className="px-2 py-2 text-right font-mono text-court-red">{team.losses}</td>
                    <td className="px-2 py-2 text-right font-mono text-white">{formatPct(team.winPct)}</td>
                    <td className="hidden px-2 py-2 text-right font-mono text-court-muted sm:table-cell">
                      {team.gamesBack === 0 ? "-" : team.gamesBack.toFixed(1)}
                    </td>
                    <td className="hidden px-2 py-2 text-right font-mono text-court-muted md:table-cell">{team.homeRecord}</td>
                    <td className="hidden px-2 py-2 text-right font-mono text-court-muted md:table-cell">{team.roadRecord}</td>
                    <td className="hidden px-2 py-2 text-right font-mono text-court-muted lg:table-cell">{team.last10}</td>
                    <td className={`px-2 py-2 text-right font-mono font-semibold ${streakWins ? "text-court-live" : "text-court-red"}`}>
                      {team.streak || "-"}
                    </td>
                  </tr>
                  {showCutLine && (
                    <tr>
                      <td colSpan={10} className="border-t border-dashed border-court-amber/50 px-3 py-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-court-amber">
                          {index === 5 ? "Playoff line" : "Play-in line"}
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
    refreshInterval: 300_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index} className="surface-card-quiet loading-shimmer h-[32rem] rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !data?.teams) {
    return (
      <div className="rounded-lg border border-court-border bg-court-card p-10 text-center text-court-muted">
        Could not load standings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-court-muted">Season {data.season}</div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ConferenceTable teams={data.teams} conference="East" />
        <ConferenceTable teams={data.teams} conference="West" />
      </div>
    </div>
  );
}
