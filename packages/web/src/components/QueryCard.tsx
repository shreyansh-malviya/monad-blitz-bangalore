"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Query } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { MemoryTimeline } from "./MemoryTimeline";

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadexplorer.com";

function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  return d.toLocaleTimeString();
}

interface QueryCardProps {
  query: Query;
  isNew?: boolean;
  showExpanded?: boolean;
}

export function QueryCard({ query, isNew, showExpanded }: QueryCardProps) {
  const [expanded, setExpanded] = useState(showExpanded ?? false);

  return (
    <div
      className="card overflow-hidden"
      style={{
        animation: isNew ? 'slideIn 0.4s ease-out' : undefined,
        borderColor: isNew ? 'rgba(99,102,241,0.4)' : undefined,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 flex items-start gap-4 hover:bg-white/[0.015] transition-colors"
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={query.status} />
            <span className="text-xs font-mono" style={{ color: '#334155' }}>#{query.id.slice(0, 8)}</span>
            <span className="text-xs" style={{ color: '#334155' }}>Rd {query.current_round}</span>
            {query.response_count != null && (
              <span className="text-xs" style={{ color: '#334155' }}>{query.response_count} resp</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-mono font-bold" style={{ color: '#818cf8' }}>
                {query.reward} MON
              </span>
              <span className="text-xs" style={{ color: '#1e293b' }}>
                {fmtTime(query.created_at)}
              </span>
            </div>
          </div>
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: '#cbd5e1' }}>
            {query.problem}
          </p>
          {query.winner_address && (
            <p className="text-xs font-mono" style={{ color: '#10b981' }}>
              ★ Winner: {fmtAddr(query.winner_address)}
            </p>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 shrink-0 mt-1" style={{ color: '#334155' }} />
          : <ChevronDown className="w-4 h-4 shrink-0 mt-1" style={{ color: '#334155' }} />
        }
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.08)', background: 'rgba(0,0,0,0.15)' }}>
          <div className="p-4">
            <p className="text-xs font-mono mb-2" style={{ color: '#334155' }}>FULL PROBLEM</p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#e2e8f0' }}>{query.problem}</p>

            {query.status === 'settled' && query.winner_address && (
              <a
                href={`${EXPLORER_URL}/address/${query.winner_address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg mb-4"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <ExternalLink className="w-3 h-3" />
                View on Monad Explorer
              </a>
            )}
          </div>

          <div className="px-2">
            <p className="text-xs font-mono px-2 mb-2" style={{ color: '#334155' }}>MEMORY CHAIN</p>
            <MemoryTimeline queryId={query.id} />
          </div>
        </div>
      )}
    </div>
  );
}
