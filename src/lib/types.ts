// NBA CDN live scoreboard types
export interface NBATeamScore {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
  seed?: number;
  inBonus: string | null;
  timeoutsRemaining: number;
  periods: { period: number; periodType: string; score: number }[];
}

export interface GameLeader {
  personId: number;
  name: string;
  playerSlug: string;
  jerseyNum: string;
  position: string;
  teamTricode: string;
  points: number;
  rebounds: number;
  assists: number;
}

export interface NBAGame {
  gameId: string;
  gameCode: string;
  gameStatus: 1 | 2 | 3; // 1=upcoming, 2=live, 3=final
  gameStatusText: string;
  period: number;
  gameClock: string;
  gameTimeUTC: string;
  gameEt: string;
  regulationPeriods: number;
  ifNecessary: boolean;
  seriesGameNumber: string;
  seriesText: string;
  gameLabel?: string;
  gameSubLabel?: string;
  poRoundDesc?: string;
  homeTeam: NBATeamScore;
  awayTeam: NBATeamScore;
  gameLeaders: {
    homeLeaders: GameLeader;
    awayLeaders: GameLeader;
  };
}

export interface NBAScoreboard {
  gameDate: string;
  leagueId: string;
  leagueName: string;
  games: NBAGame[];
}

// Box score types
export interface BoxPlayerStats {
  assists: number;
  blocks: number;
  fieldGoalsAttempted: number;
  fieldGoalsMade: number;
  fieldGoalsPercentage: number;
  freeThrowsAttempted: number;
  freeThrowsMade: number;
  foulsPersonal: number;
  minus: number;
  plus: number;
  plusMinusPoints: number;
  minutes: string;
  minutesCalculated: string;
  points: number;
  reboundsDefensive: number;
  reboundsOffensive: number;
  reboundsTotal: number;
  steals: number;
  threePointersAttempted: number;
  threePointersMade: number;
  threePointersPercentage: number;
  turnovers: number;
}

export interface BoxPlayer {
  status: string;
  order: number;
  personId: number;
  jerseyNum: string;
  position: string;
  starter: string;
  oncourt: string;
  played: string;
  statistics: BoxPlayerStats;
  name: string;
  nameI: string;
  firstName: string;
  familyName: string;
}

export interface BoxTeamStats {
  assists: number;
  benchPoints: number;
  biggestLead: number;
  biggestScoringRun: number;
  blocks: number;
  fastBreakPointsMade: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  fieldGoalsPercentage: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  freeThrowsPercentage: number;
  leadChanges: number;
  points: number;
  pointsInThePaint: number;
  pointsFastBreak: number;
  pointsFromTurnovers: number;
  pointsSecondChance: number;
  reboundsDefensive: number;
  reboundsOffensive: number;
  reboundsTotal: number;
  steals: number;
  threePointersMade: number;
  threePointersAttempted: number;
  threePointersPercentage: number;
  timesTied: number;
  turnovers: number;
  trueShootingPercentage: number;
}

export interface BoxTeam {
  teamId: number;
  teamName: string;
  teamCity: string;
  teamTricode: string;
  score: number;
  inBonus: string | null;
  timeoutsRemaining: number;
  players: BoxPlayer[];
  statistics: BoxTeamStats;
}

export interface BoxScore {
  gameId: string;
  gameTimeLocal: string;
  gameTimeUTC: string;
  gameEt: string;
  duration: number;
  gameStatusText: string;
  gameStatus: 1 | 2 | 3;
  period: number;
  gameClock: string;
  attendance: number;
  sellout: string;
  arena: {
    arenaId: number;
    arenaName: string;
    arenaCity: string;
    arenaState: string;
    arenaCountry: string;
    arenaTimezone: string;
  };
  officials: { personId: number; name: string; familyName: string; firstName: string; jerseyNum: string; assignment: string }[];
  homeTeam: BoxTeam;
  awayTeam: BoxTeam;
}

// NBA Stats API year-by-year (per game)
export interface TeamSeasonRecord {
  season: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winPct: number;
  confRank: number;
  divRank: number;
  playoffWins: number;
  playoffLosses: number;
  finalsAppearance: string; // "FINALS WON" | "FINALS APPEARANCE" | "N/A"
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  ptsRank: number;
}

export interface TeamYearStats {
  teamId: number;
  seasons: TeamSeasonRecord[];
}

// UI state
export type Tab = "live" | "history";

export interface NBAStaticTeam {
  id: number;
  city: string;
  name: string;
  tricode: string;
  conference: string;
  division: string;
}
