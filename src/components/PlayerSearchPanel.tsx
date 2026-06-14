"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BDLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  draft_year: number | null;
  draft_round: number | null;
  draft_number: number | null;
  team: { id: number; abbreviation: string; full_name: string };
}

interface SeasonAverage {
  season: number;
  games_played: number;
  min: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
}

interface SearchResponse {
  data: BDLPlayer[];
  meta?: { next_cursor: number | null };
  error?: string;
}

interface PlayerStatsResponse {
  player: BDLPlayer | null;
  seasonAverages: SeasonAverage[];
  error?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PlayerProfile({ playerId }: { playerId: number }) {
  const { data, isLoading } = useSWR<PlayerStatsResponse>(
    `/api/player-stats/${playerId}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="bg-court-card border border-court-border rounded-xl p-5">
        <div className="text-court-muted text-sm">Loading player profile…</div>
      </div>
    );
  }

  if (!data || data.error || !data.player) {
    return (
      <div className="bg-court-card border border-court-border rounded-xl p-5">
        <div className="text-court-muted text-sm">{data?.error ?? "Player not found"}</div>
      </div>
    );
  }

  const { player, seasonAverages } = data;
  const color = TEAM_COLORS[player.team?.abbreviation]?.primary ?? "#6b7280";
  const sortedSeasons = [...seasonAverages].sort((a, b) => b.season - a.season);
  const latest = sortedSeasons[0];

  return (
    <div className="bg-court-card border border-court-border rounded-xl p-5">
      <div className="flex items-start gap-4 mb-5">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black"
          style={{ backgroundColor: color }}
        >
          {player.jersey_number || "—"}
        </div>
        <div className="flex-1">
          <h2 className="text-white font-black text-xl leading-tight">
            {player.first_name} {player.last_name}
          </h2>
          <div className="text-court-muted text-sm mt-1">
            {player.position && `${player.position} · `}
            {player.team?.full_name ?? "Free Agent"}
          </div>
          <div className="text-court-muted text-xs mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {player.height && <span>📏 {player.height}</span>}
            {player.weight && <span>⚖️ {player.weight} lbs</span>}
            {player.country && <span>🌍 {player.country}</span>}
            {player.college && <span>🎓 {player.college}</span>}
            {player.draft_year && (
              <span>📋 Drafted {player.draft_year} R{player.draft_round} #{player.draft_number}</span>
            )}
          </div>
        </div>
      </div>

      {/* Latest season highlight */}
      {latest && (
        <div className="bg-court-surface rounded-xl p-4 mb-4">
          <div className="text-court-muted text-xs uppercase tracking-wider mb-2">
            {latest.season}-{(latest.season + 1).toString().slice(-2)} Season Averages · {latest.games_played} games
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: "PTS", value: latest.pts?.toFixed(1) ?? "—" },
              { label: "REB", value: latest.reb?.toFixed(1) ?? "—" },
              { label: "AST", value: latest.ast?.toFixed(1) ?? "—" },
              { label: "STL", value: latest.stl?.toFixed(1) ?? "—" },
              { label: "BLK", value: latest.blk?.toFixed(1) ?? "—" },
              { label: "MIN", value: latest.min ?? "—" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-court-muted text-[10px] uppercase tracking-wider">{s.label}</div>
                <div className="text-white font-black text-lg tabular-nums mt-1">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-court-border">
            <div className="text-center">
              <div className="text-court-muted text-[10px] uppercase">FG%</div>
              <div className="text-white font-mono text-sm mt-0.5">
                {latest.fg_pct ? `${(latest.fg_pct * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-court-muted text-[10px] uppercase">3P%</div>
              <div className="text-white font-mono text-sm mt-0.5">
                {latest.fg3_pct ? `${(latest.fg3_pct * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-court-muted text-[10px] uppercase">FT%</div>
              <div className="text-white font-mono text-sm mt-0.5">
                {latest.ft_pct ? `${(latest.ft_pct * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-season comparison */}
      {sortedSeasons.length > 1 && (
        <div>
          <div className="text-court-muted text-xs uppercase tracking-wider mb-2">Season-by-Season</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-court-muted">
                  <th className="px-2 py-1 text-left font-semibold">Season</th>
                  <th className="px-2 py-1 text-right font-mono">GP</th>
                  <th className="px-2 py-1 text-right font-mono">MIN</th>
                  <th className="px-2 py-1 text-right font-mono">PTS</th>
                  <th className="px-2 py-1 text-right font-mono">REB</th>
                  <th className="px-2 py-1 text-right font-mono">AST</th>
                  <th className="px-2 py-1 text-right font-mono">FG%</th>
                  <th className="px-2 py-1 text-right font-mono">3P%</th>
                </tr>
              </thead>
              <tbody>
                {sortedSeasons.map((s) => (
                  <tr key={s.season} className="border-t border-court-border/40">
                    <td className="px-2 py-1.5 text-white font-mono">
                      {s.season}-{(s.season + 1).toString().slice(-2)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-court-muted">{s.games_played}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-court-muted">{s.min}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-white font-semibold">{s.pts?.toFixed(1) ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-court-muted">{s.reb?.toFixed(1) ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-court-muted">{s.ast?.toFixed(1) ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-court-muted">{s.fg_pct ? `${(s.fg_pct * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-court-muted">{s.fg3_pct ? `${(s.fg3_pct * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlayerSearchPanel() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const debouncedQuery = useDebounce(query, 350);

  const { data: searchData, isLoading: searching } = useSWR<SearchResponse>(
    debouncedQuery.length >= 2 ? `/api/players?search=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search any player by name (e.g. 'Brunson', 'Wembanyama', 'LeBron')…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          className="w-full bg-court-card border border-court-border rounded-xl px-5 py-3 text-white placeholder-court-muted focus:outline-none focus:border-court-accent transition-colors"
        />
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-court-muted text-xs">
            Searching…
          </span>
        )}
      </div>

      {/* Empty state */}
      {!query && (
        <div className="bg-court-card border border-court-border rounded-xl p-10 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-white font-semibold mb-1">Search for any NBA player</div>
          <div className="text-court-muted text-sm">
            Type a name above to see career season averages, current team, draft info, and more.
          </div>
        </div>
      )}

      {/* Search results */}
      {debouncedQuery.length >= 2 && searchData?.data && !selectedId && (
        <div className="bg-court-card border border-court-border rounded-xl overflow-hidden">
          {searchData.data.length === 0 ? (
            <div className="p-6 text-center text-court-muted text-sm">
              No players found for &quot;{debouncedQuery}&quot;
            </div>
          ) : (
            <div className="divide-y divide-court-border">
              {searchData.data.map((p) => {
                const color = TEAM_COLORS[p.team?.abbreviation]?.primary ?? "#6b7280";
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-court-surface text-left transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {p.team?.abbreviation || "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate">
                        {p.first_name} {p.last_name}
                      </div>
                      <div className="text-court-muted text-xs">
                        {p.position && `${p.position} · `}
                        {p.team?.full_name ?? "Free Agent"}
                        {p.jersey_number && ` · #${p.jersey_number}`}
                      </div>
                    </div>
                    <span className="text-court-muted text-xs">View →</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected player profile */}
      {selectedId && (
        <>
          <button
            onClick={() => setSelectedId(null)}
            className="text-court-muted hover:text-court-accent text-sm flex items-center gap-1"
          >
            ← Back to search results
          </button>
          <PlayerProfile playerId={selectedId} />
        </>
      )}
    </div>
  );
}
