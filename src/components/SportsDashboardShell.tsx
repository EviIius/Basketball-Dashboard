"use client";

import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CircleDot, Command, Layers3, PanelLeftClose, PanelLeftOpen, Radio } from "lucide-react";

export type SportTheme = "basketball" | "worldcup";

export interface SportDashboardView {
  id: string;
  label: string;
  meta: string;
  icon: ComponentType<{ className?: string }>;
  panel: ReactNode | ((navigate: (viewId: string) => void) => ReactNode);
}

interface SportDashboardShellProps {
  title: string;
  subtitle: string;
  feedLabel: string;
  modelLabel?: string;
  icon: ReactNode;
  theme: SportTheme;
  views: SportDashboardView[];
  initialView: string;
}

function themeClasses(theme: SportTheme) {
  if (theme === "worldcup") {
    return {
      activeBorder: "border-court-worldcup",
      activeBg: "bg-court-worldcup/10",
      activeText: "text-court-worldcup",
      activeRing: "ring-court-worldcup/30",
      chipBorder: "border-court-worldcup/30",
      chipBg: "bg-court-worldcup/10",
      chipText: "text-court-worldcup",
      gradient: "from-court-worldcup via-court-worldcup/40 to-court-accent/50",
      label: "Tournament OS",
    };
  }

  return {
    activeBorder: "border-court-accent",
    activeBg: "bg-court-accent/10",
    activeText: "text-court-accent",
    activeRing: "ring-court-accent/30",
    chipBorder: "border-court-accent/30",
    chipBg: "bg-court-accent/10",
    chipText: "text-court-accent",
    gradient: "from-court-accent via-court-accent/40 to-court-amber/50",
    label: "Prediction OS",
  };
}

function ViewButton({
  view,
  active,
  collapsed,
  compact,
  theme,
  onClick,
}: {
  view: SportDashboardView;
  active: boolean;
  collapsed?: boolean;
  compact?: boolean;
  theme: SportTheme;
  onClick: () => void;
}) {
  const Icon = view.icon;
  const classes = themeClasses(theme);

  return (
    <button
      type="button"
      data-view={view.id}
      aria-pressed={active}
      aria-label={view.label}
      title={collapsed ? view.label : undefined}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
        active
          ? `${classes.activeBorder} ${classes.activeBg} text-white shadow-lg shadow-black/20 ring-1 ${classes.activeRing}`
          : "border-transparent text-court-muted hover:border-white/10 hover:bg-white/[0.035] hover:text-white"
      } ${compact ? "shrink-0 text-sm" : "w-full"} ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
        active ? `${classes.chipBorder} ${classes.chipBg}` : "border-white/5 bg-white/[0.025] group-hover:border-white/10"
      }`}>
        <Icon className={`h-4 w-4 shrink-0 ${active ? classes.activeText : ""}`} />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-black">{view.label}</span>
          {!compact && <span className="mt-0.5 block truncate text-[11px] text-court-muted">{view.meta}</span>}
        </span>
      )}
    </button>
  );
}

export default function SportsDashboardShell({
  title,
  subtitle,
  feedLabel,
  modelLabel,
  icon,
  theme,
  views,
  initialView,
}: SportDashboardShellProps) {
  const [activeView, setActiveView] = useState(initialView);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const active = views.find((view) => view.id === activeView) ?? views[0];
  const classes = themeClasses(theme);
  const activePanel = typeof active.panel === "function" ? active.panel(setActiveView) : active.panel;

  return (
    <div className="app-canvas min-h-screen text-white" data-sport={theme}>
      <div className="mx-auto flex max-w-[1660px] gap-0 px-4 lg:gap-5 lg:px-6">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col py-5 pr-5 transition-[width] duration-200 lg:flex ${
            sidebarCollapsed ? "w-24" : "w-80"
          }`}
        >
          <div className="surface-card motion-rail flex min-h-0 flex-1 flex-col rounded-lg p-3">
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3"}`}>
              <Link
                href="/"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${classes.chipBorder} ${classes.chipBg} text-white transition-colors hover:border-white/20`}
                aria-label="Back to SportsDash"
                title="Back to SportsDash"
              >
                {sidebarCollapsed ? icon : <ArrowLeft className="h-5 w-5" />}
              </Link>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className={`mb-1 inline-flex items-center gap-1.5 rounded-md border ${classes.chipBorder} ${classes.chipBg} px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${classes.chipText}`}>
                    <Command className="h-3 w-3" />
                    {classes.label}
                  </div>
                  <h1 className="truncate text-lg font-black tracking-tight text-white">{title}</h1>
                  <div className="truncate text-xs text-court-muted">{subtitle}</div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSidebarCollapsed((value) => !value)}
              className={`mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-bold text-court-muted transition-colors hover:border-white/20 hover:text-white ${
                sidebarCollapsed ? "justify-center" : ""
              }`}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!sidebarCollapsed && "Collapse"}
            </button>

            <nav className="mt-6 min-h-0 space-y-1 overflow-y-auto pr-1">
              {views.map((view) => (
                <ViewButton
                  key={view.id}
                  view={view}
                  active={active.id === view.id}
                  collapsed={sidebarCollapsed}
                  theme={theme}
                  onClick={() => setActiveView(view.id)}
                />
              ))}
            </nav>

            <div className={`mt-auto overflow-hidden rounded-lg border border-white/10 bg-black/20 text-xs ${sidebarCollapsed ? "p-2" : "p-3"}`}>
              <div className={`mb-3 h-1 rounded-full bg-gradient-to-r ${classes.gradient}`} />
              {modelLabel && (
                <div className="flex justify-between gap-3">
                  {!sidebarCollapsed && <span className="text-court-muted">Model</span>}
                  <span className={`font-semibold ${classes.activeText}`}>{modelLabel}</span>
                </div>
              )}
              <div className={`flex justify-between gap-3 ${modelLabel ? "mt-2" : ""}`}>
                {!sidebarCollapsed && <span className="text-court-muted">Feed</span>}
                <span className="font-semibold text-white">{sidebarCollapsed ? "Live" : feedLabel}</span>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                {!sidebarCollapsed && <span className="text-court-muted">Views</span>}
                <span className="font-semibold text-court-amber">{views.length}</span>
              </div>
              {!sidebarCollapsed && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-court-live/20 bg-court-live/10 px-2 py-1 text-court-live">
                  <CircleDot className="h-3.5 w-3.5 animate-pulse" />
                  Live data connected
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-50 -mx-4 border-b border-white/10 bg-court-bg/80 px-4 py-4 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-court-muted"
                aria-label="Back to SportsDash"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${classes.chipBorder} ${classes.chipBg}`}>
                {icon}
              </div>
              <div className="min-w-0">
                <div className={`mb-0.5 inline-flex items-center gap-1 rounded-sm text-[9px] font-black uppercase tracking-[0.16em] ${classes.chipText}`}>
                  {classes.label}
                </div>
                <h1 className="truncate text-lg font-black tracking-tight text-white">{title}</h1>
                <div className="truncate text-xs text-court-muted">{subtitle}</div>
              </div>
            </div>
            <nav className="mt-4 overflow-x-auto">
              <div className="flex min-w-max gap-1">
                {views.map((view) => (
                  <ViewButton
                    key={view.id}
                    view={view}
                    active={active.id === view.id}
                    compact
                    theme={theme}
                    onClick={() => setActiveView(view.id)}
                  />
                ))}
              </div>
            </nav>
          </header>

          <main className="space-y-5 py-5">
            <div className="surface-card-quiet flex flex-wrap items-center justify-between gap-4 rounded-lg px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-court-muted">
                  <Layers3 className={`h-4 w-4 ${classes.activeText}`} />
                  {active.meta}
                </div>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{active.label}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 rounded-md border ${classes.chipBorder} ${classes.chipBg} px-2.5 py-1 font-bold ${classes.chipText}`}>
                  <Radio className="h-3.5 w-3.5" />
                  {feedLabel}
                </span>
                {modelLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1 font-bold text-white">
                    {modelLabel}
                  </span>
                )}
              </div>
            </div>

            <div key={active.id} className="view-enter">
              {activePanel}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
