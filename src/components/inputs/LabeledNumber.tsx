// =============================
// components/inputs/LabeledNumber.tsx
// =============================
"use client";
import React from "react";

export type LabeledNumberProps = {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
};

export function LabeledNumber({
  label,
  value,
  setValue,
  min,
  max,
  step,
}: LabeledNumberProps) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="number"
        className="border rounded-lg px-2 py-1 w-24 text-right"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </label>
  );
}
