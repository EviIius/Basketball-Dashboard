# Basketball Dashboard

A full-stack NBA analytics dashboard built with Next.js 15, React 19, and TypeScript. Live scoreboard, predictive model, standings, statistical leaders, player search, playoff bracket, and historical team data — all sourced directly from the NBA Stats API.

> How bout them knicks??????

---

## Features

| Tab | What it does |
|-----|-------------|
| **Scores** | Live scoreboard with real-time box scores, per-quarter breakdowns, PBP leaders, and inline win probability for each game |
| **Model Lab** | Pick any two teams and get a win probability, projected score, and driver breakdown. Full backtest with monthly accuracy and Brier score |
| **Season Games** | Browse and filter the full current-season schedule with game-by-game results |
| **Standings** | East/West conference tables with L10 record, streak, home/road split, and games back, including playoff/play-in dividers |
| **Leaders** | Top 25 players across 10 statistical categories (PTS, REB, AST, STL, BLK, FG3M, FG%, and more) |
| **History** | Select any of the 30 NBA teams and browse season-by-season records going back decades. Win/loss chart, scoring trends, and shooting splits |
| **Players** | Search any NBA player (active or historical). Shows bio, career stats by season (regular season + playoffs), and career totals |
| **Bracket** | Live postseason bracket with series scores and win dots per team |

---

## Tech Stack

- **Framework**: Next.js 15.5.19 (App Router, `src/` layout)
- **UI**: React 19, Tailwind CSS v3, Recharts v3, Lucide React icons
- **Data fetching**: SWR v2 (client-side), Next.js Route Handlers (server-side proxy)
- **Language**: TypeScript strict mode

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [balldontlie](https://www.balldontlie.io/) API key (free tier works; used for season game log to power Elo)

### Setup

```bash
git clone https://github.com/jakebrulato/Basketball-Dashboard.git
cd Basketball-Dashboard
npm install
```

Create `.env.local` in the project root:

```env
BALLDONTLIE_API_KEY=your_key_here
```

### Run

```bash
npm run dev      # development server at http://localhost:3000
npm run build    # production build
npm run start    # serve production build
```

---

## Architecture

All NBA API calls are proxied through Next.js API routes running server-side. This avoids CORS issues and keeps headers (including the browser-equivalent `Referer` and `Origin` that the NBA CDN requires) off the client.

```
Browser → SWR hook → /api/... route handler → NBA Stats API / NBA CDN
```

### Why headers matter

NBA Stats API (`stats.nba.com`) and the NBA CDN (Akamai) both require full browser-equivalent headers or they return 403. All NBA fetches share a single header set defined in [`src/lib/nbaHeaders.ts`](src/lib/nbaHeaders.ts):

```
Referer: https://www.nba.com/
Origin: https://www.nba.com
User-Agent: Chrome 124 string
Accept-Language: en-US,en;q=0.9
```

---

## Data Sources

| Source | Used for |
|--------|----------|
| `cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json` | Live scores and game status |
| `cdn.nba.com/static/json/liveData/boxscore/boxscore_{gameId}.json` | Per-player and team box score |
| `stats.nba.com/stats/leaguedashteamstats?MeasureType=Advanced` | Net rating, pace, eFG%, TS%, PIE |
| `stats.nba.com/stats/leaguestandingsv3` | Conference standings with L10, streak, splits |
| `stats.nba.com/stats/leagueleaders` | Statistical leaders by category |
| `stats.nba.com/stats/teamyearbyyearstats` | Historical team season records |
| `stats.nba.com/stats/commonplayoffseries` | Playoff bracket series data |
| `stats.nba.com/stats/leaguegamelog` | Game-by-game scoring for playoff bracket |
| `stats.nba.com/stats/commonallplayers` | Full player index (replaces balldontlie) |
| `stats.nba.com/stats/commonplayerinfo` | Player bio and team info |
| `stats.nba.com/stats/playercareerstats` | Career stats by season |
| `api.balldontlie.io/v1/games` | Season game log for Elo model input |

---

## Predictive Model (Rolling v3)

The model builds a rolling snapshot of every team's state by replaying the season game-by-game in chronological order. Each prediction uses only data available *before* that game — no lookahead.

### Signals and weights

| Signal | Weight | Description |
|--------|--------|-------------|
| Rolling Elo | 38% | K=18 Elo updated after every game, with margin-of-victory multiplier and playoff game boost |
| Opponent-Adjusted Margin | 26% | Season scoring margin adjusted for strength of schedule |
| Recent Form | 16% | Average margin over last 10 games, scaled by games played |
| Venue Split | 10% | Home net rating vs opponent's road net rating |
| Record and Schedule | 8% | Win% difference plus SOS adjustment |
| Head-to-Head | 6% | Season series margin (when games exist) |
| Lifetime Franchise Prior | 5% | Long-run win rate prior (when franchise data is loaded) |

Additional flat adjustments:
- **Home court**: +2.15 pts (skipped for neutral site)
- **Rest edge**: ±0.55 pts/day of rest difference, capped at ±1.65 pts
- **Volatility guardrail**: shrinks margin when combined scoring std dev exceeds 13

Win probability uses a logistic function with scale 6.7 (≈10 pt margin → ~78% win probability).

### Confidence tiers

| Tier | Condition |
|------|-----------|
| High | Both teams 28+ games played, predicted margin ≥ 7 pts |
| Medium | Both teams 8+ games played, margin ≥ 3.5 pts |
| Low | Cold start or narrow margin |

### Backtest

The backtest replays the full current season in order, predicts each game before it's played, then scores accuracy, Brier score, log-loss, and home-team baseline. Results are broken down by month and confidence tier. Available via the **Model Lab** tab or directly at `/api/backtest`.

---

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/live-games` | Today's scoreboard |
| `GET /api/player-leaders/[gameId]` | Box score for a specific game |
| `GET /api/team-advanced?season=` | Advanced stats for all 30 teams |
| `GET /api/standings?season=` | Conference standings |
| `GET /api/leaders?stat=&season=` | Statistical leaders by category |
| `GET /api/team-history/[teamId]` | Historical season records for a team |
| `GET /api/season-games?season=` | Full season game log |
| `GET /api/predict?gameId=&gameDate=&neutral=` | Single-game prediction |
| `GET /api/backtest?season=` | Full-season backtest results |
| `GET /api/bracket?season=` | Playoff bracket series |
| `GET /api/players?search=&season=` | Player search (min 2 chars) |
| `GET /api/player-stats/[playerId]` | Player bio, career, and per-season stats |

---

## Key Files

```
src/
├── lib/
│   ├── nbaHeaders.ts       # Shared NBA API headers
│   ├── nbaTeams.ts         # Static 30-team list with IDs, tricodes, colors
│   ├── types.ts            # All TypeScript interfaces
│   ├── season.ts           # currentSeason(), fetchSeasonGames(), game filters
│   ├── predict.ts          # Rolling model: buildTeamState, predict, backtest
│   └── elo.ts              # Elo utilities
├── app/
│   ├── page.tsx            # Root layout with 8-tab nav (max-width 1500px)
│   └── api/                # All NBA proxy route handlers
└── components/
    ├── LiveGamesPanel.tsx      # Scores tab with SWR 30s refresh
    ├── GameCard.tsx            # Click-to-expand box score + inline prediction
    ├── BoxScorePanel.tsx       # Sortable player table + team stat bars
    ├── PredictionWidget.tsx    # Win% bar shown per game card
    ├── PredictorPanel.tsx      # Model Lab: team picker, backtest section
    ├── SeasonGamesPanel.tsx    # Season Games feed
    ├── StandingsPanel.tsx      # East/West conference tables
    ├── LeadersPanel.tsx        # 10-category stat leaders
    ├── HistoricalStatsPanel.tsx # Team history with 3 chart modes
    ├── WinsChart.tsx           # Recharts line chart for history
    ├── PlayerSearchPanel.tsx   # Player search + profile
    ├── PlayoffBracket.tsx      # 4-round bracket layout
    └── TeamSelector.tsx        # Shared team picker component
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BALLDONTLIE_API_KEY` | Yes | Used for season game log (Elo model input) |

---

## Notes

- The NBA Stats API does not require authentication but does require browser-equivalent headers. Requests without them return 403.
- Live scores refresh every 30 seconds via SWR. Advanced stats and standings cache server-side for 30 minutes. Player data caches for 1 hour.
- The predictive model runs entirely server-side in memory. Backtest results are cached for 1 hour to avoid replaying 1,200+ games on every request.
- Player search now uses `stats.nba.com/commonallplayers` instead of balldontlie, which eliminates rate limit issues for player lookups.
