"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Search, TableProperties, UserRound } from "lucide-react";
import useSWR from "swr";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PlayerSearchResult {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  fromYear: number;
  toYear: number;
  isActive: boolean;
  playerCode: string;
  slug: string;
  team: {
    id: number;
    city: string;
    name: string;
    abbreviation: string;
    fullName: string;
  };
}

interface SearchResponse {
  season: string;
  data: PlayerSearchResult[];
  error?: string;
}

interface PlayerBio {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  slug: string;
  birthdate: string;
  school: string;
  country: string;
  height: string;
  weight: string;
  experience: number;
  jersey: string;
  position: string;
  rosterStatus: string;
  fromYear: number;
  toYear: number;
  draftYear: string;
  draftRound: string;
  draftNumber: string;
  team: {
    id: number;
    city: string;
    name: string;
    abbreviation: string;
    fullName: string;
  };
}

interface PlayerSeasonStats {
  season: string;
  teamId: number;
  team: string;
  age: number;
  gp: number;
  gs: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  fgPct: number;
  fg3m: number;
  fg3a: number;
  fg3Pct: number;
  ftm: number;
  fta: number;
  ftPct: number;
}

interface PlayerStatsResponse {
  player: PlayerBio | null;
  latestSeason: PlayerSeasonStats | null;
  regularSeasons: PlayerSeasonStats[];
  playoffSeasons: PlayerSeasonStats[];
  careerRegular: PlayerSeasonStats | null;
  careerPlayoffs: PlayerSeasonStats | null;
  error?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
}

function fmt(value: number | undefined | null, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function pct(value: number | undefined | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function colorFor(abbreviation: string | undefined) {
  return TEAM_COLORS[abbreviation ?? ""]?.primary ?? "#6b7280";
}

function InfoStat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-md bg-court-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-court-muted">{label}</div>
      <div className="mt-1 text-lg font-black tabular-nums text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-court-muted">{sub}</div>}
    </div>
  );
}

function StatLine({ stats }: { stats: PlayerSeasonStats | null }) {
  const entries = [
    { label: "PTS", value: fmt(stats?.pts) },
    { label: "REB", value: fmt(stats?.reb) },
    { label: "AST", value: fmt(stats?.ast) },
    { label: "STL", value: fmt(stats?.stl) },
    { label: "BLK", value: fmt(stats?.blk) },
    { label: "MIN", value: fmt(stats?.min) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {entries.map((entry) => (
        <InfoStat key={entry.label} label={entry.label} value={entry.value} />
      ))}
    </div>
  );
}

function ShootingSplits({ stats }: { stats: PlayerSeasonStats | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <InfoStat label="FG" value={pct(stats?.fgPct)} sub={stats ? `${fmt(stats.fgm)}-${fmt(stats.fga)} / game` : undefined} />
      <InfoStat label="3PT" value={pct(stats?.fg3Pct)} sub={stats ? `${fmt(stats.fg3m)}-${fmt(stats.fg3a)} / game` : undefined} />
      <InfoStat label="FT" value={pct(stats?.ftPct)} sub={stats ? `${fmt(stats.ftm)}-${fmt(stats.fta)} / game` : undefined} />
    </div>
  );
}

function SeasonTable({ seasons }: { seasons: PlayerSeasonStats[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-court-surface">
          <tr>
            {["Season", "Team", "GP", "GS", "MIN", "PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%"].map((header) => (
              <th key={header} className="whitespace-nowrap px-2 py-2 text-right font-semibold uppercase tracking-wider text-court-muted first:text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {seasons.map((season, index) => (
            <tr key={`${season.season}-${season.team}-${index}`} className="border-t border-court-border hover:bg-court-surface/50">
              <td className="whitespace-nowrap px-2 py-2 text-left font-mono text-white">{season.season}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{season.team}</td>
              <td className="px-2 py-2 text-right font-mono text-white">{season.gp}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{season.gs}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{fmt(season.min)}</td>
              <td className="px-2 py-2 text-right font-mono font-semibold text-white">{fmt(season.pts)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{fmt(season.reb)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{fmt(season.ast)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{fmt(season.stl)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{fmt(season.blk)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{pct(season.fgPct)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{pct(season.fg3Pct)}</td>
              <td className="px-2 py-2 text-right font-mono text-court-muted">{pct(season.ftPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerProfile({ playerId }: { playerId: number }) {
  const [view, setView] = useState<"regular" | "playoffs">("regular");
  const { data, isLoading } = useSWR<PlayerStatsResponse>(`/api/player-stats/${playerId}`, fetcher, {
    revalidateOnFocus: false,
  });

  const rows = view === "regular" ? data?.regularSeasons ?? [] : data?.playoffSeasons ?? [];
  const sortedRows = useMemo(() => [...rows].sort((a, b) => b.season.localeCompare(a.season)), [rows]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-court-border bg-court-card p-5">
        <div className="text-sm text-court-muted">Loading player profile...</div>
      </div>
    );
  }

  if (!data || data.error || !data.player) {
    return (
      <div className="rounded-lg border border-court-border bg-court-card p-5">
        <div className="text-sm text-court-muted">{data?.error ?? "Player not found"}</div>
      </div>
    );
  }

  const { player, latestSeason, careerRegular, careerPlayoffs } = data;
  const color = colorFor(player.team.abbreviation);
  const career = view === "regular" ? careerRegular : careerPlayoffs;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-court-border bg-court-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg text-2xl font-black text-white" style={{ backgroundColor: color }}>
            {player.jersey || player.team.abbreviation || "-"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white">{player.fullName}</h2>
                <div className="mt-1 text-sm text-court-muted">
                  {player.position || "Position N/A"} / {player.team.fullName || "No current NBA team"}
                </div>
              </div>
              <div className="rounded-md border border-court-border px-3 py-2 text-xs text-court-muted">
                {player.fromYear}-{player.toYear}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-court-muted">
              {player.height && <span>{player.height}</span>}
              {player.weight && <span>{player.weight} lbs</span>}
              {player.country && <span>{player.country}</span>}
              {player.school && <span>{player.school}</span>}
              {player.draftYear && player.draftYear !== "Undrafted" && (
                <span>Draft {player.draftYear} R{player.draftRound} #{player.draftNumber}</span>
              )}
              {player.draftYear === "Undrafted" && <span>Undrafted</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-court-border bg-court-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-court-accent" />
            <h3 className="font-black text-white">Current Season</h3>
          </div>
          <div className="text-xs text-court-muted">
            {latestSeason ? `${latestSeason.season} / ${latestSeason.team} / ${latestSeason.gp} games` : "No current season stats"}
          </div>
        </div>
        <div className="space-y-3">
          <StatLine stats={latestSeason} />
          <ShootingSplits stats={latestSeason} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-court-border bg-court-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-black text-white">Career Per Game</h3>
            <div className="flex gap-1 rounded-md bg-court-surface p-1">
              {(["regular", "playoffs"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className={`rounded px-2 py-1 text-xs font-semibold capitalize ${
                    view === mode ? "bg-court-accent text-court-bg" : "text-court-muted hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <StatLine stats={career} />
            <ShootingSplits stats={career} />
          </div>
        </div>

        <div className="rounded-lg border border-court-border bg-court-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-court-accent" />
            <h3 className="font-black text-white">Profile</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InfoStat label="Experience" value={`${player.experience} yrs`} />
            <InfoStat label="Status" value={player.rosterStatus || "-"} />
            <InfoStat label="Birthdate" value={player.birthdate ? player.birthdate.slice(0, 10) : "-"} />
            <InfoStat label="Player ID" value={player.id} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-court-border bg-court-card">
        <div className="flex items-center justify-between border-b border-court-border px-4 py-3">
          <div className="flex items-center gap-2">
            <TableProperties className="h-5 w-5 text-court-accent" />
            <h3 className="font-black text-white">{view === "regular" ? "Regular Season" : "Playoffs"} By Season</h3>
          </div>
          <span className="text-xs text-court-muted">{sortedRows.length} rows</span>
        </div>
        {sortedRows.length ? <SeasonTable seasons={sortedRows} /> : <div className="p-6 text-center text-sm text-court-muted">No stats available for this view.</div>}
      </div>
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
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-court-muted" />
        <input
          type="text"
          placeholder="Search any player by name"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedId(null);
          }}
          className="w-full rounded-lg border border-court-border bg-court-card py-3 pl-11 pr-5 text-white outline-none placeholder:text-court-muted focus:border-court-accent"
        />
        {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-court-muted">Searching...</span>}
      </div>

      {!query && (
        <div className="rounded-lg border border-court-border bg-court-card p-10 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-court-muted" />
          <div className="font-semibold text-white">Search for an NBA player</div>
          <div className="mt-1 text-sm text-court-muted">Open a profile to see current, career, playoff, and season-by-season stats.</div>
        </div>
      )}

      {searchData?.error && (
        <div className="rounded-lg border border-court-border bg-court-card p-6 text-center text-sm text-court-muted">
          {searchData.error}
        </div>
      )}

      {debouncedQuery.length >= 2 && searchData?.data && !selectedId && (
        <div className="overflow-hidden rounded-lg border border-court-border bg-court-card">
          {searchData.data.length === 0 ? (
            <div className="p-6 text-center text-sm text-court-muted">No players found for &quot;{debouncedQuery}&quot;</div>
          ) : (
            <div className="divide-y divide-court-border">
              {searchData.data.map((player) => {
                const color = colorFor(player.team.abbreviation);
                return (
                  <button
                    key={player.id}
                    onClick={() => setSelectedId(player.id)}
                    className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-court-surface"
                  >
                    <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md text-xs font-black text-white" style={{ backgroundColor: color }}>
                      {player.team.abbreviation || "-"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{player.fullName}</div>
                      <div className="text-xs text-court-muted">
                        {player.isActive ? "Active" : "Retired"} / {player.team.fullName || "No team"} / {player.fromYear}-{player.toYear}
                      </div>
                    </div>
                    <span className="text-xs text-court-muted">Stats</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedId && (
        <>
          <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-sm text-court-muted hover:text-court-accent">
            <ArrowLeft className="h-4 w-4" />
            Back to search results
          </button>
          <PlayerProfile playerId={selectedId} />
        </>
      )}
    </div>
  );
}
