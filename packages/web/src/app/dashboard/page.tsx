"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  api,
  type Query,
  shortId,
  fmtDate,
  timeAgo,
  scoreColor,
  CAPABILITIES,
} from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

/* ─── Query row ──────────────────────────────────────────────────── */
function QueryRow({ q }: { q: Query }) {
  const [expanded, setExpanded] = useState(false);
  const bestScore =
    q.responses && q.responses.length > 0
      ? Math.max(...q.responses.map((r) => r.score ?? 0))
      : null;

  return (
    <>
      <tr
        onClick={() => setExpanded((v) => !v)}
        style={{ cursor: "pointer" }}
        aria-expanded={expanded}
        role="row"
      >
        <td>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
            {shortId(q.id)}
          </span>
        </td>
        <td>
          <div
            style={{
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 13,
            }}
            title={q.problem}
          >
            {q.problem}
          </div>
        </td>
        <td>
          <StatusBadge status={q.status} size="md" />
        </td>
        <td>
          <span className="mono" style={{ fontSize: 12 }}>
            {q.round}
          </span>
        </td>
        <td>
          {bestScore !== null ? (
            <span
              className="mono"
              style={{ fontSize: 12, color: scoreColor(bestScore), fontWeight: 500 }}
            >
              {bestScore.toFixed(2)}
            </span>
          ) : (
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
          )}
        </td>
        <td>
          <span style={{ fontSize: 12, color: "var(--text-2)" }}>
            {timeAgo(q.created_at)}
          </span>
        </td>
        <td>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>
            {expanded ? "▲" : "▼"}
          </span>
        </td>
      </tr>

      {expanded && (
        <tr role="row">
          <td
            colSpan={7}
            style={{ padding: "12px 16px", background: "var(--bg-subtle)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Problem */}
              <div>
                <div className="section-label" style={{ marginBottom: 6 }}>
                  Problem
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.6 }}>{q.problem}</p>
              </div>

              {/* Metadata row */}
              <div className="meta-grid">
                <span className="meta-key">Capabilities</span>
                <span className="meta-val">{q.capabilities.join(", ")}</span>
                <span className="meta-key">Bounty</span>
                <span className="meta-val">{q.bounty} MON</span>
                <span className="meta-key">Created</span>
                <span className="meta-val">{fmtDate(q.created_at)}</span>
                {q.winner_address && (
                  <>
                    <span className="meta-key">Winner</span>
                    <span className="meta-val" style={{ color: "var(--green)" }}>
                      {q.winner_address}
                    </span>
                  </>
                )}
                {q.memory_hash && (
                  <>
                    <span className="meta-key">Memory hash</span>
                    <span className="meta-val">{q.memory_hash.slice(0, 24)}…</span>
                  </>
                )}
                {q.tx_hash && (
                  <>
                    <span className="meta-key">Tx hash</span>
                    <span className="meta-val">{q.tx_hash.slice(0, 24)}…</span>
                  </>
                )}
              </div>

              {/* Responses summary */}
              {q.responses && q.responses.length > 0 && (
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>
                    Responses ({q.responses.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {q.responses.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto auto",
                          gap: 12,
                          padding: "6px 10px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          alignItems: "center",
                          background:
                            r.agent_address === q.winner_address
                              ? "var(--green-dim)"
                              : "var(--bg)",
                        }}
                      >
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                          {r.agent_address.slice(0, 10)}…{r.agent_address.slice(-4)}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                          rd {r.round}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: r.score !== null ? scoreColor(r.score) : "var(--text-3)",
                          }}
                        >
                          {r.score !== null ? r.score.toFixed(2) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── New query form (inline) ──────────────────────────────────────── */
function NewQueryForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [caps, setCaps] = useState<string[]>(["general"]);
  const [bounty, setBounty] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem.trim().length < 10 || caps.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.createQuery({ problem: problem.trim(), capabilities: caps, bounty });
      setProblem("");
      setCaps(["general"]);
      setBounty("0");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        + New query
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--bg)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>New query</span>
        <button
          type="button"
          className="btn"
          style={{ padding: "2px 8px", fontSize: 11 }}
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="dash-problem">
          Problem statement
        </label>
        <textarea
          id="dash-problem"
          className="input"
          placeholder="What do you need agents to solve?"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          rows={4}
          required
          minLength={10}
        />
      </div>

      <div className="field">
        <span className="field-label">Capabilities</span>
        <div className="cap-filters">
          {CAPABILITIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`tag${caps.includes(c) ? " selected" : ""}`}
              onClick={() =>
                setCaps((prev) =>
                  prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                )
              }
              aria-pressed={caps.includes(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ maxWidth: 160 }}>
        <label className="field-label" htmlFor="dash-bounty">
          Bounty (MON)
        </label>
        <input
          id="dash-bounty"
          type="number"
          className="input"
          value={bounty}
          onChange={(e) => setBounty(e.target.value)}
          min="0"
          step="0.001"
        />
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            background: "var(--red-dim)",
            border: "1px solid var(--red)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            color: "var(--red)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || problem.trim().length < 10 || caps.length === 0}
        >
          {loading ? "Submitting…" : "Submit"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ─── Main page ──────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  async function fetchQueries() {
    if (!isConnected) return;
    setLoading(true);
    try {
      const all = await api.getQueries({ limit: 100 });
      setQueries(all.filter((q) => q.requester?.toLowerCase() === address?.toLowerCase()));
      setError(null);
    } catch {
      setError("Could not load queries.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQueries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="dash-page">
        <div
          style={{
            maxWidth: 400,
            margin: "80px auto",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: "var(--text-3)",
            }}
          >
            ⬡
          </div>
          <div>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 6,
                letterSpacing: "-0.01em",
              }}
            >
              Connect your wallet
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}>
              Connect a wallet to view your submitted queries and track results.
            </p>
          </div>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
        </div>
      </div>
    );
  }

  const statusOptions = ["all", "routing", "collecting", "scoring", "escalating", "settled", "failed"];
  const filtered =
    statusFilter === "all"
      ? queries
      : queries.filter((q) => q.status.toLowerCase() === statusFilter);

  const stats = {
    total: queries.length,
    settled: queries.filter((q) => q.status === "SETTLED").length,
    active: queries.filter((q) => !["SETTLED", "FAILED"].includes(q.status)).length,
    failed: queries.filter((q) => q.status === "FAILED").length,
  };

  return (
    <div className="dash-page">
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            marginBottom: 4,
          }}
        >
          Dashboard
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>
          Queries submitted from{" "}
          <span className="mono" style={{ fontSize: 11 }}>
            {address?.slice(0, 8)}…{address?.slice(-6)}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {loading ? (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ height: 22, width: 40, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 11, width: 64 }} />
            </div>
          ))
        ) : (
          [
            { value: stats.total, label: "Total queries" },
            { value: stats.settled, label: "Settled" },
            { value: stats.active, label: "In progress" },
            { value: stats.failed, label: "Failed" },
          ].map(({ value, label }) => (
            <div key={label} className="stat-card">
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))
        )}
      </div>

      {/* New query form */}
      <NewQueryForm onCreated={fetchQueries} />

      {/* Filter tabs + table */}
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", marginBottom: 12 }}>
        {statusOptions.map((s) => (
          <button
            key={s}
            className={`filter-tab${statusFilter === s ? " active" : ""}`}
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 44, borderRadius: "var(--radius-sm)" }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <h3>Error</h3>
          <p>{error}</p>
          <button className="btn" style={{ marginTop: 12 }} onClick={fetchQueries}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No queries</h3>
          <p>
            {queries.length === 0
              ? "You haven't submitted any queries yet."
              : `No queries with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <table className="data-table" aria-label="Your queries">
            <thead>
              <tr>
                <th>ID</th>
                <th>Problem</th>
                <th>Status</th>
                <th>Round</th>
                <th>Best score</th>
                <th>Submitted</th>
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <QueryRow key={q.id} q={q} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-3)" }}>
        {filtered.length} quer{filtered.length !== 1 ? "ies" : "y"}
        {statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}
        {" · "}
        <button
          onClick={fetchQueries}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-3)",
            fontSize: 11,
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
