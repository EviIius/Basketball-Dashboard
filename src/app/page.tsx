"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

type Tab = "live" | "predictor" | "standings" | "leaders" | "history" | "players" | "bracket";

const LiveGamesPanel = dynamic(() => import("@/components/LiveGamesPanel"), { ssr: false });
const PredictorPanel = dynamic(() => import("@/components/PredictorPanel"), { ssr: false });
const StandingsPanel = dynamic(() => import("@/components/StandingsPanel"), { ssr: false });
const LeadersPanel = dynamic(() => import("@/components/LeadersPanel"), { ssr: false });
const HistoricalStatsPanel = dynamic(() => import("@/components/HistoricalStatsPanel"), { ssr: false });
const PlayerSearchPanel = dynamic(() => import("@/components/PlayerSearchPanel"), { ssr: false });
const PlayoffBracket = dynamic(() => import("@/components/PlayoffBracket"), { ssr: false });

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "live", label: "Live", icon: "🔴" },
  { id: "predictor", label: "Predictor", icon: "🎯" },
  { id: "bracket", label: "Bracket", icon: "🏆" },
  { id: "standings", label: "Standings", icon: "📋" },
  { id: "leaders", label: "Leaders", icon: "⭐" },
  { id: "history", label: "Team History", icon: "📊" },
  { id: "players", label: "Players", icon: "🔍" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("live");

  return (
    <div className="min-h-screen bg-court-bg">
      {/* Header */}
      <header className="border-b border-court-border sticky top-0 z-50 backdrop-blur-md bg-court-bg/90">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏀</span>
            <div>
              <h1 className="text-white font-black text-lg leading-tight tracking-tight">
                NBA Dashboard
              </h1>
              <p className="text-court-muted text-xs">Live scores · Predictor · Stats</p>
            </div>
          </div>

          {/* Live indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-court-live">
            <span className="w-1.5 h-1.5 rounded-full bg-court-live animate-pulse" />
            Live data
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-court-accent text-court-accent"
                    : "border-transparent text-court-muted hover:text-white hover:border-court-border"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "live" && <LiveGamesPanel />}
        {activeTab === "predictor" && <PredictorPanel />}
        {activeTab === "bracket" && <PlayoffBracket />}
        {activeTab === "standings" && <StandingsPanel />}
        {activeTab === "leaders" && <LeadersPanel />}
        {activeTab === "history" && <HistoricalStatsPanel />}
        {activeTab === "players" && <PlayerSearchPanel />}
      </main>
    </div>
  );
}
