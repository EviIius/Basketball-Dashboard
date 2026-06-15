"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  if (status === 1) return <span className="text-xs text-court-muted">Upcoming</span>;
  if (status === 3) return <span className="text-xs font-semibold text-court-muted">Final</span>;
  if (period <= 4) return <span className="text-xs font-bold text-court-live">Q{period}</span>;
  return <span className="text-xs font-bold text-court-live">OT{period - 4}</span>;
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
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div
        className="relative flex h-11 w-12 shrink-0 items-center justify-center rounded-md text-xs font-black text-white"
        style={{ backgroundColor: colors.primary }}
      >
        {tricode}
        {seed != null && seed > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-court-amber text-[10px] font-black text-court-bg">
            {seed}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight text-white">
          {city} {name}
        </div>
        <div className="flex items-center gap-2 text-xs text-court-muted">
          <span>{wins}-{losses}</span>
          {gameStatus === 2 && (
            <>
              <span className="text-court-border">/</span>
              <span className="flex items-center gap-0.5" title={`${timeoutsRemaining} timeouts remaining`}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-2 w-1 rounded-sm ${index < timeoutsRemaining ? "bg-court-muted" : "bg-court-border"}`}
                  />
                ))}
              </span>
              {inBonus === "1" && <span className="text-[10px] font-bold uppercase text-court-amber">Bonus</span>}
            </>
          )}
        </div>
      </div>
      {gameStatus !== 1 && (
        <div className={`font-mono text-2xl font-black tabular-nums ${isLeading ? "text-white" : "text-court-muted"}`}>
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
      className={`surface-card-quiet overflow-hidden rounded-lg transition-all duration-200 ${
        expandable ? "hover:-translate-y-0.5 hover:border-court-accent/60" : ""
      } ${isLive ? "border-court-live/35 bg-court-live/5" : ""} ${expanded ? "border-court-accent/70" : ""}`}
    >
      <div
        className={expandable ? "cursor-pointer p-4" : "p-4"}
        onClick={() => expandable && setExpanded((value) => !value)}
        role={expandable ? "button" : undefined}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {isLive && (
              <span className="flex shrink-0 items-center gap-1">
                <span className="live-dot h-2 w-2" />
                <span className="text-xs font-bold text-court-live">LIVE</span>
              </span>
            )}
            {game.gameLabel && (
              <span className="truncate text-xs font-bold uppercase tracking-wider text-court-accent">
                {game.gameLabel}
              </span>
            )}
            {game.gameSubLabel && <span className="truncate text-xs text-court-muted">/ {game.gameSubLabel}</span>}
            {!game.gameLabel && game.seriesText && <span className="truncate text-xs text-court-muted">{game.seriesText}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <PeriodLabel period={game.period} status={game.gameStatus} />
            {isLive && game.gameClock && <span className="font-mono text-court-live">{formatClock(game.gameClock)}</span>}
            {game.gameStatus === 1 && <span className="text-court-muted">{gameTime}</span>}
          </div>
        </div>

        {game.gameLabel && game.seriesText && <div className="-mt-1 mb-3 text-xs text-court-muted">{game.seriesText}</div>}

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
          <div className="h-px bg-white/10" />
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

        {game.gameStatus !== 1 && game.homeTeam.periods?.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex gap-1 font-mono text-xs">
              <div className="w-8 shrink-0 text-court-muted" />
              {game.homeTeam.periods.map((period) => (
                <div key={period.period} className="w-7 shrink-0 text-center text-court-muted">
                  {period.period <= 4 ? `Q${period.period}` : `OT${period.period - 4}`}
                </div>
              ))}
              <div className="ml-auto w-8 shrink-0 text-center text-court-muted">T</div>
            </div>
            {[game.awayTeam, game.homeTeam].map((team) => (
              <div key={team.teamId} className="mt-0.5 flex gap-1 font-mono text-xs">
                <div className="w-8 shrink-0 font-bold text-court-muted">{team.teamTricode}</div>
                {team.periods.map((period) => (
                  <div key={period.period} className="w-7 shrink-0 text-center text-white">
                    {period.score}
                  </div>
                ))}
                <div className="ml-auto w-8 shrink-0 text-center font-bold text-white">{team.score}</div>
              </div>
            ))}
          </div>
        )}

        {game.gameStatus !== 1 && game.gameLeaders?.homeLeaders?.name && !expanded && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
            {[
              { side: "away", leader: game.gameLeaders.awayLeaders, tricode: game.awayTeam.teamTricode },
              { side: "home", leader: game.gameLeaders.homeLeaders, tricode: game.homeTeam.teamTricode },
            ].map(({ side, leader, tricode }) => (
              <div key={side} className={side === "home" ? "text-right" : ""}>
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-court-muted">{tricode} Leader</div>
                <div className="truncate text-xs font-semibold text-white">{leader.name}</div>
                <div className="text-[11px] text-court-muted">
                  <span className="font-semibold text-white">{leader.points}</span> pts / {leader.rebounds} reb / {leader.assists} ast
                </div>
              </div>
            ))}
          </div>
        )}

        <PredictionWidget
          gameId={game.gameId}
          gameDateUTC={game.gameTimeUTC}
          homeId={game.homeTeam.teamId}
          awayId={game.awayTeam.teamId}
          homeTricode={game.homeTeam.teamTricode}
          awayTricode={game.awayTeam.teamTricode}
          actualHomeScore={game.homeTeam.score}
          actualAwayScore={game.awayTeam.score}
          gameStatus={game.gameStatus}
        />

        {expandable && (
          <div className="mt-3 flex items-center justify-center gap-1 border-t border-white/10 pt-3 text-[11px] text-court-muted transition-colors hover:text-court-accent">
            <span>{expanded ? "Hide box score" : "Box score"}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        )}
      </div>

      {expanded && expandable && (
        <div className="rounded-b-lg border-t border-white/10 bg-black/20">
          <BoxScorePanel gameId={game.gameId} liveRefresh={isLive} />
        </div>
      )}
    </div>
  );
}
