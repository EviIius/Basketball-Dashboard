"use client";

import useSWR from "swr";
import { useState } from "react";
import type { BoxScore, BoxPlayer, BoxTeam, BoxTeamStats } from "@/lib/types";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmtMinutes(min: string): string {
  // "PT34M" or "PT33M54.00S" to "34" or "33:54"
  const m = min.match(/PT(\d+)M(?:([\d.]+)S)?/);
  if (!m) return "-";
  const mm = m[1];
  const ss = m[2] ? Math.floor(parseFloat(m[2])).toString().padStart(2, "0") : null;
  return ss ? `${mm}:${ss}` : mm;
}

function pct(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

type SortKey = "points" | "reboundsTotal" | "assists" | "plusMinusPoints" | "minutes";

function PlayerTable({ team }: { team: BoxTeam }) {
  const [sortKey, setSortKey] = useState<SortKey>("points");

  const sorted = [...team.players].sort((a, b) => {
    if (a.played === "0" && b.played !== "0") return 1;
    if (a.played !== "0" && b.played === "0") return -1;
    if (sortKey === "minutes") {
      return fmtMinutes(b.statistics.minutes).localeCompare(fmtMinutes(a.statistics.minutes), undefined, { numeric: true });
    }
    return (b.statistics[sortKey] ?? 0) - (a.statistics[sortKey] ?? 0);
  });

  const color = TEAM_COLORS[team.teamTricode]?.primary ?? "#6b7280";

  const Header = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => setSortKey(k)}
      className={`px-2 py-1.5 text-right font-mono cursor-pointer hover:text-white transition-colors select-none ${
        sortKey === k ? "text-court-accent" : "text-court-muted"
      }`}
    >
      {label}
      {sortKey === k && <span className="ml-0.5">v</span>}
    </th>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-white font-bold text-sm">
          {team.teamCity} {team.teamName}
        </span>
        <span className="text-court-muted text-xs ml-auto">
          {team.score} pts
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-court-border">
              <th className="px-2 py-1.5 text-left text-court-muted font-semibold uppercase tracking-wider">Player</th>
              <Header k="minutes" label="MIN" />
              <Header k="points" label="PTS" />
              <Header k="reboundsTotal" label="REB" />
              <Header k="assists" label="AST" />
              <th className="px-2 py-1.5 text-right text-court-muted font-mono">STL</th>
              <th className="px-2 py-1.5 text-right text-court-muted font-mono">BLK</th>
              <th className="px-2 py-1.5 text-right text-court-muted font-mono">TOV</th>
              <th className="px-2 py-1.5 text-right text-court-muted font-mono">FG</th>
              <th className="px-2 py-1.5 text-right text-court-muted font-mono">3P</th>
              <Header k="plusMinusPoints" label="+/-" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p: BoxPlayer) => {
              const dnp = p.played === "0";
              const onCourt = p.oncourt === "1";
              const s = p.statistics;
              return (
                <tr
                  key={p.personId}
                  className={`border-b border-court-border/40 ${
                    dnp ? "text-court-muted/60" : "text-white"
                  } ${onCourt ? "bg-court-live/5" : ""}`}
                >
                  <td className="px-2 py-1.5 truncate max-w-[140px]">
                    <span className="font-semibold">{p.nameI}</span>
                    {p.starter === "1" && !dnp && (
                      <span className="ml-1 text-court-muted text-[10px]">*</span>
                    )}
                    {onCourt && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-court-live animate-pulse" title="On court" />
                    )}
                  </td>
                  {dnp ? (
                    <td colSpan={10} className="px-2 py-1.5 text-court-muted/60 text-right italic">
                      DNP
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtMinutes(s.minutes)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold">{s.points}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{s.reboundsTotal}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{s.assists}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{s.steals}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{s.blocks}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{s.turnovers}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {s.fieldGoalsMade}-{s.fieldGoalsAttempted}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {s.threePointersMade}-{s.threePointersAttempted}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono font-semibold ${
                          s.plusMinusPoints > 0
                            ? "text-court-live"
                            : s.plusMinusPoints < 0
                            ? "text-red-400"
                            : ""
                        }`}
                      >
                        {s.plusMinusPoints > 0 ? "+" : ""}
                        {s.plusMinusPoints}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBar({
  label,
  awayValue,
  homeValue,
  awayDisplay,
  homeDisplay,
  awayColor,
  homeColor,
}: {
  label: string;
  awayValue: number;
  homeValue: number;
  awayDisplay: string;
  homeDisplay: string;
  awayColor: string;
  homeColor: string;
}) {
  const total = awayValue + homeValue;
  const awayPct = total > 0 ? (awayValue / total) * 100 : 50;
  const homePct = total > 0 ? (homeValue / total) * 100 : 50;
  const awayWins = awayValue > homeValue;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className={`text-xs font-mono ${awayWins ? "text-white font-bold" : "text-court-muted"}`}>
          {awayDisplay}
        </span>
        <span className="text-court-muted text-[10px] uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-mono ${!awayWins ? "text-white font-bold" : "text-court-muted"}`}>
          {homeDisplay}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-court-border">
        <div
          className="transition-all"
          style={{
            width: `${awayPct}%`,
            backgroundColor: awayColor,
            opacity: awayWins ? 1 : 0.4,
          }}
        />
        <div
          className="transition-all"
          style={{
            width: `${homePct}%`,
            backgroundColor: homeColor,
            opacity: !awayWins ? 1 : 0.4,
          }}
        />
      </div>
    </div>
  );
}

function TeamComparison({ away, home }: { away: BoxTeam; home: BoxTeam }) {
  const awayColor = TEAM_COLORS[away.teamTricode]?.primary ?? "#6b7280";
  const homeColor = TEAM_COLORS[home.teamTricode]?.primary ?? "#6b7280";

  const rows: { label: string; key: keyof BoxTeamStats; format: (n: number) => string }[] = [
    { label: "Field Goal %", key: "fieldGoalsPercentage", format: pct },
    { label: "3-Point %", key: "threePointersPercentage", format: pct },
    { label: "Free Throw %", key: "freeThrowsPercentage", format: pct },
    { label: "Rebounds", key: "reboundsTotal", format: (n) => String(n) },
    { label: "Assists", key: "assists", format: (n) => String(n) },
    { label: "Steals", key: "steals", format: (n) => String(n) },
    { label: "Blocks", key: "blocks", format: (n) => String(n) },
    { label: "Turnovers", key: "turnovers", format: (n) => String(n) },
    { label: "Points in Paint", key: "pointsInThePaint", format: (n) => String(n) },
    { label: "Fast Break Pts", key: "pointsFastBreak", format: (n) => String(n) },
    { label: "Second Chance Pts", key: "pointsSecondChance", format: (n) => String(n) },
    { label: "Bench Points", key: "benchPoints", format: (n) => String(n) },
    { label: "Biggest Lead", key: "biggestLead", format: (n) => String(n) },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const a = (away.statistics[row.key] as number) ?? 0;
        const h = (home.statistics[row.key] as number) ?? 0;
        return (
          <StatBar
            key={row.label}
            label={row.label}
            awayValue={a}
            homeValue={h}
            awayDisplay={row.format(a)}
            homeDisplay={row.format(h)}
            awayColor={awayColor}
            homeColor={homeColor}
          />
        );
      })}
    </div>
  );
}

export default function BoxScorePanel({
  gameId,
  liveRefresh,
}: {
  gameId: string;
  liveRefresh: boolean;
}) {
  const [view, setView] = useState<"players" | "team">("players");
  const { data, error, isLoading } = useSWR<BoxScore>(
    `/api/player-leaders/${gameId}`,
    fetcher,
    { refreshInterval: liveRefresh ? 30_000 : 0 }
  );

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex gap-2 mb-3">
          <div className="h-7 w-20 bg-court-border rounded animate-pulse" />
          <div className="h-7 w-20 bg-court-border rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 bg-court-border/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data || (data as unknown as { error?: string }).error) {
    return (
      <div className="p-4 text-center text-court-muted text-sm">
        Box score not yet available
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* View toggle */}
      <div className="flex gap-1 mb-4 bg-court-bg rounded-lg p-1 w-fit">
        {(["players", "team"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              view === v ? "bg-court-card text-white" : "text-court-muted hover:text-white"
            }`}
          >
            {v === "players" ? "Players" : "Team Stats"}
          </button>
        ))}
      </div>

      {view === "players" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PlayerTable team={data.awayTeam} />
          <PlayerTable team={data.homeTeam} />
        </div>
      ) : (
        <TeamComparison away={data.awayTeam} home={data.homeTeam} />
      )}

      {/* Arena info */}
      {data.arena?.arenaName && (
        <div className="mt-4 pt-3 border-t border-court-border text-court-muted text-[11px] flex flex-wrap gap-x-4 gap-y-1">
          <span>📍 {data.arena.arenaName}, {data.arena.arenaCity}</span>
          {data.attendance > 0 && <span>👥 {data.attendance.toLocaleString()}</span>}
          {data.sellout === "1" && <span className="text-court-accent">Sellout</span>}
        </div>
      )}
    </div>
  );
}
