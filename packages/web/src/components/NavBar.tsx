import { NavLink } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useDashboard } from "../api/client";
import SearchDialog from "./SearchDialog";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/sessions", label: "Sessions" },
  { to: "/projects", label: "Projects" },
  { to: "/user", label: "User & System" },
];

export default function NavBar() {
  const { data } = useDashboard();
  const activeCount = data?.stats.activeSessions ?? 0;
  const [searchOpen, setSearchOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <nav style={styles.nav}>
        <div style={styles.left}>
          <span style={styles.logo}>
            <span style={styles.logoMark}>◆</span> AgentsPulse
          </span>
          <div style={styles.links}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  ...styles.link,
                  ...(isActive ? styles.linkActive : {}),
                })}
              >
                {item.label}
                {item.label === "Sessions" && activeCount > 0 && (
                  <span style={styles.badge}>{activeCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
        <button
          style={styles.searchBtn}
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <span style={styles.searchIcon}>⌕</span>
          <span style={styles.searchText}>Search…</span>
          <kbd style={styles.kbd}>⌘K</kbd>
        </button>
      </nav>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    height: 56,
    borderBottom: "1px solid var(--border)",
    background: "var(--panel)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 32,
  },
  logo: {
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "-0.02em",
    color: "var(--text)",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  logoMark: {
    fontSize: 18,
    color: "var(--color-kiro)",
  },
  links: {
    display: "flex",
    gap: 4,
  },
  link: {
    padding: "6px 12px",
    borderRadius: 6,
    fontSize: 14,
    color: "var(--text-muted)",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.15s, color 0.15s",
  },
  linkActive: {
    color: "var(--text)",
    background: "#f5f5f4",
    fontWeight: 500,
  },
  badge: {
    background: "var(--status-active)",
    color: "#fff",
    fontSize: 11,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 10,
    lineHeight: "16px",
  },
  searchBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg)",
    color: "var(--text-muted)",
    fontSize: 13,
    cursor: "pointer",
  },
  searchIcon: {
    fontSize: 14,
  },
  searchText: {
    color: "var(--text-muted)",
  },
  kbd: {
    fontSize: 11,
    padding: "2px 5px",
    borderRadius: 4,
    border: "1px solid var(--border)",
    background: "var(--panel)",
    color: "var(--text-muted)",
    fontFamily: "var(--font-sans)",
  },
};
