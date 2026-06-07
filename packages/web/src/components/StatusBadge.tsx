"use client";

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  routing:    { bg: 'rgba(6,182,212,0.1)',    color: '#06b6d4',  border: 'rgba(6,182,212,0.25)',    dot: '#06b6d4' },
  collecting: { bg: 'rgba(59,130,246,0.1)',   color: '#60a5fa',  border: 'rgba(59,130,246,0.25)',   dot: '#3b82f6' },
  scoring:    { bg: 'rgba(139,92,246,0.1)',   color: '#a78bfa',  border: 'rgba(139,92,246,0.25)',   dot: '#8b5cf6' },
  escalating: { bg: 'rgba(249,115,22,0.1)',   color: '#fb923c',  border: 'rgba(249,115,22,0.25)',   dot: '#f97316' },
  settled:    { bg: 'rgba(16,185,129,0.1)',   color: '#34d399',  border: 'rgba(16,185,129,0.25)',   dot: '#10b981' },
  failed:     { bg: 'rgba(239,68,68,0.1)',    color: '#f87171',  border: 'rgba(239,68,68,0.25)',    dot: '#ef4444' },
  created:    { bg: 'rgba(99,102,241,0.1)',   color: '#818cf8',  border: 'rgba(99,102,241,0.25)',   dot: '#6366f1' },
};

const PULSE_STATUSES = new Set(['routing', 'collecting', 'scoring', 'escalating']);

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  const style = STATUS_STYLES[key] ?? {
    bg: 'rgba(148,163,184,0.1)',
    color: '#94a3b8',
    border: 'rgba(148,163,184,0.2)',
    dot: '#64748b',
  };
  const pulse = PULSE_STATUSES.has(key);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono tracking-wider uppercase"
      style={{
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}
        style={{ background: style.dot }}
      />
      {status}
    </span>
  );
}
