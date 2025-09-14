// =============================
// components/plan/EditControls.tsx
// =============================
"use client";
import React from "react";
import type { Planned, Day } from "../../lib/types";
import { DAY_NAMES } from "../../lib/types";
import { dayTimeToAbs, fmtHHMM } from "../../lib/time";
import { minutesToDayTime } from "../utils/time-ui";

export type EditControlsProps = {
  plan: Planned;
  onUpdate: (id: string, updates: Partial<Planned>) => void;
};

export function EditControls({ plan, onUpdate }: EditControlsProps) {
  const start = minutesToDayTime(plan.startMin);
  const end = minutesToDayTime(plan.endMin);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="w-10 text-gray-500">Start</span>
        <select
          value={start.day}
          onChange={(e) => {
            const day = Number(e.target.value) as Day;
            const newStart = dayTimeToAbs(day, start.time);
            const dur = plan.endMin - plan.startMin;
            onUpdate(plan.id, { startMin: newStart, endMin: newStart + dur });
          }}
          className="border rounded-lg px-2 py-1"
        >
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={start.time}
          onChange={(e) => {
            const newStart = dayTimeToAbs(start.day, e.target.value);
            const dur = plan.endMin - plan.startMin;
            onUpdate(plan.id, { startMin: newStart, endMin: newStart + dur });
          }}
          className="border rounded-lg px-2 py-1"
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="w-10 text-gray-500">End</span>
        <select
          value={end.day}
          onChange={(e) => {
            const day = Number(e.target.value) as Day;
            const newEnd = dayTimeToAbs(day, end.time);
            onUpdate(plan.id, { endMin: newEnd });
          }}
          className="border rounded-lg px-2 py-1"
        >
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={end.time}
          onChange={(e) => {
            const newEnd = dayTimeToAbs(end.day, e.target.value);
            onUpdate(plan.id, { endMin: newEnd });
          }}
          className="border rounded-lg px-2 py-1"
        />
      </label>

      <div className="col-span-2 text-[11px] text-gray-500 mt-1">
        {fmtHHMM(plan.startMin)} → {fmtHHMM(plan.endMin)}
      </div>
    </div>
  );
}
