"use client";
import React from "react";
import { Clock } from "lucide-react";
import { ManagerWindow, DAY_NAMES, Day, AvailPresetKey } from "@/lib/types";
import { TimeInput } from "./inputs/TimeInput";

type Props = {
  managerWindows: ManagerWindow[];
  setManagerWindowDay: (idx: number, day: Day) => void;
  setManagerWindowStart: (idx: number, val: string) => void;
  setManagerWindowEnd: (idx: number, val: string) => void;
  removeManagerWindow: (idx: number) => void;

  newAvailDay: Day;
  setNewAvailDay: (d: Day) => void;
  newAvailPreset: AvailPresetKey;
  setNewAvailPreset: (p: AvailPresetKey) => void;
  addManagerWindowFromPreset: () => void;
};

const AvailabilityCard: React.FC<Props> = ({
  managerWindows,
  setManagerWindowDay,
  setManagerWindowStart,
  setManagerWindowEnd,
  removeManagerWindow,
  newAvailDay,
  setNewAvailDay,
  newAvailPreset,
  setNewAvailPreset,
  addManagerWindowFromPreset,
}) => {
  return (
    <div className="p-4 rounded-2xl shadow border bg-white overflow-hidden">
      <h2 className="font-medium mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Your Availability
      </h2>

      <div className="space-y-3">
        {managerWindows.map((w, i) => (
          <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
            <select
              value={w.day}
              onChange={(ev) =>
                setManagerWindowDay(i, Number(ev.target.value) as Day)
              }
              className="border rounded-lg px-2 py-1"
            >
              {DAY_NAMES.map((d, i2) => (
                <option key={i2} value={i2}>
                  {d}
                </option>
              ))}
            </select>

            <TimeInput
              label="Start"
              value={w.start}
              onChange={(val) => setManagerWindowStart(i, val)}
            />
            <span>→</span>
            <TimeInput
              label="End"
              value={w.end}
              onChange={(val) => setManagerWindowEnd(i, val)}
            />

            <button
              className="text-xs px-2 py-1 rounded-full border shrink-0"
              onClick={() => removeManagerWindow(i)}
            >
              Remove
            </button>
          </div>
        ))}

        {/* Preset quick-add */}
        <div className="flex items-center gap-2 pt-1">
          <select
            className="border rounded-lg px-2 py-1"
            value={newAvailDay}
            onChange={(e) => setNewAvailDay(Number(e.target.value) as Day)}
          >
            {DAY_NAMES.map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>

          <select
            className="border rounded-lg px-2 py-1"
            value={newAvailPreset}
            onChange={(e) =>
              setNewAvailPreset(e.target.value as AvailPresetKey)
            }
          >
            <option value="4a-7a">4a–7a</option>
            <option value="330a-7a">3:30a–7a</option>
            <option value="12a-7a">12a–7a</option>
            <option value="11p-7a">11p–7a</option>
            <option value="custom">Custom…</option>
          </select>

          <button
            className="px-3 py-2 rounded-xl border"
            onClick={addManagerWindowFromPreset}
          >
            + Add window
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityCard;
