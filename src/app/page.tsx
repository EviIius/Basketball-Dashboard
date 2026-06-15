"use client";

import Link from "next/link";
import useSWR from "swr";
import { Activity, ArrowRight, BadgeCheck, Layers3, Radio, Trophy, Zap } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface NBAGame {
  gameStatus: number;
  homeTeam: { teamTricode: string; score: number };
  awayTeam: { teamTricode: string; score: number };
}

interface WCTeam {
  tla: string;
  crest: string;
}

interface WCMatch {
  id: number;
  status: "live" | "upcoming" | "finished" | "other";
  minute: number | null;
  group: string | null;
  homeTeam: WCTeam;
  awayTeam: WCTeam;
  homeScore: number | null;
  awayScore: number | null;
}

function wcLiveLabel(match: WCMatch) {
  return match.minute ? `LIVE ${match.minute}'` : "LIVE";
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-court-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
      <div className="text-[10px] text-court-muted">{detail}</div>
    </div>
  );
}

function BasketballCard() {
  const { data } = useSWR<{ games: NBAGame[] }>("/api/live-games", fetcher, {
    refreshInterval: 30_000,
  });

  const games = data?.games ?? [];
  const liveGames = games.filter((game) => game.gameStatus === 2);
  const featured = liveGames[0] ?? games[0];

  return (
    <Link href="/basketball" className="group block view-enter">
      <div data-sport="basketball" className="sport-card overflow-hidden rounded-lg transition-transform duration-300 hover:-translate-y-1">
        <div className="relative h-1 w-full bg-gradient-to-r from-court-accent via-court-accent/50 to-transparent" />
        <div className="relative p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-court-accent/25 bg-court-accent/10">
                <Activity className="h-6 w-6 text-court-accent" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-court-accent">
                  <Zap className="h-3 w-3" />
                  Prediction OS
                </div>
                <h2 className="text-xl font-black tracking-tight text-white">NBA Basketball</h2>
                <p className="mt-0.5 text-xs text-court-muted">Predictions, scores, standings</p>
              </div>
            </div>
            <span className="rounded-full border border-court-accent/30 bg-court-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-court-accent">
              Rolling v3
            </span>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat label="Live" value={liveGames.length || "--"} detail="games now" />
            <Stat label="Today" value={games.length || "--"} detail="total games" />
            <Stat label="Views" value={7} detail="desk tabs" />
          </div>

          {featured && (
            <div className="score-lane mb-5 rounded-lg border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{featured.homeTeam.teamTricode}</div>
                  {featured.gameStatus !== 1 && <div className="text-2xl font-black tabular-nums text-white">{featured.homeTeam.score}</div>}
                </div>
                <div className="px-4 text-xs font-semibold text-court-muted">
                  {featured.gameStatus === 2 ? <span className="text-court-live">LIVE</span> : featured.gameStatus === 3 ? "Final" : "vs"}
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{featured.awayTeam.teamTricode}</div>
                  {featured.gameStatus !== 1 && <div className="text-2xl font-black tabular-nums text-white">{featured.awayTeam.score}</div>}
                </div>
              </div>
            </div>
          )}

          <div className="mb-5 flex flex-wrap gap-1.5">
            {["Overview", "Games & Picks", "Matchup Lab", "League Tables", "Schedule", "Bracket"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-court-muted">
                {item}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-court-accent/20 bg-court-accent/5 px-4 py-3 transition-colors group-hover:border-court-accent/50 group-hover:bg-court-accent/10">
            <span className="text-sm font-bold text-white">Open Basketball Desk</span>
            <ArrowRight className="h-4 w-4 text-court-accent transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function WorldCupCard() {
  const { data } = useSWR<{ live: WCMatch[]; today: WCMatch[]; recent: WCMatch[]; upcoming: WCMatch[] }>(
    "/api/wc/matches",
    fetcher,
    { refreshInterval: 60_000 },
  );

  const liveCount = data?.live?.length ?? 0;
  const todayCount = (data?.today?.length ?? 0) + liveCount;
  const featured = data?.live?.[0] ?? data?.today?.[0] ?? data?.upcoming?.[0] ?? data?.recent?.[0];

  return (
    <Link href="/world-cup" className="group block view-enter">
      <div data-sport="worldcup" className="sport-card overflow-hidden rounded-lg transition-transform duration-300 hover:-translate-y-1">
        <div className="relative h-1 w-full bg-gradient-to-r from-court-worldcup via-court-worldcup/50 to-transparent" />
        <div className="relative p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-court-worldcup/25 bg-court-worldcup/10">
                <Trophy className="h-6 w-6 text-court-worldcup" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-court-worldcup">
                  <Trophy className="h-3 w-3" />
                  Tournament OS
                </div>
                <h2 className="text-xl font-black tracking-tight text-white">2026 World Cup</h2>
                <p className="mt-0.5 text-xs text-court-muted">USA, Canada, Mexico</p>
              </div>
            </div>
            <span className="rounded-full border border-court-worldcup/30 bg-court-worldcup/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-court-worldcup">
              Group Stage
            </span>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-3">
            <Stat label="Live" value={liveCount || "--"} detail="matches now" />
            <Stat label="Today" value={todayCount || "--"} detail="matches" />
            <Stat label="Teams" value={48} detail="12 groups" />
          </div>

          {featured && (
            <div className="score-lane mb-5 rounded-lg border border-white/10 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <img src={featured.homeTeam.crest} alt={featured.homeTeam.tla} className="h-6 w-6 object-contain" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{featured.homeTeam.tla}</span>
                  {featured.status !== "upcoming" && <span className="text-2xl font-black tabular-nums text-white">{featured.homeScore ?? 0}</span>}
                </div>
                <div className="px-3 text-xs font-semibold text-court-muted">
                  {featured.status === "live" ? <span className="text-court-live">{wcLiveLabel(featured)}</span> : featured.status === "finished" ? "FT" : "vs"}
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  {featured.status !== "upcoming" && <span className="text-2xl font-black tabular-nums text-white">{featured.awayScore ?? 0}</span>}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-court-muted">{featured.awayTeam.tla}</span>
                  <img src={featured.awayTeam.crest} alt={featured.awayTeam.tla} className="h-6 w-6 object-contain" />
                </div>
              </div>
            </div>
          )}

          <div className="mb-5 flex flex-wrap gap-1.5">
            {["Overview", "Matches", "Groups", "Top Scorers"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-court-muted">
                {item}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-court-worldcup/20 bg-court-worldcup/5 px-4 py-3 transition-colors group-hover:border-court-worldcup/40 group-hover:bg-court-worldcup/10">
            <span className="text-sm font-bold text-white">Open World Cup Desk</span>
            <ArrowRight className="h-4 w-4 text-court-worldcup transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-canvas min-h-screen text-white">
      <header className="border-b border-white/10 bg-court-bg/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-court-accent/25 bg-court-accent/10">
              <Radio className="h-5 w-5 text-court-accent" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">SportsDash</h1>
              <p className="text-xs text-court-muted">Multi-sport command center</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-court-live/20 bg-court-live/10 px-3 py-1.5 text-xs font-bold text-court-live sm:flex">
            <span className="live-dot h-1.5 w-1.5" />
            Live data connected
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6 lg:py-10">
        <div className="mb-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-court-muted">
              <Layers3 className="h-3.5 w-3.5 text-court-accent" />
              Your dashboards
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Live sports intelligence, one consistent workspace.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-court-muted">
              Match centers, predictions, standings, scorers, and brackets now share one visual system built for scanning first and drilling in second.
            </p>
          </div>
          <div className="surface-card-quiet rounded-lg p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-court-muted">Signal stack</div>
              <BadgeCheck className="h-4 w-4 text-court-live" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Sports" value={2} detail="active desks" />
              <Stat label="Feeds" value={3} detail="API surfaces" />
              <Stat label="Mode" value="Live" detail="auto refresh" />
            </div>
          </div>
        </div>

        <div className="ticker-track mb-6 overflow-hidden rounded-lg border border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-court-muted">
            <span className="inline-flex items-center gap-2 text-white">
              <span className="live-dot h-1.5 w-1.5" />
              Live board
            </span>
            <span>NBA predictions refresh every 5 minutes</span>
            <span className="hidden text-white/20 sm:inline">/</span>
            <span>World Cup matches refresh every minute</span>
            <span className="hidden text-white/20 sm:inline">/</span>
            <span>Shared navigation and stats language across sports</span>
          </div>
        </div>

        <div className="stagger-in grid grid-cols-1 gap-6 lg:max-w-6xl lg:grid-cols-2">
          <BasketballCard />
          <WorldCupCard />
        </div>
      </main>
    </div>
  );
}
