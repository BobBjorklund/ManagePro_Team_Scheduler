"use client";
import React from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Employee, PresetKey, DAY_NAMES, Day, BreakKind } from "@/lib/types";
import { TimeInput } from "./inputs/TimeInput";

type Props = {
  employees: Employee[];
  openEmployeeId: string | null;
  setOpenEmployeeId: (id: string | null) => void;

  // callbacks that keep logic in the page
  setEmployeeName: (eid: string, name: string) => void;
  addShiftFromPreset: (eid: string, preset: PresetKey) => void;
  removeEmployee: (eid: string) => void;
  setShiftDay: (eid: string, idx: number, day: Day) => void;
  setShiftStart: (eid: string, idx: number, val: string) => void;
  setShiftEnd: (eid: string, idx: number, val: string) => void;
  addBreak: (eid: string, shiftIdx: number, kind: BreakKind) => void;
  removeBreak: (eid: string, shiftIdx: number, breakIdx: number) => void;
  removeShift: (eid: string, idx: number) => void;
  addEmployee: () => void;
};

const EmployeesCard: React.FC<Props> = ({
  employees,
  openEmployeeId,
  setOpenEmployeeId,
  setEmployeeName,
  addShiftFromPreset,
  removeEmployee,
  setShiftDay,
  setShiftStart,
  setShiftEnd,
  addBreak,
  removeBreak,
  removeShift,
  addEmployee,
}) => {
  return (
    <div className="p-4 rounded-2xl shadow border bg-white overflow-hidden">
      <h2 className="font-medium mb-3 flex items-center gap-2">Employees</h2>

      <div className="space-y-4">
        {employees.map((e) => (
          <div key={e.id} className="rounded-xl border">
            {/* header */}
            <div
              role="button"
              tabIndex={0}
              className="w-full p-3 flex items-center justify-between gap-2 cursor-pointer"
              onClick={() =>
                setOpenEmployeeId(openEmployeeId === e.id ? null : e.id)
              }
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setOpenEmployeeId(openEmployeeId === e.id ? null : e.id);
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
                  onChange={(ev) => setEmployeeName(e.id, ev.target.value)}
                />
              </div>

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
                    addShiftFromPreset(
                      e.id,
                      (sel?.value ?? "11p-7a") as PresetKey
                    );
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

            {/* body */}
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
                        onChange={(ev) =>
                          setShiftDay(e.id, idx, Number(ev.target.value) as Day)
                        }
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
                        onChange={(val) => setShiftStart(e.id, idx, val)}
                      />
                      <span>→</span>
                      <TimeInput
                        label="End"
                        value={s.end}
                        onChange={(val) => setShiftEnd(e.id, idx, val)}
                      />

                      <div className="flex items-center gap-1">
                        <button
                          className="text-xs px-2 py-1 rounded-full border"
                          onClick={() => addBreak(e.id, idx, "break1")}
                        >
                          + Break 1
                        </button>
                        <button
                          className="text-xs px-2 py-1 rounded-full border"
                          onClick={() => addBreak(e.id, idx, "break2")}
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
                              <span className="uppercase">{b.kind}</span>
                              <span>
                                {b.start}–{b.end}
                              </span>
                              <button
                                className="text-red-600"
                                onClick={() => removeBreak(e.id, idx, bi)}
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
          + Add employee
        </button>
      </div>
    </div>
  );
};

export default EmployeesCard;
