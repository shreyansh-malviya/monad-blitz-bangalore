"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { RefreshCw, Search, Plus, X, ChevronDown, ChevronUp, ExternalLink, Zap } from "lucide-react";
import { api, Query, TaskMemory } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

const POLL_INTERVAL = 3000;
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadexplorer.com";

function fmtAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return d.toLocaleTimeString();
}

// ── Memory Panel ──────────────────────────────────────────────
function MemoryPanel({ queryId }: { queryId: string }) {
  const [memory, setMemory] = useState<TaskMemory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMemory(queryId)
      .then(setMemory)
      .catch(() => setMemory(null))
      .finally(() => setLoading(false));
  }, [queryId]);

  if (loading)
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-6 w-full" />)}
      </div>
    );

  if (!memory) return <p className="p-4 text-sm" style={{ color: '#475569' }}>No memory chain yet</p>;

  const events = memory.content?.events ?? [];
  const rounds: Record<number, typeof events> = {};
  for (const ev of events) {
    const r = ev.round ?? 0;
    (rounds[r] = rounds[r] ?? []).push(ev);
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-mono" style={{ color: '#475569' }}>
          CHAIN HASH:
        </span>
        <span className="text-xs font-mono" style={{ color: '#06b6d4' }}>
          {memory.current_hash ? `${memory.current_hash.slice(0, 24)}…` : 'none'}
        </span>
      </div>

      {Object.entries(rounds)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([round, evs]) => (
          <div
            key={round}
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <div
              className="px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(6,182,212,0.06)' }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'rgba(6,182,212,0.2)', color: '#06b6d4' }}
              >
                {round}
              </div>
              <span className="text-xs font-semibold" style={{ color: '#06b6d4' }}>
                Round {round}
              </span>
              <span className="text-xs ml-auto" style={{ color: '#475569' }}>
                {evs.length} event{evs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              {evs.map((ev, i) => (
                <div
                  key={i}
                  className="px-3 py-2 text-xs font-mono flex flex-wrap gap-2 items-center"
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(99,102,241,0.08)' : undefined,
                  }}
                >
                  <span
                    className="px-1.5 py-0.5 rounded text-xs"
                    style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308' }}
                  >
                    {ev.type}
                  </span>
                  {ev.agent_address && (
                    <span style={{ color: '#94a3b8' }}>
                      {fmtAddr(ev.agent_address)}
                    </span>
                  )}
                  {ev.score !== undefined && (
                    <span
                      className="font-bold"
                      style={{
                        color: ev.score >= 0.75 ? '#10b981' : ev.score >= 0.6 ? '#eab308' : '#ef4444',
                      }}
                    >
                      score={ev.score.toFixed(3)}
                    </span>
                  )}
                  {ev.winner_address && (
                    <span style={{ color: '#10b981' }}>★ {fmtAddr(ev.winner_address)}</span>
                  )}
                  {ev.reason && (
                    <span style={{ color: '#f97316' }}>
                      [{String(ev.reason).slice(0, 60)}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// ── Query Card ────────────────────────────────────────────────
function QueryCard({ query, isNew }: { query: Query; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="card overflow-hidden"
      style={{
        animation: isNew ? 'slideIn 0.4s ease-out' : undefined,
        borderColor: isNew ? 'rgba(99,102,241,0.35)' : undefined,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-2">
          {/* Row 1: status + meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={query.status} />
            <span className="text-xs font-mono" style={{ color: '#475569' }}>
              #{query.id.slice(0, 8)}
            </span>
            <span className="text-xs" style={{ color: '#475569' }}>
              Rd {query.current_round}
            </span>
            <span className="text-xs" style={{ color: '#475569' }}>
              {query.response_count ?? 0} resp
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold" style={{ color: '#818cf8' }}>
                {query.reward} MON
              </span>
              <span className="text-xs" style={{ color: '#334155' }}>
                {fmtTime(query.created_at)}
              </span>
            </div>
          </div>

          {/* Problem text */}
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: '#cbd5e1' }}>
            {query.problem}
          </p>

          {/* Winner */}
          {query.winner_address && (
            <p className="text-xs font-mono" style={{ color: '#10b981' }}>
              ★ Winner: {fmtAddr(query.winner_address)}
            </p>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 shrink-0 mt-1" style={{ color: '#475569' }} />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0 mt-1" style={{ color: '#475569' }} />
        )}
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(0,0,0,0.2)' }}>
          {/* Full problem */}
          <div className="p-4 pb-0">
            <p className="text-xs font-mono mb-1" style={{ color: '#475569' }}>FULL PROBLEM</p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#e2e8f0' }}>{query.problem}</p>

            {/* Explorer link if settled */}
            {query.status === 'settled' && query.winner_address && (
              <a
                href={`${EXPLORER_URL}/address/${query.winner_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg mb-4"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
              >
                <ExternalLink className="w-3 h-3" />
                View winner on Monad Explorer
              </a>
            )}
          </div>

          {/* Memory timeline */}
          <div className="px-2">
            <p className="text-xs font-mono px-2 mb-2" style={{ color: '#475569' }}>MEMORY CHAIN</p>
            <MemoryPanel queryId={query.id} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create Query Modal ────────────────────────────────────────
const CAPABILITIES = ['coding', 'math', 'research', 'analysis', 'writing', 'blockchain', 'general'];

function CreateQueryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [problem, setProblem] = useState('');
  const [bounty, setBounty] = useState('0.05');
  const [caps, setCaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!problem.trim()) return;
    setLoading(true);
    setErr('');
    try {
      await api.createQuery(problem.trim(), bounty);
      onCreated();
      onClose();
    } catch (ex) {
      setErr(String(ex));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 0 60px rgba(99,102,241,0.15)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: '#818cf8' }} />
            <h2 className="font-bold" style={{ color: '#f1f5f9' }}>New Query</h2>
          </div>
          <button onClick={onClose} className="hover:opacity-70 transition-opacity">
            <X className="w-5 h-5" style={{ color: '#64748b' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: '#64748b' }}>
              PROBLEM STATEMENT
            </label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe the problem you want agents to solve…"
              className="w-full rounded-xl p-4 text-sm resize-none focus:outline-none transition-colors"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(99,102,241,0.15)',
                color: '#e2e8f0',
                height: 120,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)';
              }}
            />
          </div>

          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: '#64748b' }}>
              CAPABILITIES REQUIRED
            </label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setCaps((prev) =>
                      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                    )
                  }
                  className="px-3 py-1 rounded-full text-xs font-mono transition-all"
                  style={{
                    background: caps.includes(c) ? 'rgba(99,102,241,0.25)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${caps.includes(c) ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.15)'}`,
                    color: caps.includes(c) ? '#818cf8' : '#64748b',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: '#64748b' }}>
              BOUNTY (MON)
            </label>
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(99,102,241,0.15)',
              }}
            >
              <input
                type="number"
                value={bounty}
                onChange={(e) => setBounty(e.target.value)}
                min="0.001"
                step="0.01"
                className="bg-transparent text-sm font-mono focus:outline-none flex-1"
                style={{ color: '#e2e8f0' }}
              />
              <span className="text-sm font-bold" style={{ color: '#818cf8' }}>MON</span>
            </div>
          </div>

          {err && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !problem.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Post Query
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const STATUS_FILTERS = ['all', 'routing', 'collecting', 'scoring', 'escalating', 'settled', 'failed'];

export default function ExplorePage() {
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const fetchQueries = useCallback(async () => {
    try {
      const data = await api.getQueries({ limit: 50 });
      const incoming = new Set(data.map((q: Query) => q.id));
      const freshArr = data.map((q: Query) => q.id).filter((id: string) => !prevIds.current.has(id));
      if (freshArr.length > 0) setNewIds(new Set(freshArr));
      prevIds.current = incoming;
      setQueries(data);
      setTimeout(() => setNewIds(new Set()), 3000);
    } catch {
      // api offline - keep previous data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueries();
    const iv = setInterval(fetchQueries, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchQueries]);

  // WebSocket live logs
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => {
          setWsConnected(false);
          setTimeout(connect, 4000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            const text = msg.message || msg.data || JSON.stringify(msg);
            setLogs((prev) => [text, ...prev].slice(0, 80));
          } catch {
            setLogs((prev) => [e.data, ...prev].slice(0, 80));
          }
        };
      } catch {}
    }
    connect();
    return () => { wsRef.current?.close(); };
  }, []);

  const filtered = queries.filter((q) => {
    const matchSearch =
      !search ||
      q.problem.toLowerCase().includes(search.toLowerCase()) ||
      q.status.toLowerCase().includes(search.toLowerCase()) ||
      q.id.includes(search);
    const matchStatus = statusFilter === 'all' || q.status.toLowerCase() === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black" style={{ color: '#f1f5f9' }}>Explore Queries</h1>
          <p className="text-sm mt-1" style={{ color: '#475569' }}>
            Live AI agent task results · auto-refreshing every 3s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchQueries}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#94a3b8',
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Query
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded-lg text-xs font-mono transition-all capitalize"
            style={{
              background: statusFilter === s ? 'rgba(99,102,241,0.2)' : 'var(--bg-card)',
              border: `1px solid ${statusFilter === s ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.1)'}`,
              color: statusFilter === s ? '#818cf8' : '#475569',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Query List */}
        <div className="lg:col-span-2 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by problem, status, ID…"
              className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none transition-colors"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(99,102,241,0.15)',
                color: '#e2e8f0',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'; }}
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card p-4 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24 card">
              <div className="text-4xl mb-4">🔍</div>
              <p className="font-semibold mb-2" style={{ color: '#94a3b8' }}>No queries found</p>
              <p className="text-sm mb-6" style={{ color: '#475569' }}>
                {queries.length === 0
                  ? 'No queries exist yet. Create the first one!'
                  : 'Try adjusting your search or filter.'}
              </p>
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                Create Query
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs font-mono" style={{ color: '#475569' }}>
                {filtered.length} quer{filtered.length !== 1 ? 'ies' : 'y'}
              </p>
              {filtered.map((q) => (
                <QueryCard key={q.id} query={q} isNew={newIds.has(q.id)} />
              ))}
            </>
          )}
        </div>

        {/* Live Log Sidebar */}
        <div
          className="rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(99,102,241,0.15)',
            height: 'calc(100vh - 180px)',
            position: 'sticky',
            top: 80,
          }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
          >
            <div
              className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>
              Live Logs
            </span>
            <span className="text-xs ml-auto font-mono" style={{ color: '#475569' }}>
              {wsConnected ? 'CONNECTED' : 'RECONNECTING'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono">
            {logs.length === 0 ? (
              <p className="text-xs" style={{ color: '#334155' }}>
                {wsConnected ? 'Waiting for events…' : 'Connecting to orchestrator…'}
              </p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className="text-xs leading-relaxed py-0.5 border-b"
                  style={{
                    color: i === 0 ? '#94a3b8' : '#334155',
                    borderColor: 'rgba(99,102,241,0.05)',
                    transition: 'color 2s ease',
                  }}
                >
                  {log.slice(0, 140)}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateQueryModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchQueries}
        />
      )}
    </div>
  );
}
