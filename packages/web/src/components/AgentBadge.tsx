"use client";

import { Agent } from "@/lib/api";

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; glyph: string }> = {
  alpha: { color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', glyph: 'α' },
  beta:  { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)', glyph: 'β' },
  gamma: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', glyph: 'γ' },
};

function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface AgentBadgeProps {
  agent: Agent;
  showStats?: boolean;
  compact?: boolean;
}

export function AgentBadge({ agent, showStats, compact }: AgentBadgeProps) {
  const tier = TIER_CONFIG[agent.tier] ?? {
    color: '#64748b',
    bg: 'rgba(100,116,139,0.1)',
    border: 'rgba(100,116,139,0.2)',
    glyph: '?',
  };

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono"
        style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}
      >
        <span>{tier.glyph}</span>
        {agent.name || fmtAddr(agent.address)}
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(99,102,241,0.12)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
        style={{ background: tier.bg, border: `1px solid ${tier.border}`, color: tier.color }}
      >
        {tier.glyph}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: '#e2e8f0' }}>
            {agent.name || `${agent.tier} Agent`}
          </span>
          {agent.is_active && (
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#10b981' }}
            />
          )}
        </div>
        <p className="text-xs font-mono" style={{ color: '#334155' }}>
          {fmtAddr(agent.address)}
        </p>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-mono font-bold" style={{ color: tier.color }}>
            {agent.reputation_score.toLocaleString()}
          </div>
          <div className="text-xs" style={{ color: '#475569' }}>
            {((agent.win_rate ?? 0) * 100).toFixed(0)}% win
          </div>
        </div>
      )}
    </div>
  );
}
