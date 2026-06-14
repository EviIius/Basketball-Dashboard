"use client";

import { useState } from "react";
import useSWR from "swr";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Leader {
  playerId: number;
  rank: number;
  playerName: string;
  teamId: number;
  teamTricode: string;
  gp: number;
  minutes: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  fg3m: number;
  fg3Pct: number;
  ftPct: number;
  eff: number;
}

interface LeadersResponse {
  season: string;
  stat: string;
  leaders: Leader[];
}

const CATEGORIES: { key: string; label: string; format: (v: number) => string; field: keyof Leader }[] = [
  { key: "PTS", label: "Points", format: (v) => v.toFixed(1), field: "pts" },
  { key: "REB", label: "Rebounds", format: (v) => v.toFixed(1), field: "reb" },
  { key: "AST", label: "Assists", format: (v) => v.toFixed(1), field: "ast" },
  { key: "STL", label: "Steals", format: (v) => v.toFixed(1), field: "stl" },
  { key: "BLK", label: "Blocks", format: (v) => v.toFixed(1), field: "blk" },
  { key: "FG3M", label: "3PT Made", format: (v) => v.toFixed(1), field: "fg3m" },
  { key: "FG_PCT", label: "FG%", format: (v) => `${(v * 100).toFixed(1)}%`, field: "fgPct" },
  { key: "FG3_PCT", label: "3P%", format: (v) => `${(v * 100).toFixed(1)}%`, field: "fg3Pct" },
  { key: "FT_PCT", label: "FT%", format: (v) => `${(v * 100).toFixed(1)}%`, field: "ftPct" },
  { key: "EFF", label: "Efficiency", format: (v) => v.toFixed(1), field: "eff" },
];

export default function LeadersPanel() {
  const [stat, setStat] = useState("PTS");
  const { data, error, isLoading } = useSWR<LeadersResponse>(
    `/api/leaders?stat=${stat}`,
    fetcher,
    { refreshInterval: 600_000 }
  );

  const currentCat = CATEGORIES.find((c) => c.key === stat) ?? CATEGORIES[0];

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 bg-court-card border border-court-border rounded-xl p-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setStat(c.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              stat === c.key
                ? "bg-court-accent text-court-bg"
                : "text-court-muted hover:text-white hover:bg-court-surface"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Leaders table */}
      <div className="bg-court-card border border-court-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-court-border flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">
            Top 25 — {currentCat.label}
          </h3>
          <span className="text-court-muted text-xs">
            {data?.season ?? "—"}
          </span>
        </div>

        {isLoading && (
          <div className="p-6 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-7 bg-court-border/40 rounded animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-6 text-center text-court-muted">
            Could not load leaders
          </div>
        )}

        {!isLoading && data?.leaders && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-court-surface">
                <tr>
                  <th className="px-3 py-2 text-left text-court-muted text-[10px] font-semibold uppercase tracking-wider w-8">#</th>
                  <th className="px-3 py-2 text-left text-court-muted text-[10px] font-semibold uppercase tracking-wider">Player</th>
                  <th className="px-3 py-2 text-center text-court-muted text-[10px] font-semibold uppercase tracking-wider hidden sm:table-cell">Team</th>
                  <th className="px-3 py-2 text-right text-court-muted text-[10px] font-semibold uppercase tracking-wider">GP</th>
                  <th className="px-3 py-2 text-right text-court-accent text-[10px] font-semibold uppercase tracking-wider">
                    {currentCat.label}
                  </th>
                  <th className="px-3 py-2 text-right text-court-muted text-[10px] font-semibold uppercase tracking-wider hidden md:table-cell">PTS</th>
                  <th className="px-3 py-2 text-right text-court-muted text-[10px] font-semibold uppercase tracking-wider hidden md:table-cell">REB</th>
                  <th className="px-3 py-2 text-right text-court-muted text-[10px] font-semibold uppercase tracking-wider hidden md:table-cell">AST</th>
                  <th className="px-3 py-2 text-right text-court-muted text-[10px] font-semibold uppercase tracking-wider hidden lg:table-cell">FG%</th>
                </tr>
              </thead>
              <tbody>
                {data.leaders.map((l) => {
                  const color = TEAM_COLORS[l.teamTricode]?.primary ?? "#6b7280";
                  const featuredValue = currentCat.format(l[currentCat.field] as number);
                  return (
                    <tr
                      key={l.playerId}
                      className="border-t border-court-border hover:bg-court-surface/40 transition-colors"
                    >
                      <td className="px-3 py-2 text-court-muted font-mono text-center">
                        {l.rank <= 3 ? <span className="text-court-accent font-black">{l.rank}</span> : l.rank}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-5 rounded" style={{ backgroundColor: color }} />
                          <span className="text-white font-semibold whitespace-nowrap">{l.playerName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center hidden sm:table-cell">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-black text-white"
                          style={{ backgroundColor: color }}
                        >
                          {l.teamTricode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-court-muted">{l.gp}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-court-accent text-base">
                        {featuredValue}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-court-muted hidden md:table-cell">{l.pts.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-court-muted hidden md:table-cell">{l.reb.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-court-muted hidden md:table-cell">{l.ast.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono text-court-muted hidden lg:table-cell">
                        {(l.fgPct * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
