"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  BarChart3,
  Brackets,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import DashboardPulse from "@/components/DashboardPulse";
import OverviewBriefing from "@/components/OverviewBriefing";

type View = "overview" | "forecast" | "lab" | "league" | "schedule" | "research" | "postseason";

const LiveGamesPanel = dynamic(() => import("@/components/LiveGamesPanel"), { ssr: false });
const PredictorPanel = dynamic(() => import("@/components/PredictorPanel"), { ssr: false });
const SeasonGamesPanel = dynamic(() => import("@/components/SeasonGamesPanel"), { ssr: false });
const StandingsPanel = dynamic(() => import("@/components/StandingsPanel"), { ssr: false });
const LeadersPanel = dynamic(() => import("@/components/LeadersPanel"), { ssr: false });
const HistoricalStatsPanel = dynamic(() => import("@/components/HistoricalStatsPanel"), { ssr: false });
const PlayerSearchPanel = dynamic(() => import("@/components/PlayerSearchPanel"), { ssr: false });
const PlayoffBracket = dynamic(() => import("@/components/PlayoffBracket"), { ssr: false });

const VIEWS = [
  { id: "overview", label: "Overview", meta: "Decision center", icon: Activity },
  { id: "forecast", label: "Games & Picks", meta: "Live and scheduled win calls", icon: Radio },
  { id: "lab", label: "Matchup Lab", meta: "Any-team simulator", icon: Sparkles },
  { id: "league", label: "League Tables", meta: "Standings and leaders", icon: BarChart3 },
  { id: "schedule", label: "Schedule", meta: "Full season feed", icon: CalendarDays },
  { id: "research", label: "Research", meta: "Players and team archive", icon: Search },
  { id: "postseason", label: "Bracket", meta: "Postseason picture", icon: Brackets },
] satisfies { id: View; label: string; meta: string; icon: ComponentType<{ className?: string }> }[];

function ViewButton({
  view,
  active,
  onClick,
  compact,
  collapsed,
}: {
  view: (typeof VIEWS)[number];
  active: boolean;
  onClick: () => void;
  compact?: boolean;
  collapsed?: boolean;
}) {
  const Icon = view.icon;
  return (
    <button
      type="button"
      data-view={view.id}
      aria-pressed={active}
      aria-label={view.label}
      title={collapsed ? view.label : undefined}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        active
          ? "border-court-accent bg-court-accent/10 text-white"
          : "border-transparent text-court-muted hover:border-court-border hover:bg-court-card hover:text-white"
      } ${compact ? "shrink-0 text-sm" : "w-full"} ${collapsed ? "justify-center px-2" : ""}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-court-accent" : ""}`} />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{view.label}</span>
          {!compact && <span className="mt-0.5 block truncate text-[11px] text-court-muted">{view.meta}</span>}
        </span>
      )}
    </button>
  );
}

function SectionHeader({ activeView }: { activeView: View }) {
  const view = VIEWS.find((item) => item.id === activeView) ?? VIEWS[0];
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-court-border pb-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-court-muted">{view.meta}</div>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{view.label}</h2>
      </div>
      <div className="flex items-center gap-2 text-xs text-court-muted">
        <span className="h-2 w-2 rounded-full bg-court-live" />
        NBA data
      </div>
    </div>
  );
}

function OverviewPanel({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <div className="space-y-5">
      <DashboardPulse />
      <OverviewBriefing onNavigate={onNavigate} />
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

function ActivePanel({ activeView, onNavigate }: { activeView: View; onNavigate: (view: View) => void }) {
  if (activeView === "overview") return <OverviewPanel onNavigate={onNavigate} />;
  if (activeView === "forecast") return <LiveGamesPanel />;
  if (activeView === "lab") return <PredictorPanel />;
  if (activeView === "league") return <LeaguePanel />;
  if (activeView === "schedule") return <SeasonGamesPanel />;
  if (activeView === "research") return <ResearchPanel />;
  return <PlayoffBracket />;
}

export default function Home() {
  const [activeView, setActiveView] = useState<View>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-court-bg text-white">
      <div className="mx-auto flex max-w-[1600px] gap-0 px-4 lg:gap-5 lg:px-6">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-court-border py-5 pr-5 transition-[width] duration-200 lg:flex ${
            sidebarCollapsed ? "w-20" : "w-72"
          }`}
        >
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-court-border bg-court-card">
              <Activity className="h-5 w-5 text-court-accent" />
            </div>
            {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight text-white">Basketball Decision Desk</h1>
              <div className="text-xs text-court-muted">Predictions first, data behind them</div>
            </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className={`mt-4 flex items-center gap-2 rounded-lg border border-court-border bg-court-card px-3 py-2 text-xs font-bold text-court-muted transition-colors hover:border-court-accent hover:text-white ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!sidebarCollapsed && "Collapse"}
          </button>

          <nav className="mt-6 space-y-1">
            {VIEWS.map((view) => (
              <ViewButton
                key={view.id}
                view={view}
                active={activeView === view.id}
                onClick={() => setActiveView(view.id)}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>

          <div className={`mt-auto rounded-lg border border-court-border bg-court-card p-3 text-xs ${sidebarCollapsed ? "space-y-3" : "space-y-2"}`}>
            <div className="flex justify-between gap-3">
              {!sidebarCollapsed && <span className="text-court-muted">Model</span>}
              <span className="font-semibold text-court-accent">Rolling v3</span>
            </div>
            <div className="flex justify-between gap-3">
              {!sidebarCollapsed && <span className="text-court-muted">Feed</span>}
              <span className="font-semibold text-white">{sidebarCollapsed ? "NBA" : "NBA official"}</span>
            </div>
            <div className="flex justify-between gap-3">
              {!sidebarCollapsed && <span className="text-court-muted">Focus</span>}
              <span className="font-semibold text-court-amber">{sidebarCollapsed ? "Wins" : "Win calls"}</span>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-50 -mx-4 border-b border-court-border bg-court-bg/95 px-4 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-court-border bg-court-card">
                <Activity className="h-5 w-5 text-court-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-black tracking-tight text-white">Basketball Decision Desk</h1>
                <div className="text-xs text-court-muted">Predictions first</div>
              </div>
            </div>
            <nav className="mt-4 overflow-x-auto">
              <div className="flex min-w-max gap-1">
                {VIEWS.map((view) => (
                  <ViewButton
                    key={view.id}
                    view={view}
                    active={activeView === view.id}
                    onClick={() => setActiveView(view.id)}
                    compact
                  />
                ))}
              </div>
            </nav>
          </header>

          <main className="space-y-5 py-5">
            <SectionHeader activeView={activeView} />
            <ActivePanel activeView={activeView} onNavigate={setActiveView} />
          </main>
        </div>
      </div>
    </div>
  );
}
