"use client";

import { useEffect, useState } from "react";
import { api, TaskMemory } from "@/lib/api";

function fmtAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}

const EVENT_COLORS: Record<string, string> = {
  query_received:   '#06b6d4',
  response_received:'#818cf8',
  scoring_started:  '#eab308',
  scoring_complete: '#10b981',
  winner_selected:  '#10b981',
  escalation:       '#f97316',
  failed:           '#ef4444',
};

export function MemoryTimeline({ queryId }: { queryId: string }) {
  const [memory, setMemory] = useState<TaskMemory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMemory(queryId)
      .then(setMemory)
      .catch(() => setMemory(null))
      .finally(() => setLoading(false));
  }, [queryId]);

  if (loading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-6 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!memory) {
    return (
      <p className="p-4 text-xs font-mono" style={{ color: '#334155' }}>
        No memory chain available
      </p>
    );
  }

  const events = memory.content?.events ?? [];

  // Group by round
  const rounds: Record<number, typeof events> = {};
  for (const ev of events) {
    const r = ev.round ?? 0;
    (rounds[r] = rounds[r] ?? []).push(ev);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Hash */}
      {memory.current_hash && (
        <div
          className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg"
          style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.1)' }}
        >
          <span style={{ color: '#334155' }}>HASH:</span>
          <span style={{ color: '#06b6d4' }}>{memory.current_hash.slice(0, 28)}…</span>
        </div>
      )}

      {/* Round timeline */}
      {Object.entries(rounds)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([round, evs]) => (
          <div key={round} className="relative pl-4">
            {/* Vertical line */}
            <div
              className="absolute left-0 top-6 bottom-0 w-px"
              style={{ background: 'rgba(99,102,241,0.15)' }}
            />

            {/* Round header */}
            <div className="flex items-center gap-2 mb-2">
              <div
                className="absolute left-0 w-2 h-2 rounded-full -translate-x-0.5"
                style={{ background: '#6366f1' }}
              />
              <span
                className="ml-2 text-xs font-mono font-bold"
                style={{ color: '#6366f1' }}
              >
                ROUND {round}
              </span>
              <span className="text-xs" style={{ color: '#334155' }}>
                {evs.length} event{evs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Events */}
            <div className="space-y-1.5 ml-2">
              {evs.map((ev, i) => {
                const color = EVENT_COLORS[ev.type] ?? '#475569';
                return (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg"
                    style={{
                      background: `${color}08`,
                      border: `1px solid ${color}18`,
                    }}
                  >
                    <span
                      className="px-1.5 py-0.5 rounded text-xs"
                      style={{ background: `${color}15`, color }}
                    >
                      {ev.type}
                    </span>

                    {ev.agent_address && (
                      <span style={{ color: '#64748b' }}>
                        agent={fmtAddr(ev.agent_address)}
                      </span>
                    )}

                    {ev.score !== undefined && (
                      <span
                        className="font-bold"
                        style={{
                          color: ev.score >= 0.75 ? '#10b981' : ev.score >= 0.5 ? '#eab308' : '#ef4444',
                        }}
                      >
                        score={ev.score.toFixed(3)}
                      </span>
                    )}

                    {ev.winner_address && (
                      <span style={{ color: '#10b981' }}>
                        ★ winner={fmtAddr(ev.winner_address)}
                      </span>
                    )}

                    {ev.reason && (
                      <span style={{ color: '#f97316' }}>
                        [{String(ev.reason).slice(0, 50)}]
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      {events.length === 0 && (
        <p className="text-xs font-mono" style={{ color: '#334155' }}>
          No events recorded yet
        </p>
      )}
    </div>
  );
}
