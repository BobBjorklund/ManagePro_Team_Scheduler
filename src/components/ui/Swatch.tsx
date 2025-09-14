// =============================
// components/ui/Swatch.tsx
// =============================
"use client";
import React from "react";

export type SwatchProps = {
  color: string;
  title?: string;
  variant?: "solid" | "ring";
};

export function Swatch({ color, title, variant = "solid" }: SwatchProps) {
  const style: React.CSSProperties =
    variant === "solid"
      ? { backgroundColor: color }
      : { boxShadow: `inset 0 0 0 2px ${color}` };
  return (
    <span
      title={title}
      className={`inline-block rounded-md h-4 w-6 ${
        variant === "solid" ? "" : "bg-white"
      }`}
      style={style}
    />
  );
}
