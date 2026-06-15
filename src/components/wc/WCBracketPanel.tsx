"use client";

import useSWR from "swr";
import { Brackets, Crown, ShieldCheck, Trophy } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface ProjectedTeam {
  seed: number;
  group: string;
  groupRank: number;
  team: Team;
  projectedPoints: number;
  projectedGoalDifference: number;
  rating: number;
}

interface BracketGame {
  id: string;
  home: ProjectedTeam;
  away: ProjectedTeam;
  winner: ProjectedTeam;
  homeWinProb: number;
  awayWinProb: number;
}

interface GroupProjection {
  group: string | null;
  label: string;
  table: Array<{
    team: Team;
    projectedPoints: number;
    projectedGoalDifference: number;
  }>;
}

interface BracketResponse {
  generatedAt: string;
  modelVersion: string;
  methodology: string;
  note: string;
  groups: GroupProjection[];
  field: ProjectedTeam[];
  rounds: { name: string; games: BracketGame[] }[];
  champion: ProjectedTeam;
  error?: string;
}

function pct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function TeamSeed({ item }: { item: ProjectedTeam }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-5 shrink-0 font-mono text-[10px] text-court-muted">{item.seed}</span>
      <img src={item.team.crest} alt={item.team.tla} className="h-5 w-5 shrink-0 object-contain" />
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-white">{item.team.shortName || item.team.name}</div>
        <div className="text-[10px] text-court-muted">{item.group} #{item.groupRank}</div>
      </div>
    </div>
  );
}

function BracketCard({ game }: { game: BracketGame }) {
  const homeWon = game.winner.team.id === game.home.team.id;

  return (
    <article className="surface-card-quiet rounded-lg p-3">
      <div className="space-y-2">
        <div className={`rounded-md border px-2 py-2 ${homeWon ? "border-court-worldcup/40 bg-court-worldcup/10" : "border-white/10 bg-black/20 opacity-70"}`}>
          <div className="flex items-center justify-between gap-2">
            <TeamSeed item={game.home} />
            <span className="font-mono text-xs font-black text-white">{pct(game.homeWinProb)}</span>
          </div>
        </div>
        <div className={`rounded-md border px-2 py-2 ${!homeWon ? "border-court-worldcup/40 bg-court-worldcup/10" : "border-white/10 bg-black/20 opacity-70"}`}>
          <div className="flex items-center justify-between gap-2">
            <TeamSeed item={game.away} />
            <span className="font-mono text-xs font-black text-white">{pct(game.awayWinProb)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-court-muted">
        <Trophy className="h-3.5 w-3.5 text-court-worldcup" />
        Advances: <span className="font-bold text-white">{game.winner.team.tla}</span>
      </div>
    </article>
  );
}

function GroupMini({ group }: { group: GroupProjection }) {
  return (
    <div className="surface-card-quiet rounded-lg p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-court-worldcup">{group.label}</div>
      <div className="space-y-1.5">
        {group.table.slice(0, 3).map((row, index) => (
          <div key={row.team.id} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-4 text-court-muted">{index + 1}</span>
              <img src={row.team.crest} alt={row.team.tla} className="h-4 w-4 object-contain" />
              <span className="truncate font-semibold text-white">{row.team.shortName || row.team.name}</span>
            </div>
            <span className="font-mono text-court-muted">{row.projectedPoints.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WCBracketPanel() {
  const { data, error, isLoading } = useSWR<BracketResponse>("/api/wc/bracket", fetcher, {
    refreshInterval: 5 * 60_000,
  });

  if (isLoading) {
    return <div className="surface-card-quiet loading-shimmer rounded-lg p-10 text-center text-sm text-court-muted"><span className="loading-dots">Projecting bracket</span></div>;
  }

  if (data?.error) {
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">{data.error}</div>;
  }

  if (error || !data) {
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">Failed to load bracket projection.</div>;
  }

  return (
    <div className="space-y-5">
      <section className="spotlight-surface rounded-lg p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-court-worldcup">
              <Brackets className="h-4 w-4" />
              Tournament projection
            </div>
            <h3 className="mt-3 text-2xl font-black text-white">{data.champion.team.shortName || data.champion.team.name} champion path</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-court-muted">{data.methodology}</p>
          </div>
          <div className="score-lane rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <img src={data.champion.team.crest} alt={data.champion.team.tla} className="h-12 w-12 object-contain" />
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-court-muted">
                  <Crown className="h-3.5 w-3.5 text-court-amber" />
                  Projected champion
                </div>
                <div className="mt-1 text-2xl font-black text-white">{data.champion.team.shortName || data.champion.team.name}</div>
                <div className="text-xs text-court-muted">Seed {data.champion.seed}, {data.champion.group}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card-quiet rounded-lg p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
          <ShieldCheck className="h-4 w-4 text-court-worldcup" />
          Projected group qualifiers
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.groups.map((group) => (
            <GroupMini key={group.label} group={group} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {data.rounds.map((round) => (
          <div key={round.name}>
            <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-court-muted">{round.name}</div>
            <div className="stagger-in grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {round.games.map((game) => (
                <BracketCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <p className="text-xs leading-5 text-court-muted">{data.note}</p>
    </div>
  );
}
