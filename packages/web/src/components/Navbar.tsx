"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <Link href="/" className="nav-brand" aria-label="MonadBlitz home">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect width="18" height="18" rx="4" fill="#836EF9" />
          <path
            d="M5 13V5.5l4 3.5 4-3.5V13"
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        MonadBlitz
      </Link>

      {NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`nav-link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}

      <div className="nav-end">
        <div className="chain-pill" aria-label="Connected to Monad Testnet">
          <span className="chain-dot" />
          Monad Testnet
        </div>

        <ConnectButton
          showBalance={false}
          chainStatus="none"
          accountStatus="address"
        />
      </div>
    </nav>
  );
}
