import { NBA_CDN_HEADERS, NBA_STATS_HEADERS } from "./nbaHeaders";

export type SeasonGameType = "preseason" | "regular" | "play-in" | "playoffs" | "other";
export type SeasonGameStatus = "scheduled" | "live" | "final";

export interface SeasonTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins: number;
  losses: number;
  score: number;
}

export interface SeasonGame {
  gameId: string;
  gameCode: string;
  gameDate: string;
  gameDateTimeUTC: string;
  gameDateTimeET: string;
  status: SeasonGameStatus;
  statusText: string;
  gameType: SeasonGameType;
  gameLabel: string;
  gameSubLabel: string;
  seriesText: string;
  arenaName: string;
  arenaCity: string;
  arenaState: string;
  neutralSite: boolean;
  homeTeam: SeasonTeam;
  awayTeam: SeasonTeam;
}

interface NbaScheduleTeam {
  teamId: number;
  teamCity: string;
  teamName: string;
  teamTricode: string;
  wins?: number;
  losses?: number;
  score?: number;
}

interface NbaScheduleGame {
  gameId: string;
  gameCode: string;
  gameStatus: number;
  gameStatusText: string;
  gameDateEst: string;
  gameDateTimeEst: string;
  gameDateTimeUTC: string;
  gameLabel?: string;
  gameSubLabel?: string;
  seriesText?: string;
  arenaName?: string;
  arenaCity?: string;
  arenaState?: string;
  isNeutral?: boolean;
  homeTeam: NbaScheduleTeam;
  awayTeam: NbaScheduleTeam;
}

interface NbaScheduleDate {
  games: NbaScheduleGame[];
}

interface NbaScheduleResponse {
  leagueSchedule?: {
    seasonYear?: string | number;
    gameDates?: NbaScheduleDate[];
  };
}

const NBA_CURRENT_SCHEDULE_URL =
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json";
const NBA_CURRENT_SCHEDULE_FALLBACK_URL =
  "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json";

export function currentSeason(today = new Date()): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  const start = month >= 9 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function seasonStartYear(season: string): number {
  const year = Number(season.slice(0, 4));
  return Number.isFinite(year) ? year : Number(currentSeason().slice(0, 4));
}

function gameTypeFromId(gameId: string): SeasonGameType {
  if (gameId.startsWith("001")) return "preseason";
  if (gameId.startsWith("002")) return "regular";
  if (gameId.startsWith("004")) return "playoffs";
  if (gameId.startsWith("005")) return "play-in";
  return "other";
}

function statusFromCode(status: number): SeasonGameStatus {
  if (status === 2) return "live";
  if (status === 3) return "final";
  return "scheduled";
}

function normalizeTeam(team: NbaScheduleTeam): SeasonTeam {
  return {
    teamId: team.teamId,
    teamCity: team.teamCity,
    teamName: team.teamName,
    teamTricode: team.teamTricode,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    score: team.score ?? 0,
  };
}

function normalizeScheduleGame(game: NbaScheduleGame): SeasonGame {
  return {
    gameId: game.gameId,
    gameCode: game.gameCode,
    gameDate: (game.gameDateEst || game.gameDateTimeEst || game.gameDateTimeUTC).slice(0, 10),
    gameDateTimeUTC: game.gameDateTimeUTC,
    gameDateTimeET: game.gameDateTimeEst,
    status: statusFromCode(game.gameStatus),
    statusText: game.gameStatusText,
    gameType: gameTypeFromId(game.gameId),
    gameLabel: game.gameLabel ?? "",
    gameSubLabel: game.gameSubLabel ?? "",
    seriesText: game.seriesText ?? "",
    arenaName: game.arenaName ?? "",
    arenaCity: game.arenaCity ?? "",
    arenaState: game.arenaState ?? "",
    neutralSite: Boolean(game.isNeutral),
    homeTeam: normalizeTeam(game.homeTeam),
    awayTeam: normalizeTeam(game.awayTeam),
  };
}

async function fetchCurrentScheduleJson(): Promise<NbaScheduleResponse> {
  const primary = await fetch(NBA_CURRENT_SCHEDULE_URL, {
    headers: NBA_CDN_HEADERS,
    cache: "no-store",
  });

  if (primary.ok) {
    const primaryJson = await primary.json();
    if (primaryJson.leagueSchedule?.gameDates?.length) {
      return primaryJson;
    }
  }

  const fallback = await fetch(NBA_CURRENT_SCHEDULE_FALLBACK_URL, {
    headers: NBA_CDN_HEADERS,
    cache: "no-store",
  });

  if (!fallback.ok) {
    throw new Error(`NBA schedule returned ${primary.status}/${fallback.status}`);
  }

  return fallback.json();
}

async function fetchCompletedGamesFromStats(season: string): Promise<SeasonGame[]> {
  const url =
    `https://stats.nba.com/stats/leaguegamelog?Counter=1000&DateFrom=&DateTo=` +
    `&Direction=ASC&LeagueID=00&PlayerOrTeam=T&Season=${encodeURIComponent(season)}` +
    `&SeasonType=Regular+Season&Sorter=DATE`;

  const res = await fetch(url, {
    headers: NBA_STATS_HEADERS,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`NBA game log returned ${res.status}`);
  }

  const json = await res.json();
  const set = json.resultSets?.[0];
  if (!set) return [];

  const headers: string[] = set.headers;
  const idx = (name: string) => headers.indexOf(name);
  const cols = {
    gameId: idx("GAME_ID"),
    date: idx("GAME_DATE"),
    matchup: idx("MATCHUP"),
    teamId: idx("TEAM_ID"),
    teamName: idx("TEAM_NAME"),
    tricode: idx("TEAM_ABBREVIATION"),
    pts: idx("PTS"),
    wl: idx("WL"),
  };

  const grouped = new Map<string, unknown[][]>();
  for (const row of set.rowSet as unknown[][]) {
    const gameId = row[cols.gameId] as string;
    const list = grouped.get(gameId) ?? [];
    list.push(row);
    grouped.set(gameId, list);
  }

  const games: SeasonGame[] = [];
  for (const [gameId, rows] of grouped.entries()) {
    if (rows.length < 2) continue;
    const first = rows[0];
    const second = rows[1];
    const firstMatchup = String(first[cols.matchup] ?? "");
    const homeRow = firstMatchup.includes(" vs. ") ? first : second;
    const awayRow = homeRow === first ? second : first;
    const homeName = String(homeRow[cols.teamName] ?? "");
    const awayName = String(awayRow[cols.teamName] ?? "");
    const gameDate = String(homeRow[cols.date] ?? "").slice(0, 10);

    games.push({
      gameId,
      gameCode: "",
      gameDate,
      gameDateTimeUTC: `${gameDate}T17:00:00Z`,
      gameDateTimeET: `${gameDate}T12:00:00Z`,
      status: "final",
      statusText: "Final",
      gameType: "regular",
      gameLabel: "Regular Season",
      gameSubLabel: "",
      seriesText: "",
      arenaName: "",
      arenaCity: "",
      arenaState: "",
      neutralSite: false,
      homeTeam: {
        teamId: homeRow[cols.teamId] as number,
        teamCity: homeName,
        teamName: "",
        teamTricode: homeRow[cols.tricode] as string,
        wins: homeRow[cols.wl] === "W" ? 1 : 0,
        losses: homeRow[cols.wl] === "L" ? 1 : 0,
        score: homeRow[cols.pts] as number,
      },
      awayTeam: {
        teamId: awayRow[cols.teamId] as number,
        teamCity: awayName,
        teamName: "",
        teamTricode: awayRow[cols.tricode] as string,
        wins: awayRow[cols.wl] === "W" ? 1 : 0,
        losses: awayRow[cols.wl] === "L" ? 1 : 0,
        score: awayRow[cols.pts] as number,
      },
    });
  }

  return games.sort((a, b) => a.gameDateTimeUTC.localeCompare(b.gameDateTimeUTC));
}

export async function fetchSeasonGames(season = currentSeason()): Promise<SeasonGame[]> {
  const requestedStart = seasonStartYear(season);
  const schedule = await fetchCurrentScheduleJson();
  const rawScheduleSeason = schedule.leagueSchedule?.seasonYear;
  const scheduleStart =
    typeof rawScheduleSeason === "string" && rawScheduleSeason.includes("-")
      ? seasonStartYear(rawScheduleSeason)
      : Number(rawScheduleSeason);

  if (scheduleStart === requestedStart && schedule.leagueSchedule?.gameDates) {
    return schedule.leagueSchedule.gameDates
      .flatMap((date) => date.games)
      .map(normalizeScheduleGame)
      .sort((a, b) => a.gameDateTimeUTC.localeCompare(b.gameDateTimeUTC));
  }

  return fetchCompletedGamesFromStats(season);
}

export function isModelEligibleGame(game: SeasonGame): boolean {
  return game.gameType !== "preseason" && game.gameType !== "other";
}

export function isCompletedModelGame(game: SeasonGame): boolean {
  return (
    isModelEligibleGame(game) &&
    game.status === "final" &&
    Number.isFinite(game.homeTeam.score) &&
    Number.isFinite(game.awayTeam.score) &&
    game.homeTeam.score !== game.awayTeam.score
  );
}
