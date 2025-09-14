"use client";
import React from "react";
import { Settings, RefreshCw } from "lucide-react";
import { LabeledNumber } from "./inputs/LabeledNumber";

type Mode = "1on1" | "team" | "scramble";

type Props = {
  mode: Mode;
  setMode: (m: Mode) => void;

  slotMinutes: number;
  setSlotMinutes: (v: number) => void;

  bufferMinutes: number;
  setBufferMinutes: (v: number) => void;

  maxPerDay: number;
  setMaxPerDay: (v: number) => void;

  sessionMinutes: number;
  setSessionMinutes: (v: number) => void;

  maxPerEmployeePerDay: number;
  setMaxPerEmployeePerDay: (v: number) => void;

  appendGenerate: boolean;
  setAppendGenerate: (v: boolean) => void;

  runOptimize: () => void;
  clearPlan: () => void;
};

const ModeRulesCard: React.FC<Props> = ({
  mode,
  setMode,
  slotMinutes,
  setSlotMinutes,
  bufferMinutes,
  setBufferMinutes,
  maxPerDay,
  setMaxPerDay,
  sessionMinutes,
  setSessionMinutes,
  maxPerEmployeePerDay,
  setMaxPerEmployeePerDay,
  appendGenerate,
  setAppendGenerate,
  runOptimize,
  clearPlan,
}) => {
  return (
    <div className="p-4 rounded-2xl shadow border bg-white overflow-hidden">
      <h2 className="font-medium mb-3 flex items-center gap-2">
        <Settings className="w-4 h-4" />
        Mode & Rules
      </h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setMode("1on1")}
          className={`px-3 py-1 rounded-full border ${
            mode === "1on1" ? "bg-black text-white" : ""
          }`}
        >
          1-on-1 week
        </button>
        <button
          onClick={() => setMode("team")}
          className={`px-3 py-1 rounded-full border ${
            mode === "team" ? "bg-black text-white" : ""
          }`}
        >
          Team week
        </button>
        <button
          onClick={() => setMode("scramble")}
          className={`px-3 py-1 rounded-full border ${
            mode === "scramble" ? "bg-black text-white" : ""
          }`}
        >
          Last-minute scramble
        </button>
      </div>

      {mode === "1on1" ? (
        <div className="space-y-3">
          <LabeledNumber
            label="1:1 duration (min)"
            value={slotMinutes}
            setValue={setSlotMinutes}
            min={15}
            max={90}
            step={5}
          />
          <LabeledNumber
            label="Cooldown buffer (min)"
            value={bufferMinutes}
            setValue={setBufferMinutes}
            min={5}
            max={60}
            step={5}
          />
          <LabeledNumber
            label="Max per day"
            value={maxPerDay}
            setValue={setMaxPerDay}
            min={1}
            max={8}
            step={1}
          />
          <LabeledNumber
            label="Max per employee/day"
            value={maxPerEmployeePerDay}
            setValue={setMaxPerEmployeePerDay}
            min={1}
            max={8}
            step={1}
          />
        </div>
      ) : mode === "team" ? (
        <div className="space-y-3">
          <LabeledNumber
            label="Team session length (min)"
            value={sessionMinutes}
            setValue={setSessionMinutes}
            min={15}
            max={120}
            step={5}
          />
          <p className="text-sm text-gray-600">
            Goal: cover 100% of employees with minimal number of sessions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Scramble schedules both <strong>team sessions</strong> to hit 100%
            coverage and <strong>1:1s</strong> for as many people as possible,
            packing early.
          </p>
          <LabeledNumber
            label="Team session length (min)"
            value={sessionMinutes}
            setValue={setSessionMinutes}
            min={15}
            max={120}
            step={5}
          />
          <LabeledNumber
            label="1:1 duration (min)"
            value={slotMinutes}
            setValue={setSlotMinutes}
            min={15}
            max={90}
            step={5}
          />
          <LabeledNumber
            label="Cooldown buffer (min)"
            value={bufferMinutes}
            setValue={setBufferMinutes}
            min={5}
            max={60}
            step={5}
          />
          <LabeledNumber
            label="Max 1:1 per day"
            value={maxPerDay}
            setValue={setMaxPerDay}
            min={1}
            max={8}
            step={1}
          />
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={runOptimize}
          className="px-3 py-2 rounded-xl bg-black text-white flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Generate
        </button>
        <button onClick={clearPlan} className="px-3 py-2 rounded-xl border">
          Clear plan
        </button>
        <div className="flex items-center gap-2 mt-2">
          <label className="text-sm inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={appendGenerate}
              onChange={(e) => setAppendGenerate(e.target.checked)}
            />
            Append when generating (don’t replace)
          </label>
        </div>
      </div>
    </div>
  );
};

export default ModeRulesCard;
