"use client";

import { useMemo, useState } from "react";
import { MetricConfig, Supervisor, AgentRow } from "@/types/metrics";
import { scoreToRgb, textColorFor } from "@/lib/scoreColors";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

type Props = {
  metrics: MetricConfig[];
  supervisors: Supervisor[];
};
const PERCENT_KEYS = new Set([
  "Completed COR %",
  "Completed AAR %",
  "Completed COR AAR %",
  "Adherence %",
  "Survey_Adw", // ← treat survey avg as a percentage (0–1 → 0–100%)
]);

const COUNT_KEYS = new Set([
  "Completed COR",
  "Completed AAR",
  // add others if you later include them in metrics
  "Total Phone Calls(non membership)",
  "Total Phone Calls(membership)",
]);

function formatRaw(key: string, raw: number): string {
  if (!Number.isFinite(raw)) return "—";
  if (key === "ACD_min") return mmss(raw);
  if (PERCENT_KEYS.has(key)) return `${(raw * 100).toFixed(1)}%`;
  if (COUNT_KEYS.has(key)) return Intl.NumberFormat().format(Math.round(raw));
  if (key === "AME") return raw.toFixed(1); // avg across team can be 2.7, etc.
  return raw.toFixed(2); // sane default for other continuous values
}
export default function SupervisorHeatmap({ metrics, supervisors }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (sup: string) => setOpen((o) => ({ ...o, [sup]: !o[sup] }));

  // Build a quick map for color inheritance (counts mirror %)
  const inheritMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of metrics) {
      if (m.inheritsColorFrom) map.set(m.key, m.inheritsColorFrom);
    }
    return map;
  }, [metrics]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Supervisor Performance</h1>
        <div className="text-sm text-gray-500">
          Click a supervisor row to expand their team
        </div>
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur">
            <tr>
              <th className="sticky left-0 z-20 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-600">
                Supervisor
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                Overall
              </th>
              {metrics.map((m) => (
                <th
                  key={m.key}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-600"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supervisors.map((s) => (
              <SupervisorRow
                key={s.supervisor}
                sup={s}
                metrics={metrics}
                inheritMap={inheritMap}
                open={!!open[s.supervisor]}
                onToggle={() => toggle(s.supervisor)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupervisorRow({
  sup,
  metrics,
  inheritMap,
  open,
  onToggle,
}: {
  sup: Supervisor;
  metrics: MetricConfig[];
  inheritMap: Map<string, string>;
  open: boolean;
  onToggle: () => void;
}) {
  const overallColor = scoreToRgb(sup.overall);
  const overallText = textColorFor(sup.overall);

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium text-gray-900 flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {sup.supervisor}
        </td>
        <td className="px-3 py-2">
          <Chip
            score={sup.overall}
            label={`${Math.round(sup.overall * 100)}`}
          />
        </td>
        {metrics.map((m) => {
          const srcKey = inheritMap.get(m.key) ?? m.key;
          const score = sup.scores[srcKey] ?? 0;
          const color = scoreToRgb(score);
          const tcolor = textColorFor(score);
          const raw = sup.raw[m.key];

          const display = formatRaw(m.key, raw);

          return (
            <td key={m.key} className="px-1 py-1">
              <div
                className="rounded-md px-2 py-1 text-xs text-center shadow-sm"
                style={{ backgroundColor: color, color: tcolor }}
                title={`${m.label}: ${display}`}
              >
                {display}
              </div>
            </td>
          );
        })}
      </tr>
      {open && (
        <tr>
          <td
            colSpan={2 + metrics.length}
            className="bg-gray-50 px-3 pb-4 pt-2"
          >
            <TeamPanel
              agents={sup.agents}
              metrics={metrics}
              inheritMap={inheritMap}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function TeamPanel({
  agents,
  metrics,
  inheritMap,
}: {
  agents: AgentRow[];
  metrics: MetricConfig[];
  inheritMap: Map<string, string>;
}) {
  // Virtualize long lists
  const parentRef = useVirtualContainerRef();
  const rowVirtualizer = useVirtualizer({
    count: agents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600">
        <Users className="h-4 w-4" />
        {agents.length} agents
      </div>
      <div
        ref={parentRef}
        className="max-h-[420px] overflow-auto border-t border-gray-100"
      >
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-white">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                Agent
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                Overall
              </th>
              {metrics.map((m) => (
                <th
                  key={m.key}
                  className="px-2 py-2 text-left text-xs font-semibold text-gray-600"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const a = agents[vRow.index];
              return (
                <tr key={a.agent} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-900">{a.agent}</td>
                  <td className="px-3 py-2">
                    <Chip
                      score={a.overall}
                      label={`${Math.round(a.overall * 100)}`}
                    />
                  </td>
                  {metrics.map((m) => {
                    const srcKey = inheritMap.get(m.key) ?? m.key;
                    const score = a.scores[srcKey] ?? 0;
                    const color = scoreToRgb(score);
                    const tcolor = textColorFor(score);
                    const raw = a.raw[m.key];
                    const display = formatRaw(m.key, raw);
                    return (
                      <td key={m.key} className="px-1 py-1">
                        <div
                          className="rounded-md px-2 py-1 text-xs text-center shadow-sm"
                          style={{ backgroundColor: color, color: tcolor }}
                          title={`${m.label}: ${display}`}
                        >
                          {display}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ height: rowVirtualizer.getTotalSize() }} />
      </div>
    </div>
  );
}

function Chip({ score, label }: { score: number; label: string }) {
  const bg = scoreToRgb(score);
  const tc = textColorFor(score);
  return (
    <div
      className="inline-flex min-w-12 items-center justify-center rounded-full px-2 py-1 text-xs font-medium"
      style={{ backgroundColor: bg, color: tc }}
      title={`${label}`}
    >
      {label}
    </div>
  );
}

function mmss(mins: number): string {
  if (!isFinite(mins)) return "—";
  const m = Math.floor(mins);
  let s = Math.round((mins - m) * 60);
  if (s === 60) {
    s = 0;
    return `${String(m + 1).padStart(2, "0")}:00`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Small helper for virtualizer ref without extra deps wiring
function useVirtualContainerRef<T extends HTMLElement = HTMLDivElement>() {
  const [el, setEl] = useState<T | null>(null);
  return { current: el } as unknown as React.MutableRefObject<T>;
}
