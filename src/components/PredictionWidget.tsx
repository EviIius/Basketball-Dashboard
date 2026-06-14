"use client";

import { useState } from "react";
import useSWR from "swr";
import { Info, Target, X } from "lucide-react";
import type { Prediction } from "@/lib/predict";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error ?? "Prediction request failed");
  }

  return payload;
};

interface PredictResponse {
  season: string;
  scope: "current" | "lifetime";
  gamesUsed: number;
  prediction: Prediction;
  error?: string;
}

interface Props {
  gameId?: string;
  gameDateUTC?: string;
  homeId: number;
  awayId: number;
  homeTricode: string;
  awayTricode: string;
  actualHomeScore?: number;
  actualAwayScore?: number;
  gameStatus: 1 | 2 | 3;
}

export default function PredictionWidget({
  gameId,
  gameDateUTC,
  homeId,
  awayId,
  homeTricode,
  awayTricode,
  actualHomeScore,
  actualAwayScore,
  gameStatus,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const baseParams = gameId
    ? `gameId=${encodeURIComponent(gameId)}`
    : `homeId=${homeId}&awayId=${awayId}${gameDateUTC ? `&gameDate=${encodeURIComponent(gameDateUTC)}` : ""}`;
  const seasonUrl = `/api/predict?${baseParams}&scope=current`;
  const lifetimeUrl = `/api/predict?${baseParams}&scope=lifetime`;

  const {
    data: seasonData,
    error: seasonError,
    isLoading: seasonLoading,
  } = useSWR<PredictResponse>(seasonUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const {
    data: lifetimeData,
    error: lifetimeError,
    isLoading: lifetimeLoading,
  } = useSWR<PredictResponse>(lifetimeUrl, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  if (seasonLoading && lifetimeLoading) {
    return (
      <div className="mt-3 border-t border-court-border pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-court-muted">Prediction</span>
          <span className="text-[10px] text-court-muted">Loading</span>
        </div>
        <div className="h-2 animate-pulse rounded-full bg-court-border" />
      </div>
    );
  }

  const seasonPrediction = !seasonError && seasonData && !seasonData.error ? seasonData.prediction : null;
  const lifetimePrediction = !lifetimeError && lifetimeData && !lifetimeData.error ? lifetimeData.prediction : null;

  if (!seasonPrediction && !lifetimePrediction) return null;

  const homeColor = TEAM_COLORS[homeTricode]?.primary ?? "#6b7280";
  const awayColor = TEAM_COLORS[awayTricode]?.primary ?? "#6b7280";

  return (
    <div className="mt-3 border-t border-court-border pt-3" onClick={(event) => event.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-court-muted">
          <Target className="h-3.5 w-3.5 text-court-accent" />
          Prediction
        </span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md border border-court-border px-2 text-[10px] font-semibold uppercase tracking-wider text-court-muted transition hover:border-court-accent/70 hover:text-court-accent"
          aria-label="View prediction details"
          onClick={() => setDetailOpen(true)}
        >
          <Info className="h-3.5 w-3.5" />
          Details
        </button>
      </div>

      <div className="space-y-2">
        {seasonPrediction && (
          <PredictionRow
            label="Season"
            prediction={seasonPrediction}
            homeTricode={homeTricode}
            awayTricode={awayTricode}
            homeColor={homeColor}
            awayColor={awayColor}
            actualHomeScore={actualHomeScore}
            actualAwayScore={actualAwayScore}
            gameStatus={gameStatus}
          />
        )}
        {lifetimePrediction && (
          <PredictionRow
            label="Lifetime"
            prediction={lifetimePrediction}
            homeTricode={homeTricode}
            awayTricode={awayTricode}
            homeColor={homeColor}
            awayColor={awayColor}
            actualHomeScore={actualHomeScore}
            actualAwayScore={actualAwayScore}
            gameStatus={gameStatus}
          />
        )}
        {!lifetimePrediction && !lifetimeLoading && (
          <div className="rounded-md border border-court-border bg-court-surface/35 px-3 py-2 text-[11px] text-court-muted">
            Lifetime model unavailable
          </div>
        )}
      </div>

      {detailOpen && (
        <PredictionDetailDialog
          seasonPrediction={seasonPrediction}
          lifetimePrediction={lifetimePrediction}
          seasonGamesUsed={seasonData?.gamesUsed}
          lifetimeGamesUsed={lifetimeData?.gamesUsed}
          awayTricode={awayTricode}
          homeTricode={homeTricode}
          awayColor={awayColor}
          homeColor={homeColor}
          actualAwayScore={actualAwayScore}
          actualHomeScore={actualHomeScore}
          gameStatus={gameStatus}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  );
}

interface PredictionRowProps {
  label: string;
  prediction: Prediction;
  homeTricode: string;
  awayTricode: string;
  homeColor: string;
  awayColor: string;
  actualHomeScore?: number;
  actualAwayScore?: number;
  gameStatus: 1 | 2 | 3;
}

function PredictionRow({
  label,
  prediction,
  homeTricode,
  awayTricode,
  homeColor,
  awayColor,
  actualHomeScore,
  actualAwayScore,
  gameStatus,
}: PredictionRowProps) {
  const homePct = prediction.homeWinProb * 100;
  const awayPct = prediction.awayWinProb * 100;
  const homeFavorite = prediction.homeWinProb >= 0.5;
  const outcome = predictionOutcome(prediction, actualHomeScore, actualAwayScore, gameStatus);

  return (
    <div className="rounded-md border border-court-border bg-court-surface/30 px-3 py-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white">{label}</span>
          <span className={confidenceClass(prediction.confidence)}>{prediction.confidence}</span>
          {outcome && <span className={outcome.className}>{outcome.label}</span>}
        </div>
        {prediction.predictedHomeScore != null && prediction.predictedAwayScore != null && (
          <span className="font-mono text-[11px] text-court-muted">
            {awayTricode} {prediction.predictedAwayScore} - {prediction.predictedHomeScore} {homeTricode}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
        <span className={`text-right font-mono text-xs font-bold tabular-nums ${!homeFavorite ? "text-white" : "text-court-muted"}`}>
          {awayPct.toFixed(0)}%
        </span>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-court-border">
          <div style={{ width: `${awayPct}%`, backgroundColor: awayColor, opacity: !homeFavorite ? 1 : 0.55 }} />
          <div style={{ width: `${homePct}%`, backgroundColor: homeColor, opacity: homeFavorite ? 1 : 0.55 }} />
        </div>
        <span className={`font-mono text-xs font-bold tabular-nums ${homeFavorite ? "text-white" : "text-court-muted"}`}>
          {homePct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-court-muted">
        <span>{awayTricode}</span>
        <span>{homeTricode}</span>
      </div>
    </div>
  );
}

interface PredictionDetailDialogProps {
  seasonPrediction: Prediction | null;
  lifetimePrediction: Prediction | null;
  seasonGamesUsed?: number;
  lifetimeGamesUsed?: number;
  awayTricode: string;
  homeTricode: string;
  awayColor: string;
  homeColor: string;
  actualAwayScore?: number;
  actualHomeScore?: number;
  gameStatus: 1 | 2 | 3;
  onClose: () => void;
}

function PredictionDetailDialog({
  seasonPrediction,
  lifetimePrediction,
  seasonGamesUsed,
  lifetimeGamesUsed,
  awayTricode,
  homeTricode,
  awayColor,
  homeColor,
  actualAwayScore,
  actualHomeScore,
  gameStatus,
  onClose,
}: PredictionDetailDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-court-border bg-court-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Prediction details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-court-border bg-court-card/95 p-4 backdrop-blur">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-court-muted">Prediction detail</div>
            <h3 className="mt-1 text-lg font-black text-white">
              {awayTricode} at {homeTricode}
            </h3>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-court-border text-court-muted transition hover:border-court-accent/70 hover:text-white"
            aria-label="Close prediction details"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            {seasonPrediction && (
              <PredictionSummaryCard
                label="Season"
                prediction={seasonPrediction}
                gamesUsed={seasonGamesUsed}
                awayTricode={awayTricode}
                homeTricode={homeTricode}
                awayColor={awayColor}
                homeColor={homeColor}
                actualAwayScore={actualAwayScore}
                actualHomeScore={actualHomeScore}
                gameStatus={gameStatus}
              />
            )}
            {lifetimePrediction && (
              <PredictionSummaryCard
                label="Lifetime"
                prediction={lifetimePrediction}
                gamesUsed={lifetimeGamesUsed}
                awayTricode={awayTricode}
                homeTricode={homeTricode}
                awayColor={awayColor}
                homeColor={homeColor}
                actualAwayScore={actualAwayScore}
                actualHomeScore={actualHomeScore}
                gameStatus={gameStatus}
              />
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {seasonPrediction && <DriverList title="Season drivers" prediction={seasonPrediction} />}
            {lifetimePrediction && <DriverList title="Lifetime drivers" prediction={lifetimePrediction} />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PredictionSummaryCardProps {
  label: string;
  prediction: Prediction;
  gamesUsed?: number;
  awayTricode: string;
  homeTricode: string;
  awayColor: string;
  homeColor: string;
  actualAwayScore?: number;
  actualHomeScore?: number;
  gameStatus: 1 | 2 | 3;
}

function PredictionSummaryCard({
  label,
  prediction,
  gamesUsed,
  awayTricode,
  homeTricode,
  awayColor,
  homeColor,
  actualAwayScore,
  actualHomeScore,
  gameStatus,
}: PredictionSummaryCardProps) {
  const homePct = prediction.homeWinProb * 100;
  const awayPct = prediction.awayWinProb * 100;
  const favorite = prediction.homeWinProb >= prediction.awayWinProb ? homeTricode : awayTricode;
  const outcome = predictionOutcome(prediction, actualHomeScore, actualAwayScore, gameStatus);

  return (
    <div className="rounded-lg border border-court-border bg-court-surface/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{label} model</div>
          <div className="mt-1 text-2xl font-black text-white">{favorite}</div>
          <div className="text-xs text-court-muted">favored by {Math.abs(prediction.predictedMargin).toFixed(1)} pts</div>
        </div>
        <div className="text-right">
          <span className={confidenceClass(prediction.confidence)}>{prediction.confidence}</span>
          {outcome && <div className={`mt-2 text-xs font-bold ${outcome.className}`}>{outcome.label}</div>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <TeamProbability tricode={awayTricode} color={awayColor} pct={awayPct} isFavorite={prediction.awayWinProb >= prediction.homeWinProb} />
        <TeamProbability tricode={homeTricode} color={homeColor} pct={homePct} isFavorite={prediction.homeWinProb >= prediction.awayWinProb} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-court-border bg-court-card/70 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Projected</div>
          <div className="mt-1 font-mono font-bold text-white">
            {prediction.predictedAwayScore != null && prediction.predictedHomeScore != null
              ? `${awayTricode} ${prediction.predictedAwayScore} - ${prediction.predictedHomeScore} ${homeTricode}`
              : "No score"}
          </div>
        </div>
        <div className="rounded-md border border-court-border bg-court-card/70 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Games used</div>
          <div className="mt-1 font-mono font-bold text-white">{gamesUsed?.toLocaleString() ?? "-"}</div>
        </div>
        <div className="rounded-md border border-court-border bg-court-card/70 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Data</div>
          <div className="mt-1 font-bold uppercase text-white">{prediction.dataQuality}</div>
        </div>
        <div className="rounded-md border border-court-border bg-court-card/70 p-2">
          <div className="text-[10px] uppercase tracking-wider text-court-muted">Margin</div>
          <div className="mt-1 font-mono font-bold text-white">{formatNet(prediction.predictedMargin)}</div>
        </div>
      </div>
    </div>
  );
}

function TeamProbability({ tricode, color, pct, isFavorite }: { tricode: string; color: string; pct: number; isFavorite: boolean }) {
  return (
    <div className="rounded-md border border-court-border bg-court-card/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-white">{tricode}</span>
        <span className={`font-mono text-xl font-black tabular-nums ${isFavorite ? "text-white" : "text-court-muted"}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-court-border">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function DriverList({ title, prediction }: { title: string; prediction: Prediction }) {
  return (
    <div className="rounded-lg border border-court-border bg-court-surface/35 p-4">
      <h4 className="text-sm font-black text-white">{title}</h4>
      <div className="mt-3 space-y-2">
        {prediction.drivers.map((driver) => (
          <div key={`${title}-${driver.label}`} className="rounded-md border border-court-border bg-court-card/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-white">{driver.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-court-muted">{driver.detail}</div>
              </div>
              <div className={`shrink-0 font-mono text-xs font-bold tabular-nums ${driver.net >= 0 ? "text-court-live" : "text-court-red"}`}>
                {formatNet(driver.net)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function confidenceClass(confidence: Prediction["confidence"]) {
  const base = "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
  if (confidence === "high") return `${base} bg-court-live/15 text-court-live`;
  if (confidence === "medium") return `${base} bg-court-accent/15 text-court-accent`;
  return `${base} bg-court-card text-court-muted`;
}

function predictionOutcome(
  prediction: Prediction,
  actualHomeScore: number | undefined,
  actualAwayScore: number | undefined,
  gameStatus: 1 | 2 | 3,
) {
  if (gameStatus !== 3 || actualHomeScore == null || actualAwayScore == null) return null;

  const predictedHomeWin = prediction.homeWinProb >= prediction.awayWinProb;
  const actualHomeWon = actualHomeScore > actualAwayScore;
  const correct = predictedHomeWin === actualHomeWon;

  return {
    label: correct ? "Hit" : "Miss",
    className: correct ? "text-court-live" : "text-court-red",
  };
}

function formatNet(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}
