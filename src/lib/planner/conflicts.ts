import { Planned } from "@/lib/types";

export function timeOverlaps(a: Planned, b: Planned) {
  return !(a.endMin <= b.startMin || b.endMin <= a.startMin);
}
export function meetingsConflict(a: Planned, b: Planned) {
  return timeOverlaps(a, b);
}
export function mergeWithoutConflicts(
  existing: Planned[],
  candidates: Planned[]
) {
  const result = [...existing];
  const seen = new Set(existing.map((p) => p.id));
  for (const p of candidates) {
    if (seen.has(p.id)) continue;
    const collides = result.some((q) => meetingsConflict(p, q));
    if (!collides) {
      result.push(p);
      seen.add(p.id);
    }
  }
  return result;
}
export function stripInternalConflicts(candidates: Planned[]) {
  const kept: Planned[] = [];
  const seen = new Set<string>();
  for (const p of candidates) {
    if (seen.has(p.id)) continue;
    const collides = kept.some((q) => meetingsConflict(p, q));
    if (!collides) {
      kept.push(p);
      seen.add(p.id);
    }
  }
  return kept;
}
