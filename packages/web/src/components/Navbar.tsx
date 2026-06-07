"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Zap, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leaderboard', label: 'Leaderboard' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="fixed top-0 w-full z-50"
      style={{
        background: 'rgba(5,5,16,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(99,102,241,0.1)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(6,182,212,0.2))',
              border: '1px solid rgba(99,102,241,0.4)',
              boxShadow: '0 0 12px rgba(99,102,241,0.2)',
            }}
          >
            <Zap className="w-4 h-4" style={{ color: '#818cf8' }} />
          </div>
          <span
            className="font-black text-lg tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #a5b4fc, #06b6d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            MonadBlitz
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname?.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: active ? '#818cf8' : '#64748b',
                  background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                  border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.color = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.color = '#64748b';
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right: connect + mobile */}
        <div className="flex items-center gap-3">
          <ConnectButton chainStatus="icon" showBalance={false} />
          <button
            className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen
              ? <X className="w-4 h-4" style={{ color: '#818cf8' }} />
              : <Menu className="w-4 h-4" style={{ color: '#818cf8' }} />
            }
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden px-4 pb-4 space-y-1"
          style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}
        >
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  color: active ? '#818cf8' : '#64748b',
                  background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
