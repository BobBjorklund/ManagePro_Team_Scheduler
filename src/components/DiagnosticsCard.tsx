"use client";
import React from "react";
import { DAY_NAMES } from "@/lib/types";
import { LabeledNumber } from "./inputs/LabeledNumber";

type Mode = "1on1" | "team" | "scramble";

type CoverageRow = {
  id: string;
  name: string;
  oneCount: number;
  teamCount: number;
  conversations: number;
};

type Stats = {
  oneOnOneCount: number;
  teamCount: number;
  totalHeadcount: number;
  unique1on1Employees: number;
};

type Props = {
  mode: Mode;
  managerWindowCount: number;
  employeeCount: number;
  stats: Stats;
  unscheduled1on1s: string[];
  dayConvos: number[]; // length 7
  coverage: CoverageRow[];
  targetConversations: number;
  setTargetConversations: (v: number) => void;
};

const DiagnosticsCard: React.FC<Props> = ({
  mode,
  managerWindowCount,
  employeeCount,
  stats,
  unscheduled1on1s,
  dayConvos,
  coverage,
  targetConversations,
  setTargetConversations,
}) => {
  const maxDayConvos = Math.max(0, ...dayConvos);
  const heatClass = (count: number) => {
    if (maxDayConvos === 0) return "bg-gray-100";
    const r = count / maxDayConvos;
    if (r === 0) return "bg-gray-100";
    if (r < 0.25) return "bg-indigo-200";
    if (r < 0.5) return "bg-indigo-300";
    if (r < 0.75) return "bg-indigo-400";
    return "bg-indigo-500";
  };

  return (
    <div>
      <h2 className="font-medium mb-3">Diagnostics</h2>
      <ul className="text-sm list-disc pl-5 space-y-2">
        <li>
          Mode: <strong>{mode}</strong>
        </li>
        <li>
          Manager windows: <strong>{managerWindowCount}</strong>
        </li>
        <li>
          Employees: <strong>{employeeCount}</strong>
        </li>
        <li>
          Planned 1-on-1s: <strong>{stats.oneOnOneCount}</strong>{" "}
          <span className="text-gray-500">
            (unique employees: {stats.unique1on1Employees}/{employeeCount})
          </span>
        </li>
        <li>
          Planned meetings: <strong>{stats.teamCount}</strong>
        </li>
        <li>
          Total meeting headcount: <strong>{stats.totalHeadcount}</strong>
        </li>
        {(mode === "1on1" || mode === "scramble") &&
          unscheduled1on1s.length > 0 && (
            <li className="text-amber-600">
              Unscheduled 1:1s: {unscheduled1on1s.join(", ")}. Adjust
              availability or rules.
            </li>
          )}
      </ul>

      <div className="mt-3">
        <h3 className="font-medium text-sm mb-2">Conversations by day</h3>
        <div className="grid grid-cols-7 gap-2">
          {DAY_NAMES.map((d, i) => (
            <div key={i} className="text-center">
              <div
                className={`h-8 rounded ${heatClass(
                  dayConvos[i]
                )} flex items-center justify-center text-xs text-white`}
                title={`${d}: ${dayConvos[i]}`}
              >
                {dayConvos[i]}
              </div>
              <div className="text-[11px] mt-1 text-gray-600">{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm">Coverage by employee</h3>
          <div className="w-56">
            <LabeledNumber
              label="Target conv/employee"
              value={targetConversations}
              setValue={setTargetConversations}
              min={1}
              max={10}
              step={1}
            />
          </div>
        </div>
        <ul className="text-sm space-y-1">
          {coverage.length === 0 ? (
            <li className="text-gray-500">No employees yet.</li>
          ) : (
            coverage.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4"
              >
                <span className="truncate">{c.name}</span>
                <span
                  className={`${
                    c.conversations < targetConversations
                      ? "text-red-600"
                      : "text-green-700"
                  }`}
                >
                  {c.conversations}/{targetConversations}
                  <span className="text-gray-500 ml-2">
                    (1:1s {c.oneCount}, team {c.teamCount})
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default DiagnosticsCard;
