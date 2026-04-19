import { Link } from "react-router-dom";
import { useDashboard } from "../api/client";
import StatCard from "../components/StatCard";
import ToolTag from "../components/ToolTag";
import EmptyState from "../components/EmptyState";
import { formatRelativeTime, formatDuration } from "../utils";
import type { SessionSummary, ProjectSummary, ToolSummary } from "../types";

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--status-error)" }}>
        Failed to load dashboard data.
      </div>
    );
  }

  const { stats, activeSessions, recentProjects, toolSummaries } = data;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          ~/.agentspulse / dashboard
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          Active AI agent sessions, projects and tools on this machine.
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard value={stats.activeSessions} label="Active sessions" />
        <StatCard value={stats.sessionsThisWeek} label="Sessions this week" />
        <StatCard value={stats.projectsTouched} label="Projects touched" />
        <StatCard value={stats.toolsDetected} label="Tools detected" />
      </div>

      {/* Active sessions */}
      <ActiveSessionsSection sessions={activeSessions} />

      {/* Two-column: Recent projects + User & system config */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <RecentProjectsSection projects={recentProjects} />
        <ToolConfigSection tools={toolSummaries} />
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Active Sessions Section                                           */
/* ------------------------------------------------------------------ */

function ActiveSessionsSection({ sessions }: { sessions: SessionSummary[] }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: sessions.length > 0 ? "1px solid var(--border)" : "none",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          Active sessions{" "}
          <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 400 }}>
            · auto-refresh 5s
          </span>
        </h3>
        <Link
          to="/sessions"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          View all →
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div style={{ padding: 20 }}>
          <EmptyState
            message="No sessions running"
            guidance="Start any agent in a project — it will show here."
          />
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 120px 180px 100px 90px",
              padding: "8px 20px",
              fontSize: 12,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span />
            <span>Session</span>
            <span>Tool</span>
            <span>Project</span>
            <span>Duration</span>
            <span>Tokens</span>
          </div>

          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr 120px 180px 100px 90px",
                padding: "10px 20px",
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/* Live dot */}
              <span>
                <span className="status-dot status-dot--active" />
              </span>

              {/* Title */}
              <span style={{ fontWeight: 500, fontSize: 14 }}>{s.title}</span>

              {/* Tool */}
              <ToolTag toolId={s.toolId} size="sm" />

              {/* Project path */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.projectPath}
              </span>

              {/* Duration */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {formatDuration(s.durationMs)}
              </span>

              {/* Tokens */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {formatTokens(s.tokens)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}


/* ------------------------------------------------------------------ */
/*  Recent Projects Section                                           */
/* ------------------------------------------------------------------ */

function RecentProjectsSection({ projects }: { projects: ProjectSummary[] }) {
  const top5 = projects
    .slice()
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Recent projects</h3>
        <Link
          to="/projects"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          All {projects.length} →
        </Link>
      </div>

      {top5.length === 0 ? (
        <div style={{ padding: 20 }}>
          <EmptyState message="No projects detected" />
        </div>
      ) : (
        <div>
          {top5.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 12,
                padding: "10px 20px",
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.path}
                </div>
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                {p.tools.map((toolId) => (
                  <ToolTag key={toolId} toolId={toolId} size="sm" />
                ))}
              </div>

              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {formatRelativeTime(p.lastActivityAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  User & System Config Section                                      */
/* ------------------------------------------------------------------ */

function ToolConfigSection({ tools }: { tools: ToolSummary[] }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
          User &amp; system config
        </h3>
        <Link
          to="/user"
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          View →
        </Link>
      </div>

      {tools.length === 0 ? (
        <div style={{ padding: 20 }}>
          <EmptyState message="No tools detected" />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            padding: 16,
          }}
        >
          {tools.map((t) => (
            <Link
              key={t.toolId}
              to="/user"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 10,
                border: "1px solid var(--border)",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <ToolTag toolId={t.toolId} size="sm" />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                {t.homePath} · {t.fileCount} file{t.fileCount !== 1 ? "s" : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
