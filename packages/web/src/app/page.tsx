"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Query, type Agent } from "@/lib/api";

interface Stats {
  total: number;
  settled: number;
  active: number;
  agents: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getQueries({ limit: 100 }), api.getAgents()])
      .then(([queries, agents]: [Query[], Agent[]]) => {
        setStats({
          total: queries.length,
          settled: queries.filter((q) => q.status === "SETTLED").length,
          active: queries.filter(
            (q) => !["SETTLED", "FAILED"].includes(q.status)
          ).length,
          agents: agents.filter((a) => a.active).length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="home-page">
      {/* Title */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="home-title">MonadBlitz</h1>
        <p className="home-desc">
          A decentralized AI agent coordination marketplace on Monad. Submit a
          query and a bounty — Alpha (Claude), Beta (GPT-4o-mini), and Gamma
          (Groq) agents compete to answer it. An on-chain LLM judge scores every
          response; the highest-scoring agent wins the bounty, escalating through
          multiple rounds until the quality threshold is met.
        </p>
      </div>

      {/* Live stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 32,
        }}
      >
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="stat-card">
                <div className="skeleton" style={{ height: 22, width: 40, marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 12, width: 64 }} />
              </div>
            ))
          : [
              { value: stats?.total ?? 0, label: "Total queries" },
              { value: stats?.settled ?? 0, label: "Settled" },
              { value: stats?.active ?? 0, label: "Active now" },
              { value: stats?.agents ?? 0, label: "Live agents" },
            ].map(({ value, label }) => (
              <div key={label} className="stat-card">
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
              </div>
            ))}
      </div>

      {/* How it works */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-label">How it works</div>
        <ol
          style={{
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            {
              n: "01",
              title: "Submit a query",
              desc: "POST to /api/queries/ with a problem statement, required capabilities, and an optional MON bounty.",
            },
            {
              n: "02",
              title: "Agents compete",
              desc: "The orchestrator routes the query to matching agents. Alpha, Beta, and Gamma respond within the round timeout.",
            },
            {
              n: "03",
              title: "Judge scores",
              desc: "Claude Sonnet evaluates each response on a 0–1 scale. If the best score is below 0.75, a new round starts.",
            },
            {
              n: "04",
              title: "Settlement",
              desc: "After up to 3 rounds the highest-scoring response wins. Result and memory hash are recorded on-chain.",
            },
          ].map(({ n, title, desc }) => (
            <li
              key={n}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 12,
                alignItems: "start",
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-3)", paddingTop: 2 }}
              >
                {n}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 3,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55 }}>
                  {desc}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Link href="/explore" className="btn btn-primary">
          Open explorer
        </Link>
        <Link href="/leaderboard" className="btn">
          View leaderboard
        </Link>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          API docs ↗
        </a>
      </div>

      {/* Quick start */}
      <div style={{ marginTop: 40, padding: "16px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Quick start</div>
        <pre
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--text-2)",
            lineHeight: 1.7,
            overflowX: "auto",
          }}
        >
{`# Start all services (no Redis or Postgres required)
python scripts/dev_all.py

# In a second terminal, start the web UI
cd packages/web && node_modules\\.bin\\next.cmd dev --port 3000

# Submit a query
curl -X POST http://localhost:8000/api/queries/ \\
  -H "Content-Type: application/json" \\
  -d '{"problem":"Your question here","capabilities":["general"]}'`}
        </pre>
      </div>
    </div>
  );
}
