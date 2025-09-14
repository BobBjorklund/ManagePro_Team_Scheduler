"use client";
import React from "react";
import {
  DAY_NAMES,
  Day,
  MINUTES_IN_DAY,
  TeamSession,
  Planned,
  MeetingMeta,
} from "@/lib/types";
import { fmtHHMM } from "@/lib/time";
import { Swatch } from "./ui/Swatch";

type EmpAvail = Record<string, { start: number; end: number }[][]>;

type Block = {
  id: string;
  type: "1on1" | "team";
  start: number;
  end: number;
  empId?: string;
  attendees?: string[];
};

type Props = {
  employees: { id: string; name: string }[];
  employeeAvailByDay: EmpAvail;
  managerAvailByDay: Array<Array<{ start: number; end: number }>>;
  managerBlocksByDay: Array<Block[]>;

  colorFor: (id: string) => string;
  meetingMeta: Record<string, MeetingMeta>;
  nameById: (id: string) => string;

  HOUR_PX?: number;
  onColumnClick: (day: Day, e: React.MouseEvent<HTMLDivElement>) => void;
  onMeetingClick: (p: Planned) => void;
};

const WeekCalendar: React.FC<Props> = ({
  employees,
  employeeAvailByDay,
  managerAvailByDay,
  managerBlocksByDay,
  colorFor,
  meetingMeta,
  nameById,
  HOUR_PX = 32,
  onColumnClick,
  onMeetingClick,
}) => {
  const DAY_HEIGHT = HOUR_PX * 24;

  return (
    <section className="p-4 rounded-2xl shadow border bg-white overflow-x-auto col-span-3">
      <h2 className="font-medium mb-3">My Week (appointments):</h2>

      {/* Legend */}
      <div className="col-span-8 -mt-1 mb-2">
        <h2 className="font-medium mb-3">Legend:</h2>
        <div className="flex flex-wrap items-center gap-3">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-[3px] focusable-border"
                style={{ background: colorFor(e.id) }}
              />
              <span className="text-xs text-slate-700">{e.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="min-w-[1060px] grid grid-cols-[64px_repeat(7,minmax(140px,1fr))] gap-2 text-sm">
        {/* Header row */}
        <div className="p-2 text-gray-500">Time</div>
        {DAY_NAMES.map((d, i) => (
          <div key={i} className="p-2 font-medium text-center">
            {d}
            <br />

            {employees.map((emp) => {
              const DAY_MIN = 24 * 60;
              const dayIdx = typeof d === "number" ? d : DAY_NAMES.indexOf(d);

              const segmentsToday = employeeAvailByDay[emp.id]?.[dayIdx] ?? [];
              const managerSegmentsToday = managerAvailByDay[dayIdx] ?? [];
              if (
                managerSegmentsToday.length <= 0 ||
                managerSegmentsToday[0].start > 1379
              ) {
                return null;
              }
              if (segmentsToday.length === 0) return null;

              // Today has any tail (starts at 00:00) or any mid-day segment (ends before 24:00)?
              const hasTailOrMid = segmentsToday.some(
                (s) => s.start === 0 || s.end < DAY_MIN
              );

              // Is there a tail tomorrow (starts at 00:00)?
              const segmentsTomorrow =
                employeeAvailByDay[emp.id]?.[(dayIdx + 1) % 7] ?? [];
              const hasTailTomorrow = segmentsTomorrow.some(
                (s) => s.start === 0
              );

              // Hide only if today is *pure head(s)* (e.g., 23:00–24:00) and the tail shows up tomorrow.
              const hide = !hasTailOrMid && hasTailTomorrow;
              if (hide) return null;

              // Otherwise, show exactly one swatch for this employee/day
              return (
                <div
                  key={`empavail-${emp.id}-${dayIdx}`}
                  className="inline-block w-3 h-3 rounded-[3px]"
                >
                  {/* optional label */}
                  {/* {emp.name} */}
                  <div
                    className="h-full w-full border-2"
                    style={{ backgroundColor: colorFor(emp.id), opacity: 1 }}
                    title={emp.name}
                  />
                </div>
              );
            })}
          </div>
        ))}

        {/* Time axis */}
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

        {/* Day columns */}
        {DAY_NAMES.map((_, day) => (
          <div key={`day-${day}`} className="p-2">
            <div
              className="relative w-full border rounded-md"
              style={{
                height: DAY_HEIGHT,
                backgroundImage: `repeating-linear-gradient(to bottom, #eaeef5 0, #eaeef5 1px, transparent 1px, transparent ${HOUR_PX}px)`,
              }}
              onClick={(e) => onColumnClick(day as Day, e)}
            >
              {/* Manager availability */}
              {managerAvailByDay[day].map((seg, i) => {
                const top = (seg.start / 60) * HOUR_PX;
                const height = Math.max(
                  6,
                  ((seg.end - seg.start) / 60) * HOUR_PX
                );
                return (
                  <div
                    key={`avail-${day}-${i}`}
                    className="absolute inset-x-0 rounded-md pointer-events-none"
                    style={{ top, height }}
                  >
                    <div className="h-full w-full rounded-md ring-2 ring-sky-500/70 bg-transparent" />
                  </div>
                );
              })}

              {/* Meetings */}
              {managerBlocksByDay[day].map((b) => {
                const top = (b.start / 60) * HOUR_PX;
                const height = Math.max(10, ((b.end - b.start) / 60) * HOUR_PX);

                if (b.type === "1on1") {
                  const color = colorFor(b.empId!);
                  const hasMetadata = meetingMeta[b.id];

                  const pObj: Planned = {
                    id: b.id,
                    type: "1on1",
                    title: "1on1",
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
                        onMeetingClick(pObj);
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
                            {(hasMetadata.tags?.length ?? 0) > 0 && (
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
                const pObj: Planned = {
                  id: b.id,
                  type: "team",
                  title: "Team",
                  startMin: b.start,
                  endMin: b.end,
                  attendeeIds: b.attendees!,
                } as TeamSession;

                return (
                  <div
                    key={b.id}
                    className="absolute left-1 right-1 rounded-md px-2 py-1 text-[11px] leading-4 bg-white border border-slate-300 shadow-sm z-10 cursor-pointer hover:shadow-md transition-shadow"
                    style={{ top, height }}
                    title={`Team ${fmtHHMM(b.start)}–${fmtHHMM(b.end)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMeetingClick(pObj);
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-center content-center gap-[2px] overflow-hidden">
                      {b.attendees!.map((eid) => (
                        <span
                          key={`${b.id}-${eid}`}
                          title={nameById(eid)}
                          className="rounded-[3px] h-2"
                          style={{
                            background: colorFor(eid),
                            flex: "0 1 12px",
                          }}
                        />
                      ))}
                    </div>
                    {hasMetadata && (
                      <div className="text-center text-[10px] text-yellow-400 mt-1">
                        {hasMetadata.rating && "★".repeat(hasMetadata.rating)}
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
  );
};

export default WeekCalendar;
