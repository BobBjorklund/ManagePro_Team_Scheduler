export type MetricMode = "higher" | "lower" | "band";

export type MetricConfig = {
  key: string;
  label: string;
  mode: MetricMode;
  low: number;
  high: number;
  weight: number;
  inheritsColorFrom?: string | null;
};

export type AgentRow = {
  agent: string;
  overall: number; // 0..1
  raw: Record<string, number>; // metric -> raw value
  scores: Record<string, number>; // metric -> 0..1
};

export type Supervisor = {
  supervisor: string;
  overall: number; // 0..1 (already weighted)
  scores: Record<string, number>;
  raw: Record<string, number>;
  agents: AgentRow[];
};

export type SupervisorsPayload = {
  generatedAt: string;
  metrics: MetricConfig[];
  supervisors: Supervisor[];
};
