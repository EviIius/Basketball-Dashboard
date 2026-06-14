"use client";

import useSWR from "swr";
import GameCard from "./GameCard";
import type { NBAScoreboard } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function LiveGamesPanel() {
  const { data, error, isLoading } = useSWR<NBAScoreboard>("/api/live-games", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-court-card border border-court-border rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-court-border rounded w-1/3 mb-3" />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-court-border rounded-lg" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-court-border rounded w-3/4" />
                  <div className="h-2 bg-court-border rounded w-1/4" />
                </div>
                <div className="w-8 h-6 bg-court-border rounded" />
              </div>
              <div className="h-px bg-court-border" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-court-border rounded-lg" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-court-border rounded w-3/4" />
                  <div className="h-2 bg-court-border rounded w-1/4" />
                </div>
                <div className="w-8 h-6 bg-court-border rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-4xl mb-3">🏀</div>
        <div className="text-white font-semibold mb-1">Could not load live games</div>
        <div className="text-court-muted text-sm">Check your connection and try again</div>
      </div>
    );
  }

  const games = data?.games ?? [];
  const liveGames = games.filter((g) => g.gameStatus === 2);
  const upcomingGames = games.filter((g) => g.gameStatus === 1);
  const finishedGames = games.filter((g) => g.gameStatus === 3);

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">🏀</div>
        <div className="text-white text-lg font-semibold mb-2">No games today</div>
        <div className="text-court-muted text-sm">
          {data?.gameDate
            ? `No NBA games scheduled for ${new Date(data.gameDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`
            : "Check back on a game day"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live now */}
      {liveGames.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-court-live animate-pulse" />
            <h2 className="text-court-live text-sm font-bold uppercase tracking-wider">Live Now</h2>
            <span className="text-court-muted text-xs">({liveGames.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveGames.map((g) => (
              <GameCard key={g.gameId} game={g} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingGames.length > 0 && (
        <section>
          <h2 className="text-court-muted text-sm font-bold uppercase tracking-wider mb-3">
            Upcoming · {upcomingGames.length} game{upcomingGames.length !== 1 ? "s" : ""}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingGames.map((g) => (
              <GameCard key={g.gameId} game={g} />
            ))}
          </div>
        </section>
      )}

      {/* Final */}
      {finishedGames.length > 0 && (
        <section>
          <h2 className="text-court-muted text-sm font-bold uppercase tracking-wider mb-3">
            Final · {finishedGames.length} game{finishedGames.length !== 1 ? "s" : ""}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {finishedGames.map((g) => (
              <GameCard key={g.gameId} game={g} />
            ))}
          </div>
        </section>
      )}

      <p className="text-court-muted text-xs text-right">
        Auto-refreshes every 30s · Last updated{" "}
        {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
      </p>
    </div>
  );
}
