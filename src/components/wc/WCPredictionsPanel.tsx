"use client";

import { useState } from "react";
import useSWR from "swr";
import { Activity, Brain, CalendarClock, Gauge, Radio, Target, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface MatchPrediction {
  match: {
    id: number;
    utcDate: string;
    status: "live" | "upcoming" | "finished" | "other";
    minute: number | null;
    injuryTime: number | null;
    venue: string | null;
    group: string | null;
    homeTeam: Team;
    awayTeam: Team;
    homeScore: number | null;
    awayScore: number | null;
  };
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  knockoutHomeWinProb: number;
  knockoutAwayWinProb: number;
  predictedWinner: Team;
  predictedWinnerSide: "home" | "away";
  confidence: "high" | "medium" | "low";
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedGoalDiff: number;
  model: {
    ratingGap: number;
    liveAdjustment: number;
    drivers: { label: string; value: string; detail: string; edge: "home" | "away" | "neutral" }[];
    homeSignal: { rating: number; baseline: number; form: number; points: number; goalDifference: number };
    awaySignal: { rating: number; baseline: number; form: number; points: number; goalDifference: number };
  };
}

interface PredictionsResponse {
  generatedAt: string;
  modelVersion: string;
  methodology: string;
  summary: {
    liveCount: number;
    upcomingCount: number;
    favorites: number;
    matchesLoaded: number;
    standingsLoaded: number;
  };
  predictions: MatchPrediction[];
  error?: string;
  retryAfterSeconds?: number;
}

function pct(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function kickoff(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupLabel(value: string | null) {
  if (!value) return "Match";
  if (value.startsWith("GROUP_")) return value.replace("GROUP_", "Group ");
  return value;
}

function confidenceTone(confidence: MatchPrediction["confidence"]) {
  if (confidence === "high") return "text-court-live";
  if (confidence === "medium") return "text-court-worldcup";
  return "text-court-muted";
}

function statusLabel(item: MatchPrediction) {
  if (item.match.status === "live") {
    const minute = item.match.minute ? `${item.match.minute}'` : "Live";
    return `${minute}${item.match.injuryTime ? `+${item.match.injuryTime}` : ""}`;
  }
  return kickoff(item.match.utcDate);
}

function TeamSide({ team, prob, align }: { team: Team; prob: number; align: "left" | "right" }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${align === "right" ? "justify-end text-right" : ""}`}>
      {align === "left" && <img src={team.crest} alt={team.tla} className="h-8 w-8 shrink-0 object-contain" />}
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-white">{team.shortName || team.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-court-muted">{team.tla}</div>
      </div>
      <div className="font-mono text-lg font-black text-white">{pct(prob)}</div>
      {align === "right" && <img src={team.crest} alt={team.tla} className="h-8 w-8 shrink-0 object-contain" />}
    </div>
  );
}

function PredictionCard({ item, onOpen }: { item: MatchPrediction; onOpen: (item: MatchPrediction) => void }) {
  const isLive = item.match.status === "live";
  const favoriteProb = item.predictedWinnerSide === "home" ? item.knockoutHomeWinProb : item.knockoutAwayWinProb;

  return (
    <article className={`surface-card-quiet rounded-lg p-4 transition-all duration-200 hover:-translate-y-0.5 ${isLive ? "border-court-live/40 bg-court-live/10" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-court-muted">
            {isLive ? <Radio className="h-3.5 w-3.5 text-court-live" /> : <CalendarClock className="h-3.5 w-3.5 text-court-worldcup" />}
            {statusLabel(item)}
          </div>
          <h3 className="mt-1 truncate text-lg font-black text-white">
            {item.match.homeTeam.tla} vs {item.match.awayTeam.tla}
          </h3>
          <div className="text-xs text-court-muted">{groupLabel(item.match.group)}</div>
        </div>
        <div className="rounded-md border border-court-worldcup/25 bg-court-worldcup/10 px-2 py-1 text-right">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Winner</div>
          <div className="font-mono text-sm font-black text-white">{item.predictedWinner.tla}</div>
          <div className="text-[10px] font-bold text-court-worldcup">{pct(favoriteProb)}</div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamSide team={item.match.homeTeam} prob={item.homeWinProb} align="left" />
        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-court-muted">
          <div>Draw</div>
          <div className="font-mono text-sm text-white">{pct(item.drawProb)}</div>
        </div>
        <TeamSide team={item.match.awayTeam} prob={item.awayWinProb} align="right" />
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/30">
        <div className="bg-court-worldcup" style={{ width: `${item.homeWinProb * 100}%` }} />
        <div className="bg-court-muted/50" style={{ width: `${item.drawProb * 100}%` }} />
        <div className="bg-court-accent" style={{ width: `${item.awayWinProb * 100}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md border border-white/10 bg-black/20 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Projected</div>
          <div className="mt-0.5 font-mono font-black text-white">
            {item.expectedHomeGoals.toFixed(1)}-{item.expectedAwayGoals.toFixed(1)}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Rating gap</div>
          <div className="mt-0.5 font-mono font-black text-white">{Math.round(item.model.ratingGap)}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Trust</div>
          <div className={`mt-0.5 font-black uppercase ${confidenceTone(item.confidence)}`}>{item.confidence}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(item)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-court-worldcup/25 bg-court-worldcup/5 px-3 py-2 text-sm font-bold text-white transition-colors hover:border-court-worldcup hover:bg-court-worldcup/10"
      >
        <Target className="h-4 w-4 text-court-worldcup" />
        View match detail
      </button>
    </article>
  );
}

function PredictionDrawer({ item, onClose }: { item: MatchPrediction; onClose: () => void }) {
  const favoriteProb = item.predictedWinnerSide === "home" ? item.knockoutHomeWinProb : item.knockoutAwayWinProb;

  return (
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close match detail" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-court-bg/95 shadow-2xl backdrop-blur-xl">
        <div className="h-1.5 bg-gradient-to-r from-court-worldcup via-court-amber to-court-accent" />
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-worldcup">
              <Brain className="h-4 w-4" />
              WC hybrid v1
            </div>
            <h2 className="mt-2 text-2xl font-black text-white">
              {item.match.homeTeam.shortName} vs {item.match.awayTeam.shortName}
            </h2>
            <p className="mt-1 text-sm text-court-muted">{statusLabel(item)} - {groupLabel(item.match.group)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-court-muted transition-colors hover:border-court-worldcup hover:text-white"
            aria-label="Close match detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="spotlight-surface rounded-lg p-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-court-muted">
              <Target className="h-4 w-4 text-court-live" />
              Predicted winner
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-3xl font-black text-white">{item.predictedWinner.shortName || item.predictedWinner.name}</div>
                <div className="mt-1 text-sm text-court-muted">No-draw knockout probability: {pct(favoriteProb, 1)}</div>
              </div>
              <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">90-min line</div>
                <div className="font-mono text-lg font-black text-white">
                  {pct(item.homeWinProb)} / {pct(item.drawProb)} / {pct(item.awayWinProb)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Mini label="Lifetime" value={`${Math.round(item.model.homeSignal.baseline)}-${Math.round(item.model.awaySignal.baseline)}`} />
            <Mini label="Form" value={`${Math.round(item.model.homeSignal.form)}-${Math.round(item.model.awaySignal.form)}`} />
            <Mini label="Live adj" value={Math.round(item.model.liveAdjustment).toString()} />
          </div>

          <div className="surface-card-quiet mt-4 rounded-lg p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Gauge className="h-4 w-4 text-court-worldcup" />
              Why the model picked it
            </div>
            <div className="space-y-2">
              {item.model.drivers.map((driver) => (
                <div key={driver.label} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{driver.label}</div>
                      <div className="text-xs text-court-muted">{driver.detail}</div>
                    </div>
                    <div className={`shrink-0 font-mono text-sm font-black ${driver.edge === "home" ? "text-court-worldcup" : driver.edge === "away" ? "text-court-accent" : "text-court-muted"}`}>
                      {driver.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card-quiet rounded-lg p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-white">{value}</div>
    </div>
  );
}

export default function WCPredictionsPanel() {
  const [selected, setSelected] = useState<MatchPrediction | null>(null);
  const { data, error, isLoading } = useSWR<PredictionsResponse>("/api/wc/predictions?limit=18", fetcher, {
    refreshInterval: 60_000,
  });

  if (isLoading) {
    return <div className="surface-card-quiet loading-shimmer rounded-lg p-10 text-center text-sm text-court-muted"><span className="loading-dots">Loading match predictions</span></div>;
  }

  if (data?.error) {
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">{data.error}</div>;
  }

  if (error || !data) {
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">Failed to load World Cup predictions.</div>;
  }

  return (
    <div className="space-y-5">
      <section className="spotlight-surface rounded-lg p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-court-worldcup">
              <Brain className="h-4 w-4" />
              Match prediction model
            </div>
            <h3 className="mt-3 text-2xl font-black text-white">{data.modelVersion}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-court-muted">{data.methodology}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Live" value={data.summary.liveCount.toString()} />
            <Mini label="Upcoming" value={data.summary.upcomingCount.toString()} />
            <Mini label="Edges" value={data.summary.favorites.toString()} />
          </div>
        </div>
      </section>

      <div className="stagger-in grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {data.predictions.map((item) => (
          <PredictionCard key={item.match.id} item={item} onOpen={setSelected} />
        ))}
      </div>

      {selected && <PredictionDrawer item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
