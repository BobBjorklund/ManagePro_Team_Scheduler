"use client";

import type { SavedState } from "@/lib/types";

export type ExportBundle = {
  version: 1;
  exportedAt: string;
  data: SavedState;
};

export function serializeExport(state: SavedState): string {
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  return JSON.stringify(bundle, null, 2);
}

export function downloadJSON(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Accepts either an ExportBundle or a raw SavedState */
export async function parseImport(text: string): Promise<SavedState> {
  const obj = JSON.parse(text);
  if (obj && typeof obj === "object" && obj.version === 1 && obj.data) {
    return obj.data as SavedState;
  }
  return obj as SavedState;
}
