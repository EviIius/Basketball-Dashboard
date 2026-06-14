"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  BarChart3,
  Brackets,
  CalendarDays,
  LineChart,
  Radio,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

type Tab = "live" | "predictor" | "games" | "standings" | "leaders" | "history" | "players" | "bracket";

const LiveGamesPanel = dynamic(() => import("@/components/LiveGamesPanel"), { ssr: false });
const PredictorPanel = dynamic(() => import("@/components/PredictorPanel"), { ssr: false });
const SeasonGamesPanel = dynamic(() => import("@/components/SeasonGamesPanel"), { ssr: false });
const StandingsPanel = dynamic(() => import("@/components/StandingsPanel"), { ssr: false });
const LeadersPanel = dynamic(() => import("@/components/LeadersPanel"), { ssr: false });
const HistoricalStatsPanel = dynamic(() => import("@/components/HistoricalStatsPanel"), { ssr: false });
const PlayerSearchPanel = dynamic(() => import("@/components/PlayerSearchPanel"), { ssr: false });
const PlayoffBracket = dynamic(() => import("@/components/PlayoffBracket"), { ssr: false });

const TABS = [
  { id: "live", label: "Scores", icon: Radio },
  { id: "predictor", label: "Model Lab", icon: Sparkles },
  { id: "games", label: "Season Games", icon: CalendarDays },
  { id: "standings", label: "Standings", icon: BarChart3 },
  { id: "leaders", label: "Leaders", icon: Trophy },
  { id: "history", label: "History", icon: LineChart },
  { id: "players", label: "Players", icon: Search },
  { id: "bracket", label: "Bracket", icon: Brackets },
] satisfies { id: Tab; label: string; icon: ComponentType<{ className?: string }> }[];

function PanelTitle({ activeTab }: { activeTab: Tab }) {
  const titles: Record<Tab, { title: string; meta: string }> = {
    live: { title: "Scores", meta: "Live scoreboard" },
    predictor: { title: "Model Lab", meta: "Rolling Elo and form model" },
    games: { title: "Season Games", meta: "Current season schedule feed" },
    standings: { title: "Standings", meta: "Conference tables" },
    leaders: { title: "Leaders", meta: "Player statistical leaders" },
    history: { title: "History", meta: "Team season archive" },
    players: { title: "Players", meta: "Player lookup" },
    bracket: { title: "Bracket", meta: "Postseason series" },
  };
  const title = titles[activeTab];

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-court-border pb-4">
      <div>
        <div className="text-court-muted text-xs font-semibold uppercase tracking-[0.18em]">
          {title.meta}
        </div>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{title.title}</h2>
      </div>
      <div className="flex items-center gap-2 text-xs text-court-muted">
        <span className="h-2 w-2 rounded-full bg-court-live" />
        NBA data
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("live");

  return (
    <div className="min-h-screen bg-court-bg text-white">
      <header className="sticky top-0 z-50 border-b border-court-border bg-court-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-court-border bg-court-card">
                <Activity className="h-5 w-5 text-court-accent" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white">Basketball Dashboard</h1>
                <div className="text-xs text-court-muted">Current season command center</div>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <div className="rounded-lg border border-court-border bg-court-card px-3 py-2 text-xs">
                <span className="text-court-muted">Model</span>
                <span className="ml-2 font-semibold text-court-accent">Rolling v3</span>
              </div>
              <div className="rounded-lg border border-court-border bg-court-card px-3 py-2 text-xs">
                <span className="text-court-muted">Feed</span>
                <span className="ml-2 font-semibold text-white">NBA schedule</span>
              </div>
            </div>
          </div>

          <nav className="overflow-x-auto">
            <div className="flex min-w-max gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-court-accent bg-court-accent/10 text-white"
                        : "border-transparent text-court-muted hover:border-court-border hover:bg-court-card hover:text-white"
                    }`}
                  >
                    <Icon className={active ? "h-4 w-4 text-court-accent" : "h-4 w-4"} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 lg:px-6">
        <PanelTitle activeTab={activeTab} />
        {activeTab === "live" && <LiveGamesPanel />}
        {activeTab === "predictor" && <PredictorPanel />}
        {activeTab === "games" && <SeasonGamesPanel />}
        {activeTab === "standings" && <StandingsPanel />}
        {activeTab === "leaders" && <LeadersPanel />}
        {activeTab === "history" && <HistoricalStatsPanel />}
        {activeTab === "players" && <PlayerSearchPanel />}
        {activeTab === "bracket" && <PlayoffBracket />}
      </main>
    </div>
  );
}
