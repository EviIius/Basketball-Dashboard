"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowLeftRight, Sparkles } from "lucide-react";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import type { Prediction } from "@/lib/predict";
import type { NBAStaticTeam } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PredictResponse {
  season: string;
  gamesUsed: number;
  prediction: Prediction;
  error?: string;
}

function todayIso() {
  return new Date().toISOString();
}

function colorFor(team: NBAStaticTeam) {
  return TEAM_COLORS[team.tricode]?.primary ?? "#6b7280";
}

function TeamSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (team: NBAStaticTeam) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-court-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          const team = NBA_TEAMS.find((item) => item.id === Number(event.target.value));
          if (team) onChange(team);
        }}
        className="w-full rounded-md border border-court-border bg-court-surface px-3 py-2 text-sm font-semibold text-white outline-none focus:border-court-accent"
      >
        {NBA_TEAMS.map((team) => (
          <option key={team.id} value={team.id}>
            {team.city} {team.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CustomMatchupCard() {
  const [away, setAway] = useState<NBAStaticTeam>(NBA_TEAMS.find((team) => team.tricode === "OKC") ?? NBA_TEAMS[0]);
  const [home, setHome] = useState<NBAStaticTeam>(NBA_TEAMS.find((team) => team.tricode === "BOS") ?? NBA_TEAMS[1]);
  const query = useMemo(
    () =>
      `/api/predict?homeId=${home.id}&awayId=${away.id}&gameDate=${encodeURIComponent(todayIso())}&scope=current`,
    [away.id, home.id],
  );
  const { data, isLoading } = useSWR<PredictResponse>(away.id === home.id ? null : query, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const prediction = data?.prediction;
  const awayPct = (prediction?.awayWinProb ?? 0.5) * 100;
  const homePct = (prediction?.homeWinProb ?? 0.5) * 100;
  const awayColor = colorFor(away);
  const homeColor = colorFor(home);
  const favorite = prediction
    ? prediction.homeWinProb >= prediction.awayWinProb
      ? home.tricode
      : away.tricode
    : "--";

  return (
    <section className="overflow-hidden rounded-lg border border-court-border bg-court-card">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${awayColor}, ${homeColor})` }} />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-court-accent" />
          <h3 className="text-base font-black text-white">Any-Team Matchup</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <TeamSelect label="Away" value={away.id} onChange={setAway} />
          <button
            type="button"
            onClick={() => {
              setAway(home);
              setHome(away);
            }}
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-court-border text-court-muted transition-colors hover:border-court-accent hover:text-court-accent"
            title="Swap teams"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <TeamSelect label="Home" value={home.id} onChange={setHome} />
        </div>

        {away.id === home.id && (
          <div className="rounded-md border border-court-border bg-court-surface p-3 text-sm text-court-muted">
            Choose two different teams.
          </div>
        )}

        {away.id !== home.id && (
          <div className="rounded-lg border border-court-border bg-court-surface/60 p-3">
            {isLoading && <div className="py-6 text-center text-sm text-court-muted">Computing matchup...</div>}
            {!isLoading && prediction && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Likely winner</div>
                    <div className="mt-0.5 text-2xl font-black text-white">{favorite}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Projected</div>
                    <div className="mt-0.5 font-mono text-sm font-black text-white">
                      {away.tricode} {prediction.predictedAwayScore} - {prediction.predictedHomeScore} {home.tricode}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[3.25rem_1fr_3.25rem] items-center gap-2">
                  <div className="text-right">
                    <div className="font-mono text-sm font-black text-white">{awayPct.toFixed(0)}%</div>
                    <div className="text-[10px] font-bold text-court-muted">{away.tricode}</div>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-court-border">
                    <div style={{ width: `${awayPct}%`, backgroundColor: awayColor, opacity: awayPct >= homePct ? 1 : 0.58 }} />
                    <div style={{ width: `${homePct}%`, backgroundColor: homeColor, opacity: homePct >= awayPct ? 1 : 0.58 }} />
                  </div>
                  <div>
                    <div className="font-mono text-sm font-black text-white">{homePct.toFixed(0)}%</div>
                    <div className="text-[10px] font-bold text-court-muted">{home.tricode}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border border-court-border bg-court-card/70 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-court-muted">Margin</div>
                    <div className="mt-0.5 font-mono font-black text-white">
                      {prediction.predictedMargin > 0 ? "+" : ""}
                      {prediction.predictedMargin.toFixed(1)}
                    </div>
                  </div>
                  <div className="rounded-md border border-court-border bg-court-card/70 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-court-muted">Trust</div>
                    <div className="mt-0.5 font-black uppercase text-white">{prediction.confidence}</div>
                  </div>
                  <div className="rounded-md border border-court-border bg-court-card/70 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-court-muted">Games</div>
                    <div className="mt-0.5 font-mono font-black text-white">{data?.gamesUsed.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
