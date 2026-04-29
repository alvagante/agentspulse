import { useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useProject, type ProjectDetailResponse, fetchArtifactView, fetchConfigView } from "../api/client";
import StatCard from "../components/StatCard";
import ToolTag from "../components/ToolTag";
import Sparkline from "../components/Sparkline";
import FileTree, { type FileTreeItem } from "../components/FileTree";
import CodeViewer from "../components/CodeViewer";
import { formatRelativeTime } from "../utils";
import { TOOL_COLORS, TOOL_DISPLAY_NAMES, ARTIFACT_CATEGORY_LABELS } from "../constants";
import type {
  Project,
  SessionSummary,
  ToolBreakdownEntry,
  ToolArtifact,
  ConfigFile,
  GitInfo,
  Dependency,
  ToolId,
  FileViewResult,
} from "../types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function statusDotClass(status: string): string {
  switch (status) {
    case "active":
      return "status-dot status-dot--active";
    case "error":
      return "status-dot status-dot--error";
    case "done":
      return "status-dot status-dot--done";
    default:
      return "status-dot status-dot--idle";
  }
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useProject(id ?? "");

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading project…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Project not found</div>
        <div style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          The project you're looking for doesn't exist or couldn't be loaded.
        </div>
        <Link to="/projects" style={{ color: "var(--color-kiro)" }}>
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const {
    project,
    stats,
    sessions,
    toolBreakdown,
    artifacts,
    configs,
    gitInfo,
    dependencies,
    activitySparkline,
  } = data as ProjectDetailResponse;

  return (
    <div>
      {/* Header */}
      <HeaderSection project={project} />

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          value={stats.totalSessions}
          label="Total sessions"
        />
        <StatCard
          value={stats.toolsUsed.length}
          label="Tools used"
          subLabel={stats.toolsUsed.map((t) => TOOL_DISPLAY_NAMES[t] ?? t).join(" · ")}
        />
        <StatCard
          value={formatTokens(stats.totalTokens)}
          label="Tokens total"
          subLabel={`$${stats.estimatedCost.toFixed(2)} est.`}
        />
        <StatCard
          value={`+${formatTokens(stats.netLines.additions)}`}
          label="Lines by agents"
          subLabel={`+${stats.netLines.additions} / −${stats.netLines.deletions}`}
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ActivitySparklineSection data={activitySparkline} />
          <SessionsSection sessions={sessions} totalCount={stats.totalSessions} projectId={id!} />
          <GitSection gitInfo={gitInfo} />
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ToolBreakdownSection breakdown={toolBreakdown} />
          <ConfigTreeSection project={project} configs={configs} />
          <ArtifactsSection artifacts={artifacts} />
          <DependenciesSection dependencies={dependencies} />
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Header                                                             */
/* ------------------------------------------------------------------ */

function HeaderSection({ project }: { project: Project }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {/* Breadcrumbs */}
      <div
        style={{
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          marginBottom: 4,
        }}
      >
        <Link to="/projects" style={{ color: "var(--text-muted)" }}>
          Projects
        </Link>
        {" / "}
        <span style={{ color: "var(--text)" }}>{project.name}</span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{project.name}</h1>

      {/* Meta row: path, git, runtime */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          flexWrap: "wrap",
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
        }}
      >
        <span>{project.path}</span>
        {project.gitInfo && (
          <>
            <span style={{ color: "var(--border)" }}>·</span>
            <span>
              git: {project.gitInfo.branch}
              {project.gitInfo.ahead > 0 && ` ● ${project.gitInfo.ahead} ahead`}
              {project.gitInfo.behind > 0 && ` ● ${project.gitInfo.behind} behind`}
            </span>
          </>
        )}
        {project.tools.length > 0 && (
          <>
            <span style={{ color: "var(--border)" }}>·</span>
            <span style={{ display: "flex", gap: 4 }}>
              {project.tools.map((toolId) => (
                <ToolTag key={toolId} toolId={toolId} size="sm" />
              ))}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity Sparkline                                                 */
/* ------------------------------------------------------------------ */

function ActivitySparklineSection({ data }: { data: number[] }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Activity · 30 days</h3>
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
          }}
        >
          sessions/day
        </span>
      </div>
      <Sparkline data={data} height={60} />
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Sessions List                                                      */
/* ------------------------------------------------------------------ */

function SessionsSection({
  sessions,
  totalCount,
  projectId,
}: {
  sessions: SessionSummary[];
  totalCount: number;
  projectId: string;
}) {
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
          borderBottom: sessions.length > 0 ? "1px solid var(--border)" : "none",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Sessions</h3>
        <Link
          to={`/sessions?projectId=${projectId}`}
          style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
        >
          All {totalCount} →
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div style={{ padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
          No sessions recorded for this project.
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr 110px 80px 90px",
              padding: "8px 20px",
              fontSize: 12,
              color: "var(--text-muted)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span />
            <span>Session</span>
            <span>Tool</span>
            <span>Status</span>
            <span>Date</span>
          </div>

          {sessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr 110px 80px 90px",
                padding: "10px 20px",
                alignItems: "center",
                textDecoration: "none",
                color: "inherit",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span>
                <span className={statusDotClass(s.status)} />
              </span>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{s.title}</span>
              <ToolTag toolId={s.toolId} size="sm" />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {s.status}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {formatRelativeTime(s.startedAt)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Git Activity                                                       */
/* ------------------------------------------------------------------ */

function GitSection({ gitInfo }: { gitInfo: GitInfo | null }) {
  if (!gitInfo) return null;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Git activity</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <GitRow label="Branch" value={gitInfo.branch} />
        <GitRow
          label="Last commit"
          value={`"${gitInfo.lastCommitMessage}" · ${formatRelativeTime(gitInfo.lastCommitAt)}`}
        />
        <GitRow
          label="Uncommitted"
          value={`${gitInfo.uncommittedCount} file${gitInfo.uncommittedCount !== 1 ? "s" : ""}`}
        />
        {(gitInfo.ahead > 0 || gitInfo.behind > 0) && (
          <GitRow
            label="Ahead / Behind"
            value={`${gitInfo.ahead} ahead · ${gitInfo.behind} behind`}
          />
        )}
      </div>
    </div>
  );
}

function GitRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
        fontSize: 13,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          textAlign: "right",
          maxWidth: "65%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Per-Tool Breakdown                                                 */
/* ------------------------------------------------------------------ */

function ToolBreakdownSection({ breakdown }: { breakdown: ToolBreakdownEntry[] }) {
  if (breakdown.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Per-tool breakdown</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {breakdown.map((entry) => {
          const color = TOOL_COLORS[entry.toolId] ?? "#888";
          return (
            <div
              key={entry.toolId}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 40px",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ToolTag toolId={entry.toolId} size="sm" />
              <div
                style={{
                  height: 8,
                  background: "var(--border)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.max(2, entry.proportion * 100)}%`,
                    background: color,
                    borderRadius: 4,
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  textAlign: "right",
                }}
              >
                {entry.sessionCount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Config File Tree                                                   */
/* ------------------------------------------------------------------ */

function ConfigTreeSection({ project, configs }: { project: Project; configs: ConfigFile[] }) {
  const [viewData, setViewData] = useState<FileViewResult | null>(null);
  const [loading, setLoading] = useState(false);

  const openConfig = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await fetchConfigView(path);
      setViewData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const treeItems = buildConfigTree(project.path, configs);

  if (treeItems.length === 0) return null;

  return (
    <>
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Config files present</h3>
        <FileTree items={treeItems} onSelect={openConfig} />
      </div>

      {/* Config viewer modal */}
      {(viewData || loading) && (
        <div
          onClick={() => setViewData(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 800,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {viewData?.path ?? "Loading…"}
              </span>
              <button
                onClick={() => setViewData(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--text-muted)",
                  lineHeight: 1,
                  padding: "0 4px",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ overflow: "auto", flexGrow: 1 }}>
              {loading && (
                <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>
                  Loading…
                </div>
              )}
              {viewData && !loading && (
                viewData.readable ? (
                  <CodeViewer
                    content={viewData.content}
                    path={viewData.path}
                    fileType={viewData.fileType}
                    size={viewData.size}
                    lastModified={viewData.lastModified}
                  />
                ) : (
                  <div style={{ padding: 24, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    {viewData.error ?? "File cannot be displayed."}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Build a FileTreeItem[] from real ConfigFile paths, grouped by parent directory. */
function buildConfigTree(_projectPath: string, configs: ConfigFile[]): FileTreeItem[] {
  // Group files by their immediate parent directory (full path)
  const dirMap = new Map<string, FileTreeItem[]>();

  for (const c of configs) {
    const parts = c.path.split("/");
    const fileName = parts[parts.length - 1];
    const dir = parts.slice(0, -1).join("/");

    if (!dirMap.has(dir)) dirMap.set(dir, []);
    dirMap.get(dir)!.push({ name: fileName, type: "file", path: c.path });
  }

  if (dirMap.size === 0) return [];

  return Array.from(dirMap.entries()).map(([dir, files]) => ({
    name: dir.split("/").pop()! + "/",
    type: "directory" as const,
    children: files,
  }));
}


/* ------------------------------------------------------------------ */
/*  Tool Artifacts                                                     */
/* ------------------------------------------------------------------ */

function ArtifactsSection({ artifacts }: { artifacts: ToolArtifact[] }) {
  const [viewData, setViewData] = useState<FileViewResult | null>(null);
  const [loading, setLoading] = useState(false);

  const openArtifact = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const result = await fetchArtifactView(path);
      setViewData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  if (artifacts.length === 0) return null;

  // Group by toolId, then by category
  const byTool = new Map<ToolId, Map<string, ToolArtifact[]>>();
  for (const a of artifacts) {
    if (!byTool.has(a.toolId)) byTool.set(a.toolId, new Map());
    const catMap = byTool.get(a.toolId)!;
    if (!catMap.has(a.category)) catMap.set(a.category, []);
    catMap.get(a.category)!.push(a);
  }

  return (
    <>
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Tool artifacts</h3>
        {Array.from(byTool.entries()).map(([toolId, catMap]) => (
          <div key={toolId} style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 6 }}>
              <ToolTag toolId={toolId} size="sm" />
            </div>
            {Array.from(catMap.entries()).map(([category, items]) => (
              <div key={category} style={{ marginBottom: 8, paddingLeft: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {ARTIFACT_CATEGORY_LABELS[category] ?? category}
                </div>
                {items.map((item) => {
                  const fileName = item.path.split("/").pop() ?? item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => openArtifact(item.path)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--color-kiro)",
                        padding: "2px 0",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: 3,
                      }}
                    >
                      {fileName}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Artifact viewer modal */}
      {(viewData || loading) && (
        <div
          onClick={() => setViewData(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              width: "100%",
              maxWidth: 800,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {viewData?.path ?? "Loading…"}
              </span>
              <button
                onClick={() => setViewData(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  color: "var(--text-muted)",
                  lineHeight: 1,
                  padding: "0 4px",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ overflow: "auto", flexGrow: 1 }}>
              {loading && (
                <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>
                  Loading…
                </div>
              )}
              {viewData && !loading && (
                viewData.readable ? (
                  <CodeViewer
                    content={viewData.content}
                    path={viewData.path}
                    fileType={viewData.fileType}
                    size={viewData.size}
                    lastModified={viewData.lastModified}
                  />
                ) : (
                  <div style={{ padding: 24, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    {viewData.error ?? "File cannot be displayed."}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Dependencies                                                       */
/* ------------------------------------------------------------------ */

const MAX_DEPS_SHOWN = 8;

function DependenciesSection({ dependencies }: { dependencies: Dependency[] }) {
  if (dependencies.length === 0) return null;

  const shown = dependencies.slice(0, MAX_DEPS_SHOWN);
  const remaining = dependencies.length - shown.length;

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Dependencies</h3>
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: "var(--text-muted)",
          }}
        >
          package.json
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {shown.map((dep) => (
          <span
            key={dep.name}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              padding: "3px 8px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
            }}
          >
            {dep.name} {dep.version}
          </span>
        ))}
        {remaining > 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              padding: "3px 8px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text-muted)",
            }}
          >
            + {remaining} more
          </span>
        )}
      </div>
    </div>
  );
}
