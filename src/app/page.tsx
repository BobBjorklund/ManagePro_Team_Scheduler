"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  Plus,
  Calendar as CalendarIcon,
  Users,
  Settings,
} from "lucide-react";
import { ImportExport } from "../components/ImportExport";
import {
  Employee,
  OneOnOne,
  Planned,
  PresetKey,
  SHIFT_PRESETS,
  AVAIL_PRESETS,
  BreakKind,
  TeamSession,
  Day,
  MINUTES_IN_DAY,
  ManagerWindow,
  AvailPresetKey,
  STORAGE_KEY,
  SavedState,
  MeetingMeta,
} from "../lib/types";

import { dayTimeToAbs, uid, hhmmToMins, fmtHHMM } from "../lib/time";
import { expandManagerWindowsAbs } from "../lib/availability";
import {
  optimizeTeamWeekWeighted as optimizeTeamWeek,
  optimizeOneOnOnesScarcity as optimizeOneOnOnes,
  optimizeScramble,
} from "../lib/optimize";

import {
  MeetingModal,
  ModeRulesCard,
  EmployeesCard,
  AvailabilityCard,
  PlanList,
  WeekCalendar,
  DiagnosticsCard,
  TopBar,
} from "@/components";
import { dayTimeLabel } from "@/components/utils/time-ui";

/* ======================= Component ======================= */
export default function OvernightWeeklyPlanner() {
  const [mode, setMode] = useState<"1on1" | "team" | "scramble">("1on1");

  // meeting metadata modal
  const emptyPlanned: Planned = {
    id: "",
    type: "1on1",
    startMin: 0,
    endMin: 0,
    employeeId: "",
    title: "",
  };
  const [meetingDetailsModalOpen, setMeetingDetailsModalOpen] = useState(false);
  const [selectedMeetingBlock, setSelectedMeetingBlock] =
    useState<Planned>(emptyPlanned);
  const [meetingMeta, setMeetingMeta] = useState<Record<string, MeetingMeta>>(
    {}
  );

  // state: append vs replace when generating
  const [appendGenerate, setAppendGenerate] = useState(true);

  // QUICK INPUT HELPERS
  function pickDayTime(promptLabel: string) {
    const dayStr =
      typeof window !== "undefined"
        ? window.prompt(`${promptLabel} - day (0=Sun..6=Sat)`, "0")
        : null;
    const timeStr =
      typeof window !== "undefined"
        ? window.prompt(`${promptLabel} - time (HH:MM 24h)`, "01:00")
        : null;
    if (!dayStr || !timeStr) return null;
    const day = Number(dayStr) as Day;
    const abs = dayTimeToAbs(day, timeStr);
    return { day, timeStr, abs };
  }

  // MANUAL ADD: 1-on-1
  function addManualOneOnOne() {
    if (employees.length === 0) {
      alert("Add at least one employee first.");
      return;
    }
    const empChoices = employees.map((e, i) => `${i}:${e.name}`).join(", ");
    const empIdxStr =
      typeof window !== "undefined"
        ? window.prompt(`Pick employee index (${empChoices})`, "0")
        : null;
    if (empIdxStr == null) return;
    const emp = employees[Number(empIdxStr)];
    if (!emp) return;

    const start = pickDayTime("Start");
    if (!start) return;

    const durStr =
      typeof window !== "undefined"
        ? window.prompt("Duration (minutes)", String(slotMinutes))
        : null;
    if (!durStr) return;

    const duration = Math.max(5, Number(durStr));
    const p: OneOnOne = {
      id: uid("p"),
      type: "1on1",
      title: `1:1 with ${emp.name}`,
      startMin: start.abs,
      endMin: start.abs + duration,
      employeeId: emp.id,
    };
    setPlan((prev) => mergeWithoutConflicts(prev, [p]));
  }

  // MANUAL ADD: Team
  function addManualTeam() {
    if (employees.length === 0) {
      alert("Add at least one employee first.");
      return;
    }
    const start = pickDayTime("Start");
    if (!start) return;

    const durStr =
      typeof window !== "undefined"
        ? window.prompt("Duration (minutes)", String(sessionMinutes))
        : null;
    if (!durStr) return;

    const duration = Math.max(5, Number(durStr));

    // filter by chosen day AND time window on that day
    const day = start.day;
    const startInDay = hhmmToMins(start.timeStr);
    const endInDay = startInDay + duration;

    const availableToday = employees.filter((e) => {
      const byDay = employeeAvailByDay[e.id] ?? [];
      // single-day window
      if (endInDay <= 24 * 60) {
        return (byDay[day] ?? []).some(
          (seg) => seg.start <= startInDay && endInDay <= seg.end
        );
      }
      // crosses midnight: require coverage until midnight on `day`
      // AND from 00:00 to after-midnight remainder on `day+1`
      const over = endInDay - 24 * 60;
      const dayNext = ((day + 1) % 7) as Day;
      const okA = (byDay[day] ?? []).some(
        (seg) => seg.start <= startInDay && seg.end >= 24 * 60
      );
      const okB = (byDay[dayNext] ?? []).some(
        (seg) => seg.start <= 0 && over <= seg.end
      );
      return okA && okB;
    });

    if (availableToday.length === 0) {
      alert("No employees are available for that time window on that day.");
      return;
    }

    const choices = availableToday.map((e, i) => `${i}:${e.name}`).join(", ");
    const idxList =
      typeof window !== "undefined"
        ? window.prompt(
            `Team attendees (comma-separated indices) ${choices}`,
            "0,1"
          )
        : null;
    if (!idxList) return;

    const attendeeIds = idxList
      .split(",")
      .map((s) => availableToday[Number(s.trim())]?.id)
      .filter(Boolean) as string[];
    if (attendeeIds.length === 0) return;

    const p: TeamSession = {
      id: uid("p"),
      type: "team",
      title: "Team meeting",
      startMin: start.abs,
      endMin: start.abs + duration,
      attendeeIds,
    };
    setPlan((prev) => mergeWithoutConflicts(prev, [p]));
  }

  // Meeting details modal handlers
  const handleMeetingClick = (meetingBlock: Planned) => {
    setSelectedMeetingBlock(meetingBlock);
    setMeetingDetailsModalOpen(true);
  };
  const handleSaveMeetingDetails = (details: MeetingMeta) => {
    setMeetingMeta((prev) => ({ ...prev, [details.id]: details }));
  };

  const [planDiagOpen, setPlanDiagOpen] = useState(true);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
  const [maxPerEmployeePerDay, setMaxPerEmployeePerDay] = useState<number>(2);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [managerWindows, setManagerWindows] = useState<ManagerWindow[]>([]);

  const [slotMinutes, setSlotMinutes] = useState<number>(30);
  const [bufferMinutes, setBufferMinutes] = useState<number>(15);
  const [maxPerDay, setMaxPerDay] = useState<number>(5);
  const [sessionMinutes, setSessionMinutes] = useState<number>(45);

  type CreateState = { day: Day; startMinAbs: number } | null;
  const [createState, setCreateState] = useState<CreateState>(null);

  const SNAP_MIN = 15;
  function snapMinutes(m: number) {
    const q = Math.round(m / SNAP_MIN);
    return q * SNAP_MIN;
  }
  function openCreateFromClick(day: Day, e: React.MouseEvent<HTMLDivElement>) {
    const col = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - col.top;
    const minutesFromMidnight = snapMinutes((offsetY / HOUR_PX) * 60);
    const startMinAbs =
      day * MINUTES_IN_DAY +
      Math.max(0, Math.min(24 * 60, minutesFromMidnight));
    setCreateState({ day, startMinAbs });
  }

  const [targetConversations, setTargetConversations] = useState<number>(1);
  const [newAvailDay, setNewAvailDay] = useState<Day>(0);
  const [newAvailPreset, setNewAvailPreset] = useState<AvailPresetKey>("4a-7a");

  const [plan, setPlan] = useState<Planned[]>([]);
  const [configOpen, setConfigOpen] = useState(true);

  // Load/save to localStorage
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: SavedState = JSON.parse(raw);

      setEmployees(saved.employees ?? []);
      setManagerWindows(saved.managerWindows ?? []);
      setMeetingMeta(saved.meetingMeta ?? {});
      setMode(saved.settings?.mode ?? "1on1");
      setSlotMinutes(saved.settings?.slotMinutes ?? 30);
      setBufferMinutes(saved.settings?.bufferMinutes ?? 15);
      setMaxPerDay(saved.settings?.maxPerDay ?? 5);
      setSessionMinutes(saved.settings?.sessionMinutes ?? 45);
      setTargetConversations(saved.settings?.targetConversations ?? 1);
      setPlan(saved.plan ?? []);
    } catch (err) {
      console.warn("Failed to load saved planner state:", err);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: SavedState = {
      employees,
      managerWindows,
      meetingMeta,
      settings: {
        mode,
        slotMinutes,
        bufferMinutes,
        maxPerDay,
        sessionMinutes,
        targetConversations,
      },
      plan,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("Failed to persist planner state:", err);
    }
  }, [
    employees,
    managerWindows,
    meetingMeta,
    mode,
    slotMinutes,
    bufferMinutes,
    maxPerDay,
    sessionMinutes,
    targetConversations,
    plan,
  ]);

  // Derived
  const absManagerWins = useMemo(
    () => expandManagerWindowsAbs(managerWindows),
    [managerWindows]
  );

  const colorFor = React.useMemo(() => {
    const cache = new Map<string, string>();
    return (id: string) => {
      if (cache.has(id)) return cache.get(id)!;
      const hash = Array.from(id).reduce(
        (a, c) => (a * 31 + c.charCodeAt(0)) >>> 0,
        0
      );
      const hue = hash % 360;
      const c = `hsl(${hue}, 70%, 55%)`;
      cache.set(id, c);
      return c;
    };
  }, []);

  const nameById = React.useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.name));
    return (id: string) => m.get(id) ?? id;
  }, [employees]);

  const employeeAvailByDay = useMemo(() => {
    const byEmp: Record<string, { start: number; end: number }[][]> = {};
    for (const e of employees) {
      const perDay: { start: number; end: number }[][] = Array.from(
        { length: 7 },
        () => []
      );
      for (const s of e.shifts ?? []) {
        const d = s.day as Day;
        const start = hhmmToMins(s.start);
        const end = hhmmToMins(s.end);
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
  }, [employees]);

  const managerAvailByDay = React.useMemo(() => {
    const days: Array<Array<{ start: number; end: number }>> = Array.from(
      { length: 7 },
      () => []
    );
    for (const iv of absManagerWins) {
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
    for (let d = 0; d < 7; d++) {
      const arr = days[d].sort((a, b) => a.start - b.start);
      const merged: typeof arr = [];
      for (const seg of arr) {
        const last = merged[merged.length - 1];
        if (last && seg.start <= last.end)
          last.end = Math.max(last.end, seg.end);
        else merged.push({ ...seg });
      }
      days[d] = merged;
    }
    return days;
  }, [absManagerWins]);

  function sliceByDay(
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

  const managerBlocksByDay = React.useMemo(() => {
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
        if (p.type === "1on1")
          days[sl.day].push({
            id: p.id,
            type: "1on1",
            start: sl.start,
            end: sl.end,
            empId: (p as OneOnOne).employeeId,
          });
        else
          days[sl.day].push({
            id: p.id,
            type: "team",
            start: sl.start,
            end: sl.end,
            attendees: (p as TeamSession).attendeeIds,
          });
      }
    }
    days.forEach((col) => col.sort((a, b) => a.start - b.start));
    return days;
  }, [plan]);

  const teamByDay = useMemo(() => {
    const arr: TeamSession[][] = Array(7)
      .fill(0)
      .map(() => []);
    for (const p of plan)
      if (p.type === "team") {
        const d = (Math.floor(p.startMin / MINUTES_IN_DAY) % 7) as Day;
        arr[d].push(p as TeamSession);
      }
    return arr;
  }, [plan]);

  const oneByDayByEmp = useMemo(() => {
    const arr: Array<Record<string, OneOnOne[]>> = Array(7)
      .fill(0)
      .map(() => ({}));
    for (const p of plan)
      if (p.type === "1on1") {
        const d = (Math.floor(p.startMin / MINUTES_IN_DAY) % 7) as Day;
        const eid = (p as OneOnOne).employeeId;
        (arr[d][eid] ??= []).push(p as OneOnOne);
      }
    return arr;
  }, [plan]);

  const unscheduled1on1s = useMemo(() => {
    if (mode !== "1on1" && mode !== "scramble") return [] as string[];
    const scheduled = new Set(
      plan
        .filter((p) => p.type === "1on1")
        .map((p) => (p as OneOnOne).employeeId)
    );
    return employees.filter((e) => !scheduled.has(e.id)).map((e) => e.name);
  }, [mode, plan, employees]);

  const stats = useMemo(() => {
    const oneOnOnes = plan.filter((p) => p.type === "1on1") as OneOnOne[];
    const team = plan.filter((p) => p.type === "team") as TeamSession[];
    const totalHeadcount = team.reduce(
      (sum, ses) => sum + ses.attendeeIds.length,
      0
    );
    const unique1on1Employees = new Set(oneOnOnes.map((o) => o.employeeId))
      .size;
    return {
      oneOnOneCount: oneOnOnes.length,
      teamCount: team.length,
      totalHeadcount,
      unique1on1Employees,
    };
  }, [plan]);

  const dayConvos = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    for (const p of plan) {
      const day = (Math.floor(p.startMin / MINUTES_IN_DAY) % 7) as Day;
      if (p.type === "1on1") counts[day] += 1;
      else counts[day] += (p as TeamSession).attendeeIds.length;
    }
    return counts;
  }, [plan]);

  const coverage = useMemo(() => {
    const team = plan.filter((p) => p.type === "team") as TeamSession[];
    const oneOnOnes = plan.filter((p) => p.type === "1on1") as OneOnOne[];
    return employees.map((e) => {
      const oneCount = oneOnOnes.filter((o) => o.employeeId === e.id).length;
      const teamCount = team.filter((t) => t.attendeeIds.includes(e.id)).length;
      const conversations = oneCount + teamCount;
      return { id: e.id, name: e.name, oneCount, teamCount, conversations };
    });
  }, [employees, plan]);

  // Layout constants
  const HOUR_PX = 32;

  /* Conflicts */
  function timeOverlaps(a: Planned, b: Planned) {
    return !(a.endMin <= b.startMin || b.endMin <= a.startMin);
  }
  function meetingsConflict(a: Planned, b: Planned) {
    return timeOverlaps(a, b);
  }
  function mergeWithoutConflicts(existing: Planned[], candidates: Planned[]) {
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
  function stripInternalConflicts(candidates: Planned[]) {
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

  function runOptimize() {
    const normalized = normalizeEmployeesForOvernights(employees);
    setPlanDiagOpen(true);

    const generated =
      mode === "1on1"
        ? optimizeOneOnOnes(
            normalized,
            absManagerWins,
            slotMinutes,
            bufferMinutes,
            maxPerDay,
            [],
            targetConversations,
            maxPerEmployeePerDay
          )
        : mode === "team"
        ? optimizeTeamWeek(normalized, absManagerWins, sessionMinutes)
        : optimizeScramble(
            normalized,
            absManagerWins,
            sessionMinutes,
            slotMinutes,
            bufferMinutes,
            maxPerEmployeePerDay
          );

    setPlan((prev) =>
      appendGenerate
        ? mergeWithoutConflicts(prev, generated)
        : stripInternalConflicts(generated)
    );

    setConfigOpen(false);
    if (typeof window !== "undefined") {
      setTimeout(() => {
        document
          .getElementById("plan-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 10);
    }
  }

  function clearPlan() {
    setPlan([]);
  }

  // employee helpers wired to EmployeesCard
  function setEmployeeName(eid: string, name: string) {
    setEmployees((prev) =>
      prev.map((x) => (x.id === eid ? { ...x, name } : x))
    );
  }
  function addShift(eid: string) {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === eid
          ? {
              ...e,
              shifts: [
                ...e.shifts,
                { day: 0 as Day, start: "22:00", end: "06:00" },
              ],
            }
          : e
      )
    );
  }
  function addShiftFromPreset(eid: string, preset: PresetKey) {
    if (preset === "custom") {
      addShift(eid);
      return;
    }
    const { start, end } = SHIFT_PRESETS[preset];
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id === eid
          ? { ...emp, shifts: [...emp.shifts, { day: 0 as Day, start, end }] }
          : emp
      )
    );
  }
  function setShiftDay(eid: string, idx: number, day: Day) {
    setEmployees((prev) =>
      prev.map((x) =>
        x.id === eid
          ? {
              ...x,
              shifts: x.shifts.map((y, i) => (i === idx ? { ...y, day } : y)),
            }
          : x
      )
    );
  }
  function setShiftStart(eid: string, idx: number, val: string) {
    setEmployees((prev) =>
      prev.map((x) =>
        x.id === eid
          ? {
              ...x,
              shifts: x.shifts.map((y, i) =>
                i === idx ? { ...y, start: val } : y
              ),
            }
          : x
      )
    );
  }
  function setShiftEnd(eid: string, idx: number, val: string) {
    setEmployees((prev) =>
      prev.map((x) =>
        x.id === eid
          ? {
              ...x,
              shifts: x.shifts.map((y, i) =>
                i === idx ? { ...y, end: val } : y
              ),
            }
          : x
      )
    );
  }
  function removeShift(eid: string, idx: number) {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === eid
          ? { ...e, shifts: e.shifts.filter((_, i) => i !== idx) }
          : e
      )
    );
  }
  function removeEmployee(eid: string) {
    setEmployees((prev) => prev.filter((e) => e.id !== eid));
    if (openEmployeeId === eid) setOpenEmployeeId(null);
    setPlan((prev) => {
      const cleaned = prev
        .filter(
          (p) => !(p.type === "1on1" && (p as OneOnOne).employeeId === eid)
        )
        .map((p) =>
          p.type === "team"
            ? ({
                ...p,
                attendeeIds: (p as TeamSession).attendeeIds.filter(
                  (id) => id !== eid
                ),
              } as Planned)
            : p
        );
      return cleaned.filter(
        (p) =>
          !(p.type === "team" && (p as TeamSession).attendeeIds.length === 0)
      );
    });
  }
  function addBreak(eid: string, shiftIdx: number, kind: BreakKind) {
    const start = (
      typeof window !== "undefined"
        ? window.prompt(
            `${kind} start (HH:MM 24h)`,
            kind === "lunch" ? "02:00" : "01:00"
          )
        : ""
    )?.trim();
    const end = (
      typeof window !== "undefined"
        ? window.prompt(
            `${kind} end (HH:MM 24h)`,
            kind === "lunch" ? "02:30" : "01:15"
          )
        : ""
    )?.trim();
    if (!start || !end) return;
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id !== eid
          ? emp
          : {
              ...emp,
              shifts: emp.shifts.map((s, i) =>
                i !== shiftIdx
                  ? s
                  : {
                      ...s,
                      breaks: [...(s.breaks ?? []), { kind, start, end }],
                    }
              ),
            }
      )
    );
  }
  function removeBreak(eid: string, shiftIdx: number, bIdx: number) {
    setEmployees((prev) =>
      prev.map((emp) =>
        emp.id !== eid
          ? emp
          : {
              ...emp,
              shifts: emp.shifts.map((s, i) =>
                i !== shiftIdx
                  ? s
                  : {
                      ...s,
                      breaks: (s.breaks ?? []).filter((_, j) => j !== bIdx),
                    }
              ),
            }
      )
    );
  }

  // manager availability helpers wired to AvailabilityCard
  function setManagerWindowDay(idx: number, day: Day) {
    setManagerWindows((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, day } : x))
    );
  }
  function setManagerWindowStart(idx: number, val: string) {
    setManagerWindows((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, start: val } : x))
    );
  }
  function setManagerWindowEnd(idx: number, val: string) {
    setManagerWindows((prev) =>
      prev.map((x, i) => (i === idx ? { ...x, end: val } : x))
    );
  }
  function removeManagerWindow(i: number) {
    setManagerWindows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addManagerWindowFromPreset() {
    if (newAvailPreset === "custom") {
      const s = (
        typeof window !== "undefined"
          ? window.prompt("Start (HH:MM 24h)?", "04:00")
          : ""
      )?.trim();
      const e = (
        typeof window !== "undefined"
          ? window.prompt("End (HH:MM 24h)?", "07:00")
          : ""
      )?.trim();
      if (!s || !e) return;
      setManagerWindows((prev) => [
        ...prev,
        { day: newAvailDay, start: s, end: e },
      ]);
      return;
    }
    const { start, end } = AVAIL_PRESETS[newAvailPreset];
    setManagerWindows((prev) => [...prev, { day: newAvailDay, start, end }]);
  }

  function updateMeeting(id: string, updates: Partial<Planned>) {
    setPlan((prev) =>
      prev.map((p) => (p.id === id ? ({ ...p, ...updates } as Planned) : p))
    );
  }
  const onRemoveMeeting = (id: string) =>
    setPlan((prev) => prev.filter((x) => x.id !== id));
  function toHHMM(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function mostRecentSunday(ref = new Date()) {
    const d = new Date(ref);
    d.setHours(0, 0, 0, 0);
    const delta = d.getDay(); // 0=Sun..6=Sat
    d.setDate(d.getDate() - delta);
    return d;
  }

  function isoDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function dayLabel(weekStart: Date, day: Day) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + day);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function downloadTextFile(filename: string, contents: string) {
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportSchedule() {
    // Use most recent Sunday as the start of the week
    const weekStart = mostRecentSunday();
    const weekStartIso = isoDate(weekStart);

    const lines: string[] = [];

    // NOTE: no %7 here — we actually need to reach 7 and exit
    for (let day = 0 as Day; day < 7; day = (day + 1) as Day) {
      const blocks = managerBlocksByDay[day] ?? [];
      if (!blocks.length) continue;

      const dateStr = dayLabel(weekStart, day);

      const ones = blocks
        .filter((b) => b.type === "1on1" && b.empId)
        .map((b) => ({
          name: nameById(b.empId!),
          start: toHHMM(b.start),
          end: toHHMM(b.end),
        }))
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

      const teams = blocks
        .filter((b) => b.type === "team" && (b.attendees?.length ?? 0) > 0)
        .map((b) => ({
          start: toHHMM(b.start),
          end: toHHMM(b.end),
          attendees: (b.attendees ?? []).map((id) => nameById(id)),
        }))
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));

      if (!ones.length && !teams.length) continue;

      lines.push(
        `on ${dateStr} Please schedule the following in 1 on 1 conversations:`
      );

      if (ones.length) {
        const nameCol = Math.max(4, ...ones.map((o) => o.name.length));
        ones.forEach((o) => {
          lines.push(`${o.name.padEnd(nameCol)}  ${o.start}-${o.end}`);
        });
      } else {
        lines.push("(no 1-on-1s requested)");
      }

      if (teams.length) {
        lines.push("");
        lines.push("ALSO, please schedule the following team meetings:");

        const headerIn = "Time In";
        const headerOut = "Time Out";
        const inCol = Math.max(
          headerIn.length,
          ...teams.map((t) => t.start.length)
        );
        const outCol = Math.max(
          headerOut.length,
          ...teams.map((t) => t.end.length)
        );
        const pad = (s: string, w: number) => s.padEnd(w);

        lines.push(
          `${pad(headerIn, inCol)}  ${pad(headerOut, outCol)}  Attendees`
        );
        teams.forEach((t) => {
          lines.push(
            `${pad(t.start, inCol)}  ${pad(t.end, outCol)}  ${t.attendees.join(
              ", "
            )}`
          );
        });
      }

      lines.push(""); // blank line between days
    }

    const contents =
      lines.length > 0
        ? lines.join("\n")
        : `No meetings planned for the week starting ${weekStartIso}.`;

    downloadTextFile(`schedule-${weekStartIso}.txt`, contents);
  }
  /* === Render === */
  return (
    <>
      <TopBar
        title="Meeting Planner"
        PageIcon={<CalendarIcon className="w-6 h-6" />}
        RightSideActions={
          <>
            <button
              onClick={addManualOneOnOne}
              className="px-3 py-2 rounded-lg bg-black/30 hover:bg-black/40 transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New 1:1</span>
            </button>
            <button
              onClick={addManualTeam}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition flex items-center gap-1"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">New Team Meeting</span>
            </button>
            <ImportExport
              getState={() => ({
                employees,
                managerWindows,
                meetingMeta,
                settings: {
                  mode,
                  slotMinutes,
                  bufferMinutes,
                  maxPerDay,
                  sessionMinutes,
                  targetConversations,
                },
                plan,
              })}
              onImport={(s) => {
                setEmployees(s.employees ?? []);
                setManagerWindows(s.managerWindows ?? []);
                setMeetingMeta(s.meetingMeta ?? {});
                setMode(s.settings?.mode ?? "1on1");
                setSlotMinutes(s.settings?.slotMinutes ?? 30);
                setBufferMinutes(s.settings?.bufferMinutes ?? 15);
                setMaxPerDay(s.settings?.maxPerDay ?? 5);
                setSessionMinutes(s.settings?.sessionMinutes ?? 45);
                setTargetConversations(s.settings?.targetConversations ?? 1);
                setPlan(s.plan ?? []);
                // your existing useEffect will persist this to localStorage automatically
              }}
            />
            <button
              onClick={exportSchedule}
              className="px-3 py-2 rounded-lg bg-black/30 hover:bg-black/40 transition flex items-center gap-1"
              title="Export this week's plan as text"
            >
              Export schedule
            </button>
          </>
        }
      />
      <div className="p-7 mx-auto w-full max-w">
        <details
          className="rounded-2xl border bg-white shadow mt-16 mb-6"
          open={configOpen}
          onToggle={(e) =>
            setConfigOpen((e.currentTarget as HTMLDetailsElement).open)
          }
        >
          <summary className="flex items-center justify-between gap-2 p-4 cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Schedules & Config
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                configOpen ? "rotate-180" : ""
              }`}
            />
          </summary>

          <div className="p-4 pt-0">
            <section className="grid md:grid-cols-3 gap-6 mb-2">
              <ModeRulesCard
                mode={mode}
                setMode={setMode}
                slotMinutes={slotMinutes}
                setSlotMinutes={setSlotMinutes}
                bufferMinutes={bufferMinutes}
                setBufferMinutes={setBufferMinutes}
                maxPerDay={maxPerDay}
                setMaxPerDay={setMaxPerDay}
                sessionMinutes={sessionMinutes}
                setSessionMinutes={setSessionMinutes}
                maxPerEmployeePerDay={maxPerEmployeePerDay}
                setMaxPerEmployeePerDay={setMaxPerEmployeePerDay}
                appendGenerate={appendGenerate}
                setAppendGenerate={setAppendGenerate}
                runOptimize={runOptimize}
                clearPlan={clearPlan}
              />

              <EmployeesCard
                employees={employees}
                openEmployeeId={openEmployeeId}
                setOpenEmployeeId={setOpenEmployeeId}
                setEmployeeName={setEmployeeName}
                addShiftFromPreset={addShiftFromPreset}
                removeEmployee={removeEmployee}
                setShiftDay={setShiftDay}
                setShiftStart={setShiftStart}
                setShiftEnd={setShiftEnd}
                addBreak={addBreak}
                removeBreak={removeBreak}
                removeShift={removeShift}
                addEmployee={() => {
                  const name = (
                    typeof window !== "undefined"
                      ? window.prompt("Employee name?")
                      : ""
                  )?.trim();
                  if (!name) return;
                  const id = uid("e");
                  setEmployees((prev) => [...prev, { id, name, shifts: [] }]);
                  setOpenEmployeeId(id);
                }}
              />

              <AvailabilityCard
                managerWindows={managerWindows}
                setManagerWindowDay={setManagerWindowDay}
                setManagerWindowStart={setManagerWindowStart}
                setManagerWindowEnd={setManagerWindowEnd}
                removeManagerWindow={removeManagerWindow}
                newAvailDay={newAvailDay}
                setNewAvailDay={setNewAvailDay}
                newAvailPreset={newAvailPreset}
                setNewAvailPreset={setNewAvailPreset}
                addManagerWindowFromPreset={addManagerWindowFromPreset}
              />
            </section>
          </div>
        </details>

        {/* Plan & Diagnostics */}
        <details
          id="plan-section"
          className="rounded-2xl shadow border bg-white overflow-hidden mb-6"
          open={planDiagOpen}
          onToggle={(e) =>
            setPlanDiagOpen((e.currentTarget as HTMLDetailsElement).open)
          }
        >
          <summary className="flex items-center justify-between gap-2 p-4 cursor-pointer select-none">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="font-medium">Plan & Diagnostics</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                planDiagOpen ? "rotate-180" : ""
              }`}
            />
          </summary>

          <div className="p-4 pt-0">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <PlanList
                  plan={plan}
                  employees={employees}
                  addManualOneOnOne={addManualOneOnOne}
                  addManualTeam={addManualTeam}
                  onRemoveMeeting={onRemoveMeeting}
                  updateMeeting={updateMeeting}
                />
              </div>

              {/* Diagnostics (left intact structurally; same logic) */}
              <DiagnosticsCard
                mode={mode}
                managerWindowCount={managerWindows.length}
                employeeCount={employees.length}
                stats={stats}
                unscheduled1on1s={unscheduled1on1s}
                dayConvos={dayConvos}
                coverage={coverage}
                targetConversations={targetConversations}
                setTargetConversations={setTargetConversations}
              />
            </div>
          </div>
        </details>

        {/* Manager Week Calendar */}
        <section className="grid md:grid-cols-3 gap-6">
          <WeekCalendar
            employees={employees}
            employeeAvailByDay={employeeAvailByDay}
            managerAvailByDay={managerAvailByDay}
            managerBlocksByDay={managerBlocksByDay}
            colorFor={colorFor}
            meetingMeta={meetingMeta}
            nameById={nameById}
            HOUR_PX={HOUR_PX}
            onColumnClick={openCreateFromClick}
            onMeetingClick={handleMeetingClick}
          />
        </section>
      </div>

      {/* Meeting Details Modal */}
      <MeetingModal
        meeting={selectedMeetingBlock}
        isOpen={meetingDetailsModalOpen}
        onClose={() => setMeetingDetailsModalOpen(false)}
        onSave={handleSaveMeetingDetails}
        colorFor={colorFor}
        nameById={nameById}
        existingMetadata={meetingMeta[selectedMeetingBlock?.id]}
      />
    </>
  );

  /* ===== Helpers: normalization ===== */
  function normalizeEmployeesForOvernights(employees: Employee[]): Employee[] {
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
          const bStartMin = toMin(b.start);
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
}
