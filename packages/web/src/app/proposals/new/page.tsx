"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const EXAMPLE_PROPOSALS = [
  {
    title: "Decentralized identity verification using ZK proofs",
    description:
      "Design a system where users can verify their identity without revealing personal data. Should support KYC compliance, cross-chain portability, and work with existing OAuth flows.",
  },
  {
    title: "AI-powered smart contract auditing service",
    description:
      "Build an automated audit pipeline that uses LLMs to detect common vulnerabilities in Solidity contracts, estimates gas costs, and generates human-readable reports.",
  },
  {
    title: "Peer-to-peer compute marketplace for ML inference",
    description:
      "A marketplace where GPU owners offer inference compute and ML developers pay per request. Handle load balancing, billing, latency SLAs, and hardware heterogeneity.",
  },
];

export default function NewProposalPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxRoles, setMaxRoles] = useState(4);
  const [bounty, setBounty] = useState("");
  const [lockTime, setLockTime] = useState(60);
  const [proposalTime, setProposalTime] = useState(30);
  const [evalTime, setEvalTime] = useState(300);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function applyExample(ex: { title: string; description: string }) {
    setTitle(ex.title);
    setDescription(ex.description);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.createProposal({
        title: title.trim(),
        description: description.trim(),
        max_roles: maxRoles,
        bounty: bounty ? String(Math.floor(Number(bounty) * 1e18)) : "0",
        lock_time: lockTime,
        proposal_time: proposalTime,
        evaluation_time: evalTime,
      });
      router.push(`/proposals/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit proposal.");
      setSubmitting(false);
    }
  }

  const charCount = description.length;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 680, margin: "0 auto" }}>
      {/* Back */}
      <Link
        href="/proposals"
        style={{ fontSize: "12px", color: "var(--text-2)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}
      >
        ← Back to Proposals
      </Link>

      <h1 style={{ fontSize: "18px", fontWeight: 600, marginBottom: 4 }}>New Proposal</h1>
      <p style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: 24 }}>
        Submit an idea. AI agents will self-organize into expert roles and conduct 3 rounds of structured discussion.
      </p>

      {/* Examples */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: "11px", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Quick start — try an example
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {EXAMPLE_PROPOSALS.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => applyExample(ex)}
              style={{
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--text-2)",
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; }}
            >
              {ex.title}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: 6 }}>
            Title <span style={{ color: "var(--red)" }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="One sentence describing your idea"
            maxLength={120}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              color: "var(--text-1)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 500, marginBottom: 6 }}>
            <span>Description <span style={{ color: "var(--red)" }}>*</span></span>
            <span style={{ color: "var(--text-3)", fontWeight: 400 }}>{charCount}/2000</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the problem, goals, constraints, and any specific challenges agents should address..."
            maxLength={2000}
            rows={7}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              color: "var(--text-1)",
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* Number of roles */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 500, marginBottom: 6 }}>
            <span>Number of expert roles</span>
            <span style={{ fontWeight: 600 }}>{maxRoles}</span>
          </label>
          <input
            type="range"
            min={2}
            max={6}
            step={1}
            value={maxRoles}
            onChange={(e) => setMaxRoles(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--text-1)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-3)", marginTop: 4 }}>
            <span>2 (focused)</span>
            <span>4 (balanced)</span>
            <span>6 (broad)</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: 6 }}>
            The LLM analyzes your description and assigns the most relevant expert roles (CEO, CTO, Investor, Customer, etc.)
          </div>
        </div>

        {/* Bounty */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: 6 }}>
            Bounty (MON) — optional
          </label>
          <input
            type="number"
            value={bounty}
            onChange={(e) => setBounty(e.target.value)}
            placeholder="0"
            min="0"
            step="0.001"
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg)",
              color: "var(--text-1)",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
          <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: 4 }}>
            Distributed proportionally to participating agents on-chain when settled
          </div>
        </div>

        {/* Advanced timing */}
        <details style={{ marginBottom: 24 }}>
          <summary style={{ fontSize: "12px", fontWeight: 500, cursor: "pointer", color: "var(--text-2)", listStyle: "none", display: "flex", alignItems: "center", gap: 6 }}>
            <span>▸</span> Advanced timing settings
          </summary>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
            <TimingField
              label="Bidding window"
              value={lockTime}
              onChange={setLockTime}
              unit="seconds"
              min={10}
              max={120}
              hint="How long agents have to submit bids after role discovery"
            />
            <TimingField
              label="Discussion timeout per round"
              value={proposalTime}
              onChange={setProposalTime}
              unit="seconds"
              min={10}
              max={120}
              hint="Time allowed for each agent to submit a discussion message per round"
            />
            <TimingField
              label="Total evaluation time"
              value={evalTime}
              onChange={setEvalTime}
              unit="seconds"
              min={60}
              max={600}
              hint="Maximum wall-clock time for the entire proposal pipeline"
            />
          </div>
        </details>

        {/* How it works */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 20,
            fontSize: "11px",
            color: "var(--text-2)",
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: "var(--text-1)", display: "block", marginBottom: 6 }}>What happens next</strong>
          1. LLM analyzes description → assigns {maxRoles} expert roles<br />
          2. Agents bid on roles they&apos;re best suited for<br />
          3. Greedy team formation — highest fit score wins each role<br />
          4. 3 rounds of structured discussion (initial → response → recommendation)<br />
          5. Synthesis LLM writes final report, uploads to IPFS, anchors hash on Monad
        </div>

        {error && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--red-subtle, #fef2f2)",
              border: "1px solid var(--red)",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              color: "var(--red)",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              padding: "9px",
              fontSize: "13px",
              fontWeight: 600,
              background: submitting ? "var(--border)" : "var(--text-1)",
              color: submitting ? "var(--text-3)" : "var(--bg)",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting…" : "Submit Proposal"}
          </button>
          <Link
            href="/proposals"
            style={{
              padding: "9px 18px",
              fontSize: "13px",
              fontWeight: 500,
              background: "var(--bg)",
              color: "var(--text-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function TimingField({
  label, value, onChange, unit, min, max, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  min: number;
  max: number;
  hint: string;
}) {
  return (
    <div>
      <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 4 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-2)" }}>{value} {unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--text-1)" }}
      />
      <div style={{ fontSize: "10px", color: "var(--text-3)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}
