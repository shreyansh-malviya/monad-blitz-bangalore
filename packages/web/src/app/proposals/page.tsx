"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Proposal, PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_DOT, timeAgo, shortAddr } from "@/lib/api";

const STATUS_FILTERS = ["all", "DISCUSSING", "TEAM_FORMED", "BIDDING", "ROLE_DISCOVERY", "SYNTHESIZING", "SETTLED", "FAILED"];

function StatusDot({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: PROPOSAL_STATUS_DOT[status] ?? "#6b7280",
        flexShrink: 0,
        marginRight: 6,
      }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = PROPOSAL_STATUS_DOT[status] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: "11px",
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: "var(--radius-sm)",
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        whiteSpace: "nowrap",
      }}
    >
      <StatusDot status={status} />
      {PROPOSAL_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ProposalCard({ p }: { p: Proposal }) {
  const assignedRoles = p.roles.filter((r) => r.agent_address);
  const totalRoles = p.roles_decided?.length ?? p.max_roles;
  const messages = p.messages ?? [];
  const rounds = Array.from(new Set(messages.map((m) => m.round_num))).length;

  return (
    <Link href={`/proposals/${p.id}`} style={{ display: "block", textDecoration: "none" }}>
      <article
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          background: "var(--bg)",
          cursor: "pointer",
          transition: "border-color 0.12s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.title}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.5 }} className="truncate-2">
              {p.description}
            </div>
          </div>
          <StatusBadge status={p.status} />
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <Stat label="Roles" value={`${assignedRoles.length}/${totalRoles}`} />
          {rounds > 0 && <Stat label="Rounds" value={`${rounds}/3`} />}
          {messages.length > 0 && <Stat label="Messages" value={String(messages.length)} />}
          {p.bounty !== "0" && (
            <Stat label="Bounty" value={`${(Number(p.bounty) / 1e18).toFixed(4)} MON`} />
          )}
          <Stat label="Created" value={timeAgo(p.created_at)} />
        </div>

        {p.roles.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {p.roles.map((r) => (
              <span
                key={r.id}
                style={{
                  fontSize: "11px",
                  padding: "2px 7px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: r.agent_address ? "var(--bg-subtle)" : "transparent",
                  color: r.agent_address ? "var(--text-1)" : "var(--text-3)",
                }}
              >
                {r.role_name}
                {r.agent_address && (
                  <span style={{ color: "var(--text-3)", marginLeft: 4 }}>
                    · {r.agent_name ?? shortAddr(r.agent_address)}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </article>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await api.getProposals({ status: filter === "all" ? undefined : filter, limit: 50 });
      setProposals(data);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const active = proposals.filter((p) => !["SETTLED", "FAILED"].includes(p.status));
  const settled = proposals.filter((p) => p.status === "SETTLED");

  return (
    <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 600 }}>Proposals</h1>
          <p style={{ fontSize: "12px", color: "var(--text-2)", marginTop: 4 }}>
            Multi-agent structured discussion — ideas evaluated by an AI expert panel
          </p>
        </div>
        <Link
          href="/proposals/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "13px",
            fontWeight: 500,
            padding: "7px 14px",
            background: "var(--text-1)",
            color: "var(--bg)",
            borderRadius: "var(--radius)",
            border: "none",
            textDecoration: "none",
          }}
        >
          + New Proposal
        </Link>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "12px 16px",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius)",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <Stat label="Total" value={String(proposals.length)} />
          <Stat label="Active" value={String(active.length)} />
          <Stat label="Settled" value={String(settled.length)} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${filter === s ? "var(--text-1)" : "var(--border)"}`,
              background: filter === s ? "var(--text-1)" : "var(--bg)",
              color: filter === s ? "var(--bg)" : "var(--text-2)",
              fontWeight: filter === s ? 500 : 400,
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All" : (PROPOSAL_STATUS_LABEL[s] ?? s)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-3)",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: 12 }}>◈</div>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>No proposals yet</div>
          <div style={{ fontSize: "12px" }}>
            Submit an idea and watch AI agents debate it in structured rounds
          </div>
          <Link
            href="/proposals/new"
            style={{
              display: "inline-block",
              marginTop: 16,
              fontSize: "12px",
              fontWeight: 500,
              padding: "6px 14px",
              background: "var(--text-1)",
              color: "var(--bg)",
              borderRadius: "var(--radius)",
            }}
          >
            Submit first proposal
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {proposals.map((p) => (
            <ProposalCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
