"use client";

import useSWR from "swr";
import { Activity, Gauge, ShieldCheck } from "lucide-react";
import type { Prediction } from "@/lib/predict";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BacktestResponse {
  season: string;
  total: number;
  correct: number;
  accuracy: number;
  brierScore: number;
  logLoss: number;
  homeBaselineAccuracy: number;
  warmupGames: number;
  byConfidence: { confidence: Prediction["confidence"]; total: number; correct: number; accuracy: number; brier: number }[];
  calibration: { bucket: string; total: number; expectedHomeWins: number; actualHomeWins: number }[];
  error?: string;
}

function pct(value: number | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function healthTone(lift: number | undefined) {
  if (lift == null || !Number.isFinite(lift)) return "text-court-muted";
  if (lift >= 0.08) return "text-court-live";
  if (lift >= 0.03) return "text-court-accent";
  return "text-court-amber";
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-court-border bg-court-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-court-muted">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums text-white">{value}</div>
      {detail && <div className="mt-1 text-xs text-court-muted">{detail}</div>}
    </div>
  );
}

export default function ModelHealthPanel({ compact = false }: { compact?: boolean }) {
  const { data, error, isLoading } = useSWR<BacktestResponse>("/api/backtest", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 600_000,
  });

  if (isLoading) {
    return <div className="surface-card-quiet loading-shimmer h-56 rounded-lg" />;
  }

  if (error || data?.error || !data) {
    return (
      <div className="rounded-lg border border-court-border bg-court-card p-5 text-sm text-court-muted">
        Model health is unavailable right now.
      </div>
    );
  }

  const lift = data.accuracy - data.homeBaselineAccuracy;
  const highConfidence = data.byConfidence.find((row) => row.confidence === "high");
  const mediumConfidence = data.byConfidence.find((row) => row.confidence === "medium");
  const visibleConfidence = data.byConfidence.filter((row) => row.total > 0);
  const metricGridClass = compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 md:grid-cols-4";

  return (
    <section className="rounded-lg border border-court-border bg-court-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-court-accent" />
            <h3 className="text-base font-black text-white">Model Health</h3>
          </div>
          <div className="mt-1 text-sm text-court-muted">
            {compact ? "Replay, calibration, and baseline lift." : "Chronological replay before each final score entered the model."}
          </div>
        </div>
        <div className="rounded-md border border-court-border bg-court-surface px-3 py-2 text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">Edge vs home baseline</div>
          <div className={`font-mono text-lg font-black ${healthTone(lift)}`}>+{(lift * 100).toFixed(1)} pts</div>
        </div>
      </div>

      <div className={metricGridClass}>
        <Metric label="Replay accuracy" value={pct(data.accuracy)} detail={`${data.correct}/${data.total} games`} />
        <Metric label="Home baseline" value={pct(data.homeBaselineAccuracy)} />
        <Metric label="Brier" value={data.brierScore.toFixed(3)} detail="Lower is cleaner" />
        <Metric label="Warmup games" value={data.warmupGames.toLocaleString()} detail="Cold-start sample" />
      </div>

      {!compact && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-court-muted">
              <Gauge className="h-4 w-4 text-court-accent" />
              Confidence bands
            </div>
            <div className="space-y-2">
              {visibleConfidence.map((row) => (
                <div key={row.confidence} className="grid grid-cols-[5rem_1fr_4rem] items-center gap-2 text-xs">
                  <span className="font-bold uppercase text-white">{row.confidence}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-court-surface">
                    <div className="h-full bg-court-accent" style={{ width: `${row.accuracy * 100}%` }} />
                  </div>
                  <span className="text-right font-mono text-court-muted">{pct(row.accuracy, 0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-court-muted">
              <Activity className="h-4 w-4 text-court-amber" />
              Practical read
            </div>
            <div className="rounded-lg border border-court-border bg-court-surface/60 p-3 text-sm leading-relaxed text-court-muted">
              The replay is useful for trust: it shows the model beat a simple home-team pick by {(lift * 100).toFixed(1)} percentage points.
              It is not a guarantee, especially when confidence is low or the matchup is close.
            </div>
            {(highConfidence || mediumConfidence) && (
              <div className="mt-2 text-xs text-court-muted">
                {highConfidence && `High confidence: ${pct(highConfidence.accuracy)} over ${highConfidence.total} games.`}
                {highConfidence && mediumConfidence ? " " : ""}
                {mediumConfidence && `Medium confidence: ${pct(mediumConfidence.accuracy)} over ${mediumConfidence.total} games.`}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
