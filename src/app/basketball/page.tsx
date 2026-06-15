"use client";

import dynamic from "next/dynamic";
import {
  Activity,
  BarChart3,
  Brackets,
  CalendarDays,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import DashboardPulse from "@/components/DashboardPulse";
import OverviewBriefing from "@/components/OverviewBriefing";
import SportsDashboardShell, { type SportDashboardView } from "@/components/SportsDashboardShell";

const LiveGamesPanel = dynamic(() => import("@/components/LiveGamesPanel"), { ssr: false });
const PredictorPanel = dynamic(() => import("@/components/PredictorPanel"), { ssr: false });
const SeasonGamesPanel = dynamic(() => import("@/components/SeasonGamesPanel"), { ssr: false });
const StandingsPanel = dynamic(() => import("@/components/StandingsPanel"), { ssr: false });
const LeadersPanel = dynamic(() => import("@/components/LeadersPanel"), { ssr: false });
const HistoricalStatsPanel = dynamic(() => import("@/components/HistoricalStatsPanel"), { ssr: false });
const PlayerSearchPanel = dynamic(() => import("@/components/PlayerSearchPanel"), { ssr: false });
const PlayoffBracket = dynamic(() => import("@/components/PlayoffBracket"), { ssr: false });

function BasketballOverview({ navigate }: { navigate: (viewId: string) => void }) {
  return (
    <div className="space-y-5">
      <DashboardPulse />
      <OverviewBriefing onNavigate={(view) => navigate(view)} />
    </div>
  );
}

function LeaguePanel() {
  return (
    <div className="space-y-5">
      <StandingsPanel />
      <LeadersPanel />
    </div>
  );
}

function ResearchPanel() {
  return (
    <div className="space-y-5">
      <PlayerSearchPanel />
      <HistoricalStatsPanel />
    </div>
  );
}

export default function BasketballPage() {
  const views: SportDashboardView[] = [
    {
      id: "overview",
      label: "Overview",
      meta: "Decision center",
      icon: Activity,
      panel: (navigate) => <BasketballOverview navigate={navigate} />,
    },
    {
      id: "forecast",
      label: "Games & Picks",
      meta: "Live and scheduled win calls",
      icon: Radio,
      panel: <LiveGamesPanel />,
    },
    {
      id: "lab",
      label: "Matchup Lab",
      meta: "Any-team simulator",
      icon: Sparkles,
      panel: <PredictorPanel />,
    },
    {
      id: "league",
      label: "League Tables",
      meta: "Standings and leaders",
      icon: BarChart3,
      panel: <LeaguePanel />,
    },
    {
      id: "schedule",
      label: "Schedule",
      meta: "Full season feed",
      icon: CalendarDays,
      panel: <SeasonGamesPanel />,
    },
    {
      id: "research",
      label: "Research",
      meta: "Players and team archive",
      icon: Search,
      panel: <ResearchPanel />,
    },
    {
      id: "postseason",
      label: "Bracket",
      meta: "Postseason picture",
      icon: Brackets,
      panel: <PlayoffBracket />,
    },
  ];

  return (
    <SportsDashboardShell
      title="Basketball Decision Desk"
      subtitle="Predictions first, data behind them"
      feedLabel="NBA data"
      modelLabel="Rolling v3"
      icon={<Activity className="h-5 w-5 text-court-accent" />}
      theme="basketball"
      views={views}
      initialView="overview"
    />
  );
}
