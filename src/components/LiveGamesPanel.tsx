"use client";

import useSWR from "swr";
import type { ReactNode } from "react";
import { Activity, CalendarX } from "lucide-react";
import GameCard from "./GameCard";
import PredictionBoard from "./PredictionBoard";
import type { NBAScoreboard } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function GameGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="surface-card-quiet loading-shimmer h-64 rounded-lg" />
      ))}
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "live";
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        {tone === "live" && <span className="live-dot h-2 w-2" />}
        <h3 className={`text-sm font-black uppercase tracking-wider ${tone === "live" ? "text-court-live" : "text-court-muted"}`}>
          {title}
        </h3>
        <span className="text-xs text-court-muted">{count}</span>
      </div>
      {children}
    </section>
  );
}

export default function LiveGamesPanel() {
  const { data, error, isLoading } = useSWR<NBAScoreboard>("/api/live-games", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  if (isLoading) return <GameGridSkeleton />;

  if (error) {
    return (
      <div className="surface-card-quiet flex flex-col items-center justify-center rounded-lg py-16 text-center">
        <Activity className="mb-3 h-8 w-8 text-court-muted" />
        <div className="font-semibold text-white">Could not load live games</div>
        <div className="mt-1 text-sm text-court-muted">The NBA live feed did not respond.</div>
      </div>
    );
  }

  const games = data?.games ?? [];
  const liveGames = games.filter((game) => game.gameStatus === 2);
  const upcomingGames = games.filter((game) => game.gameStatus === 1);
  const finishedGames = games.filter((game) => game.gameStatus === 3);

  if (games.length === 0) {
    return (
      <div className="space-y-5">
        <div className="spotlight-surface relative overflow-hidden rounded-lg py-9 text-center">
          <div className="scoreboard-empty-lines absolute inset-0 opacity-60" />
          <div className="relative">
            <CalendarX className="mx-auto mb-3 h-9 w-9 text-court-muted" />
            <div className="text-lg font-black text-white">No games today</div>
            <div className="mt-1 text-sm text-court-muted">
              {data?.gameDate
                ? new Date(`${data.gameDate}T12:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "The live scoreboard is quiet."}
            </div>
          </div>
        </div>
        <PredictionBoard limit={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PredictionBoard limit={6} />

      {liveGames.length > 0 && (
        <Section title="Live Now" count={liveGames.length} tone="live">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {liveGames.map((game) => (
              <GameCard key={game.gameId} game={game} />
            ))}
          </div>
        </Section>
      )}

      {upcomingGames.length > 0 && (
        <Section title="Upcoming" count={upcomingGames.length}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcomingGames.map((game) => (
              <GameCard key={game.gameId} game={game} />
            ))}
          </div>
        </Section>
      )}

      {finishedGames.length > 0 && (
        <Section title="Final" count={finishedGames.length}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {finishedGames.map((game) => (
              <GameCard key={game.gameId} game={game} />
            ))}
          </div>
        </Section>
      )}

      <p className="text-right text-xs text-court-muted">
        Updated {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
      </p>
    </div>
  );
}
