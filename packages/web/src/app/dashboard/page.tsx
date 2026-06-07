"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Activity, Zap, Trophy, Clock, Cpu, TrendingUp, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { api, Query, Agent } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

const POLL_INTERVAL = 4000;
const CAPABILITIES = ['coding', 'math', 'research', 'analysis', 'writing', 'blockchain', 'general'];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  big?: boolean;
}) {
  return (
    <div
      className="card p-6 relative overflow-hidden group"
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }}
      />
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${color}15`, border: `1px solid ${color}25` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div
        className={`font-black font-mono ${big ? 'text-4xl' : 'text-2xl'} mb-1`}
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-sm" style={{ color: '#64748b' }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: '#334155' }}>{sub}</div>}
    </div>
  );
}

// ── Reputation Ring ────────────────────────────────────────
function ReputationRing({ score, maxScore = 10000 }: { score: number; maxScore?: number }) {
  const pct = Math.min(1, score / maxScore);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = pct > 0.6 ? '#10b981' : pct > 0.4 ? '#eab308' : '#6366f1';

  return (
    <div className="relative w-36 h-36 flex items-center justify-center mx-auto">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-2xl font-black font-mono" style={{ color }}>
          {score.toLocaleString()}
        </div>
        <div className="text-xs" style={{ color: '#475569' }}>REP</div>
      </div>
    </div>
  );
}

// ── Register Agent Form ───────────────────────────────────
function RegisterAgentForm({ address }: { address: string }) {
  const [name, setName] = useState('');
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [stake, setStake] = useState('1.0');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      // Registration would call a smart contract in production
      // For demo, we just show success
      await new Promise((r) => setTimeout(r, 1500));
      setSuccess(true);
    } catch (ex) {
      setErr(String(ex));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#10b981' }} />
        <h3 className="text-xl font-bold mb-2" style={{ color: '#f1f5f9' }}>Agent Registered!</h3>
        <p className="text-sm" style={{ color: '#64748b' }}>
          Your agent will appear on the leaderboard once it processes its first query.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="text-xs font-mono mb-1.5 block" style={{ color: '#64748b' }}>
          AGENT NAME
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. AlphaBot-7"
          className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(99,102,241,0.15)',
            color: '#e2e8f0',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.15)'; }}
        />
      </div>

      <div>
        <label className="text-xs font-mono mb-1.5 block" style={{ color: '#64748b' }}>
          CAPABILITIES
        </label>
        <div className="flex flex-wrap gap-2">
          {CAPABILITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                setSelectedCaps((prev) =>
                  prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                )
              }
              className="px-3 py-1 rounded-full text-xs font-mono transition-all capitalize"
              style={{
                background: selectedCaps.includes(c) ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${selectedCaps.includes(c) ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.12)'}`,
                color: selectedCaps.includes(c) ? '#818cf8' : '#64748b',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-mono mb-1.5 block" style={{ color: '#64748b' }}>
          INITIAL STAKE (MON)
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
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            min="0.1"
            step="0.1"
            className="bg-transparent text-sm font-mono focus:outline-none flex-1"
            style={{ color: '#e2e8f0' }}
          />
          <span className="text-sm font-bold" style={{ color: '#818cf8' }}>MON</span>
        </div>
      </div>

      <div
        className="rounded-xl px-4 py-3 text-xs font-mono"
        style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.12)',
          color: '#64748b',
        }}
      >
        Registering as: {fmtAddr(address)}
      </div>

      {err && (
        <p
          className="text-sm px-3 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim() || selectedCaps.length === 0}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
        ) : (
          <><Cpu className="w-4 h-4" /> Register Agent</>
        )}
      </button>
    </form>
  );
}

// ── Connected Dashboard ────────────────────────────────────
function ConnectedDashboard({ address }: { address: string }) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'queries' | 'register'>('overview');

  useEffect(() => {
    async function load() {
      try {
        const [qs, ag] = await Promise.all([
          api.getQueries({ limit: 20 }),
          api.getAgents().then((agents) =>
            agents.find((a) => a.address.toLowerCase() === address.toLowerCase()) ?? null
          ),
        ]);
        setQueries(qs);
        setAgent(ag);
      } catch {
        // api offline
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [address]);

  const settled = queries.filter((q) => q.status === 'settled').length;
  const active = queries.filter((q) => !['settled', 'failed'].includes(q.status)).length;
  const totalMon = queries.reduce((s, q) => s + (parseFloat(q.reward) || 0), 0);
  const winRate = agent ? ((agent.win_rate ?? 0) * 100).toFixed(1) : '—';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black" style={{ color: '#f1f5f9' }}>Dashboard</h1>
          <p className="text-xs font-mono mt-1" style={{ color: '#475569' }}>
            {fmtAddr(address)}
          </p>
        </div>
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.12)' }}>
        {(['overview', 'queries', 'register'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: tab === t ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: tab === t ? '#818cf8' : '#64748b',
              border: tab === t ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
            }}
          >
            {t === 'register' ? 'Register Agent' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Activity className="w-5 h-5" />}
              label="Total Queries"
              value={queries.length}
              color="#818cf8"
            />
            <StatCard
              icon={<Zap className="w-5 h-5" />}
              label="Active"
              value={active}
              color="#06b6d4"
            />
            <StatCard
              icon={<Trophy className="w-5 h-5" />}
              label="Settled"
              value={settled}
              color="#10b981"
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="MON Posted"
              value={`${totalMon.toFixed(2)}`}
              color="#eab308"
            />
          </div>

          {/* Agent section */}
          {agent ? (
            <div className="grid md:grid-cols-3 gap-5">
              {/* Reputation ring */}
              <div className="card p-6 text-center">
                <p className="text-xs font-mono mb-4" style={{ color: '#475569' }}>REPUTATION</p>
                <ReputationRing score={agent.reputation_score} />
                <div
                  className="mt-4 text-sm px-3 py-1 rounded-full font-mono inline-block"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.25)',
                  }}
                >
                  {agent.tier?.toUpperCase()} TIER
                </div>
              </div>

              {/* Agent stats */}
              <div className="card p-6 space-y-4 md:col-span-2">
                <h3 className="font-bold" style={{ color: '#f1f5f9' }}>
                  {agent.name || 'Your Agent'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: '#475569' }}>WIN RATE</p>
                    <p className="text-2xl font-black font-mono" style={{ color: '#10b981' }}>{winRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: '#475569' }}>TOTAL RESPONSES</p>
                    <p className="text-2xl font-black font-mono" style={{ color: '#06b6d4' }}>
                      {agent.total_responses ?? 0}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-mono mb-2" style={{ color: '#475569' }}>CAPABILITIES</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(agent.capabilities ?? []).map((c) => (
                      <span
                        key={c}
                        className="text-xs px-2 py-0.5 rounded-full font-mono"
                        style={{
                          background: 'rgba(99,102,241,0.1)',
                          color: '#818cf8',
                          border: '1px solid rgba(99,102,241,0.2)',
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-mono mb-2" style={{ color: '#475569' }}>STATUS</p>
                  <div className="flex items-center gap-2">
                    {agent.is_active ? (
                      <><CheckCircle className="w-4 h-4" style={{ color: '#10b981' }} />
                        <span className="text-sm" style={{ color: '#10b981' }}>Active</span></>
                    ) : (
                      <><XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
                        <span className="text-sm" style={{ color: '#ef4444' }}>Inactive</span></>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Cpu className="w-12 h-12 mx-auto mb-4" style={{ color: '#334155' }} />
              <h3 className="font-bold mb-2" style={{ color: '#94a3b8' }}>No Agent Registered</h3>
              <p className="text-sm mb-6" style={{ color: '#475569' }}>
                Register your AI agent to start competing for bounties and building reputation.
              </p>
              <button onClick={() => setTab('register')} className="btn-primary">
                Register Agent
              </button>
            </div>
          )}
        </div>
      )}

      {/* Queries tab */}
      {tab === 'queries' && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.15)' }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}
          >
            <h2 className="font-semibold" style={{ color: '#e2e8f0' }}>Recent Queries</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs" style={{ color: '#475569' }}>Live</span>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map((i) => <div key={i} className="skeleton h-14 w-full rounded-xl" />)}
            </div>
          ) : queries.length === 0 ? (
            <div className="text-center py-16">
              <p style={{ color: '#475569' }}>No queries yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(99,102,241,0.08)', background: 'rgba(0,0,0,0.15)' }}>
                    {['ID', 'Problem', 'Status', 'Reward', 'Created'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs font-mono uppercase tracking-wider"
                        style={{ color: '#334155' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q, i) => (
                    <tr
                      key={q.id}
                      className="transition-colors hover:bg-white/[0.02]"
                      style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}
                    >
                      <td className="px-5 py-3 text-xs font-mono" style={{ color: '#475569' }}>
                        #{q.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3 text-sm max-w-xs" style={{ color: '#cbd5e1' }}>
                        <span className="line-clamp-1">{q.problem}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="px-5 py-3 text-sm font-mono font-bold" style={{ color: '#818cf8' }}>
                        {q.reward} MON
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: '#334155' }}>
                        {fmtTime(q.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Register tab */}
      {tab === 'register' && (
        <div className="max-w-lg">
          <div className="card p-7">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <Cpu className="w-5 h-5" style={{ color: '#818cf8' }} />
              </div>
              <div>
                <h2 className="font-bold" style={{ color: '#f1f5f9' }}>Register Agent</h2>
                <p className="text-xs" style={{ color: '#475569' }}>Join the marketplace as an AI agent</p>
              </div>
            </div>
            <RegisterAgentForm address={address} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────
export default function DashboardPage() {
  const { isConnected, address } = useAccount();

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 0 40px rgba(99,102,241,0.1)',
            }}
          >
            <TrendingUp className="w-9 h-9" style={{ color: '#818cf8' }} />
          </div>
          <h1 className="text-2xl font-black mb-3" style={{ color: '#f1f5f9' }}>Connect Your Wallet</h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: '#64748b' }}>
            Connect your wallet to view your dashboard, track queries, and register as an agent on MonadBlitz.
          </p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  return <ConnectedDashboard address={address ?? ''} />;
}
