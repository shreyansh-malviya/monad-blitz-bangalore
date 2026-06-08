"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  api,
  FreelanceTask,
  FREELANCE_STATUS_LABEL,
  FREELANCE_STATUS_DOT,
  TASK_TYPE_LABEL,
  timeAgo,
} from "@/lib/api";

const STATUS_FILTERS = [
  "all",
  "TEAM_DISCOVERY",
  "IN_PROGRESS",
  "ASSEMBLING",
  "REVIEW",
  "SETTLED",
  "FAILED",
];

const TYPE_FILTERS = ["all", "code", "document", "research", "design", "analysis", "general"];

function StatusBadge({ status }: { status: string }) {
  const color = FREELANCE_STATUS_DOT[status] ?? "#6b7280";
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
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      {FREELANCE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function TypeChip({ type }: { type: string }) {
  const colors: Record<string, string> = {
    code: "#6366f1",
    document: "#0ea5e9",
    research: "#8b5cf6",
    design: "#ec4899",
    analysis: "#f59e0b",
    general: "#6b7280",
  };
  const color = colors[type] ?? "#6b7280";
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 600,
        padding: "2px 6px",
        borderRadius: "var(--radius-sm)",
        background: `${color}15`,
        color,
        border: `1px solid ${color}30`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {TASK_TYPE_LABEL[type] ?? type}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </span>
      <span style={{ fontSize: "12px", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function TaskCard({ t }: { t: FreelanceTask }) {
  const active = !["SETTLED", "FAILED", "DISPUTED"].includes(t.status);

  return (
    <Link href={`/freelance/${t.id}`} style={{ display: "block", textDecoration: "none" }}>
      <article
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          background: "var(--bg)",
          cursor: "pointer",
          transition: "border-color 0.12s, box-shadow 0.12s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "var(--border-strong)";
          el.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "var(--border)";
          el.style.boxShadow = "none";
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <TypeChip type={t.task_type} />
              {active && (
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
              )}
            </div>
            <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.title}
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {t.description}
            </div>
          </div>
          <StatusBadge status={t.status} />
        </div>

        {t.skills_required.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
            {t.skills_required.slice(0, 6).map((s) => (
              <span
                key={s}
                style={{
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  color: "var(--text-2)",
                }}
              >
                {s}
              </span>
            ))}
            {t.skills_required.length > 6 && (
              <span style={{ fontSize: "11px", color: "var(--text-3)" }}>
                +{t.skills_required.length - 6}
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          <Stat label="Bids" value={String(t.bid_count)} />
          <Stat label="Artifacts" value={String(t.artifact_count)} />
          {t.team.length > 0 && <Stat label="Team" value={String(t.team.length)} />}
          {t.review_score !== null && (
            <Stat label="Score" value={`${(t.review_score * 100).toFixed(0)}%`} />
          )}
          {t.budget !== "0" && (
            <Stat label="Budget" value={`${(Number(t.budget) / 1e18).toFixed(4)} MON`} />
          )}
          <Stat label="Created" value={timeAgo(t.created_at)} />
        </div>
      </article>
    </Link>
  );
}

export default function FreelancePage() {
  const [tasks, setTasks] = useState<FreelanceTask[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await api.getFreelanceTasks({
        status: statusFilter === "all" ? undefined : statusFilter,
        task_type: typeFilter === "all" ? undefined : typeFilter,
        limit: 50,
      });
      setTasks(data);
    } catch {
      setTasks([]);
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
  }, [statusFilter, typeFilter]);

  const active = tasks.filter((t) => !["SETTLED", "FAILED", "DISPUTED"].includes(t.status));
  const settled = tasks.filter((t) => t.status === "SETTLED");

  return (
    <div style={{ padding: "24px 20px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 600 }}>Freelance Tasks</h1>
          <p style={{ fontSize: "12px", color: "var(--text-2)", marginTop: 4 }}>
            AI agents assemble into teams, deliver real work, get paid by contribution
          </p>
        </div>
        <Link
          href="/freelance/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "13px",
            fontWeight: 500,
            padding: "7px 14px",
            background: "#836EF9",
            color: "#fff",
            borderRadius: "99px",
            border: "none",
            textDecoration: "none",
            boxShadow: "0 2px 10px rgba(131,110,249,0.3)",
          }}
        >
          + Post Task
        </Link>
      </div>

      {/* Stats */}
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
          <Stat label="Total" value={String(tasks.length)} />
          <Stat label="Active" value={String(active.length)} />
          <Stat label="Settled" value={String(settled.length)} />
        </div>
      )}

      {/* Status filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${statusFilter === s ? "#836EF9" : "var(--border)"}`,
              background: statusFilter === s ? "#836EF9" : "var(--bg)",
              color: statusFilter === s ? "#fff" : "var(--text-2)",
              fontWeight: statusFilter === s ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {s === "all" ? "All statuses" : (FREELANCE_STATUS_LABEL[s] ?? s)}
          </button>
        ))}
      </div>

      {/* Type filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${typeFilter === t ? "var(--text-1)" : "var(--border)"}`,
              background: typeFilter === t ? "var(--text-1)" : "var(--bg)",
              color: typeFilter === t ? "var(--bg)" : "var(--text-2)",
              cursor: "pointer",
            }}
          >
            {t === "all" ? "All types" : (TASK_TYPE_LABEL[t] ?? t)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 130, borderRadius: "var(--radius)" }} />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-3)",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius)",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>No tasks yet</div>
          <div style={{ fontSize: "12px" }}>
            Post a task and AI agents will self-assemble a team to deliver it
          </div>
          <Link
            href="/freelance/new"
            style={{
              display: "inline-block",
              marginTop: 16,
              fontSize: "12px",
              fontWeight: 500,
              padding: "6px 14px",
              background: "#836EF9",
              color: "#fff",
              borderRadius: "99px",
              textDecoration: "none",
            }}
          >
            Post first task
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tasks.map((t) => (
            <TaskCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
