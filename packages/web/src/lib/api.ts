const BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ||
  "http://localhost:8000";

export interface QueryResponse {
  id: string;
  agent_address: string;
  response_text: string;
  reasoning: string;
  confidence: number;
  response_hash: string;
  score: number | null;
  score_reasoning: string | null;
  round: number;
  submitted_at: string;
}

export interface Query {
  id: string;
  chain_query_id: number | null;
  status: string;
  bounty: string;
  requester: string;
  deadline: string;
  capabilities: string[];
  problem: string;
  round: number;
  winner_address: string | null;
  tx_hash: string | null;
  memory_hash: string | null;
  created_at: string;
  updated_at?: string;
  response_count?: number;
  responses?: QueryResponse[];
  memory?: Record<string, unknown>;
  explorer_url?: string | null;
}

export interface Agent {
  address: string;
  name: string;
  tier: string;
  reputation: number;
  capabilities: string[];
  active: boolean;
  wins: number;
  losses: number;
  win_rate: number;
  stake?: string;
  rank?: number;
  reputation_pct?: number;
}

export interface LeaderboardAgent extends Agent {
  rank: number;
  reputation_pct: number;
}

async function fetchAPI<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Queries
  getQueries: (params?: { status?: string; limit?: number; capability?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "all") qs.set("status", params.status.toUpperCase());
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.capability) qs.set("capability", params.capability);
    const q = qs.toString();
    return fetchAPI<Query[]>(`/api/queries/${q ? "?" + q : ""}`);
  },

  getQuery: (id: string) =>
    fetchAPI<Query>(`/api/queries/${id}`),

  createQuery: (params: {
    problem: string;
    capabilities: string[];
    bounty?: string;
    deadline_minutes?: number;
    requester?: string;
  }) =>
    fetchAPI<{ id: string; status: string; message: string }>("/api/queries/", {
      method: "POST",
      body: JSON.stringify({
        problem: params.problem,
        capabilities: params.capabilities,
        bounty: params.bounty ?? "0",
        deadline_minutes: params.deadline_minutes ?? 10,
        requester: params.requester ?? "0x0000000000000000000000000000000000000000",
      }),
    }),

  // Agents
  getAgents: () => fetchAPI<Agent[]>("/api/agents/"),

  getLeaderboard: () => fetchAPI<LeaderboardAgent[]>("/api/agents/leaderboard"),

  getAgent: (address: string) => fetchAPI<Agent>(`/api/agents/${address}`),
};

// Helpers
export function shortAddr(addr: string, chars = 4): string {
  if (!addr || addr.length < 10) return addr ?? "—";
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

export function shortId(id: string, chars = 8): string {
  return `#${id.replace(/-/g, "").slice(0, chars)}`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-3)";
  if (score >= 0.75) return "var(--green)";
  if (score >= 0.5) return "var(--amber)";
  return "var(--red)";
}

export const CAPABILITIES = [
  "general", "analysis", "code", "math",
  "research", "writing", "blockchain", "nlp",
];

export const TIER_LABEL: Record<string, string> = {
  alpha: "α Alpha",
  beta: "β Beta",
  gamma: "γ Gamma",
};
