import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects, useRescan } from "../api/client";
import ToolTag from "../components/ToolTag";
import Sparkline from "../components/Sparkline";
import EmptyState from "../components/EmptyState";
import { formatRelativeTime } from "../utils";
import { TOOL_COLORS } from "../constants";
import type { Project, ToolId } from "../types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type ViewMode = "cards" | "tree" | "table";

const VIEW_STORAGE_KEY = "agentspulse-projects-view";

function getInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "cards" || stored === "tree" || stored === "table") return stored;
  } catch {
    /* ignore */
  }
  return "cards";
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ProjectsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialView);
  const { data, isLoading, error } = useProjects();
  const rescan = useRescan();
  const navigate = useNavigate();

  const projects: Project[] = data?.projects ?? [];

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  if (isLoading) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}
      >
        Loading projects…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{ padding: 40, textAlign: "center", color: "var(--status-error)" }}
      >
        Failed to load projects.
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            ~/.agentspulse / projects
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Projects</h1>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Directories where an AI agent has been invoked — detected via{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>.claude/</span>,{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>.kiro/</span>,{" "}
            <span style={{ fontFamily: "var(--font-mono)" }}>.opencode/</span>,
            etc.
          </div>
        </div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--panel)",
            color: rescan.isPending ? "var(--text-muted)" : "var(--text)",
            cursor: rescan.isPending ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          {rescan.isPending ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "2px solid var(--border)",
                  borderTopColor: "var(--text-muted)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Scanning…
            </>
          ) : (
            <>⟳ Rescan</>
          )}
        </button>
      </div>

      {/* View switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {(
          [
            ["cards", "Card Grid"],
            ["tree", "Filesystem Tree"],
            ["table", "Table with Heatmap"],
          ] as [ViewMode, string][]
        ).map(([mode, label], i, arr) => (
          <button
            key={mode}
            onClick={() => switchView(mode)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: viewMode === mode ? 600 : 400,
              border: "1px solid var(--border)",
              borderRight:
                i < arr.length - 1 ? "none" : "1px solid var(--border)",
              borderRadius:
                i === 0
                  ? "8px 0 0 8px"
                  : i === arr.length - 1
                    ? "0 8px 8px 0"
                    : "0",
              background: viewMode === mode ? "var(--text)" : "var(--panel)",
              color: viewMode === mode ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {projects.length === 0 ? (
        <EmptyState message="No projects detected" />
      ) : viewMode === "cards" ? (
        <CardGridView projects={projects} navigate={navigate} />
      ) : viewMode === "tree" ? (
        <FilesystemTreeView projects={projects} navigate={navigate} />
      ) : (
        <TableHeatmapView projects={projects} navigate={navigate} />
      )}

      {/* Spin animation for rescan button */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Card Grid View                                                     */
/* ------------------------------------------------------------------ */

interface ViewProps {
  projects: Project[];
  navigate: (path: string) => void;
}

function CardGridView({ projects, navigate }: ViewProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 16,
      }}
    >
      {projects.map((p) => (
        <div
          key={p.id}
          onClick={() => navigate(`/projects/${p.id}`)}
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 16,
            cursor: "pointer",
            transition: "box-shadow 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow =
              "0 2px 12px rgba(0,0,0,0.06)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
        >
          {/* Name + active/idle chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {p.name}
            </h3>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                padding: "2px 8px",
                borderRadius: 10,
                background: p.isActive
                  ? "rgba(47,107,58,0.1)"
                  : "rgba(168,162,158,0.15)",
                color: p.isActive
                  ? "var(--status-active)"
                  : "var(--status-idle)",
              }}
            >
              <span
                className={
                  p.isActive
                    ? "status-dot status-dot--active"
                    : "status-dot status-dot--idle"
                }
                style={{ width: 6, height: 6 }}
              />
              {p.isActive ? "active" : "idle"}
            </span>
          </div>

          {/* Path */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: 12,
            }}
          >
            {p.path}
          </div>

          {/* Tool tags */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 12,
            }}
          >
            {p.tools.map((toolId) => (
              <ToolTag key={toolId} toolId={toolId} size="sm" />
            ))}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                Sessions
              </div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {p.sessionCount}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                This week
              </div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {p.sessionsThisWeek}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                Tokens
              </div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {formatTokens(p.totalTokens)}
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <Sparkline data={p.activitySparkline} height={24} />

          {/* Last activity */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 8,
            }}
          >
            {formatRelativeTime(p.lastActivityAt)}
          </div>
        </div>
      ))}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Filesystem Tree View                                               */
/* ------------------------------------------------------------------ */

interface TreeGroup {
  parentDir: string;
  projects: Project[];
}

function groupByParentDir(projects: Project[]): TreeGroup[] {
  const map = new Map<string, Project[]>();
  for (const p of projects) {
    const lastSlash = p.path.lastIndexOf("/");
    const parent = lastSlash > 0 ? p.path.slice(0, lastSlash) : "/";
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([parentDir, projs]) => ({ parentDir, projects: projs }));
}

function FilesystemTreeView({ projects, navigate }: ViewProps) {
  const groups = useMemo(() => groupByParentDir(projects), [projects]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.parentDir)),
  );

  function toggle(dir: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 8,
      }}
    >
      {groups.map((group) => {
        const isOpen = expanded.has(group.parentDir);
        return (
          <div key={group.parentDir}>
            {/* Parent directory row */}
            <div
              onClick={() => toggle(group.parentDir)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                cursor: "pointer",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg)")
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  fontSize: 10,
                  color: "var(--text-muted)",
                  transition: "transform 0.15s",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                }}
              >
                ▶
              </span>
              <span>{group.parentDir}</span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  fontWeight: 400,
                }}
              >
                {group.projects.length} project
                {group.projects.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Project nodes */}
            {isOpen &&
              group.projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px 6px 36px",
                    cursor: "pointer",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "")
                  }
                >
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    📁
                  </span>
                  <span style={{ fontWeight: 500 }}>{p.name}/</span>
                  <span
                    style={{
                      display: "flex",
                      gap: 4,
                      alignItems: "center",
                    }}
                  >
                    {p.tools.map((toolId) => (
                      <span
                        key={toolId}
                        title={toolId}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background:
                            TOOL_COLORS[toolId as ToolId] ?? "#888",
                        }}
                      />
                    ))}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    · {p.sessionCount}
                  </span>
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Table with Heatmap View                                            */
/* ------------------------------------------------------------------ */

function TableHeatmapView({ projects, navigate }: ViewProps) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1.5fr 1fr 1.6fr 70px 70px 80px",
          padding: "8px 16px",
          fontSize: 12,
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span>Project</span>
        <span>Path</span>
        <span>Tools</span>
        <span>Activity · 14d</span>
        <span>Sess.</span>
        <span>Tokens</span>
        <span>Last</span>
      </div>

      {/* Rows */}
      {projects.map((p) => (
        <div
          key={p.id}
          onClick={() => navigate(`/projects/${p.id}`)}
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.5fr 1fr 1.6fr 70px 70px 80px",
            padding: "10px 16px",
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            cursor: "pointer",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg)")
          }
          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        >
          {/* Name */}
          <span style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</span>

          {/* Path */}
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
            {p.path}
          </span>

          {/* Tool indicators (colored dots) */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {p.tools.map((toolId) => (
              <span
                key={toolId}
                title={toolId}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: TOOL_COLORS[toolId as ToolId] ?? "#888",
                }}
              />
            ))}
          </div>

          {/* 14-day sparkline */}
          <Sparkline
            data={
              p.activitySparkline.length >= 14
                ? p.activitySparkline.slice(-14)
                : p.activitySparkline
            }
            height={20}
          />

          {/* Sessions */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {p.sessionCount}
          </span>

          {/* Tokens */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {formatTokens(p.totalTokens)}
          </span>

          {/* Last activity */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            {formatRelativeTime(p.lastActivityAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
