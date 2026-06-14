"use client";

import { useState } from "react";
import useSWR from "swr";
import TeamSelector from "./TeamSelector";
import WinsChart from "./WinsChart";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import type { NBAStaticTeam, TeamYearStats, TeamSeasonRecord } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ChartMode = "winloss" | "ppg" | "shooting";

function classifyFinals(s: string): "won" | "appearance" | "none" {
  const v = s.toUpperCase();
  if (v.includes("WON")) return "won";
  if (v.includes("FINALS")) return "appearance";
  return "none";
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-court-card border border-court-border rounded-xl p-3">
      <div className="text-court-muted text-xs mb-1">{label}</div>
      <div className="text-white font-bold text-sm leading-tight">{value}</div>
      {sub && <div className="text-court-muted text-[11px] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function HistoricalStatsPanel() {
  const [selectedTeam, setSelectedTeam] = useState<NBAStaticTeam>(
    NBA_TEAMS.find((t) => t.tricode === "NYK") ?? NBA_TEAMS[0]
  );
  const [showSelector, setShowSelector] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("winloss");

  const { data, error, isLoading } = useSWR<TeamYearStats>(
    `/api/team-history/${selectedTeam.id}`,
    fetcher
  );

  const teamColor = TEAM_COLORS[selectedTeam.tricode]?.primary ?? "#f97316";

  const seasons = data?.seasons ?? [];
  const totalSeasons = seasons.length;
  const allTimeWins = seasons.reduce((s, r) => s + r.wins, 0);
  const allTimeLosses = seasons.reduce((s, r) => s + r.losses, 0);
  const allTimePct = allTimeWins + allTimeLosses > 0
    ? ((allTimeWins / (allTimeWins + allTimeLosses)) * 100).toFixed(1)
    : "—";

  const playoffWins = seasons.reduce((s, r) => s + r.playoffWins, 0);
  const playoffLosses = seasons.reduce((s, r) => s + r.playoffLosses, 0);
  const playoffAppearances = seasons.filter((r) => r.playoffWins + r.playoffLosses > 0).length;
  const championships = seasons.filter((r) => classifyFinals(r.finalsAppearance) === "won").length;
  const finalsAppearances = seasons.filter((r) => classifyFinals(r.finalsAppearance) !== "none").length;

  const bestSeason = seasons.reduce<TeamSeasonRecord | null>(
    (best, r) => (!best || r.wins > best.wins ? r : best),
    null
  );

  const lastSeason = seasons.at(-1);

  return (
    <div className="space-y-6">
      {/* Team picker */}
      <div className="flex items-center justify-between">
        <button onClick={() => setShowSelector((v) => !v)} className="flex items-center gap-3 group">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-sm font-black"
            style={{ backgroundColor: teamColor }}
          >
            {selectedTeam.tricode}
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-xl leading-tight">
              {selectedTeam.city} {selectedTeam.name}
            </div>
            <div className="text-court-muted text-xs">
              {selectedTeam.conference}ern · {selectedTeam.division}
              {lastSeason && (
                <>
                  {" · "}
                  <span className="text-white">
                    {lastSeason.season}: {lastSeason.wins}–{lastSeason.losses}
                  </span>
                </>
              )}
            </div>
          </div>
          <span className="text-court-muted text-sm ml-2 group-hover:text-white transition-colors">
            {showSelector ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {showSelector && (
        <div className="bg-court-card border border-court-border rounded-xl p-4">
          <TeamSelector
            selected={selectedTeam}
            onChange={(t) => {
              setSelectedTeam(t);
              setShowSelector(false);
            }}
          />
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Seasons" value={isLoading ? "…" : totalSeasons || "—"} />
        <StatCard
          label="All-time"
          value={allTimeWins + allTimeLosses > 0 ? `${allTimeWins}–${allTimeLosses}` : "—"}
          sub={allTimePct === "—" ? undefined : `${allTimePct}%`}
        />
        <StatCard
          label="Playoffs"
          value={playoffWins + playoffLosses > 0 ? `${playoffWins}–${playoffLosses}` : "—"}
          sub={playoffAppearances > 0 ? `${playoffAppearances} appearances` : undefined}
        />
        <StatCard
          label="Finals"
          value={finalsAppearances > 0 ? finalsAppearances : "—"}
          sub={championships > 0 ? `${championships} championships 🏆` : undefined}
        />
        <StatCard
          label="Best Season"
          value={bestSeason?.wins ? `${bestSeason.wins}–${bestSeason.losses}` : "—"}
          sub={bestSeason?.season}
        />
        <StatCard
          label="Last Season"
          value={lastSeason ? `${lastSeason.ppg.toFixed(1)} PPG` : "—"}
          sub={lastSeason ? `${(lastSeason.fgPct * 100).toFixed(1)}% FG` : undefined}
        />
      </div>

      {/* Chart with mode tabs */}
      <div className="bg-court-card border border-court-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-white font-semibold">Trends</h3>
          <div className="flex gap-1 bg-court-bg rounded-lg p-1">
            {(["winloss", "ppg", "shooting"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  chartMode === m ? "bg-court-card text-white" : "text-court-muted hover:text-white"
                }`}
              >
                {m === "winloss" ? "Wins/Losses" : m === "ppg" ? "Pts/Reb/Ast" : "Shooting %"}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="h-80 flex items-center justify-center">
            <div className="space-y-2 w-full">
              <div className="h-2 bg-court-border rounded animate-pulse w-3/4 mx-auto" />
              <div className="h-40 bg-court-border rounded animate-pulse mx-auto" />
              <div className="h-2 bg-court-border rounded animate-pulse w-1/2 mx-auto" />
            </div>
          </div>
        )}

        {error && (
          <div className="h-80 flex flex-col items-center justify-center text-center">
            <div className="text-3xl mb-2">📊</div>
            <div className="text-court-muted text-sm">Could not load historical data</div>
            <div className="text-court-muted text-xs mt-1">NBA Stats API may be temporarily unavailable</div>
          </div>
        )}

        {!isLoading && !error && seasons.length > 0 && (
          <WinsChart
            seasons={seasons}
            teamColor={teamColor}
            teamName={`${selectedTeam.city} ${selectedTeam.name}`}
            mode={chartMode}
          />
        )}
      </div>

      {/* Season table */}
      {!isLoading && !error && seasons.length > 0 && (
        <div className="bg-court-card border border-court-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-court-border flex items-center justify-between">
            <h3 className="text-white font-semibold">Season Records</h3>
            <span className="text-court-muted text-xs">{seasons.length} seasons</span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-court-surface z-10">
                <tr>
                  {["Season", "W-L", "Win%", "Rank", "PPG", "RPG", "APG", "FG%", "3P%", "Playoffs", "Result"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-court-muted text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...seasons].reverse().map((s) => {
                  const finals = classifyFinals(s.finalsAppearance);
                  return (
                    <tr
                      key={s.season}
                      className="border-t border-court-border hover:bg-court-surface/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-white font-mono text-xs whitespace-nowrap">{s.season}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        <span className="text-court-live font-semibold">{s.wins}</span>
                        <span className="text-court-muted">–</span>
                        <span className="text-red-400">{s.losses}</span>
                      </td>
                      <td className="px-3 py-2 text-white font-mono">{(s.winPct * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-court-muted font-mono text-xs">
                        {s.confRank > 0 ? `#${s.confRank}E` : "—"}
                      </td>
                      <td className="px-3 py-2 text-white font-mono">{s.ppg ? s.ppg.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-court-muted font-mono">{s.rpg ? s.rpg.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-court-muted font-mono">{s.apg ? s.apg.toFixed(1) : "—"}</td>
                      <td className="px-3 py-2 text-court-muted font-mono">{s.fgPct ? `${(s.fgPct * 100).toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-2 text-court-muted font-mono">{s.fg3Pct ? `${(s.fg3Pct * 100).toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {s.playoffWins + s.playoffLosses > 0 ? (
                          <>
                            <span className="text-court-live">{s.playoffWins}</span>
                            <span className="text-court-muted">–</span>
                            <span className="text-red-400">{s.playoffLosses}</span>
                          </>
                        ) : (
                          <span className="text-court-muted/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {finals === "won" && (
                          <span className="text-court-accent text-xs font-bold">🏆 Champs</span>
                        )}
                        {finals === "appearance" && (
                          <span className="text-court-accent/70 text-xs">Finals</span>
                        )}
                        {finals === "none" && <span className="text-court-muted/40">—</span>}
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
