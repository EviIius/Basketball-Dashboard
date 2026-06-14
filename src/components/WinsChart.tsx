"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import type { TeamSeasonRecord } from "@/lib/types";

interface Props {
  seasons: TeamSeasonRecord[];
  teamColor: string;
  teamName: string;
  mode: "winloss" | "ppg" | "shooting";
}

interface TooltipPayload {
  value: number;
  name: string;
  color: string;
  payload?: TeamSeasonRecord;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const season = payload[0].payload;

  return (
    <div className="bg-court-surface border border-court-border rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
      <div className="text-white text-sm font-semibold mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="text-xs flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-court-muted">{p.name}:</span>
          <span className="text-white font-mono ml-auto">
            {typeof p.value === "number" && p.value < 1 && p.value > 0
              ? `${(p.value * 100).toFixed(1)}%`
              : p.value}
          </span>
        </div>
      ))}
      {season?.finalsAppearance && season.finalsAppearance !== "N/A" && (
        <div className="text-court-accent text-[10px] font-bold uppercase tracking-wider mt-1.5 pt-1.5 border-t border-court-border">
          🏆 {season.finalsAppearance}
        </div>
      )}
      {season && (season.playoffWins > 0 || season.playoffLosses > 0) && (
        <div className="text-court-muted text-[10px] mt-1">
          Playoffs: {season.playoffWins}–{season.playoffLosses}
        </div>
      )}
    </div>
  );
}

export default function WinsChart({ seasons, teamColor, teamName, mode }: Props) {
  if (!seasons.length) return null;
  const displaySeasons = seasons.slice(-25);

  const renderLines = () => {
    if (mode === "winloss") {
      return (
        <>
          <ReferenceLine
            y={41}
            stroke="#2a2a3d"
            strokeDasharray="4 4"
            label={{ value: ".500", fill: "#4b5563", fontSize: 10, position: "right" }}
          />
          <Line
            type="monotone"
            dataKey="wins"
            name="Wins"
            stroke={teamColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="losses"
            name="Losses"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </>
      );
    }
    if (mode === "ppg") {
      return (
        <>
          <Line
            type="monotone"
            dataKey="ppg"
            name="PPG"
            stroke={teamColor}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="apg"
            name="APG"
            stroke="#22d3ee"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="rpg"
            name="RPG"
            stroke="#a78bfa"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </>
      );
    }
    return (
      <>
        <Line
          type="monotone"
          dataKey="fgPct"
          name="FG%"
          stroke={teamColor}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="fg3Pct"
          name="3P%"
          stroke="#22d3ee"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="ftPct"
          name="FT%"
          stroke="#a78bfa"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </>
    );
  };

  const yDomain: [number, number] | undefined =
    mode === "winloss" ? [0, 82] : mode === "shooting" ? [0, 1] : undefined;

  const yTicks =
    mode === "winloss" ? [0, 20, 41, 60, 82] : mode === "shooting" ? [0, 0.25, 0.5, 0.75, 1] : undefined;

  const formatYTick = (value: number) =>
    mode === "shooting" ? `${(value * 100).toFixed(0)}%` : String(value);

  const description = {
    winloss: "Wins vs Losses · last 25 regular seasons",
    ppg: "Points / Assists / Rebounds per game · last 25 seasons",
    shooting: "FG% / 3P% / FT% · last 25 seasons",
  }[mode];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={displaySeasons} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3d" vertical={false} />
          <XAxis
            dataKey="season"
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#2a2a3d" }}
            interval={Math.max(0, Math.floor(displaySeasons.length / 6))}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={yDomain ?? ["dataMin", "dataMax"]}
            ticks={yTicks}
            tickFormatter={formatYTick}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => <span style={{ color: "#9ca3af", fontSize: 12 }}>{value}</span>}
            wrapperStyle={{ paddingTop: 4 }}
          />
          {renderLines()}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-court-muted text-xs text-center mt-1">
        {teamName} — {description}
      </p>
    </div>
  );
}
