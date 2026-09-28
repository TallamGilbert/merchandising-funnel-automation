"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { ChevronsLeftIcon, LogoIcon, SearchIcon } from "./icons";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export interface StatusCard {
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}

export interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AppShell({
  brandName,
  nav,
  statusCard,
  title,
  subtitle,
  search,
  actions,
  children,
}: {
  brandName: string;
  nav: NavSection[];
  statusCard?: StatusCard;
  title: string;
  subtitle?: string;
  search?: SearchConfig;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="shell">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-icon">
              <LogoIcon />
            </span>
            <span className="brand-name">{brandName}</span>
          </div>
          <button
            className="collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Toggle sidebar"
            type="button"
          >
            <ChevronsLeftIcon size={14} />
          </button>
        </div>

        {nav.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item${active ? " active" : ""}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="sidebar-spacer" />

        {statusCard && (
          <div className="status-card">
            <h4>{statusCard.title}</h4>
            <p>{statusCard.description}</p>
            {statusCard.href && (
              <a href={statusCard.href} target="_blank" rel="noreferrer">
                {statusCard.linkLabel ?? "Learn more"}
              </a>
            )}
          </div>
        )}
      </aside>

      <div className="shell-main">
        <div className="topbar">
          {search ? (
            <div className="search-box">
              <SearchIcon />
              <input
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Search…"}
              />
              <span className="kbd-hint">/</span>
            </div>
          ) : (
            <div />
          )}
          {actions && <div className="actions">{actions}</div>}
        </div>

        <div className="page-body">
          <div className="page-heading">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
