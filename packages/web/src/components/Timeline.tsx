import { useState } from "react";
import type { SessionEvent } from "../types";

interface TimelineProps {
  events: SessionEvent[];
}

/* ── colour palette for event-type badges ── */

const badgeStyles: Record<string, { bg: string; fg: string; label: string }> = {
  user_prompt:        { bg: "#3a6b8a", fg: "#fff", label: "Prompt" },
  assistant_response: { bg: "#6a5a8a", fg: "#fff", label: "Agent" },
  tool_call:          { bg: "#3a8a6a", fg: "#fff", label: "" },       // label comes from toolName
  file_edit:          { bg: "#b8963a", fg: "#fff", label: "Edit" },
  error:              { bg: "#8a2a2a", fg: "#fff", label: "Error" },
};

/* ── specific tool-name badge colours ── */

const toolBadgeColors: Record<string, { bg: string; fg: string }> = {
  Read:            { bg: "#2563eb", fg: "#fff" },
  Bash:            { bg: "#c2410c", fg: "#fff" },
  Write:           { bg: "#16a34a", fg: "#fff" },
  Edit:            { bg: "#b8963a", fg: "#fff" },
  Grep:            { bg: "#7c3aed", fg: "#fff" },
  ToolSearch:      { bg: "#0d9488", fg: "#fff" },
  ExitPlanMode:    { bg: "#6b7280", fg: "#fff" },
  Agent:           { bg: "#6a5a8a", fg: "#fff" },
  Diff:            { bg: "#0891b2", fg: "#fff" },
  Search:          { bg: "#7c3aed", fg: "#fff" },
};

const DOT_SIZE = 10;
const LINE_LEFT = 4;       // centre of the dot on the vertical line
const CONTENT_LEFT = 28;   // left padding for content area

export default function Timeline({ events }: TimelineProps) {
  return (
    <div style={{ position: "relative", paddingLeft: CONTENT_LEFT }}>
      {/* vertical line */}
      <div
        style={{
          position: "absolute",
          left: LINE_LEFT,
          top: 0,
          bottom: 0,
          width: 2,
          background: "var(--border)",
        }}
      />
      {events.map((event, i) => (
        <TimelineEntry key={i} event={event} />
      ))}
    </div>
  );
}

/* ── Single timeline entry ── */

function TimelineEntry({ event }: { event: SessionEvent }) {
  const [expanded, setExpanded] = useState(false);
  const content = getEventContent(event);
  const truncated = content.length > 200;
  const displayText = truncated && !expanded ? content.slice(0, 200) + "…" : content;

  const badge = getBadge(event);
  const dotColor = badge.bg;

  return (
    <div
      style={{
        position: "relative",
        paddingBottom: 6,
        paddingTop: 6,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* dot */}
      <span
        style={{
          position: "absolute",
          left: -CONTENT_LEFT,
          top: 9,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          background: dotColor,
          border: "2px solid var(--panel)",
          zIndex: 1,
        }}
      />

      {/* top row: timestamp + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            flexShrink: 0,
            minWidth: 64,
          }}
        >
          {formatTimestamp(event.timestamp)}
        </span>
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            padding: "1px 8px",
            borderRadius: 4,
            background: badge.bg,
            color: badge.fg,
            whiteSpace: "nowrap",
            lineHeight: "18px",
            letterSpacing: 0.2,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* content */}
      {displayText && (
        <div
          style={{
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            color: "var(--text)",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginTop: 2,
            paddingLeft: 72,   // align with content after timestamp+badge
          }}
        >
          {displayText}
          {truncated && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-kiro)",
                fontSize: 12,
                cursor: "pointer",
                marginLeft: 4,
                padding: 0,
              }}
            >
              {expanded ? "show less" : "show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function getBadge(event: SessionEvent): { bg: string; fg: string; label: string } {
  if (event.type === "tool_call") {
    const toolColors = toolBadgeColors[event.toolName] ?? { bg: "#6b7280", fg: "#fff" };
    return { ...toolColors, label: event.toolName };
  }
  return badgeStyles[event.type] ?? { bg: "#6b7280", fg: "#fff", label: event.type };
}

function getEventContent(event: SessionEvent): string {
  switch (event.type) {
    case "user_prompt":
      return event.text;
    case "assistant_response":
      return event.text;
    case "tool_call":
      return event.input;
    case "file_edit":
      return `${event.filePath} (+${event.additions} −${event.deletions})`;
    case "error":
      return event.message;
    default:
      return "";
  }
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
