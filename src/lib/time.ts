// lib/time.ts
import { Day, Interval, MINUTES_IN_DAY, Planned } from "./types";

export const uid = (p = "id") =>
  `${p}_${Math.random().toString(36).slice(2, 9)}`;

export const hhmmToMins = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h * 60 + m) % MINUTES_IN_DAY;
};

export const minsToHHMM = (mins: number) => {
  const h = Math.floor(mins / 60) % 24,
    m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
export function fmtHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
export const dayTimeToAbs = (day: Day, hhmm: string) =>
  day * MINUTES_IN_DAY + hhmmToMins(hhmm);

export function toAbsInterval(
  startDay: Day,
  start: string,
  endDay: Day,
  end: string
): Interval {
  const s = dayTimeToAbs(startDay, start);
  let e = dayTimeToAbs(endDay, end);
  if (e <= s) e += 7 * MINUTES_IN_DAY; // wrap
  return { startMin: s, endMin: e };
}

export const intersect = (a: Interval, b: Interval): Interval | null => {
  const s = Math.max(a.startMin, b.startMin);
  const e = Math.min(a.endMin, b.endMin);
  return e > s ? { startMin: s, endMin: e } : null;
};

export function mergeIntervals(list: Interval[]): Interval[] {
  if (!list.length) return [];
  const s = [...list].sort((a, b) => a.startMin - b.startMin);
  const out: Interval[] = [{ ...s[0] }];
  for (let i = 1; i < s.length; i++) {
    const last = out[out.length - 1];
    if (s[i].startMin <= last.endMin)
      last.endMin = Math.max(last.endMin, s[i].endMin);
    else out.push({ ...s[i] });
  }
  return out;
}

export function minus(a: Interval, b: Interval): Interval[] {
  if (b.endMin <= a.startMin || b.startMin >= a.endMin) return [a];
  const out: Interval[] = [];
  if (b.startMin > a.startMin)
    out.push({ startMin: a.startMin, endMin: Math.min(b.startMin, a.endMin) });
  if (b.endMin < a.endMin)
    out.push({ startMin: Math.max(b.endMin, a.startMin), endMin: a.endMin });
  return out.filter((iv) => iv.endMin > iv.startMin);
}

export const subtractMany = (base: Interval[], holes: Interval[]) =>
  mergeIntervals(holes).reduce(
    (acc, h) => acc.flatMap((iv) => minus(iv, h)),
    mergeIntervals(base)
  );

export const sliceInto = (win: Interval, len: number, step = 15) => {
  const slots: Interval[] = [];
  for (
    let t = Math.ceil(win.startMin / step) * step;
    t + len <= win.endMin;
    t += step
  )
    slots.push({ startMin: t, endMin: t + len });
  return slots;
};

export const sameDay = (iv: Interval) =>
  Math.floor(iv.startMin / MINUTES_IN_DAY) as Day;

export const overlaps = (xs: Interval[], c: Interval) =>
  xs.some((m) => !(c.endMin <= m.startMin || m.endMin <= c.startMin));
export function sliceIntoSlots(
  win: Interval,
  slotMinutes: number,
  stepMinutes = 15
): Interval[] {
  const slots: Interval[] = [];
  for (
    let t = Math.ceil(win.startMin / stepMinutes) * stepMinutes;
    t + slotMinutes <= win.endMin;
    t += stepMinutes
  ) {
    slots.push({ startMin: t, endMin: t + slotMinutes });
  }
  return slots;
}
