"use client";

import { useState } from "react";
import useSWR from "swr";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import TeamSelector from "./TeamSelector";
import type { NBAStaticTeam } from "@/lib/types";
import type { Prediction, PredictionDriver } from "@/lib/predict";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PredictResponse {
  season: string;
  prediction: Prediction;
  home: { netRating: number; pace?: number; elo?: number; last10Wins?: number };
  away: { netRating: number; pace?: number; elo?: number; last10Wins?: number };
  error?: string;
}

interface BacktestResponse {
  season: string;
  total: number;
  correct: number;
  accuracy: number;
  brierScore: number;
  byMonth: { month: string; total: number; correct: number; accuracy: number; brier: number }[];
  sampleGames: { date: string; away: string; home: string; predHomeWin: number; actualHome: number; actualAway: number; correct: boolean }[];
  error?: string;
}

function DriverRow({ d, awayColor, homeColor }: { d: PredictionDriver; awayColor: string; homeColor: string }) {
  const favorsHome = d.net > 0;
  const absNet = Math.abs(d.net);
  const max = Math.max(absNet, 0.5);
  const pct = Math.min(100, (absNet / max) * 100);
  return (
    <div className="py-2 border-b border-court-border/40 last:border-b-0">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white font-semibold">{d.label}</span>
        <span className="text-court-muted text-[11px]">{d.detail}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex justify-end">
          {!favorsHome && (
            <div
              className="h-1.5 rounded-l-full"
              style={{ width: `${pct}%`, backgroundColor: awayColor }}
            />
          )}
        </div>
        <div className="w-px h-3 bg-court-border" />
        <div className="flex-1 flex">
          {favorsHome && (
            <div
              className="h-1.5 rounded-r-full"
              style={{ width: `${pct}%`, backgroundColor: homeColor }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PredictorPanel() {
  const [home, setHome] = useState<NBAStaticTeam>(
    NBA_TEAMS.find((t) => t.tricode === "BOS") ?? NBA_TEAMS[0]
  );
  const [away, setAway] = useState<NBAStaticTeam>(
    NBA_TEAMS.find((t) => t.tricode === "NYK") ?? NBA_TEAMS[1]
  );
  const [pickingFor, setPickingFor] = useState<"home" | "away" | null>(null);
  const [showBacktest, setShowBacktest] = useState(false);

  const { data: pred, isLoading } = useSWR<PredictResponse>(
    `/api/predict?homeId=${home.id}&awayId=${away.id}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: bt, isLoading: btLoading } = useSWR<BacktestResponse>(
    showBacktest ? `/api/backtest?season=2024-25` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  const homeColor = TEAM_COLORS[home.tricode]?.primary ?? "#6b7280";
  const awayColor = TEAM_COLORS[away.tricode]?.primary ?? "#6b7280";

  const swap = () => {
    const t = home;
    setHome(away);
    setAway(t);
  };

  const prediction = pred?.prediction;

  return (
    <div className="space-y-6">
      {/* Matchup picker */}
      <div className="bg-court-card border border-court-border rounded-xl p-5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
          {/* Away */}
          <button
            onClick={() => setPickingFor("away")}
            className="flex flex-col items-center sm:items-end gap-2 group p-3 rounded-lg hover:bg-court-surface transition-colors"
          >
            <div className="text-court-muted text-[10px] uppercase tracking-wider">Away</div>
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-sm"
              style={{ backgroundColor: awayColor }}
            >
              {away.tricode}
            </div>
            <div className="text-white font-bold text-sm">{away.city}</div>
            <div className="text-court-muted text-xs">{away.name}</div>
          </button>

          {/* VS / swap */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-court-muted text-xs">vs</span>
            <button
              onClick={swap}
              title="Swap home/away"
              className="text-court-muted hover:text-court-accent text-lg transition-colors"
            >
              ⇄
            </button>
          </div>

          {/* Home */}
          <button
            onClick={() => setPickingFor("home")}
            className="flex flex-col items-center sm:items-start gap-2 group p-3 rounded-lg hover:bg-court-surface transition-colors"
          >
            <div className="text-court-muted text-[10px] uppercase tracking-wider">
              Home <span className="text-court-accent">●</span>
            </div>
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-sm"
              style={{ backgroundColor: homeColor }}
            >
              {home.tricode}
            </div>
            <div className="text-white font-bold text-sm">{home.city}</div>
            <div className="text-court-muted text-xs">{home.name}</div>
          </button>
        </div>
      </div>

      {/* Picker overlay */}
      {pickingFor && (
        <div className="bg-court-card border border-court-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">
              Pick {pickingFor === "home" ? "home team" : "away team"}
            </h3>
            <button
              onClick={() => setPickingFor(null)}
              className="text-court-muted hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
          <TeamSelector
            selected={pickingFor === "home" ? home : away}
            onChange={(t) => {
              if (pickingFor === "home") setHome(t);
              else setAway(t);
              setPickingFor(null);
            }}
          />
        </div>
      )}

      {/* Prediction result */}
      {isLoading && (
        <div className="bg-court-card border border-court-border rounded-xl p-6 text-center text-court-muted text-sm">
          Computing prediction…
        </div>
      )}

      {!isLoading && pred?.error && (
        <div className="bg-court-card border border-court-border rounded-xl p-6 text-center text-court-muted text-sm">
          {pred.error}
        </div>
      )}

      {prediction && (
        <div className="bg-court-card border border-court-border rounded-xl p-5">
          <div className="text-court-muted text-xs uppercase tracking-wider mb-3">
            Predicted Win Probability
          </div>

          {/* Big probability bar */}
          <div className="flex items-center gap-3 mb-2">
            <div className="text-right">
              <div className="text-white text-2xl font-black tabular-nums leading-none">
                {(prediction.awayWinProb * 100).toFixed(0)}%
              </div>
              <div className="text-court-muted text-xs mt-1">{away.tricode}</div>
            </div>
            <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-court-border">
              <div
                style={{
                  width: `${prediction.awayWinProb * 100}%`,
                  backgroundColor: awayColor,
                  opacity: prediction.awayWinProb > 0.5 ? 1 : 0.55,
                }}
              />
              <div
                style={{
                  width: `${prediction.homeWinProb * 100}%`,
                  backgroundColor: homeColor,
                  opacity: prediction.homeWinProb > 0.5 ? 1 : 0.55,
                }}
              />
            </div>
            <div className="text-left">
              <div className="text-white text-2xl font-black tabular-nums leading-none">
                {(prediction.homeWinProb * 100).toFixed(0)}%
              </div>
              <div className="text-court-muted text-xs mt-1">{home.tricode}</div>
            </div>
          </div>

          {/* Predicted score */}
          {prediction.predictedHomeScore != null && prediction.predictedAwayScore != null && (
            <div className="text-center mt-4 pt-4 border-t border-court-border">
              <div className="text-court-muted text-xs mb-1">Projected Score</div>
              <div className="text-white text-xl font-bold tabular-nums">
                <span style={{ color: awayColor }}>{away.tricode}</span>{" "}
                {prediction.predictedAwayScore} – {prediction.predictedHomeScore}{" "}
                <span style={{ color: homeColor }}>{home.tricode}</span>
              </div>
              <div className="text-court-muted text-xs mt-1">
                Margin: {prediction.predictedMargin > 0 ? "+" : ""}
                {prediction.predictedMargin.toFixed(1)} pts (home)
                {" · "}
                <span
                  className={
                    prediction.confidence === "high"
                      ? "text-court-live"
                      : prediction.confidence === "medium"
                      ? "text-court-accent"
                      : "text-court-muted"
                  }
                >
                  {prediction.confidence} confidence
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Driver breakdown */}
      {prediction && (
        <div className="bg-court-card border border-court-border rounded-xl p-5">
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
            <span>📊</span> What's Driving This Prediction
          </h3>
          <div className="text-court-muted text-xs mb-3">
            Each factor contributes a point margin; the weighted total maps to win probability.
          </div>
          <div>
            {prediction.drivers.map((d) => (
              <DriverRow key={d.label} d={d} awayColor={awayColor} homeColor={homeColor} />
            ))}
          </div>
        </div>
      )}

      {/* Backtest section */}
      <div className="bg-court-card border border-court-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <span>🔬</span> Model Accuracy (Backtest)
          </h3>
          <button
            onClick={() => setShowBacktest((v) => !v)}
            className="text-court-accent text-xs font-semibold hover:underline"
          >
            {showBacktest ? "Hide" : "Run backtest on 2024-25 season"}
          </button>
        </div>
        <div className="text-court-muted text-xs">
          {!showBacktest && "Replays every game from 2024-25, predicting each one using stats and Elo as they stood before that game."}
        </div>

        {showBacktest && btLoading && (
          <div className="mt-4 text-court-muted text-sm text-center py-6">
            Replaying 1,200+ games… (takes ~15s the first time, cached after)
          </div>
        )}

        {showBacktest && bt && !bt.error && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-court-surface rounded-lg p-3 text-center">
                <div className="text-court-muted text-[10px] uppercase tracking-wider">Accuracy</div>
                <div className="text-white text-2xl font-black tabular-nums mt-1">
                  {(bt.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-court-muted text-[10px] mt-1">
                  {bt.correct} / {bt.total} correct
                </div>
              </div>
              <div className="bg-court-surface rounded-lg p-3 text-center">
                <div className="text-court-muted text-[10px] uppercase tracking-wider">Brier Score</div>
                <div className="text-white text-2xl font-black tabular-nums mt-1">
                  {bt.brierScore.toFixed(3)}
                </div>
                <div className="text-court-muted text-[10px] mt-1">lower is better</div>
              </div>
              <div className="bg-court-surface rounded-lg p-3 text-center">
                <div className="text-court-muted text-[10px] uppercase tracking-wider">Baseline</div>
                <div className="text-court-muted text-2xl font-black tabular-nums mt-1">
                  ~58%
                </div>
                <div className="text-court-muted text-[10px] mt-1">picking home team</div>
              </div>
            </div>

            {/* Monthly accuracy */}
            <div>
              <div className="text-court-muted text-xs uppercase tracking-wider mb-2">Monthly Accuracy</div>
              <div className="space-y-1.5">
                {bt.byMonth.map((m) => (
                  <div key={m.month} className="flex items-center gap-2 text-xs">
                    <span className="text-court-muted font-mono w-16">{m.month}</span>
                    <div className="flex-1 h-2 bg-court-border rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${m.accuracy * 100}%`,
                          backgroundColor:
                            m.accuracy > 0.65 ? "#22c55e" : m.accuracy > 0.55 ? "#f97316" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="text-white font-mono w-12 text-right">
                      {(m.accuracy * 100).toFixed(1)}%
                    </span>
                    <span className="text-court-muted text-[10px] w-12 text-right">n={m.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample games */}
            {bt.sampleGames.length > 0 && (
              <div>
                <div className="text-court-muted text-xs uppercase tracking-wider mb-2">
                  Sample Predictions
                </div>
                <div className="space-y-1 text-xs font-mono">
                  {bt.sampleGames.slice(0, 8).map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-court-muted">
                      <span className="w-20">{g.date}</span>
                      <span className="w-32 text-white">
                        {g.away} {g.actualAway} @ {g.home} {g.actualHome}
                      </span>
                      <span>
                        {g.home} {(g.predHomeWin * 100).toFixed(0)}%
                      </span>
                      <span className={g.correct ? "text-court-live ml-auto" : "text-red-400 ml-auto"}>
                        {g.correct ? "✓" : "✗"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showBacktest && bt?.error && (
          <div className="mt-4 text-court-muted text-sm">{bt.error}</div>
        )}
      </div>

      {/* Methodology */}
      <details className="bg-court-card border border-court-border rounded-xl p-5">
        <summary className="text-white font-semibold text-sm cursor-pointer">
          Methodology
        </summary>
        <div className="mt-3 text-court-muted text-xs space-y-2 leading-relaxed">
          <p>
            <strong className="text-white">Net Rating (55%):</strong> Each team's points scored minus
            allowed per 100 possessions, this season. The single best one-number metric for team
            quality.
          </p>
          <p>
            <strong className="text-white">Elo Rating (30%):</strong> Computed from every game played
            this season. Starts at 1500, adjusts after each result with a margin-of-victory
            multiplier and home-court bonus (100 Elo ≈ 65% home win baseline).
          </p>
          <p>
            <strong className="text-white">Recent Form (15%):</strong> Last 10 games win count.
            Reactive to streaks and slumps.
          </p>
          <p>
            <strong className="text-white">Home Court (+2.5 pts):</strong> NBA-historical average.
            Worth roughly ~7 percentage points in win probability.
          </p>
          <p>
            <strong className="text-white">Rest (when known):</strong> ~0.7 points per extra day of
            rest, capped at +2.
          </p>
          <p className="pt-2 border-t border-court-border">
            Each driver produces a point-margin estimate. The weighted sum maps to win probability
            via a logistic curve calibrated to NBA closing-line betting markets (≈ 1 pt of margin →
            3.5 pp swing).
          </p>
        </div>
      </details>
    </div>
  );
}
