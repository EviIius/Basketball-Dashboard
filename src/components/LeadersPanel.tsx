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

const CATEGORIES: { key: string; label: string; format: (value: number) => string; field: keyof Leader }[] = [
  { key: "PTS", label: "Points", format: (value) => value.toFixed(1), field: "pts" },
  { key: "REB", label: "Rebounds", format: (value) => value.toFixed(1), field: "reb" },
  { key: "AST", label: "Assists", format: (value) => value.toFixed(1), field: "ast" },
  { key: "STL", label: "Steals", format: (value) => value.toFixed(1), field: "stl" },
  { key: "BLK", label: "Blocks", format: (value) => value.toFixed(1), field: "blk" },
  { key: "FG3M", label: "3PT Made", format: (value) => value.toFixed(1), field: "fg3m" },
  { key: "FG_PCT", label: "FG%", format: (value) => `${(value * 100).toFixed(1)}%`, field: "fgPct" },
  { key: "FG3_PCT", label: "3P%", format: (value) => `${(value * 100).toFixed(1)}%`, field: "fg3Pct" },
  { key: "FT_PCT", label: "FT%", format: (value) => `${(value * 100).toFixed(1)}%`, field: "ftPct" },
  { key: "EFF", label: "Efficiency", format: (value) => value.toFixed(1), field: "eff" },
];

export default function LeadersPanel() {
  const [stat, setStat] = useState("PTS");
  const { data, error, isLoading } = useSWR<LeadersResponse>(`/api/leaders?stat=${stat}`, fetcher, {
    refreshInterval: 600_000,
  });

  const currentCat = CATEGORIES.find((category) => category.key === stat) ?? CATEGORIES[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-court-border bg-court-card p-2">
        {CATEGORIES.map((category) => (
          <button
            key={category.key}
            onClick={() => setStat(category.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              stat === category.key ? "bg-court-accent text-court-bg" : "text-court-muted hover:bg-court-surface hover:text-white"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-court-border bg-court-card">
        <div className="flex items-center justify-between border-b border-court-border px-4 py-3">
          <h3 className="text-sm font-black text-white">Top 25 - {currentCat.label}</h3>
          <span className="text-xs text-court-muted">{data?.season ?? "-"}</span>
        </div>

        {isLoading && (
          <div className="space-y-2 p-6">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-8 animate-pulse rounded-md bg-court-border/40" />
            ))}
          </div>
        )}

        {error && <div className="p-8 text-center text-court-muted">Could not load leaders.</div>}

        {!isLoading && data?.leaders && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-court-surface">
                <tr>
                  <th className="w-8 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-court-muted">#</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-court-muted">Player</th>
                  <th className="hidden px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-court-muted sm:table-cell">Team</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-court-muted">GP</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-court-accent">
                    {currentCat.label}
                  </th>
                  <th className="hidden px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-court-muted md:table-cell">PTS</th>
                  <th className="hidden px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-court-muted md:table-cell">REB</th>
                  <th className="hidden px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-court-muted md:table-cell">AST</th>
                  <th className="hidden px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-court-muted lg:table-cell">FG%</th>
                </tr>
              </thead>
              <tbody>
                {data.leaders.map((leader) => {
                  const color = TEAM_COLORS[leader.teamTricode]?.primary ?? "#6b7280";
                  const featuredValue = currentCat.format(leader[currentCat.field] as number);
                  return (
                    <tr key={leader.playerId} className="border-t border-court-border transition-colors hover:bg-court-surface/60">
                      <td className="px-3 py-2 text-center font-mono text-court-muted">
                        <span className={leader.rank <= 3 ? "font-black text-court-amber" : ""}>{leader.rank}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-5 w-1 rounded-sm" style={{ backgroundColor: color }} />
                          <span className="whitespace-nowrap font-semibold text-white">{leader.playerName}</span>
                        </div>
                      </td>
                      <td className="hidden px-3 py-2 text-center sm:table-cell">
                        <span className="inline-block rounded-md px-2 py-0.5 text-[10px] font-black text-white" style={{ backgroundColor: color }}>
                          {leader.teamTricode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-court-muted">{leader.gp}</td>
                      <td className="px-3 py-2 text-right font-mono text-base font-bold text-court-accent">{featuredValue}</td>
                      <td className="hidden px-3 py-2 text-right font-mono text-court-muted md:table-cell">{leader.pts.toFixed(1)}</td>
                      <td className="hidden px-3 py-2 text-right font-mono text-court-muted md:table-cell">{leader.reb.toFixed(1)}</td>
                      <td className="hidden px-3 py-2 text-right font-mono text-court-muted md:table-cell">{leader.ast.toFixed(1)}</td>
                      <td className="hidden px-3 py-2 text-right font-mono text-court-muted lg:table-cell">{(leader.fgPct * 100).toFixed(1)}%</td>
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
