// src/app/supervisors/page.tsx
import fs from "node:fs/promises";
import path from "node:path";
// adjust this import to where you put the component/types
import SupervisorHeatmap from "@/components/SupervisorHeatmap";
import type { SupervisorsPayload } from "@/types/metrics";

// Always read fresh on each request (turns off static caching for this route)
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
