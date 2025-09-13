"use client";
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
  DAY_NAMES,
  AvailPresetKey,
  STORAGE_KEY,
  SavedState,
  MeetingMeta,
} from "../lib/types";

import React, { useMemo, useState } from "react";
// import * as XLSX from "xlsx";

import { motion } from "framer-motion";

import {
  ChevronDown,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Users,
  User,
  Settings,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { dayTimeToAbs, uid, hhmmToMins, fmtHHMM } from "../lib/time";
import { expandManagerWindowsAbs } from "../lib/availability";
import {
  optimizeTeamWeekWeighted as optimizeTeamWeek,
  optimizeOneOnOnesScarcity as optimizeOneOnOnes,
  optimizeScramble,
} from "../lib/optimize";
import { MeetingStatus } from "../lib/types";

/* ======================= Meeting Modal Component ======================= */
const MeetingModal = ({
  meeting,
  isOpen,
  onClose,
  onSave,
  colorFor,
  nameById,
  existingMetadata,
}: {
  meeting: Planned;
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: MeetingMeta) => void;
  colorFor: (id: string) => string;
  nameById: (id: string) => string;
  existingMetadata?: MeetingMeta;
}) => {
  const [details, setDetails] = useState<MeetingMeta>({
    id: meeting?.id || "",
    notes: "",
    agenda: "",
    status: "scheduled",
    actualStartMin: meeting?.startMin || 0,
    actualEndMin: meeting?.endMin || 0,
    tags: [],
    rating: 3,
  });

  React.useEffect(() => {
    if (meeting) {
      setDetails({
        id: meeting.id,
        notes: existingMetadata?.notes || "",
        agenda: existingMetadata?.agenda || "",
        status: existingMetadata?.status || "scheduled",
        actualStartMin: existingMetadata?.actualStartMin || meeting.startMin,
        actualEndMin: existingMetadata?.actualEndMin || meeting.endMin,
        tags: existingMetadata?.tags || [],
        rating: existingMetadata?.rating || 3,
      });
    }
  }, [meeting, existingMetadata]);

  if (!isOpen || !meeting) return null;

  const handleSave = () => {
    onSave(details);
    onClose();
  };

  const is1on1 = meeting.type === "1on1";
  const attendeeNames = is1on1
    ? [nameById(meeting.employeeId)]
    : meeting.attendeeIds.map(nameById);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 p-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {is1on1 ? (
                <div className="p-2 rounded-xl bg-blue-50">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-purple-50">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {is1on1 ? "1-on-1 Meeting" : "Team Meeting"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {fmtHHMM(meeting.startMin)} – {fmtHHMM(meeting.endMin)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl p-4">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Attendees
            </div>
            <div className="flex flex-wrap gap-2">
              {attendeeNames.map((name: string, idx: number) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: is1on1
                        ? colorFor(meeting.employeeId)
                        : colorFor(meeting.attendeeIds[idx]),
                    }}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={details.status}
                onChange={(e) =>
                  setDetails({
                    ...details,
                    status: e.target.value as MeetingStatus | undefined,
                  })
                }
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setDetails({ ...details, rating: star })}
                    className={`w-8 h-8 rounded-lg transition-colors ${
                      star <= details.rating!
                        ? "bg-yellow-400 text-white"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-400"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <input
              value={details.tags!.join(", ")}
              onChange={(e) =>
                setDetails({
                  ...details,
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="urgent, follow-up, career..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Agenda
            </label>
            <textarea
              value={details.agenda}
              onChange={(e) =>
                setDetails({ ...details, agenda: e.target.value })
              }
              placeholder="Key topics to discuss..."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={details.notes}
              onChange={(e) =>
                setDetails({ ...details, notes: e.target.value })
              }
              placeholder="Meeting outcomes, action items..."
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-gray-100 p-6 pt-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              Save Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================= Core Planning ======================= */

/* ======================= UI Helpers ======================= */
function minutesToDayTime(mins: number) {
  const day = (Math.floor(mins / MINUTES_IN_DAY) % 7) as Day;
  const time = fmtHHMM(mins % MINUTES_IN_DAY);
  return { day, time };
}
function dayTimeLabel(mins: number) {
  const { day, time } = minutesToDayTime(mins);
  return `${DAY_NAMES[day]} ${time}`;
}

/* ======================= Component ======================= */
export default function OvernightWeeklyPlanner() {
  const [mode, setMode] = useState<"1on1" | "team" | "scramble">("1on1");
  const [activeMeeting, setActiveMeeting] = useState<Planned | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Planned | null>(null);
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const emptyPlanned: Planned = {
    id: "",
    type: "1on1",
    startMin: 0,
    endMin: 0,
    employeeId: "",
    title: "",
  };
  // New state for meeting details modal
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

    // comma-delimited indices of employees to include
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

  const openMetaModal = (meeting: Planned) => {
    setSelectedMeeting(meeting);
    setMetaModalOpen(true);
  };

  const closeMetaModal = () => {
    setMetaModalOpen(false);
    setSelectedMeeting(null);
  };

  const saveMeta = (meta: MeetingMeta) => {
    // You would update the meta here
    closeMetaModal();
  };

  // New handlers for meeting details modal
  const handleMeetingClick = (meetingBlock: Planned) => {
    setSelectedMeetingBlock(meetingBlock);
    setMeetingDetailsModalOpen(true);
  };

  const handleSaveMeetingDetails = (details: MeetingMeta) => {
    setMeetingMeta((prev) => ({
      ...prev,
      [details.id]: details,
    }));
  };

  const [planDiagOpen, setPlanDiagOpen] = useState(true);
  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null);
  const [maxPerEmployeePerDay, setMaxPerEmployeePerDay] = useState<number>(2);
  const [employees, setEmployees] = useState<Employee[]>([]);
  // start empty – real product
  const [managerWindows, setManagerWindows] = useState<ManagerWindow[]>([]);

  const [slotMinutes, setSlotMinutes] = useState<number>(30);
  const [bufferMinutes, setBufferMinutes] = useState<number>(15);
  const [maxPerDay, setMaxPerDay] = useState<number>(5);
  const [sessionMinutes, setSessionMinutes] = useState<number>(45);
  // NEW: create-meeting modal state
  type CreateState = {
    day: Day;
    startMinAbs: number; // absolute minute (0..10080)
  } | null;

  const [createState, setCreateState] = useState<CreateState>(null);

  // snap to your grid (e.g., 15min or slotMinutes)
  const SNAP_MIN = Math.max(5, Math.min(slotMinutes, 30)); // pick the granularity you like

  function snapMinutes(m: number) {
    const q = Math.round(m / SNAP_MIN);
    return q * SNAP_MIN;
  }

  // Compute absolute start from a column click
  function openCreateFromClick(day: Day, e: React.MouseEvent<HTMLDivElement>) {
    const col = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - col.top;
    // If your column uses repeating background with HOUR_PX per hour:
    // 60 minutes corresponds to HOUR_PX
    const minutesFromMidnight = snapMinutes((offsetY / HOUR_PX) * 60);
    const startMinAbs =
      day * MINUTES_IN_DAY +
      Math.max(0, Math.min(24 * 60, minutesFromMidnight));
    setCreateState({ day, startMinAbs });
  }

  // Tracking target conversations per employee
  const [targetConversations, setTargetConversations] = useState<number>(1);

  // Preset quick-add state for manager windows
  const [newAvailDay, setNewAvailDay] = useState<Day>(0);
  const [newAvailPreset, setNewAvailPreset] = useState<AvailPresetKey>("4a-7a");

  const [plan, setPlan] = useState<Planned[]>([]);

  // Collapsible wrapper for schedules + config
  const [configOpen, setConfigOpen] = useState(true);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------- Auto-save whenever relevant state changes -------
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
  // deterministic color per employee
  // Color per employee (stable)
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
  // Map: employeeId -> [7 days] -> array of {start, end} in *minutes from midnight*
  const employeeAvailByDay = useMemo(() => {
    const byEmp: Record<string, { start: number; end: number }[][]> = {};
    for (const e of employees) {
      // 7-day container
      const perDay: { start: number; end: number }[][] = Array.from(
        { length: 7 },
        () => []
      );

      // Assume each shift has shape: { day: Day, start: "HH:MM", end: "HH:MM" }
      for (const s of e.shifts ?? []) {
        const d = s.day as Day;
        const start = hhmmToMins(s.start);
        const end = hhmmToMins(s.end);

        if (start <= end) {
          // Same-day shift
          perDay[d].push({ start, end });
        } else {
          // Overnight shift (wraps past midnight)
          perDay[d].push({ start, end: 24 * 60 });
          perDay[(d + 1) % 7].push({ start: 0, end });
        }
      }

      byEmp[e.id] = perDay;
    }
    return byEmp;
  }, [employees]);

  const managerAvailByDay = React.useMemo(() => {
    // slice the absolute manager windows across day boundaries
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

    // merge overlaps per day so outlines are clean
    for (let d = 0; d < 7; d++) {
      const arr = days[d].sort((a, b) => a.start - b.start);
      const merged: typeof arr = [];
      for (const seg of arr) {
        const last = merged[merged.length - 1];
        if (last && seg.start <= last.end) {
          last.end = Math.max(last.end, seg.end);
        } else {
          merged.push({ ...seg });
        }
      }
      days[d] = merged;
    }
    return days;
  }, [absManagerWins]);
  // Slice a planned item across day boundaries -> per-day fragments
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

  // Manager-centric blocks per day (what *you* have on your calendar)
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
  }, [plan]);

  // Group plan by day
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

  // Conversations by day (attribute to start day)
  const dayConvos = useMemo(() => {
    const counts = Array(7).fill(0) as number[];
    for (const p of plan) {
      const day = (Math.floor(p.startMin / MINUTES_IN_DAY) % 7) as Day;
      if (p.type === "1on1") counts[day] += 1;
      else counts[day] += (p as TeamSession).attendeeIds.length;
    }
    return counts;
  }, [plan]);
  const maxDayConvos = useMemo(() => Math.max(0, ...dayConvos), [dayConvos]);
  const heatClass = (count: number) => {
    if (maxDayConvos === 0) return "bg-gray-100";
    const r = count / maxDayConvos;
    if (r === 0) return "bg-gray-100";
    if (r < 0.25) return "bg-indigo-200";
    if (r < 0.5) return "bg-indigo-300";
    if (r < 0.75) return "bg-indigo-400";
    return "bg-indigo-500";
  };

  // Per-employee conversation coverage (1:1 = 1; each team session attended = 1)
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
  const HOUR_PX = 32; // pixels per hour (tweak to taste)
  const DAY_HEIGHT = HOUR_PX * 24; // 24h vertical grid

  // Stable color per employee (HSL by id)

  // Slice a planned item across day boundaries -> per-day fragments

  // Team blocks per day (for the Team Meetings row)
  const teamBlocksByDay = useMemo(() => {
    const arr: { p: TeamSession; start: number; end: number }[][] = Array.from(
      { length: 7 },
      () => []
    );
    for (const item of plan)
      if (item.type === "team") {
        for (const sl of sliceByDay(item)) {
          arr[sl.day].push({
            p: item as TeamSession,
            start: sl.start,
            end: sl.end,
          });
        }
      }
    return arr;
  }, [plan]);

  // Employee blocks per day: map[day][employeeId] -> fragments (1:1 or team)
  const blocksByEmpByDay = useMemo(() => {
    const arr: Array<
      Record<
        string,
        Array<{ type: "1on1" | "team"; start: number; end: number; p: Planned }>
      >
    > = Array.from({ length: 7 }, () => ({}));
    for (const item of plan) {
      const slices = sliceByDay(item);
      if (item.type === "1on1") {
        for (const sl of slices) {
          const eid = (item as OneOnOne).employeeId;
          (arr[sl.day][eid] ??= []).push({
            type: "1on1",
            start: sl.start,
            end: sl.end,
            p: item,
          });
        }
      } else {
        // push a fragment for each attendee
        const attendees = (item as TeamSession).attendeeIds;
        for (const sl of slices) {
          for (const eid of attendees) {
            (arr[sl.day][eid] ??= []).push({
              type: "team",
              start: sl.start,
              end: sl.end,
              p: item,
            });
          }
        }
      }
    }
    return arr;
  }, [plan]);
  /* === Actions === */
  // === Conflict helpers (manager attends all meetings): any time overlap is a conflict ===

  // Basic time overlap check (absolute minutes)
  function timeOverlaps(a: Planned, b: Planned) {
    return !(a.endMin <= b.startMin || b.endMin <= a.startMin);
  }

  // With manager in all meetings, attendees don't matter — any overlap is a conflict.
  function meetingsConflict(a: Planned, b: Planned) {
    return timeOverlaps(a, b);
  }

  // Merge new items into existing, skipping anything that conflicts or duplicates (by id)
  function mergeWithoutConflicts(existing: Planned[], candidates: Planned[]) {
    const result = [...existing];
    const seen = new Set(existing.map((p) => p.id));

    for (const p of candidates) {
      if (seen.has(p.id)) continue; // skip exact dupes by id
      const collides = result.some((q) => meetingsConflict(p, q));
      if (!collides) {
        result.push(p);
        seen.add(p.id);
      }
    }
    return result;
  }

  // When replacing the plan, keep a maximal non-overlapping subset (first-come wins)
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

    setPlan((prev) => {
      if (appendGenerate) {
        return mergeWithoutConflicts(prev, generated); // now blocks ANY overlaps in time
      }
      return stripInternalConflicts(generated);
    });

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

  function addEmployee() {
    const name = (
      typeof window !== "undefined" ? window.prompt("Employee name?") : ""
    )?.trim();
    if (!name) return;
    const id = uid("e");
    setEmployees((prev) => [...prev, { id, name, shifts: [] }]);
    setOpenEmployeeId(id); // open the new one
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

  // Add shift using preset list; "custom" falls back to addShift(eid)
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
  function removeManagerWindow(i: number) {
    setManagerWindows((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Manager preset quick-add
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

  /* === Render === */
  return (
    <>
      <div className="p-7 mx-auto w-full max-w">
        <header className="flex items-center gap-3 mb-6">
          <CalendarIcon className="w-6 h-6" />
          <h1 className="text-2xl font-semibold">
            Overnight-Friendly Weekly Planner
          </h1>
        </header>
        <details
          className="rounded-2xl border bg-white shadow mb-6"
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
              {/* Mode & Rules */}
              <div className="p-4 rounded-2xl shadow border bg-white overflow-hidden">
                <h2 className="font-medium mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Mode & Rules
                </h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setMode("1on1")}
                    className={`px-3 py-1 rounded-full border ${
                      mode === "1on1" ? "bg-black text-white" : ""
                    }`}
                  >
                    1-on-1 week
                  </button>
                  <button
                    onClick={() => setMode("team")}
                    className={`px-3 py-1 rounded-full border ${
                      mode === "team" ? "bg-black text-white" : ""
                    }`}
                  >
                    Team week
                  </button>
                  <button
                    onClick={() => setMode("scramble")}
                    className={`px-3 py-1 rounded-full border ${
                      mode === "scramble" ? "bg-black text-white" : ""
                    }`}
                  >
                    Last-minute scramble
                  </button>
                </div>

                {mode === "1on1" ? (
                  <div className="space-y-3">
                    <LabeledNumber
                      label="1:1 duration (min)"
                      value={slotMinutes}
                      setValue={setSlotMinutes}
                      min={15}
                      max={90}
                      step={5}
                    />
                    <LabeledNumber
                      label="Cooldown buffer (min)"
                      value={bufferMinutes}
                      setValue={setBufferMinutes}
                      min={5}
                      max={60}
                      step={5}
                    />
                    <LabeledNumber
                      label="Max per day"
                      value={maxPerDay}
                      setValue={setMaxPerDay}
                      min={1}
                      max={8}
                      step={1}
                    />
                    <LabeledNumber
                      label="Max per employee/day"
                      value={maxPerEmployeePerDay}
                      setValue={setMaxPerEmployeePerDay}
                      min={1}
                      max={8}
                      step={1}
                    />
                  </div>
                ) : mode === "team" ? (
                  <div className="space-y-3">
                    <LabeledNumber
                      label="Team session length (min)"
                      value={sessionMinutes}
                      setValue={setSessionMinutes}
                      min={15}
                      max={120}
                      step={5}
                    />
                    <p className="text-sm text-gray-600">
                      Goal: cover 100% of employees with minimal number of
                      sessions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700">
                      Scramble schedules both <strong>team sessions</strong> to
                      hit 100% coverage and <strong>1:1s</strong> for as many
                      people as possible, packing early.
                    </p>
                    <LabeledNumber
                      label="Team session length (min)"
                      value={sessionMinutes}
                      setValue={setSessionMinutes}
                      min={15}
                      max={120}
                      step={5}
                    />
                    <LabeledNumber
                      label="1:1 duration (min)"
                      value={slotMinutes}
                      setValue={setSlotMinutes}
                      min={15}
                      max={90}
                      step={5}
                    />
                    <LabeledNumber
                      label="Cooldown buffer (min)"
                      value={bufferMinutes}
                      setValue={setBufferMinutes}
                      min={5}
                      max={60}
                      step={5}
                    />
                    <LabeledNumber
                      label="Max 1:1 per day"
                      value={maxPerDay}
                      setValue={setMaxPerDay}
                      min={1}
                      max={8}
                      step={1}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={runOptimize}
                    className="px-3 py-2 rounded-xl bg-black text-white flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Generate
                  </button>
                  <button
                    onClick={clearPlan}
                    className="px-3 py-2 rounded-xl border"
                  >
                    Clear plan
                  </button>
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-sm inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={appendGenerate}
                        onChange={(e) => setAppendGenerate(e.target.checked)}
                      />
                      Append when generating (don’t replace)
                    </label>
                  </div>
                </div>
              </div>

              {/* Employees */}
              <div className="p-4 rounded-2xl shadow border bg-white overflow-hidden">
                <h2 className="font-medium mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Employees
                </h2>
                <div className="space-y-4">
                  {employees.map((e) => (
                    <div key={e.id} className="rounded-xl border">
                      {/* Header (click to toggle) */}
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full p-3 flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() =>
                          setOpenEmployeeId((prev) =>
                            prev === e.id ? null : e.id
                          )
                        }
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            setOpenEmployeeId((prev) =>
                              prev === e.id ? null : e.id
                            );
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown
                            className={`w-4 h-4 shrink-0 transition-transform ${
                              openEmployeeId === e.id ? "rotate-180" : ""
                            }`}
                          />
                          <input
                            className="font-medium outline-none min-w-0"
                            value={e.name}
                            onClick={(ev) => ev.stopPropagation()}
                            onMouseDown={(ev) => ev.stopPropagation()}
                            onChange={(ev) =>
                              setEmployees((prev) =>
                                prev.map((x) =>
                                  x.id === e.id
                                    ? { ...x, name: ev.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </div>

                        {/* Right-side controls (don't toggle card) */}
                        <div
                          className="flex items-center gap-2 shrink-0"
                          onClick={(ev) => ev.stopPropagation()}
                          onMouseDown={(ev) => ev.stopPropagation()}
                        >
                          <select
                            className="border rounded-lg px-2 py-1"
                            defaultValue="11p-7a"
                            id={`preset-${e.id}`}
                          >
                            <option value="11p-7a">11p–7a</option>
                            <option value="12a-4a">12a–4a</option>
                            <option value="10p-6a">10p–6a</option>
                            <option value="7p-11p">7p–11p</option>
                            <option value="11p-9a">11p–9a</option>
                            <option value="1030p-630a">10:30p–6:30a</option>
                            <option value="8p-4a">8p–4a</option>
                            <option value="custom">Custom…</option>
                          </select>
                          <button
                            className="text-sm px-2 py-1 rounded-full border"
                            onClick={(ev) => {
                              ev.preventDefault();
                              const sel = document.getElementById(
                                `preset-${e.id}`
                              ) as HTMLSelectElement | null;
                              const key = (sel?.value ?? "11p-7a") as PresetKey;
                              addShiftFromPreset(e.id, key);
                            }}
                          >
                            Add shift
                          </button>
                          <button
                            className="text-sm px-2 py-1 rounded-full border text-red-600"
                            onClick={() => removeEmployee(e.id)}
                          >
                            <Trash2 className="w-3 h-3 inline mr-1" />
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Collapsible content */}
                      {openEmployeeId === e.id && (
                        <div className="px-3 pb-3">
                          <div className="space-y-2">
                            {e.shifts.map((s, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 text-sm flex-wrap"
                              >
                                <select
                                  value={s.day}
                                  onChange={(ev) => {
                                    const day = Number(ev.target.value) as Day;
                                    setEmployees((prev) =>
                                      prev.map((x) =>
                                        x.id === e.id
                                          ? {
                                              ...x,
                                              shifts: x.shifts.map((y, i) =>
                                                i === idx ? { ...y, day } : y
                                              ),
                                            }
                                          : x
                                      )
                                    );
                                  }}
                                  className="border rounded-lg px-2 py-1"
                                >
                                  {DAY_NAMES.map((d, i) => (
                                    <option key={i} value={i}>
                                      {d}
                                    </option>
                                  ))}
                                </select>

                                <TimeInput
                                  label="Start"
                                  value={s.start}
                                  onChange={(val) =>
                                    setEmployees((prev) =>
                                      prev.map((x) =>
                                        x.id === e.id
                                          ? {
                                              ...x,
                                              shifts: x.shifts.map((y, i) =>
                                                i === idx
                                                  ? { ...y, start: val }
                                                  : y
                                              ),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                />
                                <span>→</span>
                                <TimeInput
                                  label="End"
                                  value={s.end}
                                  onChange={(val) =>
                                    setEmployees((prev) =>
                                      prev.map((x) =>
                                        x.id === e.id
                                          ? {
                                              ...x,
                                              shifts: x.shifts.map((y, i) =>
                                                i === idx
                                                  ? { ...y, end: val }
                                                  : y
                                              ),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                />
                                <div className="flex items-center gap-1">
                                  <button
                                    className="text-xs px-2 py-1 rounded-full border"
                                    onClick={() =>
                                      addBreak(e.id, idx, "break1")
                                    }
                                  >
                                    + Break 1
                                  </button>
                                  <button
                                    className="text-xs px-2 py-1 rounded-full border"
                                    onClick={() =>
                                      addBreak(e.id, idx, "break2")
                                    }
                                  >
                                    + Break 2
                                  </button>
                                  <button
                                    className="text-xs px-2 py-1 rounded-full border"
                                    onClick={() => addBreak(e.id, idx, "lunch")}
                                  >
                                    + Lunch
                                  </button>
                                </div>
                                {(s.breaks ?? []).length > 0 && (
                                  <div className="ml-0 pl-0 flex flex-wrap gap-2">
                                    {(s.breaks ?? []).map((b, bi) => (
                                      <span
                                        key={bi}
                                        className="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full bg-gray-100 border"
                                      >
                                        <span className="uppercase">
                                          {b.kind}
                                        </span>
                                        <span>
                                          {b.start}–{b.end}
                                        </span>
                                        <button
                                          className="text-red-600"
                                          onClick={() =>
                                            removeBreak(e.id, idx, bi)
                                          }
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <button
                                  className="text-xs px-2 py-1 rounded-full border shrink-0"
                                  onClick={() => removeShift(e.id, idx)}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {e.shifts.length === 0 && (
                              <p className="text-xs text-gray-500">
                                No shifts yet. Add at least one.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    className="px-3 py-2 rounded-xl border w-full"
                    onClick={addEmployee}
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add employee
                  </button>
                </div>
              </div>

              {/* Your Availability */}
              <div className="p-4 rounded-2xl shadow border bg-white overflow-hidden">
                <h2 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Your Availability
                </h2>
                <div className="space-y-3">
                  {managerWindows.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm flex-wrap"
                    >
                      <select
                        value={w.day}
                        onChange={(ev) => {
                          const day = Number(ev.target.value) as Day;
                          setManagerWindows((prev) =>
                            prev.map((x, idx) =>
                              idx === i ? { ...x, day } : x
                            )
                          );
                        }}
                        className="border rounded-lg px-2 py-1"
                      >
                        {DAY_NAMES.map((d, i2) => (
                          <option key={i2} value={i2}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <TimeInput
                        label="Start"
                        value={w.start}
                        onChange={(val) =>
                          setManagerWindows((prev) =>
                            prev.map((x, idx) =>
                              idx === i ? { ...x, start: val } : x
                            )
                          )
                        }
                      />
                      <span>→</span>
                      <TimeInput
                        label="End"
                        value={w.end}
                        onChange={(val) =>
                          setManagerWindows((prev) =>
                            prev.map((x, idx) =>
                              idx === i ? { ...x, end: val } : x
                            )
                          )
                        }
                      />
                      <button
                        className="text-xs px-2 py-1 rounded-full border shrink-0"
                        onClick={() => removeManagerWindow(i)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  {/* Preset quick-add for manager windows */}
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      className="border rounded-lg px-2 py-1"
                      value={newAvailDay}
                      onChange={(e) =>
                        setNewAvailDay(Number(e.target.value) as Day)
                      }
                    >
                      {DAY_NAMES.map((d, i) => (
                        <option key={i} value={i}>
                          {d}
                        </option>
                      ))}
                    </select>

                    <select
                      className="border rounded-lg px-2 py-1"
                      value={newAvailPreset}
                      onChange={(e) =>
                        setNewAvailPreset(e.target.value as AvailPresetKey)
                      }
                    >
                      <option value="4a-7a">4a–7a</option>
                      <option value="330a-7a">3:30a–7a</option>
                      <option value="12a-7a">12a–7a</option>
                      <option value="11p-7a">11p–7a</option>
                      <option value="custom">Custom…</option>
                    </select>

                    <button
                      className="px-3 py-2 rounded-xl border"
                      onClick={addManagerWindowFromPreset}
                    >
                      + Add window
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </details>
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
              {/* --- PLAN (left, 2 cols) --- */}
              <div className="md:col-span-2">
                {plan.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    Click <strong>Optimize</strong> to generate a plan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        className="px-3 py-2 rounded-xl border"
                        onClick={addManualOneOnOne}
                      >
                        + Add 1-on-1
                      </button>
                      <button
                        className="px-3 py-2 rounded-xl border"
                        onClick={addManualTeam}
                      >
                        + Add team meeting
                      </button>
                    </div>
                    {plan.map((p) => (
                      <motion.div
                        key={p.id}
                        layout
                        className="border rounded-xl p-3 flex items-start justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.title}</div>
                          <div className="text-sm text-gray-600">
                            {dayTimeLabel(p.startMin)} →{" "}
                            {dayTimeLabel(p.endMin)} (
                            {Math.round(p.endMin - p.startMin)} min)
                          </div>
                          {p.type === "1on1" && (
                            <div className="text-xs text-gray-500">
                              Employee:{" "}
                              {
                                employees.find(
                                  (e) => e.id === (p as OneOnOne).employeeId
                                )?.name
                              }
                            </div>
                          )}
                          {p.type === "team" && (
                            <div className="text-xs text-gray-500">
                              Attendees:{" "}
                              {(p as TeamSession).attendeeIds
                                .map(
                                  (id) =>
                                    employees.find((e) => e.id === id)?.name ??
                                    id
                                )
                                .join(", ")}
                            </div>
                          )}
                          <EditControls plan={p} onUpdate={updateMeeting} />
                        </div>

                        <button
                          onClick={() =>
                            setPlan((prev) => prev.filter((x) => x.id !== p.id))
                          }
                          className="text-red-600 hover:bg-red-50 rounded-lg p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* --- DIAGNOSTICS (right) --- */}
              <div>
                <h2 className="font-medium mb-3">Diagnostics</h2>
                <ul className="text-sm list-disc pl-5 space-y-2">
                  <li>
                    Mode: <strong>{mode}</strong>
                  </li>
                  <li>
                    Manager windows: <strong>{managerWindows.length}</strong>
                  </li>
                  <li>
                    Employees: <strong>{employees.length}</strong>
                  </li>
                  <li>
                    Planned 1-on-1s: <strong>{stats.oneOnOneCount}</strong>{" "}
                    <span className="text-gray-500">
                      (unique employees: {stats.unique1on1Employees}/
                      {employees.length})
                    </span>
                  </li>
                  <li>
                    Planned meetings: <strong>{stats.teamCount}</strong>
                  </li>
                  <li>
                    Total meeting headcount:{" "}
                    <strong>{stats.totalHeadcount}</strong>
                  </li>
                  {(mode === "1on1" || mode === "scramble") &&
                    unscheduled1on1s.length > 0 && (
                      <li className="text-amber-600">
                        Unscheduled 1:1s: {unscheduled1on1s.join(", ")}. Adjust
                        availability or rules.
                      </li>
                    )}
                </ul>

                {/* Keep your conversations heat + coverage UI below as-is */}
                <div className="mt-3">
                  <h3 className="font-medium text-sm mb-2">
                    Conversations by day
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {DAY_NAMES.map((d, i) => (
                      <div key={i} className="text-center">
                        <div
                          className={`h-8 rounded ${heatClass(
                            dayConvos[i]
                          )} flex items-center justify-center text-xs text-white`}
                          title={`${d}: ${dayConvos[i]}`}
                        >
                          {dayConvos[i]}
                        </div>
                        <div className="text-[11px] mt-1 text-gray-600">
                          {d}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">
                      Coverage by employee
                    </h3>
                    <div className="w-56">
                      <LabeledNumber
                        label="Target conv/employee"
                        value={targetConversations}
                        setValue={setTargetConversations}
                        min={1}
                        max={10}
                        step={1}
                      />
                    </div>
                  </div>
                  <ul className="text-sm space-y-1">
                    {coverage.length === 0 ? (
                      <li className="text-gray-500">No employees yet.</li>
                    ) : (
                      coverage.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="truncate">{c.name}</span>
                          <span
                            className={`${
                              c.conversations < targetConversations
                                ? "text-red-600"
                                : "text-green-700"
                            }`}
                          >
                            {c.conversations}/{targetConversations}
                            <span className="text-gray-500 ml-2">
                              (1:1s {c.oneCount}, team {c.teamCount})
                            </span>
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </details>
        <section className="grid md:grid-cols-3 gap-6">
          {/* === MANAGER WEEK CALENDAR (single calendar, time-based) === */}
          <section className="p-4 rounded-2xl shadow border bg-white overflow-x-auto col-span-3">
            <h2 className="font-medium mb-3">My Week (appointments):</h2>
            {/* Legend: employee colors */}
            <div className="col-span-8 -mt-1 mb-2">
              <h2 className="font-medium mb-3">Legend:</h2>
              <div className="flex flex-wrap items-center gap-3">
                {employees.map((e) => (
                  <div key={e.id} className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-[3px]"
                      style={{ background: colorFor(e.id) }}
                    />
                    <span className="text-xs text-slate-700">{e.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grid: time axis + 7 day columns */}
            <div className="min-w-[1060px] grid grid-cols-[64px_repeat(7,minmax(140px,1fr))] gap-2 text-sm">
              {/* Header row */}
              <div className="p-2 text-gray-500">Time</div>
              {DAY_NAMES.map((d, i) => (
                <div key={i} className="p-2 font-medium text-center">
                  {d}
                </div>
              ))}

              {/* Time axis with hour ticks */}
              <div className="p-2">
                <div
                  className="relative w-full border rounded-md"
                  style={{
                    height: DAY_HEIGHT,
                    backgroundImage: `repeating-linear-gradient(to bottom, #eaeef5 0, #eaeef5 1px, transparent 1px, transparent ${HOUR_PX}px)`,
                  }}
                >
                  {Array.from({ length: 25 }).map((_, h) => (
                    <div
                      key={h}
                      className="absolute left-1 -translate-y-1/2 text-[10px] text-gray-500"
                      style={{ top: h * HOUR_PX }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
              </div>

              {/* Day columns with your appointments as time blocks */}
              {DAY_NAMES.map((_, day) => (
                <div key={`day-${day}`} className="p-2">
                  <div
                    className="relative w-full border rounded-md"
                    style={{
                      height: DAY_HEIGHT,
                      backgroundImage: `repeating-linear-gradient(to bottom, #eaeef5 0, #eaeef5 1px, transparent 1px, transparent ${HOUR_PX}px)`,
                    }}
                    onClick={(e) => openCreateFromClick(day as Day, e)}
                  >
                    {/* teams scheduled for this day */}
                    {/* Per-employee availability outlines */}
                    {employees.map((emp, j) =>
                      employeeAvailByDay[emp.id]?.[day]?.map((seg, i) => {
                        const top = (seg.start / 60) * HOUR_PX;
                        const height = Math.max(
                          6,
                          ((seg.end - seg.start) / 60) * HOUR_PX
                        );

                        // shift each employee outline outward by j * 1px
                        const offset = (j + 1) * -3;

                        return (
                          <div
                            key={`empavail-${emp.id}-${day}-${i}`}
                            className="absolute rounded-md pointer-events-none"
                            style={{
                              top: top - offset,
                              height: height + offset * 2,
                              left: offset * -1,
                              right: offset * -1,
                              zIndex: 1, // keep behind meeting blocks
                            }}
                          >
                            {emp.name && (
                              <div
                                className="absolute left-1 top-1 text-[10px] text-gray-500 bg-white/30 px-1 rounded"
                                // style={{
                                //   transform: `translateY(${-offset}px)`,
                                // }}
                              >
                                {emp.name}
                              </div>
                            )}
                            <div
                              className="h-full w-full rounded-md bg-transparent border-2"
                              style={{
                                borderColor: colorFor(emp.id),
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        );
                      })
                    )}

                    {/* Your availability (outlined in blue), rendered behind appointments */}
                    {managerAvailByDay[day].map((seg, i) => {
                      const top = (seg.start / 60) * HOUR_PX;
                      const height = Math.max(
                        6,
                        ((seg.end - seg.start) / 60) * HOUR_PX
                      );
                      return (
                        <div
                          key={`avail-${day}-${i}`}
                          className="absolute rounded-md pointer-events-none"
                          style={{ top, height }}
                        >
                          <div className="h-full w-full rounded-md ring-2 ring-sky-500/70 bg-transparent" />
                        </div>
                      );
                    })}
                    {managerBlocksByDay[day].map((b) => {
                      const top = (b.start / 60) * HOUR_PX;
                      const height = Math.max(
                        10,
                        ((b.end - b.start) / 60) * HOUR_PX
                      );

                      if (b.type === "1on1") {
                        const color = colorFor(b.empId!);
                        const hasMetadata = meetingMeta[b.id];
                        const a = {
                          id: b.id,
                          type: b.type,
                          attendeeIds: b.attendees ? b.attendees : [b.empId],
                          title: b.type,
                          startMin: b.start,
                          endMin: b.end,
                          employeeId: b.empId!,
                        };
                        return (
                          <div
                            key={b.id}
                            className="absolute left-0 right-0 rounded-md px-2 py-1 text-[11px] leading-4 text-white shadow cursor-pointer hover:shadow-lg transition-shadow"
                            style={{ top, height, background: color }}
                            title={`${nameById(b.empId!)} ${fmtHHMM(
                              b.start
                            )}–${fmtHHMM(b.end)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMeetingClick(a);
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium truncate">
                                {nameById(b.empId!)}
                              </div>
                              {hasMetadata && (
                                <div className="flex items-center gap-1 text-yellow-300 text-xs">
                                  {hasMetadata.rating &&
                                    "★".repeat(hasMetadata.rating)}
                                  {hasMetadata.tags!.length > 0 && (
                                    <span className="opacity-75">
                                      #{hasMetadata.tags!.length}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="opacity-90">
                              {fmtHHMM(b.start)}–{fmtHHMM(b.end)}
                            </div>
                          </div>
                        );
                      }

                      // team block
                      const hasMetadata = meetingMeta[b.id];
                      const a = {
                        id: b.id,
                        type: b.type,
                        attendeeIds: b.attendees!,
                        title: b.type,
                        startMin: b.start,
                        endMin: b.end,
                        employeeId: b.empId!,
                      };
                      return (
                        <div
                          key={b.id}
                          className="absolute left-1 right-1 rounded-md px-2 py-1 text-[11px] leading-4 bg-white border border-slate-300 shadow-sm z-10 cursor-pointer hover:shadow-md transition-shadow"
                          style={{ top, height }}
                          title={`Team ${fmtHHMM(b.start)}–${fmtHHMM(b.end)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMeetingClick(a);
                          }}
                        >
                          {/* Attendee swatches: wrap + shrink */}
                          <div className="flex flex-wrap items-center justify-center content-center gap-[2px] overflow-hidden">
                            {b.attendees!.map((eid) => (
                              <span
                                key={`${b.id}-${eid}`}
                                title={nameById(eid)}
                                className="rounded-[3px] h-2"
                                style={{
                                  background: colorFor(eid),
                                  // flex: grow shrink basis (lets them compress instead of overflowing)
                                  flex: "0 1 12px",
                                }}
                              />
                            ))}
                          </div>
                          {hasMetadata && (
                            <div className="text-center text-[10px] text-yellow-400 mt-1">
                              {hasMetadata.rating &&
                                "★".repeat(hasMetadata.rating)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
      <div id="ModalPlaceholder"></div>

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
  function addBreak(eid: string, shiftIdx: number, kind: BreakKind) {
    // Simple prompt UX for now; later: preset durations or a mini time picker
    const def = kind === "lunch" ? ["03:00", "03:30"] : ["04:00", "04:10"]; // hh:mm durations as suggestions
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
}

/* ======================= Small UI Components ======================= */
function LabeledNumber({
  label,
  value,
  setValue,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="number"
        className="border rounded-lg px-2 py-1 w-24 text-right"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </label>
  );
}

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="text-xs text-gray-500 w-10">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-lg px-2 py-1"
      />
    </label>
  );
}

function EditControls({
  plan,
  onUpdate,
}: {
  plan: Planned;
  onUpdate: (id: string, updates: Partial<Planned>) => void;
}) {
  const start = minutesToDayTime(plan.startMin);
  const end = minutesToDayTime(plan.endMin);
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="w-10 text-gray-500">Start</span>
        <select
          value={start.day}
          onChange={(e) => {
            const day = Number(e.target.value) as Day;
            const newStart = dayTimeToAbs(day, start.time);
            const dur = plan.endMin - plan.startMin;
            onUpdate(plan.id, { startMin: newStart, endMin: newStart + dur });
          }}
          className="border rounded-lg px-2 py-1"
        >
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={start.time}
          onChange={(e) => {
            const newStart = dayTimeToAbs(start.day, e.target.value);
            const dur = plan.endMin - plan.startMin;
            onUpdate(plan.id, { startMin: newStart, endMin: newStart + dur });
          }}
          className="border rounded-lg px-2 py-1"
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="w-10 text-gray-500">End</span>
        <select
          value={end.day}
          onChange={(e) => {
            const day = Number(e.target.value) as Day;
            const newEnd = dayTimeToAbs(day, end.time);
            onUpdate(plan.id, { endMin: newEnd });
          }}
          className="border rounded-lg px-2 py-1"
        >
          {DAY_NAMES.map((d, i) => (
            <option key={i} value={i}>
              {d}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={end.time}
          onChange={(e) => {
            const newEnd = dayTimeToAbs(end.day, e.target.value);
            onUpdate(plan.id, { endMin: newEnd });
          }}
          className="border rounded-lg px-2 py-1"
        />
      </label>
    </div>
  );
}

function Swatch({
  color,
  title,
  variant = "solid",
}: {
  color: string;
  title?: string;
  variant?: "solid" | "ring";
}) {
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

function normalizeEmployeesForOvernights(employees: Employee[]): Employee[] {
  // Helper to compare "HH:MM" as minutes
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  return employees.map((emp) => {
    const newShifts: Employee["shifts"] = [];

    for (const s of emp.shifts) {
      const startMin = toMin(s.start);
      const endMin = toMin(s.end);
      const crossesMidnight = endMin <= startMin; // e.g., 23:00 → 07:00

      if (!crossesMidnight) {
        // Keep as-is
        newShifts.push({
          day: s.day,
          start: s.start,
          end: s.end,
          breaks: s.breaks ? [...s.breaks] : undefined,
        });
        continue;
      }

      // Split into two shifts: [D: start→24:00] and [D+1: 00:00→end]
      const dayA = s.day;
      const dayB = ((s.day + 1) % 7) as Day;

      const breaksA: typeof s.breaks = [];
      const breaksB: typeof s.breaks = [];

      // Assign each break to the correct "half" by comparing to startMin
      for (const b of s.breaks ?? []) {
        const bStartMin = toMin(b.start);
        const bEndMin = toMin(b.end);
        // If the break time is at/after the shift start clock time,
        // it belongs to the first segment (same day).
        // Else it's the next day segment.
        const goesInA = bStartMin >= startMin;
        (goesInA ? breaksA : breaksB)!.push({ ...b });
      }

      // First segment: D start→24:00
      newShifts.push({
        day: dayA,
        start: s.start,
        end: "24:00",
        breaks: breaksA.length ? breaksA : undefined,
      });

      // Second segment: D+1 00:00→end
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
