"use client";

import { Check } from "lucide-react";
import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import type { NBAStaticTeam } from "@/lib/types";

interface Props {
  selected: NBAStaticTeam;
  onChange: (team: NBAStaticTeam) => void;
}

const CONFERENCES = ["East", "West"] as const;

export default function TeamSelector({ selected, onChange }: Props) {
  const byConference = (conference: "East" | "West") =>
    NBA_TEAMS.filter((team) => team.conference === conference).sort((a, b) => a.city.localeCompare(b.city));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CONFERENCES.map((conference) => (
        <div key={conference}>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-court-muted">
            {conference}ern Conference
          </div>
          <div className="grid gap-1">
            {byConference(conference).map((team) => {
              const isSelected = team.id === selected.id;
              const color = TEAM_COLORS[team.tricode]?.primary ?? "#6b7280";
              return (
                <button
                  key={team.id}
                  onClick={() => onChange(team)}
                  className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "border-court-accent bg-court-accent/10 text-white"
                      : "border-transparent text-court-muted hover:border-court-border hover:bg-court-surface hover:text-white"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="truncate">
                    {team.city} {team.name}
                  </span>
                  <span className="ml-auto font-mono text-xs text-court-muted">{team.tricode}</span>
                  {isSelected && <Check className="h-4 w-4 text-court-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
