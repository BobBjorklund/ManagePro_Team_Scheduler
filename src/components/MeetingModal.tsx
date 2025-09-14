// =============================
// components/MeetingModal.tsx
// =============================
"use client";
import React from "react";
import { Users, User, X } from "lucide-react";
import type { MeetingMeta, Planned, OneOnOne, TeamSession } from "../lib/types";
import type { MeetingStatus } from "../lib/types";
import { fmtHHMM } from "../lib/time";

export type MeetingModalProps = {
  meeting: Planned | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: MeetingMeta) => void;
  colorFor: (id: string) => string;
  nameById: (id: string) => string;
  existingMetadata?: MeetingMeta;
};

export function MeetingModal({
  meeting,
  isOpen,
  onClose,
  onSave,
  colorFor,
  nameById,
  existingMetadata,
}: MeetingModalProps) {
  const [details, setDetails] = React.useState<MeetingMeta>({
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
        status:
          (existingMetadata?.status as MeetingStatus | undefined) ||
          "scheduled",
        actualStartMin: existingMetadata?.actualStartMin || meeting.startMin,
        actualEndMin: existingMetadata?.actualEndMin || meeting.endMin,
        tags: existingMetadata?.tags || [],
        rating: existingMetadata?.rating || 3,
      });
    }
  }, [meeting, existingMetadata]);

  if (!isOpen || !meeting) return null;

  const is1on1 = meeting.type === "1on1";
  const teamIds: string[] = !is1on1
    ? (meeting as TeamSession).attendeeIds ?? []
    : [];
  const attendeeNames: string[] = is1on1
    ? [nameById((meeting as OneOnOne).employeeId)]
    : teamIds.map((id) => nameById(id));

  const handleSave = () => {
    onSave(details);
    onClose();
  };

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
              {attendeeNames.map((name, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      backgroundColor: is1on1
                        ? colorFor((meeting as OneOnOne).employeeId)
                        : colorFor(teamIds[idx]),
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
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
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
                      (details.rating ?? 0) >= star
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
              value={(details.tags ?? []).join(", ")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
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
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
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
}
