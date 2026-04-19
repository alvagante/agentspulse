import type { SessionEvent } from "../types";

interface TimelineProps {
  events: SessionEvent[];
}

const dotColors: Record<string, string> = {
  user_prompt: "var(--color-kiro)",
  assistant_response: "var(--text-muted)",
  tool_call: "var(--color-opencode)",
  file_edit: "#b8963a",
  error: "var(--status-error)",
};

export default function Timeline({ events }: TimelineProps) {
  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      <div
        style={{
          position: "absolute",
          left: 5,
          top: 0,
          bottom: 0,
          width: 2,
          background: "var(--border)",
        }}
      />
      {events.map((event, i) => (
        <div key={i} style={{ position: "relative", paddingBottom: 16 }}>
          <span
            style={{
              position: "absolute",
              left: -24,
              top: 4,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: dotColors[event.type] ?? "var(--text-muted)",
              border: "2px solid var(--panel)",
            }}
          />
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {event.timestamp}
          </div>
          <div style={{ fontSize: 14, marginTop: 2 }}>
            {renderEventContent(event)}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderEventContent(event: SessionEvent): string {
  switch (event.type) {
    case "user_prompt":
      return event.text;
    case "assistant_response":
      return event.text;
    case "tool_call":
      return `${event.toolName}: ${event.input}`;
    case "file_edit":
      return `${event.filePath} (+${event.additions} -${event.deletions})`;
    case "error":
      return event.message;
    default:
      return "Unknown event";
  }
}
