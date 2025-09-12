// lib/availability.ts
import {
  BreakInput,
  Day,
  Employee,
  Interval,
  ManagerWindow,
  MINUTES_IN_DAY,
  ShiftInput,
  ShiftAbs,
  Planned,
} from "./types";
import {
  hhmmToMins,
  toAbsInterval,
  intersect,
  mergeIntervals,
  subtractMany,
  sliceIntoSlots,
} from "./time";
export function expandShiftsAbs(employees: Employee[]): ShiftAbs[] {
  const out: ShiftAbs[] = [];
  employees.forEach((e) => {
    e.shifts.forEach((s) => {
      const startDay = s.day;
      const endDay: Day = (
        hhmmToMins(s.end) <= hhmmToMins(s.start) ? (s.day + 1) % 7 : s.day
      ) as Day;
      const iv = toAbsInterval(startDay, s.start, endDay, s.end);
      out.push({ ...iv, employeeId: e.id });
    });
  });
  return out;
}
export function shiftMinusBreaks(
  day: Day,
  start: string,
  end: string,
  breaks: BreakInput[] | undefined
): Interval[] {
  const endDay: Day = (
    hhmmToMins(end) <= hhmmToMins(start) ? (day + 1) % 7 : day
  ) as Day;
  const shift = toAbsInterval(day, start, endDay, end);
  const holes = (breaks ?? []).map((b) => {
    const bEndDay: Day = (
      hhmmToMins(b.end) <= hhmmToMins(b.start) ? (day + 1) % 7 : day
    ) as Day;
    return toAbsInterval(day, b.start, bEndDay, b.end);
  });
  return subtractMany([shift], holes);
}

export function expandManagerWindowsAbs(wins: ManagerWindow[]): Interval[] {
  const out: Interval[] = [];
  for (const w of wins) {
    const endDay: Day = (
      hhmmToMins(w.end) <= hhmmToMins(w.start) ? (w.day + 1) % 7 : w.day
    ) as Day;
    out.push(toAbsInterval(w.day, w.start, endDay, w.end));
  }
  return out;
}
export function countDayMeetings(existing: Planned[], cand: Interval): number {
  const day = Math.floor(cand.startMin / MINUTES_IN_DAY);
  return existing.filter((m) => Math.floor(m.startMin / MINUTES_IN_DAY) === day)
    .length;
}
export function intersectEmployeeWithManager(
  shifts: ShiftAbs[],
  managerWins: Interval[]
): Record<string, Interval[]> {
  const byEmp: Record<string, Interval[]> = {};
  shifts.forEach((s) => {
    managerWins.forEach((mw) => {
      const iv = intersect(s, mw);
      if (iv) {
        if (!byEmp[s.employeeId]) byEmp[s.employeeId] = [];
        byEmp[s.employeeId].push(iv);
      }
    });
  });
  // merge overlapping per employee
  Object.keys(byEmp).forEach((eid) => {
    const list = byEmp[eid].sort((a, b) => a.startMin - b.startMin);
    const merged: Interval[] = [];
    for (const iv of list) {
      const last = merged[merged.length - 1];
      if (last && iv.startMin <= last.endMin)
        last.endMin = Math.max(last.endMin, iv.endMin);
      else merged.push({ ...iv });
    }
    byEmp[eid] = merged;
  });
  return byEmp;
}
// Employee -> merged availability (shifts minus breaks ∩ manager windows)
export function availabilityByEmployee(
  employees: Employee[],
  managerWins: Interval[]
): Record<string, Interval[]> {
  const byEmp: Record<string, Interval[]> = {};
  for (const e of employees) {
    const base = e.shifts.flatMap((s) =>
      shiftMinusBreaks(s.day, s.start, s.end, s.breaks)
    );
    const hits: Interval[] = [];
    for (const m of managerWins)
      for (const iv of base) {
        const j = intersect(iv, m);
        if (j) hits.push(j);
      }
    byEmp[e.id] = mergeIntervals(hits);
  }
  return byEmp;
}
export function shiftIntervalsMinusBreaks(s: ShiftInput): Interval[] {
  const startDay = s.day;
  const endDay: Day = (
    hhmmToMins(s.end) <= hhmmToMins(s.start) ? (s.day + 1) % 7 : s.day
  ) as Day;
  const shiftAbs = toAbsInterval(startDay, s.start, endDay, s.end);

  const holes: Interval[] = (s.breaks ?? [])
    .map((b) => {
      const bEndDay: Day = (
        hhmmToMins(b.end) <= hhmmToMins(b.start) ? (s.day + 1) % 7 : s.day
      ) as Day;
      const iv = toAbsInterval(s.day, b.start, bEndDay, b.end);
      // clamp to shift just in case
      const j = intersect(shiftAbs, iv);
      return j ?? { startMin: 0, endMin: 0 }; // junk will be filtered
    })
    .filter((iv) => iv.endMin > iv.startMin);

  return subtractMany([shiftAbs], holes);
}
export function minutesOf(intervals: Interval[]): number {
  return intervals.reduce((s, iv) => s + (iv.endMin - iv.startMin), 0);
}

// Build overlap map (employee -> merged intervals overlapped with manager windows)
export function overlapsByEmployee(
  employees: Employee[],
  managerWins: Interval[]
) {
  const shifts = expandShiftsAbs(employees);
  return intersectEmployeeWithManager(shifts, managerWins); // already merges per-employee
}
export function overlapsByEmployee_WithBreaks(
  employees: Employee[],
  managerWins: Interval[]
) {
  const byEmp: Record<string, Interval[]> = {};
  for (const e of employees) {
    const minusBreaks = e.shifts.flatMap(shiftIntervalsMinusBreaks);
    // intersect with manager windows
    const hits: Interval[] = [];
    for (const m of managerWins) {
      for (const iv of minusBreaks) {
        const j = intersect(iv, m);
        if (j) hits.push(j);
      }
    }
    byEmp[e.id] = mergeIntervals(hits);
  }
  return byEmp;
}

// Stats used for scarcity: total overlap minutes and slot counts (for a given slot size)
export function availabilityStats(
  byEmp: Record<string, Interval[]>,
  slotLen: number
): Record<string, { minutes: number; slots: number }> {
  const out: Record<string, { minutes: number; slots: number }> = {};
  for (const [eid, ivs] of Object.entries(byEmp)) {
    const minutes = minutesOf(ivs);
    const slots = ivs.reduce(
      (acc, iv) => acc + sliceIntoSlots(iv, slotLen, 15).length,
      0
    );
    out[eid] = { minutes, slots };
  }
  return out;
}

// Does a candidate time overlap any existing sessions (manager can't be in 2 team meetings at once)
export function overlapsAny(existing: Planned[], cand: Interval): boolean {
  return existing.some(
    (m) => !(cand.endMin <= m.startMin || m.endMin <= cand.startMin)
  );
}
export function respectsBuffer(
  existing: Planned[],
  candidate: Interval,
  buffer: number
): boolean {
  const day = Math.floor(candidate.startMin / MINUTES_IN_DAY);
  return existing
    .filter((m) => Math.floor(m.startMin / MINUTES_IN_DAY) === day)
    .every(
      (m) =>
        candidate.endMin + buffer <= m.startMin ||
        m.endMin + buffer <= candidate.startMin
    );
}
