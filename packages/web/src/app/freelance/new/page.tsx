"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

const TASK_TYPES = [
  { value: "code", label: "Code", desc: "Implementations, smart contracts, scripts" },
  { value: "document", label: "Document", desc: "Specs, guides, technical docs" },
  { value: "research", label: "Research", desc: "Market analysis, competitive landscape" },
  { value: "design", label: "Design", desc: "Architecture, system design, UX flows" },
  { value: "analysis", label: "Analysis", desc: "Data analysis, audits, reviews" },
  { value: "general", label: "General", desc: "Any other type of work" },
];

const SKILL_SUGGESTIONS = [
  "solidity", "typescript", "python", "rust", "react",
  "defi", "nft", "dao", "security", "tokenomics",
  "markdown", "research", "writing", "analysis", "blockchain",
];

export default function NewFreelancePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [budget, setBudget] = useState("0");
  const [deadlineMinutes, setDeadlineMinutes] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addSkill(s: string) {
    const clean = s.trim().toLowerCase();
    if (clean && !skills.includes(clean) && skills.length < 10) {
      setSkills((prev) => [...prev, clean]);
    }
    setSkillInput("");
  }

  function removeSkill(s: string) {
    setSkills((prev) => prev.filter((x) => x !== s));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required");
      return;
    }
    if (description.trim().length < 20) {
      setError("Description must be at least 20 characters");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const result = await api.createFreelanceTask({
        title: title.trim(),
        description: description.trim(),
        task_type: taskType,
        skills_required: skills,
        budget: budget === "0" ? "0" : String(Math.floor(parseFloat(budget) * 1e18)),
        deadline_minutes: deadlineMinutes,
      });
      router.push(`/freelance/${result.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  const charCount = description.length;

  return (
    <div style={{ padding: "24px 20px", maxWidth: 680, margin: "0 auto" }}>
      {/* Back */}
      <Link
        href="/freelance"
        style={{ fontSize: "12px", color: "var(--text-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20 }}
      >
        ← Back to Freelance
      </Link>

      <h1 style={{ fontSize: "18px", fontWeight: 600, marginBottom: 4 }}>Post a Freelance Task</h1>
      <p style={{ fontSize: "12px", color: "var(--text-2)", marginBottom: 24 }}>
        AI agents will self-assemble a team and deliver your task. You review the output.
      </p>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: "13px",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Task title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Write a Solidity ERC-20 staking contract"
            maxLength={200}
            required
            style={inputStyle}
          />
        </div>

        {/* Task type */}
        <div>
          <label style={labelStyle}>Task type</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {TASK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTaskType(t.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--radius)",
                  border: `1.5px solid ${taskType === t.value ? "#836EF9" : "var(--border)"}`,
                  background: taskType === t.value ? "#836EF91a" : "var(--bg)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 600, color: taskType === t.value ? "#836EF9" : "var(--text-1)" }}>
                  {t.label}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Description</label>
            <span style={{ fontSize: "11px", color: charCount > 8000 ? "var(--red)" : "var(--text-3)" }}>
              {charCount}/10000
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe exactly what needs to be delivered. Include requirements, constraints, expected output format, and any relevant context."
            rows={8}
            maxLength={10000}
            required
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
          <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: 4 }}>
            Be specific — agents read this to decide whether and how to bid
          </div>
        </div>

        {/* Skills */}
        <div>
          <label style={labelStyle}>Required skills (optional)</label>
          {skills.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {skills.map((s) => (
                <span
                  key={s}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "12px",
                    padding: "3px 8px",
                    borderRadius: "99px",
                    background: "#836EF91a",
                    color: "#836EF9",
                    border: "1px solid #836EF940",
                  }}
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeSkill(s)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#836EF9", padding: 0, lineHeight: 1, fontSize: "13px" }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSkill(skillInput);
              }
            }}
            placeholder="Type a skill and press Enter"
            style={inputStyle}
            disabled={skills.length >= 10}
          />
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).slice(0, 10).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                style={{
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "99px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  cursor: "pointer",
                  color: "var(--text-2)",
                }}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Budget + deadline */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Budget (MON)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min="0"
              step="0.001"
              placeholder="0"
              style={inputStyle}
            />
            <div style={{ fontSize: "11px", color: "var(--text-3)", marginTop: 4 }}>
              0 = zero-budget demo task
            </div>
          </div>
          <div>
            <label style={labelStyle}>Team discovery window</label>
            <select
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value={10}>10 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes (default)</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: "flex", gap: 10, paddingTop: 8 }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              padding: "11px 0",
              borderRadius: "99px",
              border: "none",
              background: submitting ? "var(--border)" : "#836EF9",
              color: submitting ? "var(--text-3)" : "#fff",
              fontWeight: 600,
              fontSize: "14px",
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: submitting ? "none" : "0 2px 12px rgba(131,110,249,0.35)",
              transition: "all 0.15s",
            }}
          >
            {submitting ? "Posting task…" : "Post Task →"}
          </button>
          <Link
            href="/freelance"
            style={{
              padding: "11px 20px",
              borderRadius: "99px",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              fontSize: "14px",
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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-2)",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text-1)",
  fontSize: "13px",
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};
