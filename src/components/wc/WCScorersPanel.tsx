"use client";

import useSWR from "swr";
import { Target, Trophy } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Scorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedMatches: number;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

interface ScorersResponse {
  scorers: Scorer[];
  error?: string;
  retryAfterSeconds?: number;
}

export default function WCScorersPanel() {
  const { data, error, isLoading } = useSWR<ScorersResponse>("/api/wc/scorers", fetcher, {
    refreshInterval: 5 * 60_000,
  });

  if (isLoading) {
    return <div className="surface-card-quiet loading-shimmer rounded-lg p-10 text-center text-sm text-court-muted"><span className="loading-dots">Loading scorers</span></div>;
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
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">Failed to load top scorers.</div>;
  }

  const scorers = data.scorers;

  if (!scorers.length) {
    return (
      <div className="surface-card-quiet rounded-lg p-10 text-center text-sm text-court-muted">
        No goals scored yet. Check back once matches are underway.
      </div>
    );
  }

  const maxGoals = Math.max(1, scorers[0]?.goals ?? 1);
  const leader = scorers[0];
  const totalGoals = scorers.reduce((sum, scorer) => sum + (scorer.goals ?? 0), 0);
  const totalAssists = scorers.reduce((sum, scorer) => sum + (scorer.assists ?? 0), 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="spotlight-surface rounded-lg p-4 md:col-span-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
            <Trophy className="h-4 w-4" />
            Golden boot leader
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <img src={leader.team.crest} alt={leader.team.tla} className="h-10 w-10 object-contain" />
            <div>
              <div className="text-2xl font-black text-white">{leader.player.name}</div>
              <div className="text-sm text-court-muted">
                {leader.team.shortName}, {leader.player.nationality}
              </div>
            </div>
            <div className="ml-auto rounded-md border border-white/10 bg-black/20 px-3 py-2 text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Goals</div>
              <div className="font-mono text-2xl font-black text-court-worldcup">{leader.goals}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          <MiniStat label="Top 25 goals" value={totalGoals.toString()} />
          <MiniStat label="Assists listed" value={totalAssists.toString()} />
        </div>
      </section>

      <div className="surface-card-quiet overflow-hidden rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-xs text-court-muted">
              <th className="w-10 py-3 pl-4 text-left font-semibold">#</th>
              <th className="py-3 text-left font-semibold">Player</th>
              <th className="hidden py-3 text-left font-semibold sm:table-cell">Nation</th>
              <th className="py-3 text-center font-semibold">Goals</th>
              <th className="hidden py-3 text-center font-semibold sm:table-cell">Ast</th>
              <th className="hidden py-3 text-center font-semibold md:table-cell">Pen</th>
              <th className="py-3 pr-4 text-center font-semibold">MP</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((scorer, index) => (
              <tr key={`${scorer.player.id}-${scorer.team.id}`} className="border-b border-white/10 bg-transparent transition-colors hover:bg-white/[0.035] last:border-0">
                <td className="py-3 pl-4 font-semibold text-court-muted">{index + 1}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <img src={scorer.team.crest} alt={scorer.team.tla} className="h-5 w-5 shrink-0 object-contain" />
                    <div>
                      <div className="font-semibold text-white">{scorer.player.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-court-muted">{scorer.team.tla}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden py-3 text-xs text-court-muted sm:table-cell">{scorer.player.nationality}</td>
                <td className="py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-court-surface">
                      <div className="h-full rounded-full bg-court-worldcup" style={{ width: `${(scorer.goals / maxGoals) * 100}%` }} />
                    </div>
                    <span className="w-4 text-right font-black text-white">{scorer.goals}</span>
                  </div>
                </td>
                <td className="hidden py-3 text-center text-court-muted sm:table-cell">{scorer.assists ?? 0}</td>
                <td className="hidden py-3 text-center text-court-muted md:table-cell">{scorer.penalties ?? 0}</td>
                <td className="py-3 pr-4 text-center text-court-muted">{scorer.playedMatches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card-quiet rounded-lg p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-court-muted">
        <Target className="h-4 w-4 text-court-worldcup" />
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl font-black text-white">{value}</div>
    </div>
  );
}
