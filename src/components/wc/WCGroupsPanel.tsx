"use client";

import useSWR from "swr";
import { ShieldCheck } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface StandingRow {
  position: number;
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface Standing {
  stage: string;
  type: string;
  group: string | null;
  table: StandingRow[];
}

interface GroupsResponse {
  standings: Standing[];
  error?: string;
  retryAfterSeconds?: number;
}

function groupName(group: string | null) {
  if (!group) return "Unknown";
  if (group.startsWith("GROUP_")) return group.replace("GROUP_", "Group ");
  return group;
}

function FormPip({ result }: { result: string }) {
  const color = result === "W" ? "bg-court-live" : result === "D" ? "bg-court-amber" : "bg-court-red";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} title={result} />;
}

function GroupTable({ standing }: { standing: Standing }) {
  return (
    <div className="surface-card-quiet overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-widest text-court-worldcup">{groupName(standing.group)}</span>
        <span className="text-[10px] font-semibold text-court-muted">Top 2 safe</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-court-border/60 text-court-muted">
            <th className="w-6 py-2 pl-4 text-left font-semibold">#</th>
            <th className="py-2 text-left font-semibold">Team</th>
            <th className="w-7 py-2 text-center font-semibold">P</th>
            <th className="w-7 py-2 text-center font-semibold">W</th>
            <th className="w-7 py-2 text-center font-semibold">D</th>
            <th className="w-7 py-2 text-center font-semibold">L</th>
            <th className="w-9 py-2 text-center font-semibold">GD</th>
            <th className="w-9 py-2 pr-4 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standing.table.map((row, index) => {
            const advancing = index < 2;
            return (
              <tr key={row.team.id} className={`border-b border-court-border/30 last:border-0 ${advancing ? "bg-court-worldcup/5" : ""}`}>
                <td className="py-2 pl-4">
                  <span className={`text-xs font-bold ${advancing ? "text-court-worldcup" : "text-court-muted"}`}>{row.position}</span>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <img src={row.team.crest} alt={row.team.tla} className="h-4 w-4 shrink-0 object-contain" />
                    <span className={`truncate font-semibold ${advancing ? "text-white" : "text-court-muted"}`}>
                      {row.team.shortName || row.team.name}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-center text-court-muted">{row.playedGames}</td>
                <td className="py-2 text-center font-semibold text-white">{row.won}</td>
                <td className="py-2 text-center text-court-muted">{row.draw}</td>
                <td className="py-2 text-center text-court-muted">{row.lost}</td>
                <td className="py-2 text-center text-court-muted">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className="py-2 pr-4 text-center font-black text-white">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {standing.table.some((row) => row.form) && (
        <div className="border-t border-court-border/30 px-4 py-2">
          {standing.table.map((row) =>
            row.form ? (
              <div key={row.team.id} className="mb-1 flex items-center gap-2 last:mb-0">
                <span className="w-8 text-[10px] uppercase text-court-muted">{row.team.tla}</span>
                <div className="flex gap-1">
                  {row.form.split("").map((result, index) => (
                    <FormPip key={`${row.team.id}-${index}`} result={result} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

export default function WCGroupsPanel() {
  const { data, error, isLoading } = useSWR<GroupsResponse>("/api/wc/standings", fetcher, {
    refreshInterval: 5 * 60_000,
  });

  if (isLoading) {
    return <div className="surface-card-quiet loading-shimmer rounded-lg p-10 text-center text-sm text-court-muted"><span className="loading-dots">Loading standings</span></div>;
  }

  if (data?.error) {
    return (
      <div className="surface-card-quiet rounded-lg p-6 text-center">
        <p className="text-sm text-court-muted">{data.error}</p>
        {(data.retryAfterSeconds ?? 0) > 0 && (
          <p className="mt-1 text-xs text-court-muted">Retry in {data.retryAfterSeconds}s - cached data will auto-refresh.</p>
        )}
      </div>
    );
  }

  if (error || !data) {
    return <div className="surface-card-quiet rounded-lg p-6 text-center text-sm text-court-muted">Failed to load group standings.</div>;
  }

  const groups = data.standings.filter((standing) => standing.group !== null);
  const completedRows = groups.flatMap((standing) => standing.table).filter((row) => row.playedGames > 0);

  if (!groups.length) {
    return (
      <div className="surface-card-quiet rounded-lg p-10 text-center text-sm text-court-muted">
        Group standings are not available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-card-quiet rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4 text-xs text-court-muted">
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-court-worldcup" />
            {groups.length} groups loaded
          </span>
          <span>Top 2 advance automatically.</span>
          <span>8 best third-place teams also advance.</span>
          <span>{completedRows.length} teams have played.</span>
        </div>
      </div>

      <div className="stagger-in grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((standing) => (
          <GroupTable key={standing.group} standing={standing} />
        ))}
      </div>
    </div>
  );
}
