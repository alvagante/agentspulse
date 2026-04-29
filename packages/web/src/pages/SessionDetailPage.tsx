import { useParams, Link } from "react-router-dom";
import { useSession, type SessionDetailResponse } from "../api/client";
import { formatDuration } from "../utils";
import ToolTag from "../components/ToolTag";
import Timeline from "../components/Timeline";
import DiffViewer from "../components/DiffViewer";
import type { Session, SessionConfig, FileChange, FileEditEvent } from "../types";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useSession(id ?? "");

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading session…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Session not found</div>
        <div style={{ color: "var(--text-muted)", marginBottom: 16 }}>
          The session you're looking for doesn't exist or couldn't be loaded.
        </div>
        <Link to="/sessions" style={{ color: "var(--color-kiro)" }}>
          ← Back to Sessions
        </Link>
      </div>
    );
  }

  const { session, files, config, sourceFiles } = data as SessionDetailResponse;

  return (
    <div style={{ padding: "0 24px 40px" }}>
      <Header session={session} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 24,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        <MainContent session={session} />
        <Sidebar session={session} files={files} config={config} sourceFiles={sourceFiles} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                            */
/* ------------------------------------------------------------------ */

function Header({ session }: { session: Session }) {
  const dotClass =
    session.status === "active"
      ? "status-dot status-dot--active"
      : session.status === "error"
        ? "status-dot status-dot--error"
        : session.status === "done"
          ? "status-dot status-dot--done"
          : "status-dot status-dot--idle";

  return (
    <div>
      {/* Breadcrumbs */}
      <div
        style={{
          fontSize: 13,
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        <Link to="/sessions" style={{ color: "var(--text-muted)" }}>
          Sessions
        </Link>
        {" / "}
        <span style={{ color: "var(--text)" }}>{session.title}</span>
      </div>

      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{session.title}</h1>
        <button
          onClick={() => handleExportJson(session)}
          style={{
            padding: "6px 14px",
            fontSize: 13,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "var(--panel)",
            cursor: "pointer",
          }}
        >
          ⇣ Export JSON
        </button>
      </div>

      {/* Meta chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 8,
          flexWrap: "wrap",
          fontSize: 13,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 10px",
            borderRadius: 12,
            background: "var(--panel)",
            border: "1px solid var(--border)",
          }}
        >
          <span className={dotClass} />
          {session.status}
          {session.status === "active" && session.durationMs > 0 && (
            <span style={{ color: "var(--text-muted)" }}>
              {" · "}
              {formatDuration(session.durationMs)}
            </span>
          )}
        </span>
        <ToolTag toolId={session.toolId} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{session.model}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          {session.projectPath}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          {new Date(session.startedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Content — Timeline                                           */
/* ------------------------------------------------------------------ */

function MainContent({ session }: { session: Session }) {
  const fileEditEvents = session.events.filter(
    (e): e is FileEditEvent => e.type === "file_edit" && !!e.diff
  );

  return (
    <div>
      {/* Timeline */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Timeline</h3>
        {session.events.length > 0 ? (
          <Timeline events={session.events} />
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No events recorded.</div>
        )}
      </div>

      {/* Diffs for file edits */}
      {fileEditEvents.map((event, i) => (
        <div
          key={i}
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: 20,
            marginTop: 16,
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
            <h3 style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)" }}>
              {event.filePath}
            </h3>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
              <span style={{ color: "#166534" }}>+{event.additions}</span>
              {" / "}
              <span style={{ color: "#991b1b" }}>−{event.deletions}</span>
            </span>
          </div>
          <DiffViewer diff={event.diff!} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */

function Sidebar({
  session,
  files,
  config,
  sourceFiles,
}: {
  session: Session;
  files: FileChange[];
  config: SessionConfig;
  sourceFiles: string[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Metadata */}
      <SidebarCard title="Overview">
        <MetaRow label="Model" value={session.model} />
        <MetaRow
          label="Tokens"
          value={`${formatTokens(session.tokens.used)} / ${formatTokens(session.tokens.limit)}`}
        />
        <MetaRow label="Cost" value={`$${session.estimatedCost.toFixed(2)}`} />
        <MetaRow label="Duration" value={formatDuration(session.durationMs)} />
        <MetaRow label="Messages" value={String(session.messageCount)} />
        <MetaRow label="Tool calls" value={String(session.toolCallCount)} />
        <MetaRow label="Files" value={String(session.filesModified.length)} />
        <MetaRow
          label="Net"
          value={
            <span>
              <span style={{ color: "#166534" }}>+{session.netLines.additions}</span>
              {" / "}
              <span style={{ color: "#991b1b" }}>−{session.netLines.deletions}</span>
            </span>
          }
        />
      </SidebarCard>

      {/* Files modified */}
      <SidebarCard title="Files modified">
        {files.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No files modified.</div>
        )}
        {files.map((f, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              padding: "4px 0",
              fontSize: 12,
              gap: 8,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                wordBreak: "break-all",
                marginRight: 8,
              }}
            >
              {f.filePath}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
              <span style={{ color: "#166534" }}>+{f.additions}</span>
              {" "}
              <span style={{ color: "#991b1b" }}>−{f.deletions}</span>
            </span>
          </div>
        ))}
      </SidebarCard>

      {/* Source files */}
      <SidebarCard title="Source files">
        {sourceFiles.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No source files.</div>
        )}
        {sourceFiles.map((path, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              padding: "3px 0",
              wordBreak: "break-all",
              color: "var(--text-muted)",
            }}
          >
            {path}
          </div>
        ))}
      </SidebarCard>

      {/* Session config */}
      <SidebarCard title="Config">
        <MetaRow label="Model" value={config.model} />
        {config.tools.length > 0 && (
          <MetaRow label="Tools" value={config.tools.join(", ")} />
        )}
        {config.systemPrompt && (
          <MetaRow label="System prompt" value={config.systemPrompt} mono />
        )}
      </SidebarCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared small components                                           */
/* ------------------------------------------------------------------ */

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 16,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-mono)",
          fontSize: 12,
          textAlign: "right",
          maxWidth: "60%",
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
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function handleExportJson(session: Session) {
  const json = JSON.stringify(session, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session-${session.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
