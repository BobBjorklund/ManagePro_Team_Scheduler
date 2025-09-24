// Map score 0..1 to a classic RdYlGn gradient without importing a big lib.
// You can swap to d3-scale-chromatic later if you like.
export function scoreToRgb(score: number): string {
  const s = Math.max(0, Math.min(1, score ?? 0));
  // simple two-step lerp: red->yellow (0..0.5), yellow->green (0.5..1)
  if (s <= 0.5) {
    const t = s / 0.5; // 0..1
    // red (220, 38, 38) -> yellow (234, 179, 8)
    const r = Math.round(220 + (234 - 220) * t);
    const g = Math.round(38 + (179 - 38) * t);
    const b = Math.round(38 + (8 - 38) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = (s - 0.5) / 0.5; // 0..1
    // yellow (234, 179, 8) -> green (22, 163, 74)
    const r = Math.round(234 + (22 - 234) * t);
    const g = Math.round(179 + (163 - 179) * t);
    const b = Math.round(8 + (74 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

export function textColorFor(score: number): string {
  // Make text dark on yellow/green, light on intense red
  return score < 0.2 ? "white" : "black";
}
