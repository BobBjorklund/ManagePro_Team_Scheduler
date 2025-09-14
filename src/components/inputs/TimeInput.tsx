// =============================
// components/inputs/TimeInput.tsx
// =============================
"use client";
import React from "react";

export type TimeInputProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
};

export function TimeInput({ label, value, onChange }: TimeInputProps) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-xs text-gray-500 w-10">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-lg px-2 py-1"
      />
    </label>
  );
}
