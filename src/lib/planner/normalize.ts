import { Employee, Day } from "@/lib/types";

export function normalizeEmployeesForOvernights(
  employees: Employee[]
): Employee[] {
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  return employees.map((emp) => {
    const newShifts: Employee["shifts"] = [];

    for (const s of emp.shifts) {
      const startMin = toMin(s.start);
      const endMin = toMin(s.end);
      const crossesMidnight = endMin <= startMin;

      if (!crossesMidnight) {
        newShifts.push({
          day: s.day,
          start: s.start,
          end: s.end,
          breaks: s.breaks ? [...s.breaks] : undefined,
        });
        continue;
      }

      const dayA = s.day;
      const dayB = ((s.day + 1) % 7) as Day;

      const breaksA: typeof s.breaks = [];
      const breaksB: typeof s.breaks = [];

      for (const b of s.breaks ?? []) {
        const [bh, bm] = b.start.split(":").map(Number);
        const bStartMin = bh * 60 + bm;
        const goesInA = bStartMin >= startMin;
        (goesInA ? breaksA : breaksB)!.push({ ...b });
      }

      newShifts.push({
        day: dayA,
        start: s.start,
        end: "24:00",
        breaks: breaksA.length ? breaksA : undefined,
      });

      newShifts.push({
        day: dayB,
        start: "00:00",
        end: s.end,
        breaks: breaksB.length ? breaksB : undefined,
      });
    }

    return { ...emp, shifts: newShifts };
  });
}
