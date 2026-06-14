"use client";

import { NBA_TEAMS, TEAM_COLORS } from "@/lib/nbaTeams";
import type { NBAStaticTeam } from "@/lib/types";

interface Props {
  selected: NBAStaticTeam;
  onChange: (team: NBAStaticTeam) => void;
}

const CONFERENCES = ["East", "West"] as const;

export default function TeamSelector({ selected, onChange }: Props) {
  const byConference = (conf: "East" | "West") =>
    NBA_TEAMS.filter((t) => t.conference === conf).sort((a, b) =>
      a.city.localeCompare(b.city)
    );

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
      {CONFERENCES.map((conf) => (
        <div key={conf}>
          <div className="text-court-muted text-xs font-bold uppercase tracking-wider mb-2">
            {conf}ern Conference
          </div>
          <div className="space-y-1">
            {byConference(conf).map((team) => {
              const isSelected = team.id === selected.id;
              const color = TEAM_COLORS[team.tricode]?.primary ?? "#6b7280";
              return (
                <button
                  key={team.id}
                  onClick={() => onChange(team)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-sm ${
                    isSelected
                      ? "bg-court-card border border-court-accent/60 text-white"
                      : "hover:bg-court-card text-court-muted hover:text-white border border-transparent"
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate">{team.city} {team.name}</span>
                  {isSelected && (
                    <span className="ml-auto text-xs font-mono text-court-muted">{team.tricode}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
