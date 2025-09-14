"use client";
import React from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Planned, OneOnOne, TeamSession, Employee } from "@/lib/types";
import { dayTimeLabel } from "@/components/utils/time-ui";
import { EditControls } from "./plan/EditControls";

type Props = {
  plan: Planned[];
  employees: Employee[];
  addManualOneOnOne: () => void;
  addManualTeam: () => void;
  onRemoveMeeting: (id: string) => void;
  updateMeeting: (id: string, updates: Partial<Planned>) => void;
};

const PlanList: React.FC<Props> = ({
  plan,
  employees,
  addManualOneOnOne,
  addManualTeam,
  onRemoveMeeting,
  updateMeeting,
}) => {
  if (plan.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Click <strong>Optimize</strong> to generate a plan.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          className="px-3 py-2 rounded-xl border"
          onClick={addManualOneOnOne}
        >
          + Add 1-on-1
        </button>
        <button className="px-3 py-2 rounded-xl border" onClick={addManualTeam}>
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
              {dayTimeLabel(p.startMin)} → {dayTimeLabel(p.endMin)} (
              {Math.round(p.endMin - p.startMin)} min)
            </div>

            {p.type === "1on1" && (
              <div className="text-xs text-gray-500">
                Employee:{" "}
                {
                  employees.find((e) => e.id === (p as OneOnOne).employeeId)
                    ?.name
                }
              </div>
            )}

            {p.type === "team" && (
              <div className="text-xs text-gray-500">
                Attendees:{" "}
                {(p as TeamSession).attendeeIds
                  .map((id) => employees.find((e) => e.id === id)?.name ?? id)
                  .join(", ")}
              </div>
            )}

            <EditControls plan={p} onUpdate={updateMeeting} />
          </div>

          <button
            onClick={() => onRemoveMeeting(p.id)}
            className="text-red-600 hover:bg-red-50 rounded-lg p-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

export default PlanList;
