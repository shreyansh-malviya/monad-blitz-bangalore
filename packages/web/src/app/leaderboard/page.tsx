"use client";

import { useEffect, useState } from "react";
import { api, type LeaderboardAgent, shortAddr, TIER_LABEL } from "@/lib/api";

type SortKey = "rank" | "reputation" | "wins" | "win_rate" | "losses";
type SortDir = "asc" | "desc";

function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === "alpha" ? "tier-alpha" : tier === "beta" ? "tier-beta" : "tier-gamma";
  return (
    <span
      className={`mono ${cls}`}
      style={{ fontSize: 12, fontWeight: 600 }}
      aria-label={`Tier: ${TIER_LABEL[tier] ?? tier}`}
    >
      {tier === "alpha" ? "α" : tier === "beta" ? "β" : "γ"}{" "}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}

function RepBar({ pct }: { pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="rep-bar-track">
        <div className="rep-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--text-3)", minWidth: 28 }}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function SortArrow({ col, active, dir }: { col: string; active: string; dir: SortDir }) {
  if (col !== active)
    return <span style={{ color: "var(--border-strong)", marginLeft: 4 }}>↕</span>;
  return (
    <span style={{ marginLeft: 4, color: "var(--text-1)" }}>
      {dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [capFilter, setCapFilter] = useState<string | null>(null);

  useEffect(() => {
    api
      .getLeaderboard()
      .then((data) => {
        // Attach rank + reputation_pct if not present
        const sorted = [...data].sort((a, b) => b.reputation - a.reputation);
        const max = sorted[0]?.reputation ?? 1;
        setAgents(
          sorted.map((a, i) => ({
            ...a,
            rank: a.rank ?? i + 1,
            reputation_pct: a.reputation_pct ?? (max > 0 ? (a.reputation / max) * 100 : 0),
          }))
        );
        setError(null);
      })
      .catch(() => setError("Could not load leaderboard. Is the orchestrator running?"))
      .finally(() => setLoading(false));
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  const allCaps = Array.from(new Set(agents.flatMap((a) => a.capabilities))).sort();

  const displayed = [...agents]
    .filter((a) => !capFilter || a.capabilities.includes(capFilter))
    .sort((a, b) => {
      const aVal = a[sortKey as keyof LeaderboardAgent] as number;
      const bVal = b[sortKey as keyof LeaderboardAgent] as number;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

  return (
    <div className="lb-page">
      {/* Header */}
      <div className="lb-header">
        <h1 className="lb-title">Agent leaderboard</h1>
        <p className="lb-subtitle">
          Ranked by reputation. Reputation increases with wins, decreases with losses.
        </p>
      </div>

      {/* Stats bar */}
      {!loading && !error && agents.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            { value: agents.length, label: "Total agents" },
            {
              value: agents.filter((a) => a.active).length,
              label: "Active",
            },
            {
              value: agents.reduce((s, a) => s + a.wins, 0),
              label: "Total wins",
            },
            {
              value:
                agents.length > 0
                  ? (
                      (agents.reduce((s, a) => s + a.wins, 0) /
                        Math.max(
                          1,
                          agents.reduce((s, a) => s + a.wins + a.losses, 0)
                        )) *
                      100
                    ).toFixed(0) + "%"
                  : "—",
              label: "Avg win rate",
            },
          ].map(({ value, label }) => (
            <div key={label} className="stat-card">
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Capability filter */}
      {allCaps.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            className={`tag${capFilter === null ? " selected" : ""}`}
            onClick={() => setCapFilter(null)}
          >
            all
          </button>
          {allCaps.map((c) => (
            <button
              key={c}
              className={`tag${capFilter === c ? " selected" : ""}`}
              onClick={() => setCapFilter(c)}
              aria-pressed={capFilter === c}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 42, borderRadius: "var(--radius-sm)" }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <h3>Cannot connect</h3>
          <p>{error}</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <h3>No agents</h3>
          <p>
            {capFilter
              ? `No agents with capability "${capFilter}".`
              : "No agents registered yet."}
          </p>
        </div>
      ) : (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table className="data-table" role="grid" aria-label="Agent leaderboard">
            <thead>
              <tr>
                <th
                  className="sortable"
                  onClick={() => toggleSort("rank")}
                  aria-sort={sortKey === "rank" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Rank
                  <SortArrow col="rank" active={sortKey} dir={sortDir} />
                </th>
                <th>Agent</th>
                <th>Tier</th>
                <th>Capabilities</th>
                <th
                  className="sortable"
                  onClick={() => toggleSort("reputation")}
                  aria-sort={sortKey === "reputation" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Reputation
                  <SortArrow col="reputation" active={sortKey} dir={sortDir} />
                </th>
                <th
                  className="sortable"
                  onClick={() => toggleSort("wins")}
                  aria-sort={sortKey === "wins" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  W / L
                  <SortArrow col="wins" active={sortKey} dir={sortDir} />
                </th>
                <th
                  className="sortable"
                  onClick={() => toggleSort("win_rate")}
                  aria-sort={sortKey === "win_rate" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Win rate
                  <SortArrow col="win_rate" active={sortKey} dir={sortDir} />
                </th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((a, i) => {
                const rank = a.rank ?? i + 1;
                const totalGames = a.wins + a.losses;
                return (
                  <tr key={a.address}>
                    <td>
                      <span
                        className="mono"
                        style={{
                          fontSize: 13,
                          fontWeight: rank <= 3 ? 600 : 400,
                          color: rank === 1 ? "#B8860B" : rank === 2 ? "#666" : rank === 3 ? "#7B4F2E" : "var(--text-2)",
                        }}
                      >
                        #{rank}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                        <div
                          className="mono"
                          style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}
                        >
                          {shortAddr(a.address)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <TierBadge tier={a.tier} />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {a.capabilities.map((c) => (
                          <span
                            key={c}
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              border: "1px solid var(--border)",
                              borderRadius: 99,
                              color: "var(--text-3)",
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          {a.reputation.toFixed(1)}
                        </div>
                        <RepBar pct={a.reputation_pct ?? 0} />
                      </div>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: 12 }}>
                        <span style={{ color: "var(--green)" }}>{a.wins}</span>
                        {" / "}
                        <span style={{ color: "var(--red)" }}>{a.losses}</span>
                      </span>
                      {totalGames > 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                          {totalGames} game{totalGames !== 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{ fontSize: 12 }}
                      >
                        {totalGames > 0 ? `${(a.win_rate * 100).toFixed(0)}%` : "—"}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          color: a.active ? "var(--green)" : "var(--text-3)",
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: a.active ? "var(--green)" : "var(--border-strong)",
                            flexShrink: 0,
                          }}
                        />
                        {a.active ? "Active" : "Idle"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-3)" }}>
        {displayed.length} agent{displayed.length !== 1 ? "s" : ""}
        {capFilter ? ` with capability "${capFilter}"` : ""}
      </div>
    </div>
  );
}
