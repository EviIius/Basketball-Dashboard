"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CalendarDays, CheckCircle2, Clock3, Filter, Radio } from "lucide-react";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type GameType = "preseason" | "regular" | "play-in" | "playoffs" | "other";
type GameStatus = "scheduled" | "live" | "final";

interface SeasonTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
}

interface SeasonGame {
  gameId: string;
  gameDate: string;
  gameDateTimeUTC: string;
  gameDateTimeET: string;
  status: GameStatus;
  statusText: string;
  gameType: GameType;
  gameLabel: string;
  gameSubLabel: string;
  seriesText: string;
  arenaName: string;
  arenaCity: string;
  arenaState: string;
  neutralSite: boolean;
  homeTeam: SeasonTeam;
  awayTeam: SeasonTeam;
}

interface SeasonGamesResponse {
  season: string;
  counts: {
    total: number;
    modelEligible: number;
    completedModelGames: number;
    upcomingModelGames: number;
    returned: number;
  };
  games: SeasonGame[];
  error?: string;
}

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "scheduled", label: "Upcoming" },
  { id: "live", label: "Live" },
  { id: "final", label: "Final" },
] as const;

const TYPE_FILTERS = [
  { id: "all", label: "All games" },
  { id: "model", label: "Model games" },
  { id: "regular", label: "Regular" },
  { id: "play-in", label: "Play-in" },
  { id: "playoffs", label: "Playoffs" },
  { id: "preseason", label: "Preseason" },
] as const;

function isModelEligible(type: GameType) {
  return type !== "preseason" && type !== "other";
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function typeLabel(type: GameType) {
  if (type === "play-in") return "Play-in";
  if (type === "playoffs") return "Playoffs";
  if (type === "regular") return "Regular";
  if (type === "preseason") return "Preseason";
  return "Other";
}

function TeamBadge({ team }: { team: SeasonTeam }) {
  const color = TEAM_COLORS[team.teamTricode]?.primary ?? "#6b7280";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-black text-white"
        style={{ backgroundColor: color }}
      >
        {team.teamTricode}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-white">
          {team.teamCity} {team.teamName}
        </div>
        <div className="text-xs text-court-muted">
          {team.wins}-{team.losses}
        </div>
      </div>
    </div>
  );
}

function GameRow({ game }: { game: SeasonGame }) {
  const modelReady = isModelEligible(game.gameType);
  const statusIcon =
    game.status === "final" ? (
      <CheckCircle2 className="h-4 w-4 text-court-live" />
    ) : game.status === "live" ? (
      <Radio className="h-4 w-4 text-court-live" />
    ) : (
      <Clock3 className="h-4 w-4 text-court-muted" />
    );

  return (
    <div className="grid gap-3 border-b border-court-border px-4 py-3 last:border-b-0 lg:grid-cols-[8rem_1fr_7rem_1fr_11rem] lg:items-center">
      <div>
        <div className="text-sm font-semibold text-white">{formatDate(game.gameDate)}</div>
        <div className="text-xs text-court-muted">{formatTime(game.gameDateTimeUTC)}</div>
      </div>

      <TeamBadge team={game.awayTeam} />

      <div className="flex items-center justify-between gap-2 rounded-md bg-court-surface px-3 py-2 lg:justify-center">
        {game.status === "final" || game.status === "live" ? (
          <div className="font-mono text-lg font-black text-white">
            {game.awayTeam.score}-{game.homeTeam.score}
          </div>
        ) : (
          <div className="text-xs font-semibold uppercase tracking-wider text-court-muted">at</div>
        )}
      </div>

      <TeamBadge team={game.homeTeam} />

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <span className="inline-flex items-center gap-1 rounded-md border border-court-border px-2 py-1 text-xs text-court-muted">
          {statusIcon}
          {game.statusText}
        </span>
        <span className="rounded-md border border-court-border px-2 py-1 text-xs text-court-muted">
          {typeLabel(game.gameType)}
        </span>
        {modelReady && game.status === "final" && (
          <span className="rounded-md bg-court-accent/10 px-2 py-1 text-xs font-semibold text-court-accent">
            In model
          </span>
        )}
        {modelReady && game.status !== "final" && (
          <span className="rounded-md bg-court-amber/10 px-2 py-1 text-xs font-semibold text-court-amber">
            Forecast
          </span>
        )}
      </div>
    </div>
  );
}

export default function SeasonGamesPanel() {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]["id"]>("all");
  const [teamId, setTeamId] = useState("0");
  const { data, error, isLoading } = useSWR<SeasonGamesResponse>("/api/season-games", fetcher, {
    refreshInterval: 900_000,
  });

  const games = useMemo(() => {
    const rows = data?.games ?? [];
    return rows
      .filter((game) => (status === "all" ? true : game.status === status))
      .filter((game) => {
        if (type === "all") return true;
        if (type === "model") return isModelEligible(game.gameType);
        return game.gameType === type;
      })
      .filter((game) => {
        if (teamId === "0") return true;
        const id = Number(teamId);
        return game.homeTeam.teamId === id || game.awayTeam.teamId === id;
      })
      .sort((a, b) => b.gameDateTimeUTC.localeCompare(a.gameDateTimeUTC));
  }, [data?.games, status, teamId, type]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card-quiet loading-shimmer h-24 rounded-lg" />
          ))}
        </div>
        <div className="surface-card-quiet loading-shimmer h-96 rounded-lg" />
      </div>
    );
  }

  if (error || data?.error || !data) {
    return (
      <div className="rounded-lg border border-court-border bg-court-card p-8 text-center text-court-muted">
        Could not load season games.
      </div>
    );
  }

  const visibleGames = games.slice(0, 120);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-court-border bg-court-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-court-muted">Season</div>
          <div className="mt-1 text-2xl font-black text-white">{data.season}</div>
        </div>
        <div className="rounded-lg border border-court-border bg-court-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-court-muted">Model Games</div>
          <div className="mt-1 text-2xl font-black text-court-accent">{data.counts.modelEligible}</div>
        </div>
        <div className="rounded-lg border border-court-border bg-court-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-court-muted">Final Scores</div>
          <div className="mt-1 text-2xl font-black text-court-live">{data.counts.completedModelGames}</div>
        </div>
        <div className="rounded-lg border border-court-border bg-court-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-court-muted">Upcoming</div>
          <div className="mt-1 text-2xl font-black text-court-amber">{data.counts.upcomingModelGames}</div>
        </div>
      </div>

      <div className="rounded-lg border border-court-border bg-court-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Filter className="h-4 w-4 text-court-accent" />
            Filters
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setStatus(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  status === item.id ? "bg-court-accent text-court-bg" : "bg-court-surface text-court-muted hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {TYPE_FILTERS.map((item) => (
              <button
                key={item.id}
                onClick={() => setType(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  type === item.id ? "bg-court-amber text-court-bg" : "bg-court-surface text-court-muted hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            className="ml-auto rounded-md border border-court-border bg-court-surface px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-court-accent"
          >
            <option value="0">All teams</option>
            {NBA_TEAMS.map((team) => (
              <option key={team.id} value={team.id}>
                {team.city} {team.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-court-border bg-court-card">
        <div className="flex items-center justify-between border-b border-court-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <CalendarDays className="h-4 w-4 text-court-accent" />
            Games
          </div>
          <div className="text-xs text-court-muted">
            Showing {visibleGames.length} of {games.length}
          </div>
        </div>
        {visibleGames.length === 0 ? (
          <div className="p-8 text-center text-court-muted">No games match these filters.</div>
        ) : (
          visibleGames.map((game) => <GameRow key={game.gameId} game={game} />)
        )}
      </div>
    </div>
  );
}
