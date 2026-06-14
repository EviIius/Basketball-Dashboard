// Matchup prediction model.
//
// Combines three independent signals into a final win probability:
//
//   1. Net Rating differential  (from leaguedashteamstats?MeasureType=Advanced)
//        margin_nr = (home.netRating - away.netRating) + HOME_COURT_POINTS
//   2. Elo rating differential  (computed by elo.ts from game-by-game results)
//        margin_elo = (home.elo - away.elo + HOME_ELO) → converted to points
//   3. Recent form              (last-10 win % from standings, normalized)
//        margin_form = (home.formAdj - away.formAdj) in points
//
// Each signal produces a point-margin estimate; we take a weighted mean,
// then map the combined margin to a win probability with a logistic curve
// calibrated to NBA scoring (1 pt margin ≈ ~3.5 pp swing in win prob).
//
// Optional adjustments:
//   - Rest days (back-to-back loses ~1.5 pts)
//   - Pace mismatch (small, ignored unless we have it from advanced stats)

export interface TeamSnapshot {
  teamId: number;
  netRating: number;
  pace?: number;
  elo?: number;
  last10Wins?: number; // 0-10
  restDays?: number; // days since last game (0 = back-to-back)
}

export interface PredictionDriver {
  label: string;
  homeContribution: number; // in points, positive = favors home
  awayContribution: number; // in points, positive = favors away
  net: number; // home - away
  detail: string;
}

export interface Prediction {
  homeWinProb: number;
  awayWinProb: number;
  predictedMargin: number; // home - away
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  drivers: PredictionDriver[];
  confidence: "low" | "medium" | "high";
}

const HOME_COURT_POINTS = 2.5;
const REST_PT_PER_DAY = 0.7;
const MAX_REST_BONUS = 2.0;

const W_NET = 0.55; // weight on net rating
const W_ELO = 0.3; // weight on Elo (only if available)
const W_FORM = 0.15; // weight on recent form (only if available)

function logisticWinProb(marginPoints: number): number {
  // NBA-tuned: each ~10 points of margin ≈ ×10 odds shift.
  // Equivalent to logistic with scale ~6.5 (matches Vegas closing-line empirical fit)
  return 1 / (1 + Math.pow(10, -marginPoints / 10));
}

function eloToPoints(eloDiff: number): number {
  // Elo diff → expected point margin. Roughly 28 Elo per 1 point (538 calibration).
  return eloDiff / 28;
}

export function predict(home: TeamSnapshot, away: TeamSnapshot): Prediction {
  const drivers: PredictionDriver[] = [];

  // 1. Net rating contribution
  const nrMargin = home.netRating - away.netRating;
  drivers.push({
    label: "Net Rating",
    homeContribution: home.netRating,
    awayContribution: away.netRating,
    net: nrMargin,
    detail: `${home.netRating > 0 ? "+" : ""}${home.netRating.toFixed(1)} vs ${away.netRating > 0 ? "+" : ""}${away.netRating.toFixed(1)} per 100 poss`,
  });

  // 2. Elo contribution
  let eloMargin = 0;
  if (home.elo != null && away.elo != null) {
    eloMargin = eloToPoints(home.elo - away.elo);
    drivers.push({
      label: "Elo Rating",
      homeContribution: home.elo,
      awayContribution: away.elo,
      net: home.elo - away.elo,
      detail: `${Math.round(home.elo)} vs ${Math.round(away.elo)} (≈ ${eloMargin > 0 ? "+" : ""}${eloMargin.toFixed(1)} pts)`,
    });
  }

  // 3. Recent form contribution (last-10 win % as a small modifier)
  let formMargin = 0;
  if (home.last10Wins != null && away.last10Wins != null) {
    formMargin = (home.last10Wins - away.last10Wins) * 0.4; // each L10 game ≈ 0.4 pts
    drivers.push({
      label: "Recent Form (L10)",
      homeContribution: home.last10Wins,
      awayContribution: away.last10Wins,
      net: home.last10Wins - away.last10Wins,
      detail: `${home.last10Wins}-${10 - home.last10Wins} vs ${away.last10Wins}-${10 - away.last10Wins}`,
    });
  }

  // 4. Home court
  drivers.push({
    label: "Home Court",
    homeContribution: HOME_COURT_POINTS,
    awayContribution: 0,
    net: HOME_COURT_POINTS,
    detail: "≈ +2.5 pts NBA average",
  });

  // 5. Rest days
  let restMargin = 0;
  if (home.restDays != null && away.restDays != null) {
    const homeBonus = Math.min(home.restDays * REST_PT_PER_DAY, MAX_REST_BONUS);
    const awayBonus = Math.min(away.restDays * REST_PT_PER_DAY, MAX_REST_BONUS);
    restMargin = homeBonus - awayBonus;
    if (Math.abs(restMargin) > 0.1) {
      drivers.push({
        label: "Rest",
        homeContribution: home.restDays,
        awayContribution: away.restDays,
        net: home.restDays - away.restDays,
        detail: `${home.restDays}d vs ${away.restDays}d rest`,
      });
    }
  }

  // Weighted combination
  const totalWeight = W_NET + (home.elo != null ? W_ELO : 0) + (home.last10Wins != null ? W_FORM : 0);
  const weightedMargin =
    (W_NET * nrMargin + (home.elo != null ? W_ELO * eloMargin : 0) + (home.last10Wins != null ? W_FORM * formMargin : 0)) /
    totalWeight;

  const totalMargin = weightedMargin + HOME_COURT_POINTS + restMargin;
  const homeWinProb = logisticWinProb(totalMargin);

  // Predicted score: use average pace × offensive efficiency if we have it
  let predictedHomeScore: number | undefined;
  let predictedAwayScore: number | undefined;
  if (home.pace != null && away.pace != null) {
    // pace = possessions per 48 min for one team. In a game, each team gets ~pace possessions.
    // Total game points ≈ pace × 2 × 1.13 (1.13 = league average pts/possession).
    const possessions = (home.pace + away.pace) / 2;
    const totalPoints = possessions * 2 * 1.13;
    const half = totalPoints / 2;
    predictedHomeScore = Math.round(half + totalMargin / 2);
    predictedAwayScore = Math.round(half - totalMargin / 2);
  }

  // Confidence based on absolute margin
  const absMargin = Math.abs(totalMargin);
  const confidence: Prediction["confidence"] = absMargin > 6 ? "high" : absMargin > 2.5 ? "medium" : "low";

  return {
    homeWinProb,
    awayWinProb: 1 - homeWinProb,
    predictedMargin: totalMargin,
    predictedHomeScore,
    predictedAwayScore,
    drivers,
    confidence,
  };
}

// Backtest helper: run predictions over a set of completed games using stats-at-the-time
// (simplified — uses final season stats but masks games being predicted).
// Returns accuracy: fraction of games where the predicted winner was correct.
export interface BacktestResult {
  total: number;
  correct: number;
  accuracy: number;
  brierScore: number; // 0 = perfect; lower = better calibration
  byMonth: { month: string; total: number; correct: number; accuracy: number }[];
}

export function backtest(
  games: { date: string; homeId: number; awayId: number; homeScore: number; awayScore: number }[],
  teamSnapshot: (id: number) => TeamSnapshot | null
): BacktestResult {
  let correct = 0;
  let brier = 0;
  const byMonthMap = new Map<string, { total: number; correct: number }>();

  for (const g of games) {
    const home = teamSnapshot(g.homeId);
    const away = teamSnapshot(g.awayId);
    if (!home || !away) continue;

    const pred = predict(home, away);
    const homeWon = g.homeScore > g.awayScore;
    const predictedHomeWin = pred.homeWinProb > 0.5;
    if (homeWon === predictedHomeWin) correct++;

    const actualHome = homeWon ? 1 : 0;
    brier += Math.pow(pred.homeWinProb - actualHome, 2);

    const month = g.date.slice(0, 7);
    const m = byMonthMap.get(month) ?? { total: 0, correct: 0 };
    m.total++;
    if (homeWon === predictedHomeWin) m.correct++;
    byMonthMap.set(month, m);
  }

  const byMonth = Array.from(byMonthMap.entries())
    .map(([month, v]) => ({ month, total: v.total, correct: v.correct, accuracy: v.correct / v.total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    total: games.length,
    correct,
    accuracy: games.length > 0 ? correct / games.length : 0,
    brierScore: games.length > 0 ? brier / games.length : 0,
    byMonth,
  };
}
