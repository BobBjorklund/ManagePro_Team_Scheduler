// src/app/supervisors/page.tsx
import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import SupervisorHeatmap from "@/components/SupervisorHeatmap";
import type { SupervisorsPayload } from "@/types/metrics";

export const dynamic = "force-dynamic";

async function getData(): Promise<SupervisorsPayload> {
  const file = await fs.readFile(
    path.join(process.cwd(), "public", "data", "supervisors.json"),
    "utf8"
  );
  return JSON.parse(file);
}

export default async function Page() {
  const data = await getData();

  return (
    <main className="mx-auto max-w-[1400px] p-6">
      <Link
        href="../"
        className="inline-flex items-center rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
      >
        meeting planner
      </Link>

      <SupervisorHeatmap
        metrics={data.metrics}
        supervisors={data.supervisors}
      />

      <p className="mt-4 text-xs text-gray-500">
        Data generated at {new Date(data.generatedAt).toLocaleString()}
      </p>
    </main>
  );
}

