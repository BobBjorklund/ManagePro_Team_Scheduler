"use client";

import React from "react";
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
} from "@/lib/types";

import { dayTimeToAbs, uid, hhmmToMins, fmtHHMM } from "@/lib/time";
import { expandManagerWindowsAbs } from "@/lib/availability";
import {
  optimizeTeamWeekWeighted as optimizeTeamWeek,
  optimizeOneOnOnesScarcity as optimizeOneOnOnes,
  optimizeScramble,
} from "@/lib/optimize";

import {
  buildEmployeeAvailByDay,
  buildManagerAvailByDay,
  buildManagerBlocksByDay,
  computeCoverage,
  computeDayConvos,
  computeStats,
} from "@/lib/planner/derived";

import {
  mergeWithoutConflicts,
  stripInternalConflicts,
} from "@/lib/planner/conflicts";

import { normalizeEmployeesForOvernights } from "@/lib/planner/normalize";

export function usePlanner() {
  // ========= STATE =========
  const [mode, setMode] = React.useState<"1on1" | "team" | "scramble">("1on1");

  const emptyPlanned: Planned = {
    id: "",
    type: "1on1",
    startMin: 0,
    endMin: 0,
    employeeId: "",
    title: "",
  };
  const [meetingDetailsModalOpen, setMeetingDetailsModalOpen] =
    React.useState(false);
  const [selectedMeetingBlock, setSelectedMeetingBlock] =
    React.useState<Planned>(emptyPlanned);
  const [meetingMeta, setMeetingMeta] = React.useState<
    Record<string, MeetingMeta>
  >({});

  const [appendGenerate, setAppendGenerate] = React.useState(true);

  const [planDiagOpen, setPlanDiagOpen] = React.useState(true);
  const [openEmployeeId, setOpenEmployeeId] = React.useState<string | null>(
    null
  );
  const [maxPerEmployeePerDay, setMaxPerEmployeePerDay] =
    React.useState<number>(2);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [managerWindows, setManagerWindows] = React.useState<ManagerWindow[]>(
    []
  );

  const [slotMinutes, setSlotMinutes] = React.useState<number>(30);
  const [bufferMinutes, setBufferMinutes] = React.useState<number>(15);
  const [maxPerDay, setMaxPerDay] = React.useState<number>(5);
  const [sessionMinutes, setSessionMinutes] = React.useState<number>(45);

  type CreateState = { day: Day; startMinAbs: number } | null;
  const [createState, setCreateState] = React.useState<CreateState>(null);

  const [targetConversations, setTargetConversations] =
    React.useState<number>(1);
  const [newAvailDay, setNewAvailDay] = React.useState<Day>(0);
  const [newAvailPreset, setNewAvailPreset] =
    React.useState<AvailPresetKey>("4a-7a");

  const [plan, setPlan] = React.useState<Planned[]>([]);
  const [configOpen, setConfigOpen] = React.useState(true);

  // ========= PERSISTENCE =========
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

  // ========= DERIVED =========
  const absManagerWins = React.useMemo(
    () => expandManagerWindowsAbs(managerWindows),
    [managerWindows]
  );

  const employeeAvailByDay = React.useMemo(
    () => buildEmployeeAvailByDay(employees),
    [employees]
  );

  const managerAvailByDay = React.useMemo(
    () => buildManagerAvailByDay(absManagerWins),
    [absManagerWins]
  );

  const managerBlocksByDay = React.useMemo(
    () => buildManagerBlocksByDay(plan),
    [plan]
  );

  const stats = React.useMemo(() => computeStats(plan), [plan]);
  const dayConvos = React.useMemo(() => computeDayConvos(plan), [plan]);
  const coverage = React.useMemo(
    () => computeCoverage(employees, plan),
    [employees, plan]
  );

  const unscheduled1on1s = React.useMemo(() => {
    if (mode !== "1on1" && mode !== "scramble") return [] as string[];
    const scheduled = new Set(
      plan
        .filter((p) => p.type === "1on1")
        .map((p) => (p as OneOnOne).employeeId)
    );
    return employees.filter((e) => !scheduled.has(e.id)).map((e) => e.name);
  }, [mode, plan, employees]);

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

  // ========= UX HELPERS =========
  const HOUR_PX = 32;
  const SNAP_MIN = 15;
  function snapMinutes(m: number) {
    const q = Math.round(m / SNAP_MIN);
    return q * SNAP_MIN;
  }

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

  function openCreateFromClick(day: Day, e: React.MouseEvent<HTMLDivElement>) {
    const col = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - col.top;
    const minutesFromMidnight = snapMinutes((offsetY / HOUR_PX) * 60);
    const startMinAbs =
      day * MINUTES_IN_DAY +
      Math.max(0, Math.min(24 * 60, minutesFromMidnight));
    setCreateState({ day, startMinAbs });
  }

  // ========= COMMANDS =========
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
    const choices = employees.map((e, i) => `${i}:${e.name}`).join(", ");
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
      .map((s) => employees[Number(s.trim())]?.id)
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

  // ===== Employees
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

  // ===== Manager availability
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

  // ===== Meetings edit
  function updateMeeting(id: string, updates: Partial<Planned>) {
    setPlan((prev) =>
      prev.map((p) => (p.id === id ? ({ ...p, ...updates } as Planned) : p))
    );
  }
  const onRemoveMeeting = (id: string) =>
    setPlan((prev) => prev.filter((x) => x.id !== id));

  // ===== Modal
  const handleMeetingClick = (meetingBlock: Planned) => {
    setSelectedMeetingBlock(meetingBlock);
    setMeetingDetailsModalOpen(true);
  };
  const handleSaveMeetingDetails = (details: MeetingMeta) => {
    setMeetingMeta((prev) => ({ ...prev, [details.id]: details }));
  };

  return {
    // state & setters
    mode,
    setMode,
    meetingDetailsModalOpen,
    setMeetingDetailsModalOpen,
    selectedMeetingBlock,
    setSelectedMeetingBlock,
    meetingMeta,
    setMeetingMeta,
    appendGenerate,
    setAppendGenerate,
    planDiagOpen,
    setPlanDiagOpen,
    openEmployeeId,
    setOpenEmployeeId,
    maxPerEmployeePerDay,
    setMaxPerEmployeePerDay,
    employees,
    setEmployees,
    managerWindows,
    setManagerWindows,
    slotMinutes,
    setSlotMinutes,
    bufferMinutes,
    setBufferMinutes,
    maxPerDay,
    setMaxPerDay,
    sessionMinutes,
    setSessionMinutes,
    createState,
    setCreateState,
    targetConversations,
    setTargetConversations,
    newAvailDay,
    setNewAvailDay,
    newAvailPreset,
    setNewAvailPreset,
    plan,
    setPlan,
    configOpen,
    setConfigOpen,

    // derived
    employeeAvailByDay,
    managerAvailByDay,
    managerBlocksByDay,
    colorFor,
    nameById,
    stats,
    unscheduled1on1s,
    dayConvos,
    coverage,

    // handlers
    addManualOneOnOne,
    addManualTeam,
    runOptimize,
    clearPlan,
    addManagerWindowFromPreset,
    setManagerWindowDay,
    setManagerWindowStart,
    setManagerWindowEnd,
    removeManagerWindow,

    setEmployeeName,
    addShiftFromPreset,
    setShiftDay,
    setShiftStart,
    setShiftEnd,
    removeShift,
    removeEmployee,
    addBreak,
    removeBreak,

    updateMeeting,
    onRemoveMeeting,
    openCreateFromClick,
    handleMeetingClick,
    handleSaveMeetingDetails,

    // constants
    HOUR_PX,
  };
}
