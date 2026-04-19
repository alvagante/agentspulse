import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../api/client";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data } = useSearch(query);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        justifyContent: "center",
        paddingTop: 120,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          borderRadius: 12,
          width: 520,
          maxHeight: 420,
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions, projects, configs…"
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              fontSize: 15,
              background: "transparent",
              color: "var(--text)",
            }}
          />
        </div>
        <div style={{ overflow: "auto", padding: 8 }}>
          {data?.sessions.map((s) => (
            <div
              key={s.id}
              style={resultStyle}
              onClick={() => goTo(`/sessions/${s.id}`)}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Session</span>
              <span>{s.title}</span>
            </div>
          ))}
          {data?.projects.map((p) => (
            <div
              key={p.id}
              style={resultStyle}
              onClick={() => goTo(`/projects/${p.id}`)}
            >
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Project</span>
              <span>{p.name}</span>
            </div>
          ))}
          {query && !data?.sessions.length && !data?.projects.length && (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              No results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const resultStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
};
