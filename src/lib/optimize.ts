// lib/optimize.ts
import { Employee, Interval, OneOnOne, Planned, TeamSession } from "./types";
import { availabilityByEmployee } from "./availability";
import { sliceInto, overlaps, sameDay } from "./time";

import { uid } from "./time";

// scarcity metrics
const minutes = (ivs: Interval[]) =>
  ivs.reduce((s, iv) => s + (iv.endMin - iv.startMin), 0);

export function optimizeOneOnOnesScarcity(
  employees: Employee[],
  managerWindowsAbs: Interval[],
  slotMinutes: number,
  bufferMinutes: number,
  maxPerDay: number,
  existingBusy: Planned[] = [],
  perEmployeeWeekCap = 1,
  perEmployeeDayCap = 1
): OneOnOne[] {
  const byEmp = availabilityByEmployee(employees, managerWindowsAbs);

  const weekCount = new Map<string, number>();
  const dayCount = new Map<string, Map<number, number>>();

  // Initialize counts for all employees
  employees.forEach((emp) => {
    weekCount.set(emp.id, 0);
    dayCount.set(emp.id, new Map<number, number>());
  });

  const inc = (eid: string, d: number) => {
    weekCount.set(eid, (weekCount.get(eid) ?? 0) + 1);
    const m = dayCount.get(eid) ?? new Map<number, number>();
    m.set(d, (m.get(d) ?? 0) + 1);
    dayCount.set(eid, m);
  };

  const placed: OneOnOne[] = [];
  const busy: Planned[] = [...existingBusy];

  const respectsBuffer = (c: Interval) => {
    const day = sameDay(c);
    const todays = busy.filter(
      (b) => sameDay({ startMin: b.startMin, endMin: b.endMin }) === day
    );
    return todays.every(
      (m) =>
        c.endMin + bufferMinutes <= m.startMin ||
        m.endMin + bufferMinutes <= c.startMin
    );
  };
  const countDay = (c: Interval) =>
    busy.filter(
      (b) => sameDay({ startMin: b.startMin, endMin: b.endMin }) === sameDay(c)
    ).length;

  // Get all time slots for all employees
  const allSlots: { employeeId: string; slot: Interval }[] = [];
  for (const emp of employees) {
    const ivs = byEmp[emp.id] ?? [];
    const slots = ivs
      .flatMap((iv) => sliceInto(iv, slotMinutes, 15))
      .sort((a, b) => a.startMin - b.startMin);

    for (const slot of slots) {
      allSlots.push({ employeeId: emp.id, slot });
    }
  }

  // Sort slots by time to maintain chronological order
  allSlots.sort((a, b) => a.slot.startMin - b.slot.startMin);

  // First pass: ensure everyone gets at least their minimum (up to perEmployeeWeekCap)
  for (const { employeeId, slot } of allSlots) {
    const currentCount = weekCount.get(employeeId) ?? 0;
    if (currentCount >= perEmployeeWeekCap) continue;

    const d = sameDay(slot);
    if ((dayCount.get(employeeId)?.get(d) ?? 0) >= perEmployeeDayCap) continue;
    if (!respectsBuffer(slot)) continue;
    if (countDay(slot) >= maxPerDay) continue;

    // Check if this employee has fewer meetings than others
    const minCount = Math.min(...Array.from(weekCount.values()));
    if (currentCount > minCount) continue; // Skip if this employee already has more than the minimum

    const mtg: OneOnOne = {
      id: uid("oo"),
      type: "1on1",
      employeeId,
      title: "1:1",
      startMin: slot.startMin,
      endMin: slot.endMin,
    };
    placed.push(mtg);
    busy.push(mtg);
    inc(employeeId, d);
  }

  // Second pass: fill remaining slots fairly, but don't exceed the cap
  for (const { employeeId, slot } of allSlots) {
    const currentCount = weekCount.get(employeeId) ?? 0;
    if (currentCount >= perEmployeeWeekCap) continue;

    const d = sameDay(slot);
    if ((dayCount.get(employeeId)?.get(d) ?? 0) >= perEmployeeDayCap) continue;
    if (!respectsBuffer(slot)) continue;
    if (countDay(slot) >= maxPerDay) continue;

    // Only schedule if this slot hasn't been used already
    const slotUsed = placed.some(
      (p) => p.startMin === slot.startMin && p.endMin === slot.endMin
    );
    if (slotUsed) continue;

    const mtg: OneOnOne = {
      id: uid("oo"),
      type: "1on1",
      employeeId,
      title: "1:1",
      startMin: slot.startMin,
      endMin: slot.endMin,
    };
    placed.push(mtg);
    busy.push(mtg);
    inc(employeeId, d);
  }

  return placed.sort((a, b) => a.startMin - b.startMin);
}

export function optimizeTeamWeekWeighted(
  employees: Employee[],
  managerWindowsAbs: Interval[],
  sessionMinutes: number
): TeamSession[] {
  const byEmp = availabilityByEmployee(employees, managerWindowsAbs);
  const minsMap: Record<string, number> = {};
  let maxMin = 0;
  for (const [eid, ivs] of Object.entries(byEmp)) {
    const m = minutes(ivs);
    minsMap[eid] = m;
    maxMin = Math.max(maxMin, m);
  }
  const weight: Record<string, number> = {};
  for (const e of employees) {
    const m = minsMap[e.id] ?? 0;
    const scarcity = maxMin ? (maxMin - m) / maxMin : 1;
    weight[e.id] = 1 + scarcity;
  }

  // candidates
  const cands: { interval: Interval; attendees: string[] }[] = [];
  for (const mw of managerWindowsAbs) {
    const step = 15;
    for (
      let t = Math.ceil(mw.startMin / step) * step;
      t + sessionMinutes <= mw.endMin;
      t += step
    ) {
      const win = { startMin: t, endMin: t + sessionMinutes };
      const attendees = employees
        .filter((e) =>
          (byEmp[e.id] ?? []).some(
            (iv) => iv.startMin < win.endMin && iv.endMin > win.startMin
          )
        )
        .map((e) => e.id);
      if (attendees.length >= 2) cands.push({ interval: win, attendees });
    }
  }

  const sessions: TeamSession[] = [];
  const scheduled = new Set<string>(); // Track employees already scheduled

  const conflicts = (iv: Interval) =>
    overlaps(
      sessions.map((s) => ({ startMin: s.startMin, endMin: s.endMin })),
      iv
    );

  // First pass: try to schedule everyone in their best meeting
  while (scheduled.size < employees.length) {
    let best: (typeof cands)[number] | null = null;
    let bestScore = 0;

    for (const c of cands) {
      if (conflicts(c.interval)) continue;

      // Only consider unscheduled attendees
      const unscheduledAttendees = c.attendees.filter(
        (id) => !scheduled.has(id)
      );
      if (unscheduledAttendees.length < 2) continue;

      let score = 0;
      for (const id of unscheduledAttendees) {
        score += weight[id] * 2; // Higher weight for unscheduled employees
      }

      if (score > bestScore) {
        bestScore = score;
        best = { ...c, attendees: unscheduledAttendees };
      }
    }

    if (!best || bestScore <= 0) break;

    sessions.push({
      id: uid("tm"),
      type: "team",
      title: "Team Session",
      startMin: best.interval.startMin,
      endMin: best.interval.endMin,
      attendeeIds: best.attendees.slice(),
    });

    // Mark these employees as scheduled
    best.attendees.forEach((id) => scheduled.add(id));
  }

  return sessions.sort((a, b) => a.startMin - b.startMin);
}

export function optimizeScramble(
  employees: Employee[],
  managerWindowsAbs: Interval[],
  teamMinutes: number,
  oneOnOneMinutes: number,
  bufferMinutes: number,
  maxPerDay: number
): Planned[] {
  const team = optimizeTeamWeekWeighted(
    employees,
    managerWindowsAbs,
    teamMinutes
  );
  const one = optimizeOneOnOnesScarcity(
    employees,
    managerWindowsAbs,
    oneOnOneMinutes,
    bufferMinutes,
    maxPerDay,
    team
  );
  return [...team, ...one].sort((a, b) => a.startMin - b.startMin);
}
