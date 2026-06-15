"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import useSWR from "swr";
import { CalendarDays, Clock3, Radio, Trophy } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface WCMatch {
  id: number;
  utcDate: string;
  status: "live" | "upcoming" | "finished" | "other";
  minute: number | null;
  injuryTime: number | null;
  venue: string | null;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: "home" | "away" | "draw" | null;
}

interface MatchesData {
  live: WCMatch[];
  today: WCMatch[];
  recent: WCMatch[];
  upcoming: WCMatch[];
  error?: string;
  retryAfterSeconds?: number;
}

type Filter = "all" | "live" | "today" | "upcoming" | "recent";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All loaded" },
  { id: "live", label: "Live" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "recent", label: "Recent" },
];

function formatKickoff(utcDate: string) {
  return new Date(utcDate).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupLabel(group: string | null) {
  if (!group) return "";
  if (group.startsWith("GROUP_")) return group.replace("GROUP_", "Group ");
  return group;
}

function statusLabel(match: WCMatch) {
  if (match.status === "live") return `${match.minute ? `${match.minute}'` : "Live"}${match.injuryTime ? `+${match.injuryTime}` : ""}`;
  if (match.status === "finished") return "FT";
  if (match.status === "upcoming") return formatKickoff(match.utcDate);
  return match.status;
}

function MatchCard({ match }: { match: WCMatch }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const showScore = isLive || isFinished;
  const homeWon = match.winner === "home";
  const awayWon = match.winner === "away";

  return (
    <article className={`rounded-lg border p-4 transition-all duration-200 hover:-translate-y-0.5 ${isLive ? "border-court-live/40 bg-court-live/10" : "surface-card-quiet"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {match.group && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-court-worldcup/15 text-court-worldcup">
              {groupLabel(match.group)}
            </span>
          )}
          {match.venue && <span className="truncate text-[10px] text-court-muted">{match.venue}</span>}
        </div>
        <div className="shrink-0 text-xs font-semibold text-court-muted">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-court-live">
              <span className="live-dot h-1.5 w-1.5" />
              {statusLabel(match)}
            </span>
          ) : (
            statusLabel(match)
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide team={match.homeTeam} score={match.homeScore} showScore={showScore} won={homeWon} align="left" />
        <span className="text-xs font-semibold text-court-muted">{showScore ? "-" : "vs"}</span>
        <TeamSide team={match.awayTeam} score={match.awayScore} showScore={showScore} won={awayWon} align="right" />
      </div>

      {isFinished && match.halfTimeHome !== null && (
        <div className="mt-3 text-center text-[10px] text-court-muted">
          HT: {match.halfTimeHome} - {match.halfTimeAway}
        </div>
      )}
    </article>
  );
}

function TeamSide({
  team,
  score,
  showScore,
  won,
  align,
}: {
  team: FDTeam;
  score: number | null;
  showScore: boolean;
  won: boolean;
  align: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end text-right" : ""}`}>
      {align === "left" && <img src={team.crest} alt={team.tla} className="h-8 w-8 shrink-0 object-contain" />}
      <div className="min-w-0">
        <div className={`truncate text-sm font-bold ${won || !showScore ? "text-white" : "text-court-muted"}`}>{team.shortName || team.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-court-muted">{team.tla}</div>
      </div>
      {showScore && <span className={`shrink-0 font-mono text-2xl font-black ${won ? "text-white" : "text-court-muted"}`}>{score ?? 0}</span>}
      {align === "right" && <img src={team.crest} alt={team.tla} className="h-8 w-8 shrink-0 object-contain" />}
    </div>
  );
}

function Section({ title, matches }: { title: string; matches: WCMatch[] }) {
  if (!matches.length) return null;
  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-court-muted">{title}</h3>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}

export default function WCMatchesPanel() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, error, isLoading } = useSWR<MatchesData>("/api/wc/matches", fetcher, {
    refreshInterval: 60_000,
  });

  const allMatches = useMemo(() => {
    if (!data) return [];
    return [...data.live, ...data.today, ...data.upcoming, ...data.recent];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "live") return data.live;
    if (filter === "today") return [...data.live, ...data.today];
    if (filter === "upcoming") return data.upcoming;
    if (filter === "recent") return data.recent;
    return allMatches;
  }, [allMatches, data, filter]);

  if (isLoading) {
    return <div className="surface-card-quiet loading-shimmer rounded-lg p-10 text-center text-sm text-court-muted"><span className="loading-dots">Loading matches</span></div>;
  }

  if (data?.error) {
    return (
      <div className="surface-card-quiet rounded-lg p-6 text-center">
        <p className="text-sm text-court-muted">{data.error}</p>
        {(data.retryAfterSeconds ?? 0) > 0 && (
          <p className="mt-1 text-xs text-court-muted">Retry in {data.retryAfterSeconds}s - cached data will auto-refresh.</p>
        )}
      </div>
    );
  }

  if (error || !data) {
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">Failed to load match data.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Summary icon={<Radio className="h-4 w-4 text-court-live" />} label="Live" value={data.live.length.toString()} />
        <Summary icon={<CalendarDays className="h-4 w-4 text-court-worldcup" />} label="Today" value={(data.live.length + data.today.length).toString()} />
        <Summary icon={<Clock3 className="h-4 w-4 text-court-amber" />} label="Upcoming" value={data.upcoming.length.toString()} />
        <Summary icon={<Trophy className="h-4 w-4 text-court-muted" />} label="Recent" value={data.recent.length.toString()} />
      </div>

      <div className="surface-card-quiet rounded-lg p-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === item.id ? "bg-court-worldcup text-court-bg" : "bg-black/20 text-court-muted hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="surface-card-quiet rounded-lg p-10 text-center text-sm text-court-muted">
          No matches found for this filter.
        </div>
      ) : filter === "all" ? (
        <div className="space-y-8">
          <Section title="Live" matches={data.live} />
          <Section title="Today" matches={data.today} />
          <Section title="Upcoming" matches={data.upcoming} />
          <Section title="Recent Results" matches={data.recent} />
        </div>
      ) : (
        <div className="stagger-in grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="surface-card-quiet rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-black text-white">{value}</div>
    </div>
  );
}
