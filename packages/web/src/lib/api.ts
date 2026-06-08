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

export { fetchAPI };

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

  // Proposals
  getProposals: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "all") qs.set("status", params.status.toUpperCase());
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return fetchAPI<Proposal[]>(`/api/proposals/${q ? "?" + q : ""}`);
  },

  getProposal: (id: string) => fetchAPI<Proposal>(`/api/proposals/${id}`),

  createProposal: (params: {
    title: string;
    description: string;
    max_roles?: number;
    bounty?: string;
    requester?: string;
    lock_time?: number;
    proposal_time?: number;
    evaluation_time?: number;
  }) =>
    fetchAPI<{ id: string; status: string; message: string }>("/api/proposals/", {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        max_roles: params.max_roles ?? 4,
        bounty: params.bounty ?? "0",
        requester: params.requester ?? "0x0000000000000000000000000000000000000000",
        lock_time: params.lock_time ?? 60,
        proposal_time: params.proposal_time ?? 30,
        evaluation_time: params.evaluation_time ?? 300,
      }),
    }),

  getProposalReport: (id: string) =>
    fetchAPI<{ report: string; report_ipfs_hash: string; ipfs_url: string | null }>(
      `/api/proposals/${id}/report`
    ),

  // Freelance
  getFreelanceTasks: (params?: { status?: string; task_type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== "all") qs.set("status", params.status.toUpperCase());
    if (params?.task_type) qs.set("task_type", params.task_type);
    if (params?.limit) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return fetchAPI<FreelanceTask[]>(`/api/freelance/${q ? "?" + q : ""}`);
  },

  getFreelanceTask: (id: string) =>
    fetchAPI<FreelanceTask>(`/api/freelance/${id}`),

  createFreelanceTask: (params: {
    title: string;
    description: string;
    task_type?: string;
    skills_required?: string[];
    budget?: string;
    requester?: string;
    deadline_minutes?: number;
  }) =>
    fetchAPI<{ id: string; status: string; message: string }>("/api/freelance/", {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        task_type: params.task_type ?? "general",
        skills_required: params.skills_required ?? [],
        budget: params.budget ?? "0",
        requester: params.requester ?? "0x0000000000000000000000000000000000000000",
        deadline_minutes: params.deadline_minutes ?? 30,
      }),
    }),

  getFreelanceReport: (id: string) =>
    fetchAPI<{
      task_id: string;
      deliverable: string;
      deliverable_hash: string;
      ipfs_hash: string | null;
      ipfs_url: string | null;
      review_score: number | null;
      review_notes: string | null;
      status: string;
    }>(`/api/freelance/${id}/report`),
};

// ── Explorer links ────────────────────────────────────────────────────────────
const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadexplorer.com";

export function explorerTx(hash: string | null | undefined): string | null {
  if (!hash || /^0x0+$/.test(hash)) return null;
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export function explorerAddr(address: string | null | undefined): string | null {
  if (!address || address === "0x0000000000000000000000000000000000000000") return null;
  return `${EXPLORER_BASE}/address/${address}`;
}

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

// ── Proposal types ────────────────────────────────────────────────────────────

export interface ProposalRole {
  id: string;
  role_name: string;
  role_description: string;
  agent_address: string | null;
  agent_name: string | null;
  assigned_at: string | null;
}

export interface ProposalBid {
  id: string;
  agent_address: string;
  agent_name: string;
  role_name: string;
  fit_score: number;
  reasoning: string;
  created_at: string;
}

export interface DiscussionMessage {
  id: string;
  agent_address: string;
  agent_name: string;
  role_name: string;
  round_num: number;
  round_type: string;
  content: string;
  created_at: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  domain: string | null;
  status: string;
  bounty: string;
  requester: string;
  max_roles: number;
  lock_time: number;
  proposal_time: number;
  evaluation_time: number;
  chain_proposal_id: number | null;
  roles_decided: Array<{ name: string; description: string }>;
  final_report: string | null;
  report_ipfs_hash: string | null;
  report_hash: string | null;
  tx_hash: string | null;
  created_at: string;
  updated_at: string;
  roles: ProposalRole[];
  bids: ProposalBid[];
  messages: DiscussionMessage[];
}


// ── Freelance types ───────────────────────────────────────────────────────────

export interface FreelanceBid {
  id: string;
  agent_address: string;
  agent_name: string;
  proposed_role: string;
  proposed_subtask: string;
  fit_score: number;
  reasoning: string;
  accepted: boolean;
  created_at: string;
}

export interface FreelanceArtifact {
  id: string;
  agent_address: string;
  agent_name: string;
  role: string;
  subtask_description: string;
  content: string;
  content_type: string;
  ipfs_hash: string | null;
  quality_score: number | null;
  submitted_at: string;
}

export interface FreelanceTask {
  id: string;
  title: string;
  description: string;
  task_type: string;
  skills_required: string[];
  budget: string;
  requester: string;
  status: string;
  chain_task_id: number | null;
  team: Array<{ address: string; role: string; weight: number }>;
  deliverable: string | null;
  deliverable_ipfs_hash: string | null;
  deliverable_hash: string | null;
  review_score: number | null;
  review_notes: string | null;
  tx_hash: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  bid_count: number;
  artifact_count: number;
  bids?: FreelanceBid[];
  artifacts?: FreelanceArtifact[];
}

export const FREELANCE_STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  TEAM_DISCOVERY: "Finding team",
  TEAM_FORMED: "Team formed",
  IN_PROGRESS: "In progress",
  ASSEMBLING: "Assembling",
  REVIEW: "Review",
  SETTLED: "Settled",
  FAILED: "Failed",
  DISPUTED: "Disputed",
};

export const FREELANCE_STATUS_DOT: Record<string, string> = {
  CREATED: "#6b7280",
  TEAM_DISCOVERY: "#836EF9",
  TEAM_FORMED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  ASSEMBLING: "#8b5cf6",
  REVIEW: "#06b6d4",
  SETTLED: "var(--green)",
  FAILED: "var(--red)",
  DISPUTED: "#ef4444",
};

export const TASK_TYPE_LABEL: Record<string, string> = {
  code: "Code",
  document: "Document",
  research: "Research",
  design: "Design",
  analysis: "Analysis",
  general: "General",
};

export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  ROLE_DISCOVERY: "Discovering roles",
  BIDDING: "Bidding",
  TEAM_FORMED: "Team formed",
  DISCUSSING: "Discussing",
  SYNTHESIZING: "Synthesizing",
  SETTLED: "Settled",
  FAILED: "Failed",
};

export const PROPOSAL_STATUS_DOT: Record<string, string> = {
  CREATED: "#6b7280",
  ROLE_DISCOVERY: "#836EF9",
  BIDDING: "#f59e0b",
  TEAM_FORMED: "#3b82f6",
  DISCUSSING: "#8b5cf6",
  SYNTHESIZING: "#10b981",
  SETTLED: "var(--green)",
  FAILED: "var(--red)",
};
