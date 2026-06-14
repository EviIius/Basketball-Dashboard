"use client";

import useSWR from "swr";
import type { Prediction } from "@/lib/predict";
import { TEAM_COLORS } from "@/lib/nbaTeams";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PredictResponse {
  season: string;
  prediction: Prediction;
  home: { netRating: number; elo?: number };
  away: { netRating: number; elo?: number };
  error?: string;
}

interface Props {
  homeId: number;
  awayId: number;
  homeTricode: string;
  awayTricode: string;
  actualHomeScore?: number;
  actualAwayScore?: number;
  gameStatus: 1 | 2 | 3;
}

export default function PredictionWidget({
  homeId,
  awayId,
  homeTricode,
  awayTricode,
  actualHomeScore,
  actualAwayScore,
  gameStatus,
}: Props) {
  const { data, error, isLoading } = useSWR<PredictResponse>(
    `/api/predict?homeId=${homeId}&awayId=${awayId}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-court-border">
        <div className="flex items-center justify-between mb-1">
          <span className="text-court-muted text-[10px] uppercase tracking-wider">Prediction</span>
          <span className="text-court-muted text-[10px]">Loading…</span>
        </div>
        <div className="h-1.5 bg-court-border rounded-full animate-pulse" />
      </div>
    );
  }

  if (error || !data || data.error || !data.prediction) {
    return null;
  }

  const p = data.prediction;
  const homePct = (p.homeWinProb * 100).toFixed(0);
  const awayPct = (p.awayWinProb * 100).toFixed(0);
  const homeColor = TEAM_COLORS[homeTricode]?.primary ?? "#6b7280";
  const awayColor = TEAM_COLORS[awayTricode]?.primary ?? "#6b7280";
  const homeFavorite = p.homeWinProb > 0.5;

  // Was the prediction correct? (only meaningful for finished games)
  const isFinal = gameStatus === 3 && actualHomeScore != null && actualAwayScore != null;
  const actualHomeWon = isFinal && actualHomeScore! > actualAwayScore!;
  const predictionCorrect = isFinal ? actualHomeWon === homeFavorite : null;

  return (
    <div
      className="mt-3 pt-3 border-t border-court-border"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-court-muted text-[10px] uppercase tracking-wider flex items-center gap-1">
          <span>🎯</span>
          Prediction
        </span>
        <span className="flex items-center gap-2 text-[10px]">
          {p.predictedHomeScore != null && p.predictedAwayScore != null && (
            <span className="text-court-muted font-mono">
              {awayTricode} {p.predictedAwayScore} – {p.predictedHomeScore} {homeTricode}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
              p.confidence === "high"
                ? "bg-court-live/20 text-court-live"
                : p.confidence === "medium"
                ? "bg-court-accent/20 text-court-accent"
                : "bg-court-border text-court-muted"
            }`}
          >
            {p.confidence}
          </span>
          {predictionCorrect != null && (
            <span
              title={predictionCorrect ? "Prediction was correct" : "Prediction missed"}
              className={predictionCorrect ? "text-court-live" : "text-red-400"}
            >
              {predictionCorrect ? "✓" : "✗"}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-mono font-bold tabular-nums ${
            !homeFavorite ? "text-white" : "text-court-muted"
          }`}
        >
          {awayPct}%
        </span>
        <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-court-border">
          <div
            className="transition-all"
            style={{
              width: `${awayPct}%`,
              backgroundColor: awayColor,
              opacity: !homeFavorite ? 1 : 0.55,
            }}
          />
          <div
            className="transition-all"
            style={{
              width: `${homePct}%`,
              backgroundColor: homeColor,
              opacity: homeFavorite ? 1 : 0.55,
            }}
          />
        </div>
        <span
          className={`text-xs font-mono font-bold tabular-nums ${
            homeFavorite ? "text-white" : "text-court-muted"
          }`}
        >
          {homePct}%
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-court-muted mt-0.5">
        <span>{awayTricode}</span>
        <span>{homeTricode}</span>
      </div>
    </div>
  );
}
