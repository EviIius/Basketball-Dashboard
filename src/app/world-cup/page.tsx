"use client";

import dynamic from "next/dynamic";
import { BarChart3, Brackets, Brain, Radio, Target, Trophy } from "lucide-react";
import SportsDashboardShell, { type SportDashboardView } from "@/components/SportsDashboardShell";
import WorldCupOverview from "@/components/wc/WorldCupOverview";

const WCPredictionsPanel = dynamic(() => import("@/components/wc/WCPredictionsPanel"), { ssr: false });
const WCMatchesPanel = dynamic(() => import("@/components/wc/WCMatchesPanel"), { ssr: false });
const WCGroupsPanel = dynamic(() => import("@/components/wc/WCGroupsPanel"), { ssr: false });
const WCScorersPanel = dynamic(() => import("@/components/wc/WCScorersPanel"), { ssr: false });
const WCBracketPanel = dynamic(() => import("@/components/wc/WCBracketPanel"), { ssr: false });

export default function WorldCupPage() {
  const views: SportDashboardView[] = [
    {
      id: "overview",
      label: "Overview",
      meta: "Tournament pulse",
      icon: Trophy,
      panel: (navigate) => <WorldCupOverview navigate={navigate} />,
    },
    {
      id: "forecast",
      label: "Predictions",
      meta: "Likely winners and model edge",
      icon: Brain,
      panel: <WCPredictionsPanel />,
    },
    {
      id: "matches",
      label: "Matches",
      meta: "Live scores and schedule",
      icon: Radio,
      panel: <WCMatchesPanel />,
    },
    {
      id: "groups",
      label: "Groups",
      meta: "Group stage standings",
      icon: BarChart3,
      panel: <WCGroupsPanel />,
    },
    {
      id: "scorers",
      label: "Top Scorers",
      meta: "Tournament goal leaders",
      icon: Target,
      panel: <WCScorersPanel />,
    },
    {
      id: "bracket",
      label: "Bracket",
      meta: "Projected tournament path",
      icon: Brackets,
      panel: <WCBracketPanel />,
    },
  ];

  return (
    <SportsDashboardShell
      title="2026 World Cup Desk"
      subtitle="USA, Canada, and Mexico"
      feedLabel="football-data.org"
      icon={<Trophy className="h-5 w-5 text-court-worldcup" />}
      theme="worldcup"
      views={views}
      initialView="overview"
    />
  );
}
