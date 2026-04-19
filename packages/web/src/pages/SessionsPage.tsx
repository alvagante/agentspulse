import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSessions } from "../api/client";
import FilterBar from "../components/FilterBar";
import ToolTag from "../components/ToolTag";
import EmptyState from "../components/EmptyState";
import { formatRelativeTime, formatDuration } from "../utils";
import type { ToolId, SessionStatus, SessionFilter, SessionSummary } from "../types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TOOLS: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Kiro", value: "kiro" },
  { label: "Claude Code", value: "claude" },
  { label: "Gemini", value: "gemini" },
  { label: "OpenCode", value: "opencode" },
  { label: "Continue", value: "continue" },
  { label: "Codex", value: "codex" },
  { label: "Cline", value: "cline" },
  { label: "OpenClaw", value: "openclaw" },
  { label: "NemoClaw", value: "nemoclaw" },
];

const STATUSES: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Done", value: "done" },
  { label: "Error", value: "error" },
  { label: "Archived", value: "archived" },
];

const DATE_RANGES: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

type ViewMode = "grouped" | "table" | "kanban";

const VIEW_STORAGE_KEY = "agentspulse-sessions-view";

function getInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grouped" || stored === "table" || stored === "kanban") return stored;
  } catch { /* ignore */ }
  return "grouped";
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function SessionsPage() {
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialView);
  const [sortBy, setSortBy] = useState<SessionFilter["sortBy"]>("startedAt");
  const [sortOrder, setSortOrder] = useState<SessionFilter["sortOrder"]>("desc");
  const [page, setPage] = useState(1);
  const limit = 20;

  const filter: SessionFilter = {
    tool: toolFilter !== "all" ? (toolFilter as ToolId) : undefined,
    status: statusFilter !== "all" ? (statusFilter as SessionStatus) : undefined,
    dateRange: dateFilter !== "all" ? (dateFilter as SessionFilter["dateRange"]) : undefined,
    sortBy,
    sortOrder,
    page,
    limit,
  };

  const { data, isLoading, error } = useSessions(filter);
  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;

  const navigate = useNavigate();

  function switchView(mode: ViewMode) {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_STORAGE_KEY, mode); } catch { /* ignore */ }
  }

  const toolFilters = TOOLS.map((t) => ({
    label: t.label,
    value: t.value,
    active: toolFilter === t.value,
  }));

  const statusFilters = STATUSES.map((s) => ({
    label: s.label,
    value: s.value,
    active: statusFilter === s.value,
  }));

  const dateFilters = DATE_RANGES.map((d) => ({
    label: d.label,
    value: d.value,
    active: dateFilter === d.value,
  }));

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading sessions…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--status-error)" }}>
        Failed to load sessions.
      </div>
    );
  }

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
          ~/.agentspulse / sessions
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Sessions</h1>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
          All agent sessions — active and archived — across every detected tool.
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>Tool</div>
          <FilterBar filters={toolFilters} onToggle={setToolFilter} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>Status</div>
          <FilterBar filters={statusFilters} onToggle={setStatusFilter} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>Date</div>
          <FilterBar filters={dateFilters} onToggle={setDateFilter} />
        </div>
      </div>

      {/* View switcher */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
        {([
          ["grouped", "Grouped by Project"],
          ["table", "Flat Table"],
          ["kanban", "Kanban by Status"],
        ] as [ViewMode, string][]).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => switchView(mode)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: viewMode === mode ? 600 : 400,
              border: "1px solid var(--border)",
              borderRight: mode === "kanban" ? "1px solid var(--border)" : "none",
              borderRadius:
                mode === "grouped"
                  ? "8px 0 0 8px"
                  : mode === "kanban"
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
      {sessions.length === 0 ? (
        <EmptyState message="No sessions match filters" />
      ) : viewMode === "grouped" ? (
        <GroupedView sessions={sessions} navigate={navigate} />
      ) : viewMode === "table" ? (
        <FlatTableView
          sessions={sessions}
          total={total}
          page={page}
          limit={limit}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={(col) => {
            if (sortBy === col) {
              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
            } else {
              setSortBy(col);
              setSortOrder("desc");
            }
          }}
          onPageChange={setPage}
          navigate={navigate}
        />
      ) : (
        <KanbanView sessions={sessions} navigate={navigate} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusDotClass(status: SessionStatus): string {
  switch (status) {
    case "active": return "status-dot status-dot--active";
    case "done": return "status-dot status-dot--done";
    case "error": return "status-dot status-dot--error";
    case "archived": return "status-dot status-dot--idle";
    default: return "status-dot";
  }
}

function statusLabel(status: SessionStatus): string {
  switch (status) {
    case "active": return "running";
    case "done": return "done";
    case "error": return "error";
    case "archived": return "archived";
    default: return status;
  }
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/* ------------------------------------------------------------------ */
/*  Grouped by Project View                                            */
/* ------------------------------------------------------------------ */

interface GroupedViewProps {
  sessions: SessionSummary[];
  navigate: (path: string) => void;
}

function GroupedView({ sessions, navigate }: GroupedViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; path: string; sessions: SessionSummary[] }>();
    for (const s of sessions) {
      const key = s.projectPath;
      if (!map.has(key)) {
        map.set(key, { name: s.projectName, path: s.projectPath, sessions: [] });
      }
      map.get(key)!.sessions.push(s);
    }
    return Array.from(map.values());
  }, [sessions]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((group) => (
        <div key={group.path}>
          {/* Project heading */}
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {group.name}{" "}
              <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 14 }}>
                · {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
              </span>
            </h2>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              {group.path}
            </div>
          </div>

          {/* Sessions card */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
          >
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr 110px 90px 90px 130px",
                padding: "8px 16px",
                fontSize: 12,
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span />
              <span>Title</span>
              <span>Tool</span>
              <span>Status</span>
              <span>Tokens</span>
              <span>Started</span>
            </div>

            {group.sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/sessions/${s.id}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr 110px 90px 90px 130px",
                  padding: "10px 16px",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <span><span className={statusDotClass(s.status)} /></span>
                <span style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title}
                </span>
                <ToolTag toolId={s.toolId} size="sm" />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                  {statusLabel(s.status)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                  {formatTokens(s.tokens)}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                  {formatRelativeTime(s.startedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flat Table View                                                    */
/* ------------------------------------------------------------------ */

interface FlatTableViewProps {
  sessions: SessionSummary[];
  total: number;
  page: number;
  limit: number;
  sortBy?: SessionFilter["sortBy"];
  sortOrder?: SessionFilter["sortOrder"];
  onSort: (col: NonNullable<SessionFilter["sortBy"]>) => void;
  onPageChange: (page: number) => void;
  navigate: (path: string) => void;
}

function FlatTableView({
  sessions,
  total,
  page,
  limit,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  navigate,
}: FlatTableViewProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));

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
          gridTemplateColumns: "24px 2fr 1fr 1.2fr 90px 70px 80px 110px",
          padding: "8px 16px",
          fontSize: 12,
          color: "var(--text-muted)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span />
        {/* Title - sortable */}
        <SortHeader label="Title" colKey="title" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
        <span>Tool</span>
        <span>Project</span>
        <span>Status</span>
        <SortHeader label="Dur." colKey="duration" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
        <SortHeader label="Tokens" colKey="tokens" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
        <SortHeader label="Started" colKey="startedAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      </div>

      {/* Rows */}
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => navigate(`/sessions/${s.id}`)}
          style={{
            display: "grid",
            gridTemplateColumns: "24px 2fr 1fr 1.2fr 90px 70px 80px 110px",
            padding: "10px 16px",
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
            cursor: "pointer",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        >
          <span><span className={statusDotClass(s.status)} /></span>
          <span style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.title}
          </span>
          <ToolTag toolId={s.toolId} size="sm" />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.projectName}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
            {statusLabel(s.status)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
            {formatDuration(s.durationMs)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
            {formatTokens(s.tokens)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
            {formatRelativeTime(s.startedAt)}
          </span>
        </div>
      ))}

      {/* Pagination */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
          {sessions.length} of {total} sessions
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <PaginationButton
            label="‹ Prev"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
          <span
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--text-muted)",
            }}
          >
            {page} / {totalPages}
          </span>
          <PaginationButton
            label="Next ›"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  colKey,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  colKey: NonNullable<SessionFilter["sortBy"]>;
  sortBy?: SessionFilter["sortBy"];
  sortOrder?: SessionFilter["sortOrder"];
  onSort: (col: NonNullable<SessionFilter["sortBy"]>) => void;
}) {
  const active = sortBy === colKey;
  const arrow = active ? (sortOrder === "asc" ? " ▴" : " ▾") : "";
  return (
    <span
      onClick={() => onSort(colKey)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        fontWeight: active ? 600 : 400,
        color: active ? "var(--text)" : undefined,
      }}
    >
      {label}{arrow}
    </span>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px",
        fontSize: 12,
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: disabled ? "var(--bg)" : "var(--panel)",
        color: disabled ? "var(--text-muted)" : "var(--text)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban by Status View                                              */
/* ------------------------------------------------------------------ */

const KANBAN_COLUMNS: { status: SessionStatus; label: string }[] = [
  { status: "active", label: "Running" },
  { status: "done", label: "Done" },
  { status: "error", label: "Errored" },
  { status: "archived", label: "Archived" },
];

interface KanbanViewProps {
  sessions: SessionSummary[];
  navigate: (path: string) => void;
}

function KanbanView({ sessions, navigate }: KanbanViewProps) {
  const buckets = useMemo(() => {
    const map: Record<SessionStatus, SessionSummary[]> = {
      active: [],
      done: [],
      error: [],
      archived: [],
    };
    for (const s of sessions) {
      if (map[s.status]) map[s.status].push(s);
    }
    return map;
  }, [sessions]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        alignItems: "start",
      }}
    >
      {KANBAN_COLUMNS.map(({ status, label }) => {
        const items = buckets[status];
        return (
          <div
            key={status}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 12,
              minHeight: 120,
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                {label}{" "}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  · {items.length}
                </span>
              </h3>
              {(status === "active" || status === "error") && (
                <span className={statusDotClass(status)} />
              )}
            </div>

            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  style={{
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 10,
                    cursor: "pointer",
                    transition: "box-shadow 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <ToolTag toolId={s.toolId} size="sm" />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--text-muted)",
                      }}
                    >
                      {formatDuration(s.durationMs)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.projectName} · {formatTokens(s.tokens)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
