import {
  Employee,
  Planned,
  OneOnOne,
  TeamSession,
  Day,
  MINUTES_IN_DAY,
} from "@/lib/types";

export function sliceByDay(
  p: Planned
): Array<{ day: Day; start: number; end: number; p: Planned }> {
  const out: Array<{ day: Day; start: number; end: number; p: Planned }> = [];
  let s = p.startMin;
  const e = p.endMin;
  while (s < e) {
    const dayIndexAbs = Math.floor(s / MINUTES_IN_DAY);
    const dayEndAbs = (dayIndexAbs + 1) * MINUTES_IN_DAY;
    const sliceEnd = Math.min(e, dayEndAbs);
    const day = (dayIndexAbs % 7) as Day;
    const startInDay = s % MINUTES_IN_DAY;
    const endInDay = sliceEnd % MINUTES_IN_DAY || MINUTES_IN_DAY;
    out.push({ day, start: startInDay, end: endInDay, p });
    s = sliceEnd;
  }
  return out;
}

export function buildEmployeeAvailByDay(employees: Employee[]) {
  const byEmp: Record<string, { start: number; end: number }[][]> = {};
  for (const e of employees) {
    const perDay: { start: number; end: number }[][] = Array.from(
      { length: 7 },
      () => []
    );
    for (const s of e.shifts ?? []) {
      const [sh, sm] = s.start.split(":").map(Number);
      const [eh, em] = s.end.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      const d = s.day as Day;
      if (start <= end) {
        perDay[d].push({ start, end });
      } else {
        perDay[d].push({ start, end: 24 * 60 });
        perDay[(d + 1) % 7].push({ start: 0, end });
      }
    }
    byEmp[e.id] = perDay;
  }
  return byEmp;
}

export function buildManagerAvailByDay(
  absWins: Array<{ startMin: number; endMin: number }>
) {
  const days: Array<Array<{ start: number; end: number }>> = Array.from(
    { length: 7 },
    () => []
  );
  for (const iv of absWins) {
    let s = iv.startMin;
    const e = iv.endMin;
    while (s < e) {
      const dayIndexAbs = Math.floor(s / MINUTES_IN_DAY);
      const dayEndAbs = (dayIndexAbs + 1) * MINUTES_IN_DAY;
      const sliceEnd = Math.min(e, dayEndAbs);
      const day = (dayIndexAbs % 7) as Day;
      const startInDay = s % MINUTES_IN_DAY;
      const endInDay = sliceEnd % MINUTES_IN_DAY || MINUTES_IN_DAY;
      days[day].push({ start: startInDay, end: endInDay });
      s = sliceEnd;
    }
  }
  // merge overlaps
  for (let d = 0; d < 7; d++) {
    const arr = days[d].sort((a, b) => a.start - b.start);
    const merged: typeof arr = [];
    for (const seg of arr) {
      const last = merged[merged.length - 1];
      if (last && seg.start <= last.end) last.end = Math.max(last.end, seg.end);
      else merged.push({ ...seg });
    }
    days[d] = merged;
  }
  return days;
}

export function buildManagerBlocksByDay(plan: Planned[]) {
  const days: Array<
    Array<{
      id: string;
      type: "1on1" | "team";
      start: number;
      end: number;
      empId?: string;
      attendees?: string[];
    }>
  > = Array.from({ length: 7 }, () => []);
  for (const p of plan) {
    for (const sl of sliceByDay(p)) {
      if (p.type === "1on1") {
        days[sl.day].push({
          id: p.id,
          type: "1on1",
          start: sl.start,
          end: sl.end,
          empId: (p as OneOnOne).employeeId,
        });
      } else {
        days[sl.day].push({
          id: p.id,
          type: "team",
          start: sl.start,
          end: sl.end,
          attendees: (p as TeamSession).attendeeIds,
        });
      }
    }
  }
  days.forEach((col) => col.sort((a, b) => a.start - b.start));
  return days;
}

export function computeStats(plan: Planned[]) {
  const oneOnOnes = plan.filter((p) => p.type === "1on1") as OneOnOne[];
  const team = plan.filter((p) => p.type === "team") as TeamSession[];
  const totalHeadcount = team.reduce(
    (sum, ses) => sum + ses.attendeeIds.length,
    0
  );
  const unique1on1Employees = new Set(oneOnOnes.map((o) => o.employeeId)).size;
  return {
    oneOnOneCount: oneOnOnes.length,
    teamCount: team.length,
    totalHeadcount,
    unique1on1Employees,
  };
}

export function computeDayConvos(plan: Planned[]) {
  const counts = Array(7).fill(0) as number[];
  for (const p of plan) {
    const day = (Math.floor(p.startMin / MINUTES_IN_DAY) % 7) as Day;
    if (p.type === "1on1") counts[day] += 1;
    else counts[day] += (p as TeamSession).attendeeIds.length;
  }
  return counts;
}

export function computeCoverage(employees: Employee[], plan: Planned[]) {
  const team = plan.filter((p) => p.type === "team") as TeamSession[];
  const oneOnOnes = plan.filter((p) => p.type === "1on1") as OneOnOne[];
  return employees.map((e) => {
    const oneCount = oneOnOnes.filter((o) => o.employeeId === e.id).length;
    const teamCount = team.filter((t) => t.attendeeIds.includes(e.id)).length;
    const conversations = oneCount + teamCount;
    return { id: e.id, name: e.name, oneCount, teamCount, conversations };
  });
}
