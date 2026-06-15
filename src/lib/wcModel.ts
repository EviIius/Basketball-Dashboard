export interface WCTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface WCMatch {
  id: number;
  utcDate: string;
  status: "live" | "upcoming" | "finished" | "other";
  minute: number | null;
  injuryTime: number | null;
  venue: string | null;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: WCTeam;
  awayTeam: WCTeam;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: "home" | "away" | "draw" | null;
}

export interface StandingRow {
  position: number;
  team: WCTeam;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface Standing {
  stage: string;
  type: string;
  group: string | null;
  table: StandingRow[];
}

export interface TeamSignal {
  team: WCTeam;
  rating: number;
  baseline: number;
  form: number;
  playedGames: number;
  points: number;
  goalDifference: number;
}

export interface WCMatchPrediction {
  match: WCMatch;
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  knockoutHomeWinProb: number;
  knockoutAwayWinProb: number;
  predictedWinner: WCTeam;
  predictedWinnerSide: "home" | "away";
  confidence: "high" | "medium" | "low";
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  expectedGoalDiff: number;
  model: {
    homeSignal: TeamSignal;
    awaySignal: TeamSignal;
    ratingGap: number;
    liveAdjustment: number;
    drivers: { label: string; value: string; detail: string; edge: "home" | "away" | "neutral" }[];
  };
}

const DEFAULT_BASELINE = 1660;

const BASELINE_RATINGS: Record<string, number> = {
  ARG: 1970,
  FRA: 1960,
  ESP: 1935,
  ENG: 1915,
  BRA: 1910,
  POR: 1895,
  NED: 1885,
  BEL: 1865,
  GER: 1855,
  CRO: 1840,
  URY: 1830,
  COL: 1815,
  ITA: 1810,
  MAR: 1800,
  USA: 1775,
  MEX: 1765,
  SUI: 1760,
  DEN: 1755,
  JPN: 1750,
  SEN: 1740,
  AUT: 1735,
  IRN: 1725,
  KOR: 1715,
  AUS: 1705,
  CAN: 1700,
  TUR: 1695,
  SCO: 1685,
  NOR: 1680,
  SWE: 1675,
  ECU: 1670,
  PAR: 1668,
  EGY: 1665,
  QAT: 1655,
  KSA: 1648,
  GHA: 1645,
  CIV: 1642,
  ALG: 1640,
  TUN: 1638,
  RSA: 1630,
  NZL: 1625,
  PAN: 1620,
  IRQ: 1615,
  UZB: 1610,
  JOR: 1605,
  CPV: 1600,
  HAI: 1588,
  BIH: 1585,
  COD: 1580,
  CUW: 1568,
  CZE: 1708,
};

const HOST_BOOST = new Set(["USA", "CAN", "MEX"]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function baselineFor(team: WCTeam) {
  return BASELINE_RATINGS[team.tla] ?? DEFAULT_BASELINE;
}

function rowForm(row?: StandingRow) {
  if (!row) return 0;
  const pointsPerGame = row.playedGames ? row.points / row.playedGames : 0;
  const goalDiffPerGame = row.playedGames ? row.goalDifference / row.playedGames : 0;
  const attackPerGame = row.playedGames ? row.goalsFor / row.playedGames : 0;
  const formLetters = row.form ?? "";
  const formBoost = formLetters
    .split("")
    .slice(-3)
    .reduce((sum, result) => sum + (result === "W" ? 10 : result === "D" ? 2 : -8), 0);

  return clamp(pointsPerGame * 24 + goalDiffPerGame * 18 + attackPerGame * 5 + formBoost, -70, 90);
}

export function groupLabel(value: string | null) {
  if (!value) return "Group";
  if (value.startsWith("GROUP_")) return value.replace("GROUP_", "Group ");
  return value;
}

export function buildSignals(standings: Standing[], matches: WCMatch[] = []) {
  const rows = new Map<number, StandingRow>();
  const teams = new Map<number, WCTeam>();

  for (const standing of standings) {
    for (const row of standing.table) {
      rows.set(row.team.id, row);
      teams.set(row.team.id, row.team);
    }
  }

  for (const match of matches) {
    teams.set(match.homeTeam.id, match.homeTeam);
    teams.set(match.awayTeam.id, match.awayTeam);
  }

  const signals = new Map<number, TeamSignal>();
  for (const team of teams.values()) {
    const row = rows.get(team.id);
    const baseline = baselineFor(team) + (HOST_BOOST.has(team.tla) ? 18 : 0);
    const form = rowForm(row);
    signals.set(team.id, {
      team,
      baseline,
      form,
      rating: baseline + form,
      playedGames: row?.playedGames ?? 0,
      points: row?.points ?? 0,
      goalDifference: row?.goalDifference ?? 0,
    });
  }

  return signals;
}

function fallbackSignal(team: WCTeam): TeamSignal {
  const baseline = baselineFor(team) + (HOST_BOOST.has(team.tla) ? 18 : 0);
  return {
    team,
    baseline,
    form: 0,
    rating: baseline,
    playedGames: 0,
    points: 0,
    goalDifference: 0,
  };
}

function liveAdjustment(match: WCMatch) {
  if (match.status !== "live") return 0;
  const margin = (match.homeScore ?? 0) - (match.awayScore ?? 0);
  const elapsed = clamp((match.minute ?? 45) / 90, 0.08, 0.98);
  return margin * (95 + elapsed * 145);
}

function drawProbability(ratingGap: number, match: WCMatch) {
  if (match.status === "live") {
    const margin = Math.abs((match.homeScore ?? 0) - (match.awayScore ?? 0));
    const elapsed = clamp((match.minute ?? 45) / 90, 0.08, 0.98);
    return clamp(0.3 - margin * 0.1 - elapsed * 0.08, 0.04, 0.28);
  }

  const gapPenalty = Math.min(Math.abs(ratingGap) / 900, 0.16);
  return clamp(0.27 - gapPenalty, 0.12, 0.29);
}

function confidenceFrom(maxProb: number, gap: number): WCMatchPrediction["confidence"] {
  if (maxProb >= 0.64 || Math.abs(gap) >= 185) return "high";
  if (maxProb >= 0.54 || Math.abs(gap) >= 85) return "medium";
  return "low";
}

export function predictMatch(match: WCMatch, signals: Map<number, TeamSignal>): WCMatchPrediction {
  const homeSignal = signals.get(match.homeTeam.id) ?? fallbackSignal(match.homeTeam);
  const awaySignal = signals.get(match.awayTeam.id) ?? fallbackSignal(match.awayTeam);
  const live = liveAdjustment(match);
  const homeVenue = HOST_BOOST.has(match.homeTeam.tla) ? 14 : 0;
  const awayVenue = HOST_BOOST.has(match.awayTeam.tla) ? 14 : 0;
  const ratingGap = homeSignal.rating - awaySignal.rating + homeVenue - awayVenue + live;
  const noDrawHome = logistic(ratingGap / 235);
  const draw = drawProbability(ratingGap, match);
  const homeWinProb = clamp(noDrawHome * (1 - draw), 0.02, 0.94);
  const awayWinProb = clamp((1 - noDrawHome) * (1 - draw), 0.02, 0.94);
  const total = homeWinProb + draw + awayWinProb;
  const normalizedHome = homeWinProb / total;
  const normalizedDraw = draw / total;
  const normalizedAway = awayWinProb / total;
  const knockoutHome = normalizedHome / (normalizedHome + normalizedAway);
  const knockoutAway = normalizedAway / (normalizedHome + normalizedAway);
  const predictedWinnerSide = knockoutHome >= knockoutAway ? "home" : "away";
  const expectedGoalDiff = ratingGap / 235;
  const expectedHomeGoals = clamp(1.35 + expectedGoalDiff * 0.34, 0.35, 3.7);
  const expectedAwayGoals = clamp(1.35 - expectedGoalDiff * 0.34, 0.35, 3.7);

  const drivers: WCMatchPrediction["model"]["drivers"] = [
    {
      label: "Lifetime strength",
      value: `${Math.round(homeSignal.baseline)}-${Math.round(awaySignal.baseline)}`,
      detail: "Country baseline from long-run international strength.",
      edge: homeSignal.baseline === awaySignal.baseline ? "neutral" : homeSignal.baseline > awaySignal.baseline ? "home" : "away",
    },
    {
      label: "Tournament form",
      value: `${homeSignal.points} pts / ${awaySignal.points} pts`,
      detail: `${homeSignal.team.tla} GD ${homeSignal.goalDifference}, ${awaySignal.team.tla} GD ${awaySignal.goalDifference}.`,
      edge: homeSignal.form === awaySignal.form ? "neutral" : homeSignal.form > awaySignal.form ? "home" : "away",
    },
    {
      label: "Real-time state",
      value: match.status === "live" ? `${match.homeScore ?? 0}-${match.awayScore ?? 0}` : "Pre-match",
      detail: match.status === "live" ? `Live score and minute add ${Math.round(live)} rating points.` : "No live-score adjustment yet.",
      edge: live === 0 ? "neutral" : live > 0 ? "home" : "away",
    },
  ];

  return {
    match,
    homeWinProb: normalizedHome,
    drawProb: normalizedDraw,
    awayWinProb: normalizedAway,
    knockoutHomeWinProb: knockoutHome,
    knockoutAwayWinProb: knockoutAway,
    predictedWinner: predictedWinnerSide === "home" ? match.homeTeam : match.awayTeam,
    predictedWinnerSide,
    confidence: confidenceFrom(Math.max(knockoutHome, knockoutAway), ratingGap),
    expectedHomeGoals,
    expectedAwayGoals,
    expectedGoalDiff,
    model: {
      homeSignal,
      awaySignal,
      ratingGap,
      liveAdjustment: live,
      drivers,
    },
  };
}

export function sortStandingRows(rows: StandingRow[]) {
  return rows
    .slice()
    .sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      a.team.name.localeCompare(b.team.name),
    );
}
