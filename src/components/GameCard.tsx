"use client";

import { useState } from "react";
import type { NBAGame } from "@/lib/types";
import { TEAM_COLORS } from "@/lib/nbaTeams";
import BoxScorePanel from "./BoxScorePanel";
import PredictionWidget from "./PredictionWidget";

function formatClock(clock: string): string {
  const match = clock.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return clock;
  return `${match[1]}:${Math.floor(parseFloat(match[2])).toString().padStart(2, "0")}`;
}

function PeriodLabel({ period, status }: { period: number; status: 1 | 2 | 3 }) {
  if (status === 1) return <span className="text-court-muted text-xs">Upcoming</span>;
  if (status === 3) return <span className="text-court-muted text-xs font-semibold">FINAL</span>;
  if (period <= 4) return <span className="text-court-live text-xs font-bold">Q{period}</span>;
  return <span className="text-court-live text-xs font-bold">OT{period - 4}</span>;
}

interface TeamBlockProps {
  city: string;
  name: string;
  tricode: string;
  score: number;
  wins: number;
  losses: number;
  seed?: number;
  isLeading: boolean;
  gameStatus: 1 | 2 | 3;
  inBonus: string | null;
  timeoutsRemaining: number;
}

function TeamBlock({
  city,
  name,
  tricode,
  score,
  wins,
  losses,
  seed,
  isLeading,
  gameStatus,
  inBonus,
  timeoutsRemaining,
}: TeamBlockProps) {
  const colors = TEAM_COLORS[tricode] ?? { primary: "#6b7280", secondary: "#ffffff" };
  return (
    <div className="flex items-center gap-3 flex-1">
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0 relative"
        style={{ backgroundColor: colors.primary }}
      >
        {tricode}
        {seed != null && seed > 0 && (
          <span className="absolute -top-1 -right-1 bg-court-accent text-court-bg text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
            {seed}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm font-semibold leading-tight truncate">
          {city} {name}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-court-muted">
            {wins}–{losses}
          </span>
          {gameStatus === 2 && (
            <>
              <span className="text-court-border">·</span>
              <span className="flex items-center gap-0.5" title={`${timeoutsRemaining} TOs remaining`}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-1 h-2 rounded-sm ${
                      i < timeoutsRemaining ? "bg-court-muted" : "bg-court-border"
                    }`}
                  />
                ))}
              </span>
              {inBonus === "1" && (
                <span className="text-court-accent text-[10px] font-bold uppercase">Bonus</span>
              )}
            </>
          )}
        </div>
      </div>
      {gameStatus !== 1 && (
        <div
          className={`text-2xl font-black tabular-nums ${
            isLeading ? "text-white" : "text-court-muted"
          }`}
        >
          {score}
        </div>
      )}
    </div>
  );
}

export default function GameCard({ game }: { game: NBAGame }) {
  const [expanded, setExpanded] = useState(false);
  const homeLeads = game.homeTeam.score > game.awayTeam.score;
  const awayLeads = game.awayTeam.score > game.homeTeam.score;
  const isLive = game.gameStatus === 2;
  const isFinal = game.gameStatus === 3;
  const expandable = isLive || isFinal;

  const gameTime = new Date(game.gameTimeUTC).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div
      className={`bg-court-card border rounded-xl transition-all ${
        expandable
          ? "border-court-border hover:border-court-accent/40 cursor-pointer"
          : "border-court-border"
      } ${expanded ? "border-court-accent/60" : ""}`}
    >
      <div
        className="p-4"
        onClick={() => expandable && setExpanded((v) => !v)}
        role={expandable ? "button" : undefined}
      >
        {/* Header: playoff label or live indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {isLive && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-court-live animate-pulse" />
                <span className="text-court-live text-xs font-bold">LIVE</span>
              </span>
            )}
            {game.gameLabel && (
              <span className="text-court-accent text-xs font-bold uppercase tracking-wider truncate">
                {game.gameLabel}
              </span>
            )}
            {game.gameSubLabel && (
              <span className="text-court-muted text-xs truncate">· {game.gameSubLabel}</span>
            )}
            {!game.gameLabel && game.seriesText && (
              <span className="text-court-muted text-xs truncate">{game.seriesText}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <PeriodLabel period={game.period} status={game.gameStatus} />
            {isLive && game.gameClock && (
              <span className="text-court-live font-mono">{formatClock(game.gameClock)}</span>
            )}
            {game.gameStatus === 1 && <span className="text-court-muted">{gameTime}</span>}
          </div>
        </div>

        {/* Series subline when playoff label is shown */}
        {game.gameLabel && game.seriesText && (
          <div className="text-court-muted text-xs mb-3 -mt-1">{game.seriesText}</div>
        )}

        {/* Teams */}
        <div className="space-y-2">
          <TeamBlock
            city={game.awayTeam.teamCity}
            name={game.awayTeam.teamName}
            tricode={game.awayTeam.teamTricode}
            score={game.awayTeam.score}
            wins={game.awayTeam.wins}
            losses={game.awayTeam.losses}
            seed={game.awayTeam.seed}
            isLeading={awayLeads}
            gameStatus={game.gameStatus}
            inBonus={game.awayTeam.inBonus}
            timeoutsRemaining={game.awayTeam.timeoutsRemaining}
          />
          <div className="h-px bg-court-border" />
          <TeamBlock
            city={game.homeTeam.teamCity}
            name={game.homeTeam.teamName}
            tricode={game.homeTeam.teamTricode}
            score={game.homeTeam.score}
            wins={game.homeTeam.wins}
            losses={game.homeTeam.losses}
            seed={game.homeTeam.seed}
            isLeading={homeLeads}
            gameStatus={game.gameStatus}
            inBonus={game.homeTeam.inBonus}
            timeoutsRemaining={game.homeTeam.timeoutsRemaining}
          />
        </div>

        {/* Period scores */}
        {game.gameStatus !== 1 && game.homeTeam.periods?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-court-border">
            <div className="flex gap-1 text-xs font-mono">
              <div className="text-court-muted w-8 flex-shrink-0" />
              {game.homeTeam.periods.map((p) => (
                <div key={p.period} className="text-court-muted w-7 text-center flex-shrink-0">
                  {p.period <= 4 ? `Q${p.period}` : `OT${p.period - 4}`}
                </div>
              ))}
              <div className="text-court-muted w-8 text-center flex-shrink-0 ml-auto">T</div>
            </div>
            <div className="flex gap-1 text-xs font-mono mt-0.5">
              <div className="text-court-muted w-8 flex-shrink-0 font-bold">{game.awayTeam.teamTricode}</div>
              {game.awayTeam.periods.map((p) => (
                <div key={p.period} className="text-white w-7 text-center flex-shrink-0">{p.score}</div>
              ))}
              <div className="text-white w-8 text-center flex-shrink-0 font-bold ml-auto">{game.awayTeam.score}</div>
            </div>
            <div className="flex gap-1 text-xs font-mono mt-0.5">
              <div className="text-court-muted w-8 flex-shrink-0 font-bold">{game.homeTeam.teamTricode}</div>
              {game.homeTeam.periods.map((p) => (
                <div key={p.period} className="text-white w-7 text-center flex-shrink-0">{p.score}</div>
              ))}
              <div className="text-white w-8 text-center flex-shrink-0 font-bold ml-auto">{game.homeTeam.score}</div>
            </div>
          </div>
        )}

        {/* Game leaders (compact, when collapsed) */}
        {game.gameStatus !== 1 && game.gameLeaders?.homeLeaders?.name && !expanded && (
          <div className="mt-3 pt-3 border-t border-court-border grid grid-cols-2 gap-3">
            {[
              { side: "away", leader: game.gameLeaders.awayLeaders, tricode: game.awayTeam.teamTricode },
              { side: "home", leader: game.gameLeaders.homeLeaders, tricode: game.homeTeam.teamTricode },
            ].map(({ side, leader, tricode }) => (
              <div key={side} className={side === "home" ? "text-right" : ""}>
                <div className="text-court-muted text-[10px] uppercase tracking-wider mb-0.5">
                  {tricode} Leader
                </div>
                <div className="text-white text-xs font-semibold truncate">{leader.name}</div>
                <div className="text-court-muted text-[11px]">
                  <span className="text-white font-semibold">{leader.points}</span>
                  <span className="mx-0.5">·</span>
                  {leader.rebounds}r
                  <span className="mx-0.5">·</span>
                  {leader.assists}a
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Prediction widget */}
        <PredictionWidget
          homeId={game.homeTeam.teamId}
          awayId={game.awayTeam.teamId}
          homeTricode={game.homeTeam.teamTricode}
          awayTricode={game.awayTeam.teamTricode}
          actualHomeScore={game.homeTeam.score}
          actualAwayScore={game.awayTeam.score}
          gameStatus={game.gameStatus}
        />

        {/* Expand hint */}
        {expandable && (
          <div className="mt-3 pt-2 border-t border-court-border flex items-center justify-center gap-1 text-court-muted text-[11px] hover:text-court-accent transition-colors">
            <span>{expanded ? "Hide box score" : "Box score"}</span>
            <span>{expanded ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {/* Expanded box score */}
      {expanded && expandable && (
        <div className="border-t border-court-border bg-court-surface/40 rounded-b-xl">
          <BoxScorePanel gameId={game.gameId} liveRefresh={isLive} />
        </div>
      )}
    </div>
  );
}
