"use client";

import React from "react";
import { Upload, Download } from "lucide-react";
import type { SavedState } from "@/lib/types";
import { serializeExport, downloadJSON, parseImport } from "@/lib/io";

type Props = {
  getState: () => SavedState;
  onImport: (state: SavedState) => void;
  className?: string;
};

export const ImportExport: React.FC<Props> = ({
  getState,
  onImport,
  className,
}) => {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const handleExport = () => {
    const state = getState();
    downloadJSON(
      `planner-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      serializeExport(state)
    );
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const state = await parseImport(text);
      onImport(state);
    } catch (err: unknown | Error) {
      alert(`Failed to import: ${err}`);
    } finally {
      setBusy(false);
      e.target.value = ""; // allow re-selecting same file
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <button
        onClick={handleExport}
        className="px-3 py-2 rounded-lg bg-black/30 hover:bg-black/40 transition flex items-center gap-1 text-white"
        title="Export team + availability + plan"
        disabled={busy}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
      </button>

      <button
        onClick={handleImportClick}
        className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition flex items-center gap-1 text-white"
        title="Import team + availability + plan"
        disabled={busy}
      >
        <Upload className="w-4 h-4" />
        <span className="hidden sm:inline">Import</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
