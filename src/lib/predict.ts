import type { SeasonGame, SeasonGameType } from "./season";
import { isCompletedModelGame } from "./season";
import type { FranchisePrior } from "./franchise";

export interface TeamSnapshot {
  teamId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  elo: number;
  netRating: number;
  avgFor: number;
  avgAgainst: number;
  recentNet: number;
  recentWins: number;
  last10Wins: number;
  homeNet: number;
  awayNet: number;
  strengthOfSchedule: number;
  marginStdDev: number;
  restDays?: number;
  lastGameDate?: string;
  pace?: number;
}

export interface PredictionDriver {
  label: string;
  homeContribution: number;
  awayContribution: number;
  net: number;
  detail: string;
  weight?: number;
}

export interface Prediction {
  homeWinProb: number;
  awayWinProb: number;
  predictedMargin: number;
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  drivers: PredictionDriver[];
  confidence: "low" | "medium" | "high";
  dataQuality: "cold" | "low" | "medium" | "high";
  modelVersion: string;
}

export interface BacktestGameResult {
  gameId: string;
  date: string;
  away: string;
  home: string;
  predHomeWin: number;
  actualHome: number;
  actualAway: number;
  correct: boolean;
  confidence: Prediction["confidence"];
  margin: number;
}

export interface BacktestResult {
  total: number;
  correct: number;
  accuracy: number;
  brierScore: number;
  logLoss: number;
  homeBaselineAccuracy: number;
  warmupGames: number;
  byMonth: { month: string; total: number; correct: number; accuracy: number; brier: number }[];
  byConfidence: { confidence: Prediction["confidence"]; total: number; correct: number; accuracy: number; brier: number }[];
  calibration: { bucket: string; total: number; expectedHomeWins: number; actualHomeWins: number }[];
  sampleGames: BacktestGameResult[];
}

export interface HeadToHeadSnapshot {
  games: number;
  homeWins: number;
  awayWins: number;
  avgHomeMargin: number;
}

interface TeamAccumulator {
  teamId: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  homeGames: number;
  homePointsFor: number;
  homePointsAgainst: number;
  awayGames: number;
  awayPointsFor: number;
  awayPointsAgainst: number;
  margins: number[];
  recentMargins: number[];
  recentWins: number[];
  opponentRatings: number[];
  elo: number;
  lastGameDate?: string;
}

interface ApplyGameInput {
  gameId: string;
  date: string;
  homeId: number;
  awayId: number;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  neutralSite?: boolean;
  gameType?: SeasonGameType;
}

const MODEL_VERSION = "rolling-elo-team-form-v3";
const INITIAL_ELO = 1500;
const LEAGUE_AVG_SCORE = 114;
const HOME_COURT_POINTS = 2.15;
const HOME_ELO = 65;
const ELO_POINTS = 28;
const REST_POINTS_PER_DAY = 0.55;
const MAX_REST_EDGE = 1.65;
const LOGISTIC_SCALE = 6.7;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeAverage(values: number[], fallback = 0): number {
  if (!values.length) return fallback;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 12;
  const avg = safeAverage(values);
  const variance = safeAverage(values.map((value) => Math.pow(value - avg, 2)));
  return Math.sqrt(variance);
}

function createAccumulator(teamId: number): TeamAccumulator {
  return {
    teamId,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    homeGames: 0,
    homePointsFor: 0,
    homePointsAgainst: 0,
    awayGames: 0,
    awayPointsFor: 0,
    awayPointsAgainst: 0,
    margins: [],
    recentMargins: [],
    recentWins: [],
    opponentRatings: [],
    elo: INITIAL_ELO,
  };
}

function getAccumulator(state: Map<number, TeamAccumulator>, teamId: number): TeamAccumulator {
  const existing = state.get(teamId);
  if (existing) return existing;
  const created = createAccumulator(teamId);
  state.set(teamId, created);
  return created;
}

function expectedElo(homeElo: number, awayElo: number, neutralSite = false): number {
  const homeBoost = neutralSite ? 0 : HOME_ELO;
  return 1 / (1 + Math.pow(10, -((homeElo + homeBoost - awayElo) / 400)));
}

function movMultiplier(margin: number, eloDiff: number): number {
  return Math.log(Math.abs(margin) + 1) * (2.2 / (Math.abs(eloDiff) * 0.001 + 2.2));
}

function restDaysBetween(lastGameDate: string | undefined, targetDate: string | undefined): number | undefined {
  if (!lastGameDate || !targetDate) return undefined;
  const diff = new Date(targetDate).getTime() - new Date(lastGameDate).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.max(0, Math.floor(diff / 86_400_000) - 1);
}

function updateRecent(acc: TeamAccumulator, margin: number): void {
  acc.recentMargins.push(margin);
  acc.recentWins.push(margin > 0 ? 1 : 0);
  if (acc.recentMargins.length > 10) acc.recentMargins.shift();
  if (acc.recentWins.length > 10) acc.recentWins.shift();
}

function applyGame(state: Map<number, TeamAccumulator>, game: ApplyGameInput): void {
  const home = getAccumulator(state, game.homeId);
  const away = getAccumulator(state, game.awayId);
  const homePregameElo = home.elo;
  const awayPregameElo = away.elo;
  const margin = game.homeScore - game.awayScore;
  if (margin === 0) return;

  home.gamesPlayed += 1;
  away.gamesPlayed += 1;
  home.wins += margin > 0 ? 1 : 0;
  home.losses += margin < 0 ? 1 : 0;
  away.wins += margin < 0 ? 1 : 0;
  away.losses += margin > 0 ? 1 : 0;

  home.pointsFor += game.homeScore;
  home.pointsAgainst += game.awayScore;
  away.pointsFor += game.awayScore;
  away.pointsAgainst += game.homeScore;

  home.homeGames += 1;
  home.homePointsFor += game.homeScore;
  home.homePointsAgainst += game.awayScore;
  away.awayGames += 1;
  away.awayPointsFor += game.awayScore;
  away.awayPointsAgainst += game.homeScore;

  home.margins.push(margin);
  away.margins.push(-margin);
  updateRecent(home, margin);
  updateRecent(away, -margin);
  home.opponentRatings.push(awayPregameElo);
  away.opponentRatings.push(homePregameElo);
  home.lastGameDate = game.date;
  away.lastGameDate = game.date;

  const expectedHome = expectedElo(homePregameElo, awayPregameElo, game.neutralSite);
  const actualHome = margin > 0 ? 1 : 0;
  const gameTypeBoost = game.gameType === "playoffs" ? 1.15 : game.gameType === "play-in" ? 1.08 : 1;
  const k = 18 * gameTypeBoost * movMultiplier(margin, homePregameElo + (game.neutralSite ? 0 : HOME_ELO) - awayPregameElo);
  const delta = k * (actualHome - expectedHome);
  home.elo += delta;
  away.elo -= delta;
}

function snapshotFromAccumulator(
  acc: TeamAccumulator | undefined,
  teamId: number,
  targetDate?: string
): TeamSnapshot {
  if (!acc || acc.gamesPlayed === 0) {
    return {
      teamId,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winPct: 0.5,
      elo: acc?.elo ?? INITIAL_ELO,
      netRating: 0,
      avgFor: LEAGUE_AVG_SCORE,
      avgAgainst: LEAGUE_AVG_SCORE,
      recentNet: 0,
      recentWins: 5,
      last10Wins: 5,
      homeNet: 0,
      awayNet: 0,
      strengthOfSchedule: 0,
      marginStdDev: 12,
      restDays: restDaysBetween(acc?.lastGameDate, targetDate),
      lastGameDate: acc?.lastGameDate,
    };
  }

  const avgFor = acc.pointsFor / acc.gamesPlayed;
  const avgAgainst = acc.pointsAgainst / acc.gamesPlayed;
  const homeNet = acc.homeGames > 0 ? acc.homePointsFor / acc.homeGames - acc.homePointsAgainst / acc.homeGames : avgFor - avgAgainst;
  const awayNet = acc.awayGames > 0 ? acc.awayPointsFor / acc.awayGames - acc.awayPointsAgainst / acc.awayGames : avgFor - avgAgainst;
  const recentNet = safeAverage(acc.recentMargins, avgFor - avgAgainst);
  const recentWins = acc.recentWins.reduce((sum, value) => sum + value, 0);
  const strengthOfSchedule = (safeAverage(acc.opponentRatings, INITIAL_ELO) - INITIAL_ELO) / ELO_POINTS;
  const marginStdDev = stdDev(acc.margins);

  return {
    teamId,
    gamesPlayed: acc.gamesPlayed,
    wins: acc.wins,
    losses: acc.losses,
    winPct: acc.wins / acc.gamesPlayed,
    elo: acc.elo,
    netRating: avgFor - avgAgainst,
    avgFor,
    avgAgainst,
    recentNet,
    recentWins,
    last10Wins: recentWins,
    homeNet,
    awayNet,
    strengthOfSchedule,
    marginStdDev,
    restDays: restDaysBetween(acc.lastGameDate, targetDate),
    lastGameDate: acc.lastGameDate,
  };
}

function toApplyGame(game: SeasonGame): ApplyGameInput {
  return {
    gameId: game.gameId,
    date: game.gameDateTimeUTC || `${game.gameDate}T17:00:00Z`,
    homeId: game.homeTeam.teamId,
    awayId: game.awayTeam.teamId,
    homeAbbr: game.homeTeam.teamTricode,
    awayAbbr: game.awayTeam.teamTricode,
    homeScore: game.homeTeam.score,
    awayScore: game.awayTeam.score,
    neutralSite: game.neutralSite,
    gameType: game.gameType,
  };
}

export function buildTeamState(
  games: SeasonGame[],
  options: { beforeDate?: string; excludeGameId?: string } = {}
): Map<number, TeamSnapshot> {
  const state = new Map<number, TeamAccumulator>();
  const sorted = games
    .filter(isCompletedModelGame)
    .filter((game) => game.gameId !== options.excludeGameId)
    .filter((game) => !options.beforeDate || (game.gameDateTimeUTC || game.gameDate).localeCompare(options.beforeDate) < 0)
    .sort((a, b) => (a.gameDateTimeUTC || a.gameDate).localeCompare(b.gameDateTimeUTC || b.gameDate));

  for (const game of sorted) {
    applyGame(state, toApplyGame(game));
  }

  const snapshots = new Map<number, TeamSnapshot>();
  for (const [teamId, acc] of state.entries()) {
    snapshots.set(teamId, snapshotFromAccumulator(acc, teamId, options.beforeDate));
  }

  return snapshots;
}

export function snapshotForTeam(
  state: Map<number, TeamSnapshot>,
  teamId: number,
  targetDate?: string
): TeamSnapshot {
  return (
    state.get(teamId) ?? {
      ...snapshotFromAccumulator(undefined, teamId, targetDate),
      restDays: undefined,
    }
  );
}

export function headToHeadSnapshot(games: SeasonGame[], homeId: number, awayId: number): HeadToHeadSnapshot | undefined {
  const relevant = games.filter((game) => {
    const teams = [game.homeTeam.teamId, game.awayTeam.teamId];
    return isCompletedModelGame(game) && teams.includes(homeId) && teams.includes(awayId);
  });

  if (!relevant.length) return undefined;

  let homeWins = 0;
  let awayWins = 0;
  let marginSum = 0;

  for (const game of relevant) {
    const selectedHomeWasHome = game.homeTeam.teamId === homeId;
    const selectedHomeScore = selectedHomeWasHome ? game.homeTeam.score : game.awayTeam.score;
    const selectedAwayScore = selectedHomeWasHome ? game.awayTeam.score : game.homeTeam.score;
    const margin = selectedHomeScore - selectedAwayScore;
    marginSum += margin;
    if (margin > 0) homeWins += 1;
    else awayWins += 1;
  }

  return {
    games: relevant.length,
    homeWins,
    awayWins,
    avgHomeMargin: marginSum / relevant.length,
  };
}

function logisticWinProb(marginPoints: number): number {
  return 1 / (1 + Math.exp(-marginPoints / LOGISTIC_SCALE));
}

function dataQuality(home: TeamSnapshot, away: TeamSnapshot): Prediction["dataQuality"] {
  const minGames = Math.min(home.gamesPlayed, away.gamesPlayed);
  if (minGames === 0) return "cold";
  if (minGames < 8) return "low";
  if (minGames < 28) return "medium";
  return "high";
}

function contribution(label: string, home: number, away: number, net: number, detail: string, weight?: number): PredictionDriver {
  return {
    label,
    homeContribution: home,
    awayContribution: away,
    net,
    detail,
    weight,
  };
}

export function predict(
  home: TeamSnapshot,
  away: TeamSnapshot,
  options: {
    neutralSite?: boolean;
    headToHead?: HeadToHeadSnapshot;
    homeFranchisePrior?: FranchisePrior;
    awayFranchisePrior?: FranchisePrior;
  } = {}
): Prediction {
  const drivers: PredictionDriver[] = [];
  const minGames = Math.min(home.gamesPlayed, away.gamesPlayed);
  const reliability = clamp(minGames / 30, 0.22, 1);

  const eloPoints = (home.elo - away.elo) / ELO_POINTS;
  const eloContribution = eloPoints * 0.38;
  drivers.push(
    contribution(
      "Rolling Elo",
      home.elo,
      away.elo,
      eloContribution,
      `${Math.round(home.elo)} vs ${Math.round(away.elo)} ratings`,
      0.38
    )
  );

  const adjustedHomeNet = home.netRating + home.strengthOfSchedule;
  const adjustedAwayNet = away.netRating + away.strengthOfSchedule;
  const seasonRaw = adjustedHomeNet - adjustedAwayNet;
  const seasonContribution = seasonRaw * 0.26 * reliability;
  drivers.push(
    contribution(
      "Opponent-Adjusted Margin",
      adjustedHomeNet,
      adjustedAwayNet,
      seasonContribution,
      `${adjustedHomeNet >= 0 ? "+" : ""}${adjustedHomeNet.toFixed(1)} vs ${adjustedAwayNet >= 0 ? "+" : ""}${adjustedAwayNet.toFixed(1)} adjusted pts/game`,
      0.26
    )
  );

  const recentRaw = home.recentNet - away.recentNet;
  const recentContribution = recentRaw * 0.16 * clamp((home.gamesPlayed + away.gamesPlayed) / 36, 0.28, 1);
  const homeRecentLosses = Math.max(0, Math.min(10, home.gamesPlayed) - home.recentWins);
  const awayRecentLosses = Math.max(0, Math.min(10, away.gamesPlayed) - away.recentWins);
  drivers.push(
    contribution(
      "Recent Form",
      home.recentNet,
      away.recentNet,
      recentContribution,
      home.gamesPlayed === 0 || away.gamesPlayed === 0
        ? "cold-start team form"
        : `${home.recentWins}-${homeRecentLosses} vs ${away.recentWins}-${awayRecentLosses} last 10`,
      0.16
    )
  );

  const venueReliability = clamp(Math.min(home.gamesPlayed, away.gamesPlayed) / 24, 0.2, 1);
  const venueRaw = home.homeNet - away.awayNet;
  const venueContribution = venueRaw * 0.1 * venueReliability;
  drivers.push(
    contribution(
      "Venue Split",
      home.homeNet,
      away.awayNet,
      venueContribution,
      `${home.homeNet >= 0 ? "+" : ""}${home.homeNet.toFixed(1)} home vs ${away.awayNet >= 0 ? "+" : ""}${away.awayNet.toFixed(1)} road`,
      0.1
    )
  );

  const recordPoints = (home.winPct - away.winPct) * 8 * reliability;
  const sosPoints = (home.strengthOfSchedule - away.strengthOfSchedule) * 0.35;
  const recordContribution = (recordPoints + sosPoints) * 0.08;
  drivers.push(
    contribution(
      "Record and Schedule",
      home.winPct,
      away.winPct,
      recordContribution,
      `${(home.winPct * 100).toFixed(1)}% vs ${(away.winPct * 100).toFixed(1)}% win rate`,
      0.08
    )
  );

  let totalMargin = drivers.reduce((sum, driver) => sum + driver.net, 0);

  if (options.homeFranchisePrior && options.awayFranchisePrior) {
    const homePrior = options.homeFranchisePrior;
    const awayPrior = options.awayFranchisePrior;
    const lifetimeRaw = homePrior.marginEquivalent - awayPrior.marginEquivalent;
    const lifetimeContribution = lifetimeRaw * 0.5;
    totalMargin += lifetimeContribution;
    drivers.push(
      contribution(
        "Lifetime Franchise Prior",
        homePrior.priorWinPct,
        awayPrior.priorWinPct,
        lifetimeContribution,
        `${(homePrior.priorWinPct * 100).toFixed(1)}% prior (${homePrior.seasons} seasons) vs ${(awayPrior.priorWinPct * 100).toFixed(1)}% prior (${awayPrior.seasons} seasons)`,
        0.05
      )
    );
  }

  if (options.headToHead?.games) {
    const h2hContribution = clamp(options.headToHead.avgHomeMargin, -10, 10) * 0.06 * clamp(options.headToHead.games / 4, 0.35, 1);
    totalMargin += h2hContribution;
    drivers.push(
      contribution(
        "Head-to-Head",
        options.headToHead.homeWins,
        options.headToHead.awayWins,
        h2hContribution,
        `${options.headToHead.homeWins}-${options.headToHead.awayWins}, ${options.headToHead.avgHomeMargin >= 0 ? "+" : ""}${options.headToHead.avgHomeMargin.toFixed(1)} avg margin`,
        0.06
      )
    );
  }

  if (!options.neutralSite) {
    totalMargin += HOME_COURT_POINTS;
    drivers.push(contribution("Home Court", HOME_COURT_POINTS, 0, HOME_COURT_POINTS, "+2.2 points league baseline"));
  }

  if (home.restDays != null && away.restDays != null) {
    const restEdge = clamp(
      (clamp(home.restDays, 0, 4) - clamp(away.restDays, 0, 4)) * REST_POINTS_PER_DAY,
      -MAX_REST_EDGE,
      MAX_REST_EDGE
    );
    if (Math.abs(restEdge) >= 0.15) {
      totalMargin += restEdge;
      drivers.push(contribution("Rest", home.restDays, away.restDays, restEdge, `${home.restDays} vs ${away.restDays} rest days`));
    }
  }

  const preVolatilityMargin = totalMargin;
  const combinedVolatility = (home.marginStdDev + away.marginStdDev) / 2;
  const volatilityShrink = clamp(1 - Math.max(0, combinedVolatility - 13) / 70, 0.82, 1);
  totalMargin *= volatilityShrink;
  const volatilityAdjustment = totalMargin - preVolatilityMargin;
  if (Math.abs(volatilityAdjustment) >= 0.15) {
    drivers.push(
      contribution(
        "Volatility Guardrail",
        home.marginStdDev,
        away.marginStdDev,
        volatilityAdjustment,
        `${combinedVolatility.toFixed(1)} combined margin std dev`,
      )
    );
  }

  const homeWinProb = logisticWinProb(totalMargin);

  const projectedHomeOffense = home.gamesPlayed > 0 || away.gamesPlayed > 0
    ? (home.avgFor + away.avgAgainst) / 2
    : LEAGUE_AVG_SCORE;
  const projectedAwayOffense = away.gamesPlayed > 0 || home.gamesPlayed > 0
    ? (away.avgFor + home.avgAgainst) / 2
    : LEAGUE_AVG_SCORE;
  const projectedTotal = clamp(projectedHomeOffense + projectedAwayOffense, 188, 255);
  const predictedHomeScore = Math.round(projectedTotal / 2 + totalMargin / 2);
  const predictedAwayScore = Math.round(projectedTotal / 2 - totalMargin / 2);

  const quality = dataQuality(home, away);
  const absMargin = Math.abs(totalMargin);
  const confidence: Prediction["confidence"] =
    quality === "high" && absMargin >= 7
      ? "high"
      : quality !== "cold" && absMargin >= 3.5
      ? "medium"
      : "low";

  return {
    homeWinProb,
    awayWinProb: 1 - homeWinProb,
    predictedMargin: totalMargin,
    predictedHomeScore,
    predictedAwayScore,
    drivers,
    confidence,
    dataQuality: quality,
    modelVersion: MODEL_VERSION,
  };
}

function emptyBacktest(): BacktestResult {
  return {
    total: 0,
    correct: 0,
    accuracy: 0,
    brierScore: 0,
    logLoss: 0,
    homeBaselineAccuracy: 0,
    warmupGames: 0,
    byMonth: [],
    byConfidence: [],
    calibration: [],
    sampleGames: [],
  };
}

export function backtest(games: SeasonGame[]): BacktestResult {
  const completed = games
    .filter(isCompletedModelGame)
    .sort((a, b) => (a.gameDateTimeUTC || a.gameDate).localeCompare(b.gameDateTimeUTC || b.gameDate));

  if (!completed.length) return emptyBacktest();

  const state = new Map<number, TeamAccumulator>();
  let correct = 0;
  let homeBaselineCorrect = 0;
  let brier = 0;
  let logLoss = 0;
  let total = 0;
  let warmupGames = 0;

  const byMonthMap = new Map<string, { total: number; correct: number; brier: number }>();
  const byConfidenceMap = new Map<Prediction["confidence"], { total: number; correct: number; brier: number }>();
  const calibrationMap = new Map<string, { total: number; expectedHomeWins: number; actualHomeWins: number }>();
  const auditedGames: BacktestGameResult[] = [];
  const previousGames: SeasonGame[] = [];

  for (const game of completed) {
    const targetDate = game.gameDateTimeUTC || `${game.gameDate}T17:00:00Z`;
    const home = snapshotFromAccumulator(state.get(game.homeTeam.teamId), game.homeTeam.teamId, targetDate);
    const away = snapshotFromAccumulator(state.get(game.awayTeam.teamId), game.awayTeam.teamId, targetDate);
    const h2h = headToHeadSnapshot(previousGames, game.homeTeam.teamId, game.awayTeam.teamId);
    const pred = predict(home, away, { neutralSite: game.neutralSite, headToHead: h2h });
    const homeWon = game.homeTeam.score > game.awayTeam.score;
    const predictedHome = pred.homeWinProb >= 0.5;
    const actual = homeWon ? 1 : 0;
    const clippedProb = clamp(pred.homeWinProb, 0.01, 0.99);
    const gameBrier = Math.pow(pred.homeWinProb - actual, 2);
    const gameCorrect = predictedHome === homeWon;

    total += 1;
    correct += gameCorrect ? 1 : 0;
    homeBaselineCorrect += homeWon ? 1 : 0;
    brier += gameBrier;
    logLoss += -(actual * Math.log(clippedProb) + (1 - actual) * Math.log(1 - clippedProb));
    warmupGames += Math.min(home.gamesPlayed, away.gamesPlayed) < 8 ? 1 : 0;

    const month = game.gameDate.slice(0, 7);
    const monthStats = byMonthMap.get(month) ?? { total: 0, correct: 0, brier: 0 };
    monthStats.total += 1;
    monthStats.correct += gameCorrect ? 1 : 0;
    monthStats.brier += gameBrier;
    byMonthMap.set(month, monthStats);

    const confidenceStats = byConfidenceMap.get(pred.confidence) ?? { total: 0, correct: 0, brier: 0 };
    confidenceStats.total += 1;
    confidenceStats.correct += gameCorrect ? 1 : 0;
    confidenceStats.brier += gameBrier;
    byConfidenceMap.set(pred.confidence, confidenceStats);

    const bucketStart = Math.floor(pred.homeWinProb * 10) * 10;
    const bucket = `${bucketStart}-${bucketStart + 10}%`;
    const bucketStats = calibrationMap.get(bucket) ?? { total: 0, expectedHomeWins: 0, actualHomeWins: 0 };
    bucketStats.total += 1;
    bucketStats.expectedHomeWins += pred.homeWinProb;
    bucketStats.actualHomeWins += actual;
    calibrationMap.set(bucket, bucketStats);

    auditedGames.push({
      gameId: game.gameId,
      date: game.gameDate,
      away: game.awayTeam.teamTricode,
      home: game.homeTeam.teamTricode,
      predHomeWin: pred.homeWinProb,
      actualHome: game.homeTeam.score,
      actualAway: game.awayTeam.score,
      correct: gameCorrect,
      confidence: pred.confidence,
      margin: pred.predictedMargin,
    });

    applyGame(state, toApplyGame(game));
    previousGames.push(game);
  }

  const byMonth = Array.from(byMonthMap.entries())
    .map(([month, value]) => ({
      month,
      total: value.total,
      correct: value.correct,
      accuracy: value.correct / value.total,
      brier: value.brier / value.total,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const byConfidence = (["low", "medium", "high"] as const)
    .map((confidence) => {
      const value = byConfidenceMap.get(confidence) ?? { total: 0, correct: 0, brier: 0 };
      return {
        confidence,
        total: value.total,
        correct: value.correct,
        accuracy: value.total > 0 ? value.correct / value.total : 0,
        brier: value.total > 0 ? value.brier / value.total : 0,
      };
    })
    .filter((row) => row.total > 0);

  const calibration = Array.from(calibrationMap.entries())
    .map(([bucket, value]) => ({
      bucket,
      total: value.total,
      expectedHomeWins: value.expectedHomeWins / value.total,
      actualHomeWins: value.actualHomeWins / value.total,
    }))
    .sort((a, b) => Number(a.bucket.split("-")[0]) - Number(b.bucket.split("-")[0]));

  return {
    total,
    correct,
    accuracy: correct / total,
    brierScore: brier / total,
    logLoss: logLoss / total,
    homeBaselineAccuracy: homeBaselineCorrect / total,
    warmupGames,
    byMonth,
    byConfidence,
    calibration,
    sampleGames: auditedGames.slice(-24).reverse(),
  };
}
