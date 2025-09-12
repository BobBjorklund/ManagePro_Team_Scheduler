// lib/types.ts
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0..Sat=6

export interface Interval {
  startMin: number;
  endMin: number;
} // [start,end)

export type BreakKind = "break1" | "break2" | "lunch";
export interface BreakInput {
  kind: BreakKind;
  start: string;
  end: string;
}

export interface ShiftInput {
  day: Day;
  start: string;
  end: string;
  breaks?: BreakInput[];
}

export interface Employee {
  id: string;
  name: string;
  shifts: ShiftInput[];
}
export interface ManagerWindow {
  day: Day;
  start: string;
  end: string;
}

export interface MeetingBase {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
}
export interface OneOnOne extends MeetingBase {
  type: "1on1";
  employeeId: string;
}
export interface TeamSession extends MeetingBase {
  type: "team";
  attendeeIds: string[];
}
export interface ShiftAbs extends Interval {
  employeeId: string;
}

export type MeetingStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface MeetingMeta {
  /** same id as the Planned meeting id */
  id: string;
  /** free-form notes you enter after/while meeting */
  notes?: string;
  /** agenda/topics to discuss */
  agenda?: string;
  /** meeting status */
  status?: MeetingStatus;
  /** actuals (mins since week start), optional */
  actualStartMin?: number;
  actualEndMin?: number;
  /** quick tags or outcomes */
  tags?: string[];
  /** rating or sentiment if you want it later */
  rating?: number; // 1-5
}

export const SHIFT_PRESETS = {
  "11p-7a": { start: "23:00", end: "07:00" },
  "12a-4a": { start: "00:00", end: "04:00" },
  "10p-6a": { start: "22:00", end: "06:00" },
  "7p-11p": { start: "19:00", end: "23:00" },
  "11p-9a": { start: "23:00", end: "09:00" },
  "1030p-630a": { start: "22:30", end: "06:30" },
  "8p-4a": { start: "20:00", end: "04:00" },
} as const;
export type PresetKey = keyof typeof SHIFT_PRESETS | "custom";
export const STORAGE_KEY = "ofwp:state:v1";
// Manager availability presets
export const AVAIL_PRESETS = {
  "4a-7a": { start: "04:00", end: "07:00" },
  "330a-7a": { start: "03:30", end: "07:00" },
  "12a-7a": { start: "00:00", end: "07:00" },
  "11p-7a": { start: "23:00", end: "07:00" }, // crosses day
} as const;
export type AvailPresetKey = keyof typeof AVAIL_PRESETS | "custom";
export type Planned = OneOnOne | TeamSession;
export type OneOnOneStrategy = "scarcity" | "packEarly";
export const MINUTES_IN_DAY = 24 * 60;
export const MINUTES_IN_WEEK = 7 * MINUTES_IN_DAY;
export const DAY_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export interface SavedState {
  employees: Employee[];
  managerWindows: ManagerWindow[];
  settings: {
    mode: "1on1" | "team" | "scramble";
    slotMinutes: number;
    bufferMinutes: number;
    maxPerDay: number;
    sessionMinutes: number;
    targetConversations: number;
  };
  plan: Planned[];
  /** store per-meeting notes/actuals by id */
  meetingMeta?: Record<string, MeetingMeta>;
}
