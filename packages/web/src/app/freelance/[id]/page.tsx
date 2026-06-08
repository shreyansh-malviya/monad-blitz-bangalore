"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  api,
  FreelanceTask,
  FreelanceBid,
  FreelanceArtifact,
  FREELANCE_STATUS_LABEL,
  FREELANCE_STATUS_DOT,
  TASK_TYPE_LABEL,
  timeAgo,
  fmtDate,
  shortAddr,
  scoreColor,
} from "@/lib/api";

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const color = FREELANCE_STATUS_DOT[status] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: "12px",
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: "var(--radius-sm)",
        background: `${color}18`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block" }} />
      {FREELANCE_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <h2 style={{ fontSize: "13px", fontWeight: 600 }}>{title}</h2>
      {count !== undefined && (
        <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "99px", background: "var(--bg-subtle)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
          {count}
        </span>
      )}
    </div>
  );
}

function BidRow({ bid }: { bid: FreelanceBid }) {
  const scoreC = bid.fit_score >= 0.7 ? "var(--green)" : bid.fit_score >= 0.4 ? "var(--amber)" : "var(--red)";
  return (
    <div
      style={{
        padding: "12px 14px",
        border: `1px solid ${bid.accepted ? "#836EF940" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        background: bid.accepted ? "#836EF908" : "var(--bg)",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>{bid.proposed_role}</span>
            {bid.accepted && (
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 6px", borderRadius: "99px", background: "#836EF920", color: "#836EF9", border: "1px solid #836EF940" }}>
                ✓ Selected
              </span>
            )}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-2)", marginBottom: 6 }}>
            {shortAddr(bid.agent_address)} · {bid.agent_name || "Unknown Agent"} · {timeAgo(bid.created_at)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.5 }}>{bid.proposed_subtask}</div>
          {bid.reasoning && (
            <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: 6, fontStyle: "italic" }}>
              {bid.reasoning}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: scoreC }}>
            {(bid.fit_score * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-3)" }}>fit</div>
        </div>
      </div>
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: FreelanceArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const preview = artifact.content.slice(0, 300);
  const hasMore = artifact.content.length > 300;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--bg)",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      <div
        style={{ padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}
        onClick={() => setExpanded((x) => !x)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: "13px" }}>{artifact.role}</span>
            <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", color: "var(--text-3)", border: "1px solid var(--border)", fontFamily: "var(--mono)" }}>
              {artifact.content_type}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-2)" }}>
            {shortAddr(artifact.agent_address)} · {artifact.agent_name || "Unknown"} · {timeAgo(artifact.submitted_at)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {artifact.quality_score !== null && (
            <span style={{ fontSize: "12px", fontWeight: 600, color: scoreColor(artifact.quality_score) }}>
              {(artifact.quality_score * 100).toFixed(0)}%
            </span>
          )}
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-subtle)",
          }}
        >
          <pre
            style={{
              fontSize: "12px",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: artifact.content_type === "code" ? "var(--mono)" : "inherit",
              margin: 0,
              color: "var(--text-1)",
            }}
          >
            {artifact.content}
          </pre>
          {artifact.ipfs_hash && (
            <div style={{ marginTop: 10, fontSize: "11px", color: "var(--text-3)" }}>
              IPFS: <span style={{ fontFamily: "var(--mono)" }}>{artifact.ipfs_hash}</span>
            </div>
          )}
        </div>
      )}
      {!expanded && hasMore && (
        <div style={{ padding: "0 14px 10px", fontSize: "11px", color: "var(--text-3)" }}>
          {preview}…
        </div>
      )}
    </div>
  );
}

function DeliverablePanel({ task }: { task: FreelanceTask }) {
  const [expanded, setExpanded] = useState(false);

  if (!task.deliverable) {
    return (
      <div
        style={{
          padding: "20px",
          border: "1px dashed var(--border)",
          borderRadius: "var(--radius)",
          textAlign: "center",
          color: "var(--text-3)",
          fontSize: "12px",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: 8 }}>📄</div>
        Deliverable not yet assembled
        {["IN_PROGRESS", "ASSEMBLING", "REVIEW"].includes(task.status) && (
          <div style={{ marginTop: 6 }}>Agents are working on it now…</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: task.review_score !== null && task.review_score >= 0.65 ? "#16a34a0a" : "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: "13px" }}>Assembled Deliverable</div>
          {task.review_score !== null && (
            <div style={{ fontSize: "11px", color: "var(--text-2)", marginTop: 2 }}>
              Review score:{" "}
              <span style={{ fontWeight: 600, color: scoreColor(task.review_score) }}>
                {(task.review_score * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {task.deliverable_ipfs_hash && (
            <a
              href={`https://ipfs.io/ipfs/${task.deliverable_ipfs_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: "11px", color: "#836EF9", textDecoration: "none" }}
            >
              IPFS ↗
            </a>
          )}
          <button
            onClick={() => setExpanded((x) => !x)}
            style={{
              fontSize: "11px",
              padding: "3px 9px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              cursor: "pointer",
              color: "var(--text-2)",
            }}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {task.review_notes && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: "12px", color: "var(--text-2)", fontStyle: "italic", background: "var(--bg)" }}>
          {task.review_notes}
        </div>
      )}
      {expanded && (
        <div style={{ padding: "16px", background: "var(--bg)" }}>
          <pre
            style={{
              fontSize: "12px",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              margin: 0,
              color: "var(--text-1)",
            }}
          >
            {task.deliverable}
          </pre>
        </div>
      )}
      {!expanded && (
        <div
          style={{ padding: "16px", background: "var(--bg)", cursor: "pointer", color: "var(--text-2)", fontSize: "12px" }}
          onClick={() => setExpanded(true)}
        >
          {task.deliverable.slice(0, 400)}
          {task.deliverable.length > 400 && "…"}
        </div>
      )}
    </div>
  );
}

// ── State machine phase timeline ──────────────────────────────────────────────

const PHASES = ["CREATED", "TEAM_DISCOVERY", "TEAM_FORMED", "IN_PROGRESS", "ASSEMBLING", "REVIEW", "SETTLED"];

function PhaseTimeline({ status }: { status: string }) {
  const currentIdx = PHASES.indexOf(status);
  const settled = status === "SETTLED";
  const failed = status === "FAILED" || status === "DISPUTED";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20, overflowX: "auto" }}>
      {PHASES.map((phase, i) => {
        const done = currentIdx > i || settled;
        const current = i === currentIdx && !failed;
        const label = FREELANCE_STATUS_LABEL[phase] ?? phase;

        return (
          <div key={phase} style={{ display: "flex", alignItems: "center", flex: i < PHASES.length - 1 ? "1 1 0" : "0 0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: failed ? "var(--border)" : done || current ? (settled ? "var(--green)" : "#836EF9") : "var(--border)",
                  border: current ? "3px solid #836EF960" : "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  color: done || current ? "#fff" : "var(--text-3)",
                  flexShrink: 0,
                  boxSizing: "border-box",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <div
                style={{
                  fontSize: "9px",
                  marginTop: 4,
                  color: current ? "var(--text-1)" : "var(--text-3)",
                  fontWeight: current ? 600 : 400,
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {label}
              </div>
            </div>
            {i < PHASES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? "#836EF9" : "var(--border)",
                  marginTop: -16,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FreelanceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [task, setTask] = useState<FreelanceTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await api.getFreelanceTask(id);
      setTask(data);
    } catch {
      setError("Task not found");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: "24px 20px", maxWidth: 1080, margin: "0 auto" }}>
        <div className="skeleton" style={{ height: 200, borderRadius: "var(--radius)", marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius)" }} />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-3)" }}>
        <div style={{ fontSize: "28px", marginBottom: 12 }}>◈</div>
        <div style={{ fontWeight: 500 }}>{error || "Task not found"}</div>
        <Link href="/freelance" style={{ display: "inline-block", marginTop: 16, fontSize: "12px", color: "#836EF9", textDecoration: "none" }}>
          ← Back to Freelance
        </Link>
      </div>
    );
  }

  const bids = task.bids ?? [];
  const artifacts = task.artifacts ?? [];
  const acceptedBids = bids.filter((b) => b.accepted);
  const isActive = !["SETTLED", "FAILED", "DISPUTED"].includes(task.status);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1080, margin: "0 auto" }}>
      {/* Back */}
      <Link href="/freelance" style={{ fontSize: "12px", color: "var(--text-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}>
        ← Freelance
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <h1 style={{ fontSize: "20px", fontWeight: 700, flex: 1 }}>{task.title}</h1>
          <StatusBadge status={task.status} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {TASK_TYPE_LABEL[task.task_type] ?? task.task_type}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-3)" }}>
            Created {timeAgo(task.created_at)}
          </span>
          {task.deadline && (
            <span style={{ fontSize: "12px", color: isActive ? "var(--amber)" : "var(--text-3)" }}>
              Deadline {fmtDate(task.deadline)}
            </span>
          )}
          {task.budget !== "0" && (
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-1)" }}>
              {(Number(task.budget) / 1e18).toFixed(4)} MON
            </span>
          )}
        </div>
      </div>

      {/* Phase timeline */}
      <PhaseTimeline status={task.status} />

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* Left column */}
        <div>
          {/* Description */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", marginBottom: 16, background: "var(--bg)" }}>
            <SectionHead title="Task Description" />
            <div style={{ fontSize: "13px", color: "var(--text-1)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {task.description}
            </div>
            {task.skills_required.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
                {task.skills_required.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "99px",
                      border: "1px solid var(--border)",
                      color: "var(--text-2)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Deliverable */}
          <div style={{ marginBottom: 16 }}>
            <SectionHead title="Deliverable" />
            <DeliverablePanel task={task} />
          </div>

          {/* Artifacts */}
          {artifacts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SectionHead title="Agent Artifacts" count={artifacts.length} />
              {artifacts.map((a) => (
                <ArtifactRow key={a.id} artifact={a} />
              ))}
            </div>
          )}

          {/* All bids */}
          {bids.length > 0 && (
            <div>
              <SectionHead title="Bids" count={bids.length} />
              {bids.map((b) => (
                <BidRow key={b.id} bid={b} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Stats card */}
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", background: "var(--bg)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <StatBox label="Status" value={FREELANCE_STATUS_LABEL[task.status] ?? task.status} />
              <StatBox label="Type" value={TASK_TYPE_LABEL[task.task_type] ?? task.task_type} />
              <StatBox label="Bids" value={String(task.bid_count)} />
              <StatBox label="Artifacts" value={String(task.artifact_count)} />
              {task.team.length > 0 && <StatBox label="Team size" value={String(task.team.length)} />}
              {task.review_score !== null && (
                <StatBox
                  label="Review score"
                  value={`${(task.review_score * 100).toFixed(0)}%`}
                  color={scoreColor(task.review_score)}
                />
              )}
            </div>
          </div>

          {/* Team */}
          {acceptedBids.length > 0 && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", background: "var(--bg)" }}>
              <SectionHead title="Assembled Team" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {acceptedBids.map((b) => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#836EF920",
                        border: "1px solid #836EF940",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#836EF9",
                        flexShrink: 0,
                      }}
                    >
                      {(b.agent_name || "?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.proposed_role}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-3)" }}>
                        {b.agent_name || shortAddr(b.agent_address)}
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--green)" }}>
                      {(b.fit_score * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* On-chain info */}
          {(task.tx_hash || task.deliverable_hash || task.deliverable_ipfs_hash) && (
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px", background: "var(--bg)" }}>
              <SectionHead title="On-chain" />
              {task.tx_hash && (
                <MonoLine label="Tx" value={task.tx_hash} truncate />
              )}
              {task.deliverable_hash && (
                <MonoLine label="Hash" value={task.deliverable_hash} truncate />
              )}
              {task.deliverable_ipfs_hash && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: "10px", color: "var(--text-3)", marginBottom: 2 }}>IPFS</div>
                  <a
                    href={`https://ipfs.io/ipfs/${task.deliverable_ipfs_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "#836EF9", textDecoration: "none", wordBreak: "break-all" }}
                  >
                    {task.deliverable_ipfs_hash}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Live indicator */}
          {isActive && (
            <div
              style={{
                padding: "10px 14px",
                border: "1px solid #836EF940",
                borderRadius: "var(--radius)",
                background: "#836EF908",
                fontSize: "12px",
                color: "#836EF9",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#836EF9", animation: "pulse 2s infinite", flexShrink: 0, display: "inline-block" }} />
              Live — agents are working · auto-refreshing every 4s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: "13px", fontWeight: 600, color: color ?? "var(--text-1)" }}>{value}</div>
    </div>
  );
}

function MonoLine({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  const display = truncate ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: "10px", color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "11px", fontFamily: "var(--mono)", color: "var(--text-2)", wordBreak: "break-all" }} title={value}>
        {display}
      </div>
    </div>
  );
}
