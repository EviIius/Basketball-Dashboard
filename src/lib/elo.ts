// Elo ratings for NBA teams.
// Standard Elo with NBA-tuned constants:
//   K-factor = 20 (slightly slower than chess to dampen flukes)
//   Home court bonus = 100 Elo points (~ 3 pts, ~ 65% home win baseline)
//   Margin-of-victory multiplier scales K by log(margin+1) for blowouts
//
// Season reset: regress to the mean (1500) by 25% at the start of each season,
// so prior-year strength carries over but doesn't dominate.

export interface EloGame {
  date: string;
  homeId: number;
  homeAbbr: string;
  homeScore: number;
  awayId: number;
  awayAbbr: string;
  awayScore: number;
  postseason: boolean;
}

export interface EloRating {
  teamId: number;
  rating: number;
  games: number;
}

const INITIAL_RATING = 1500;
const K_FACTOR = 20;
const HOME_BONUS = 100;

function expectedScore(rA: number, rB: number, homeAdvA: number): number {
  return 1 / (1 + Math.pow(10, -(rA + homeAdvA - rB) / 400));
}

function movMultiplier(margin: number, eloDiff: number): number {
  // 538-style margin multiplier; rewards wins by more, penalizes upsets less
  return Math.log(Math.abs(margin) + 1) * (2.2 / (eloDiff * 0.001 + 2.2));
}

export interface EloHistory {
  finalRatings: Map<number, EloRating>;
  history: { date: string; ratings: Map<number, number> }[];
}

export function computeElo(
  games: EloGame[],
  seedRatings?: Map<number, number>,
  options: { trackHistory?: boolean; seasonStart?: string } = {}
): EloHistory {
  const ratings = new Map<number, EloRating>();
  const history: { date: string; ratings: Map<number, number> }[] = [];

  // Season-start regression to mean if we have seed ratings
  if (seedRatings) {
    for (const [id, prev] of seedRatings.entries()) {
      ratings.set(id, {
        teamId: id,
        rating: prev * 0.75 + INITIAL_RATING * 0.25,
        games: 0,
      });
    }
  }

  for (const g of games) {
    const home = ratings.get(g.homeId) ?? { teamId: g.homeId, rating: INITIAL_RATING, games: 0 };
    const away = ratings.get(g.awayId) ?? { teamId: g.awayId, rating: INITIAL_RATING, games: 0 };

    const margin = g.homeScore - g.awayScore;
    if (margin === 0) continue;

    const expectedHome = expectedScore(home.rating, away.rating, HOME_BONUS);
    const actualHome = margin > 0 ? 1 : 0;

    const eloDiff = (home.rating + HOME_BONUS - away.rating) * (margin > 0 ? 1 : -1);
    const mov = movMultiplier(margin, eloDiff);

    const k = K_FACTOR * mov;
    const delta = k * (actualHome - expectedHome);

    home.rating += delta;
    away.rating -= delta;
    home.games += 1;
    away.games += 1;

    ratings.set(g.homeId, home);
    ratings.set(g.awayId, away);

    if (options.trackHistory) {
      const snapshot = new Map<number, number>();
      for (const [id, r] of ratings.entries()) snapshot.set(id, r.rating);
      history.push({ date: g.date, ratings: snapshot });
    }
  }

  return { finalRatings: ratings, history };
}

export function eloWinProb(ratingHome: number, ratingAway: number, homeCourt = true): number {
  return expectedScore(ratingHome, ratingAway, homeCourt ? HOME_BONUS : 0);
}
