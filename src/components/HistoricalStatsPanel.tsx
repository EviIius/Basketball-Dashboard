"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import useSWR from "swr";
import TeamSelector from "./TeamSelector";
import WinsChart from "./WinsChart";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import type { NBAStaticTeam, TeamYearStats, TeamSeasonRecord } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ChartMode = "winloss" | "ppg" | "shooting";

function classifyFinals(value: string): "won" | "appearance" | "none" {
  const normalized = value.toUpperCase();
  if (normalized.includes("WON")) return "won";
  if (normalized.includes("FINALS")) return "appearance";
  return "none";
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-court-border bg-court-card p-3">
      <div className="mb-1 text-xs text-court-muted">{label}</div>
      <div className="text-sm font-bold leading-tight text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-court-muted">{sub}</div>}
    </div>
  );
}

export default function HistoricalStatsPanel() {
  const [selectedTeam, setSelectedTeam] = useState<NBAStaticTeam>(NBA_TEAMS.find((team) => team.tricode === "NYK") ?? NBA_TEAMS[0]);
  const [showSelector, setShowSelector] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("winloss");

  const { data, error, isLoading } = useSWR<TeamYearStats>(`/api/team-history/${selectedTeam.id}`, fetcher);
  const teamColor = TEAM_COLORS[selectedTeam.tricode]?.primary ?? "#2dd4bf";
  const seasons = data?.seasons ?? [];
  const totalSeasons = seasons.length;
  const allTimeWins = seasons.reduce((sum, record) => sum + record.wins, 0);
  const allTimeLosses = seasons.reduce((sum, record) => sum + record.losses, 0);
  const allTimePct = allTimeWins + allTimeLosses > 0 ? ((allTimeWins / (allTimeWins + allTimeLosses)) * 100).toFixed(1) : "-";
  const playoffWins = seasons.reduce((sum, record) => sum + record.playoffWins, 0);
  const playoffLosses = seasons.reduce((sum, record) => sum + record.playoffLosses, 0);
  const playoffAppearances = seasons.filter((record) => record.playoffWins + record.playoffLosses > 0).length;
  const championships = seasons.filter((record) => classifyFinals(record.finalsAppearance) === "won").length;
  const finalsAppearances = seasons.filter((record) => classifyFinals(record.finalsAppearance) !== "none").length;
  const bestSeason = seasons.reduce<TeamSeasonRecord | null>((best, record) => (!best || record.wins > best.wins ? record : best), null);
  const lastSeason = seasons.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setShowSelector((value) => !value)} className="group flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-black text-white" style={{ backgroundColor: teamColor }}>
            {selectedTeam.tricode}
          </div>
          <div className="text-left">
            <div className="text-xl font-black leading-tight text-white">
              {selectedTeam.city} {selectedTeam.name}
            </div>
            <div className="text-xs text-court-muted">
              {selectedTeam.conference} / {selectedTeam.division}
              {lastSeason && <span className="text-white"> / {lastSeason.season}: {lastSeason.wins}-{lastSeason.losses}</span>}
            </div>
          </div>
          {showSelector ? <ChevronUp className="h-4 w-4 text-court-muted group-hover:text-white" /> : <ChevronDown className="h-4 w-4 text-court-muted group-hover:text-white" />}
        </button>
      </div>

      {showSelector && (
        <div className="rounded-lg border border-court-border bg-court-card p-4">
          <TeamSelector
            selected={selectedTeam}
            onChange={(team) => {
              setSelectedTeam(team);
              setShowSelector(false);
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Seasons" value={isLoading ? "..." : totalSeasons || "-"} />
        <StatCard label="All-time" value={allTimeWins + allTimeLosses > 0 ? `${allTimeWins}-${allTimeLosses}` : "-"} sub={allTimePct === "-" ? undefined : `${allTimePct}%`} />
        <StatCard label="Playoffs" value={playoffWins + playoffLosses > 0 ? `${playoffWins}-${playoffLosses}` : "-"} sub={playoffAppearances > 0 ? `${playoffAppearances} appearances` : undefined} />
        <StatCard label="Finals" value={finalsAppearances > 0 ? finalsAppearances : "-"} sub={championships > 0 ? `${championships} championships` : undefined} />
        <StatCard label="Best Season" value={bestSeason?.wins ? `${bestSeason.wins}-${bestSeason.losses}` : "-"} sub={bestSeason?.season} />
        <StatCard label="Last Season" value={lastSeason ? `${lastSeason.ppg.toFixed(1)} PPG` : "-"} sub={lastSeason ? `${(lastSeason.fgPct * 100).toFixed(1)}% FG` : undefined} />
      </div>

      <div className="rounded-lg border border-court-border bg-court-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-white">Trends</h3>
          <div className="flex gap-1 rounded-lg bg-court-bg p-1">
            {(["winloss", "ppg", "shooting"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  chartMode === mode ? "bg-court-card text-white" : "text-court-muted hover:text-white"
                }`}
              >
                {mode === "winloss" ? "Wins/Losses" : mode === "ppg" ? "Pts/Reb/Ast" : "Shooting"}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex h-80 items-center justify-center">
            <div className="w-full space-y-2">
              <div className="loading-shimmer mx-auto h-2 w-3/4 rounded bg-court-border/40" />
              <div className="loading-shimmer mx-auto h-40 rounded bg-court-border/40" />
              <div className="loading-shimmer mx-auto h-2 w-1/2 rounded bg-court-border/40" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex h-80 flex-col items-center justify-center text-center">
            <div className="text-sm text-court-muted">Could not load historical data.</div>
          </div>
        )}

        {!isLoading && !error && seasons.length > 0 && (
          <WinsChart seasons={seasons} teamColor={teamColor} teamName={`${selectedTeam.city} ${selectedTeam.name}`} mode={chartMode} />
        )}
      </div>

      {!isLoading && !error && seasons.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-court-border bg-court-card">
          <div className="flex items-center justify-between border-b border-court-border px-4 py-3">
            <h3 className="font-black text-white">Season Records</h3>
            <span className="text-xs text-court-muted">{seasons.length} seasons</span>
          </div>
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-court-surface">
                <tr>
                  {["Season", "W-L", "Win%", "Rank", "PPG", "RPG", "APG", "FG%", "3P%", "Playoffs", "Result"].map((header) => (
                    <th key={header} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-court-muted">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...seasons].reverse().map((season) => {
                  const finals = classifyFinals(season.finalsAppearance);
                  return (
                    <tr key={season.season} className="border-t border-court-border transition-colors hover:bg-court-surface/60">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-white">{season.season}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        <span className="font-semibold text-court-live">{season.wins}</span>
                        <span className="text-court-muted">-</span>
                        <span className="text-court-red">{season.losses}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-white">{(season.winPct * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono text-xs text-court-muted">{season.confRank > 0 ? `#${season.confRank}E` : "-"}</td>
                      <td className="px-3 py-2 font-mono text-white">{season.ppg ? season.ppg.toFixed(1) : "-"}</td>
                      <td className="px-3 py-2 font-mono text-court-muted">{season.rpg ? season.rpg.toFixed(1) : "-"}</td>
                      <td className="px-3 py-2 font-mono text-court-muted">{season.apg ? season.apg.toFixed(1) : "-"}</td>
                      <td className="px-3 py-2 font-mono text-court-muted">{season.fgPct ? `${(season.fgPct * 100).toFixed(1)}%` : "-"}</td>
                      <td className="px-3 py-2 font-mono text-court-muted">{season.fg3Pct ? `${(season.fg3Pct * 100).toFixed(1)}%` : "-"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        {season.playoffWins + season.playoffLosses > 0 ? (
                          <>
                            <span className="text-court-live">{season.playoffWins}</span>
                            <span className="text-court-muted">-</span>
                            <span className="text-court-red">{season.playoffLosses}</span>
                          </>
                        ) : (
                          <span className="text-court-muted/50">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {finals === "won" && <span className="text-xs font-bold text-court-amber">Champs</span>}
                        {finals === "appearance" && <span className="text-xs text-court-amber/80">Finals</span>}
                        {finals === "none" && <span className="text-court-muted/50">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
