"use client";

import useSWR from "swr";
import { BarChart3, Brackets, Brain, Radio, ShieldCheck, Target, Trophy } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface WCTeam {
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
  stage: string;
  group: string | null;
  homeTeam: WCTeam;
  awayTeam: WCTeam;
  homeScore: number | null;
  awayScore: number | null;
  winner: "home" | "away" | "draw" | null;
}

interface MatchesData {
  live: WCMatch[];
  today: WCMatch[];
  recent: WCMatch[];
  upcoming: WCMatch[];
  error?: string;
}

interface StandingRow {
  position: number;
  team: WCTeam;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface Standing {
  group: string | null;
  table: StandingRow[];
}

interface Scorer {
  player: { id: number; name: string; nationality: string };
  team: WCTeam;
  playedMatches: number;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

interface PredictionSummary {
  summary: { liveCount: number; upcomingCount: number; favorites: number };
  predictions: Array<{
    predictedWinner: WCTeam;
    confidence: "high" | "medium" | "low";
    knockoutHomeWinProb: number;
    knockoutAwayWinProb: number;
    predictedWinnerSide: "home" | "away";
    match: { homeTeam: WCTeam; awayTeam: WCTeam };
  }>;
}

interface BracketSummary {
  champion: { team: WCTeam; seed: number; group: string };
}

function groupLabel(value: string | null) {
  if (!value) return "Group";
  if (value.startsWith("GROUP_")) return value.replace("GROUP_", "Group ");
  return value;
}

function kickoff(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function liveLabel(match: WCMatch) {
  const minute = match.minute ? `${match.minute}'` : "Live";
  const injuryTime = match.injuryTime ? `+${match.injuryTime}` : "";
  return `${minute}${injuryTime}`;
}

function matchSummary(match: WCMatch) {
  if (match.status === "live") {
    return `${liveLabel(match)} - ${groupLabel(match.group)}.`;
  }
  if (match.status === "finished") {
    return `Finished - ${groupLabel(match.group)}.`;
  }
  return `${kickoff(match.utcDate)} - ${groupLabel(match.group)}.`;
}

function StatCard({
  label,
  value,
  detail,
  tone = "text-white",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-court-muted">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-sm text-court-muted">{detail}</div>
    </div>
  );
}

function TeamLine({ team, score, muted }: { team: WCTeam; score?: number | null; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${muted ? "opacity-60" : ""}`}>
      <img src={team.crest} alt={team.tla} className="h-9 w-9 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-white">{team.shortName || team.name}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{team.tla}</div>
      </div>
      {score != null && <div className="font-mono text-2xl font-black text-white">{score}</div>}
    </div>
  );
}

export default function WorldCupOverview({ navigate }: { navigate: (viewId: string) => void }) {
  const { data: matches } = useSWR<MatchesData>("/api/wc/matches", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: standings } = useSWR<{ standings: Standing[] }>("/api/wc/standings", fetcher, {
    refreshInterval: 5 * 60_000,
  });
  const { data: scorers } = useSWR<{ scorers: Scorer[] }>("/api/wc/scorers", fetcher, {
    refreshInterval: 5 * 60_000,
  });
  const { data: predictions } = useSWR<PredictionSummary>("/api/wc/predictions?limit=6", fetcher, {
    refreshInterval: 60_000,
  });
  const { data: bracket } = useSWR<BracketSummary>("/api/wc/bracket", fetcher, {
    refreshInterval: 5 * 60_000,
  });

  const live = matches?.live ?? [];
  const today = matches?.today ?? [];
  const recent = matches?.recent ?? [];
  const upcoming = matches?.upcoming ?? [];
  const featured = live[0] ?? today[0] ?? upcoming[0] ?? recent[0];
  const matchCenterMatch = live[0] ?? upcoming[0] ?? today[0];
  const groupTables = standings?.standings?.filter((standing) => standing.group) ?? [];
  const groupLeaders = groupTables
    .map((standing) => ({
      group: standing.group,
      leader: standing.table[0],
    }))
    .filter((item) => item.leader)
    .slice(0, 6);
  const topScorer = scorers?.scorers?.[0];
  const totalGoals = (scorers?.scorers ?? []).reduce((sum, scorer) => sum + (scorer.goals ?? 0), 0);
  const topPrediction = predictions?.predictions?.[0];
  const topPredictionProb = topPrediction
    ? topPrediction.predictedWinnerSide === "home"
      ? topPrediction.knockoutHomeWinProb
      : topPrediction.knockoutAwayWinProb
    : null;

  return (
    <div className="space-y-5">
      <section className="dashboard-pulse spotlight-surface relative overflow-hidden rounded-lg">
        <div className="relative grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-court-worldcup">
                <Trophy className="h-4 w-4" />
                World Cup Pulse
              </div>
              <span className="rounded-md border border-court-border bg-court-card/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-court-muted">
                football-data.org
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
              {featured ? `${featured.homeTeam.tla} vs ${featured.awayTeam.tla}` : "Tournament feed loading"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-court-muted">
              {featured
                ? matchSummary(featured)
                : "Pulling match, group, and scoring data from the World Cup feed."}
            </p>
          </div>

          <div className="score-lane rounded-lg border border-white/10 p-4">
            {featured ? (
              <div className="space-y-3">
                <TeamLine team={featured.homeTeam} score={featured.homeScore} muted={featured.winner === "away"} />
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-court-muted">
                  <span>{featured.status === "upcoming" ? "Kickoff" : "Score"}</span>
                  <span>{featured.status === "live" ? liveLabel(featured) : featured.status === "upcoming" ? kickoff(featured.utcDate) : featured.status.toUpperCase()}</span>
                </div>
                <TeamLine team={featured.awayTeam} score={featured.awayScore} muted={featured.winner === "home"} />
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-court-muted">Waiting for match data.</div>
            )}
          </div>
        </div>

        <div className="relative grid grid-cols-2 border-t border-court-border/80 md:grid-cols-4">
          <StatCard label="Live" value={live.length ? live.length.toString() : "0"} detail="matches now" tone={live.length ? "text-court-live" : "text-white"} />
          <StatCard label="Today" value={(today.length + live.length).toString()} detail="scheduled or live" />
          <StatCard label="Upcoming" value={upcoming.length.toString()} detail="next matches loaded" />
          <StatCard label="Scorer goals" value={totalGoals.toString()} detail="top 25 combined" tone="text-court-worldcup" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card-quiet rounded-lg p-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
            <Brain className="h-4 w-4" />
            Predictions
          </div>
          <h3 className="mt-3 text-xl font-black text-white">
            {topPrediction ? `${topPrediction.predictedWinner.tla} ${((topPredictionProb ?? 0) * 100).toFixed(0)}%` : "Model loading"}
          </h3>
          <p className="mt-2 min-h-10 text-sm text-court-muted">
            {topPrediction
              ? `${topPrediction.match.homeTeam.shortName} vs ${topPrediction.match.awayTeam.shortName}, ${topPrediction.confidence} confidence.`
              : "Building likely winners from lifetime strength, form, and live state."}
          </p>
          <button
            type="button"
            onClick={() => navigate("forecast")}
            className="mt-4 rounded-md border border-court-worldcup/25 bg-court-worldcup/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-worldcup hover:bg-court-worldcup/10"
          >
            Open Predictions
          </button>
        </article>

        <article className="surface-card-quiet rounded-lg p-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
            <Radio className="h-4 w-4" />
            Match center
          </div>
          <h3 className="mt-3 text-xl font-black text-white">{live.length ? `${live.length} live now` : "Next fixtures ready"}</h3>
          <p className="mt-2 min-h-10 text-sm text-court-muted">
            {matchCenterMatch
              ? `${matchCenterMatch.homeTeam.shortName} vs ${matchCenterMatch.awayTeam.shortName}, ${matchSummary(matchCenterMatch)}`
              : "No upcoming fixtures returned right now."}
          </p>
          <button
            type="button"
            onClick={() => navigate("matches")}
            className="mt-4 rounded-md border border-court-worldcup/25 bg-court-worldcup/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-worldcup hover:bg-court-worldcup/10"
          >
            Open Matches
          </button>
        </article>

        <article className="surface-card-quiet rounded-lg p-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
            <BarChart3 className="h-4 w-4" />
            Group picture
          </div>
          <h3 className="mt-3 text-xl font-black text-white">{groupTables.length} groups loaded</h3>
          <p className="mt-2 min-h-10 text-sm text-court-muted">
            {groupLeaders[0] ? `${groupLabel(groupLeaders[0].group)} leader: ${groupLeaders[0].leader.team.shortName}, ${groupLeaders[0].leader.points} points.` : "Standings are waiting for group results."}
          </p>
          <button
            type="button"
            onClick={() => navigate("groups")}
            className="mt-4 rounded-md border border-court-worldcup/25 bg-court-worldcup/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-worldcup hover:bg-court-worldcup/10"
          >
            Open Groups
          </button>
        </article>

        <article className="surface-card-quiet rounded-lg p-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
            <Target className="h-4 w-4" />
            Golden boot
          </div>
          <h3 className="mt-3 text-xl font-black text-white">{topScorer ? topScorer.player.name : "No leader yet"}</h3>
          <p className="mt-2 min-h-10 text-sm text-court-muted">
            {topScorer ? `${topScorer.goals} goals for ${topScorer.team.shortName}, ${topScorer.playedMatches} match played.` : "Scorer table will populate after goals are recorded."}
          </p>
          <button
            type="button"
            onClick={() => navigate("scorers")}
            className="mt-4 rounded-md border border-court-worldcup/25 bg-court-worldcup/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-worldcup hover:bg-court-worldcup/10"
          >
            Open Scorers
          </button>
        </article>

        <article className="surface-card-quiet rounded-lg p-4 transition-transform duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
            <Brackets className="h-4 w-4" />
            Bracket path
          </div>
          <h3 className="mt-3 text-xl font-black text-white">
            {bracket?.champion ? `${bracket.champion.team.tla} champion` : "Path loading"}
          </h3>
          <p className="mt-2 min-h-10 text-sm text-court-muted">
            {bracket?.champion
              ? `${bracket.champion.team.shortName} projects from seed ${bracket.champion.seed}, ${bracket.champion.group}.`
              : "Projecting group qualifiers and knockout winners."}
          </p>
          <button
            type="button"
            onClick={() => navigate("bracket")}
            className="mt-4 rounded-md border border-court-worldcup/25 bg-court-worldcup/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:border-court-worldcup hover:bg-court-worldcup/10"
          >
            Open Bracket
          </button>
        </article>
      </section>

      {groupLeaders.length > 0 && (
        <section className="surface-card-quiet rounded-lg p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
            <ShieldCheck className="h-4 w-4 text-court-worldcup" />
            Group leaders
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupLeaders.map(({ group, leader }) => (
              <div key={group} className="rounded-md border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{groupLabel(group)}</div>
                <div className="mt-2 flex items-center gap-2">
                  <img src={leader.team.crest} alt={leader.team.tla} className="h-6 w-6 object-contain" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white">{leader.team.shortName}</div>
                    <div className="text-xs text-court-muted">
                      {leader.points} pts, {leader.goalDifference > 0 ? "+" : ""}
                      {leader.goalDifference} GD
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
