interface DiffViewerProps {
  diff: string;
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  const lines = diff.split("\n");

  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        lineHeight: 1.6,
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "auto",
      }}
    >
      {lines.map((line, i) => {
        let bg = "transparent";
        let color = "var(--text)";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          bg = "#dcfce7";
          color = "#166534";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          bg = "#fee2e2";
          color = "#991b1b";
        } else if (line.startsWith("@@")) {
          bg = "#eff6ff";
          color = "#1e40af";
        }

        return (
          <div
            key={i}
            style={{
              display: "flex",
              background: bg,
              padding: "0 12px",
              minHeight: 22,
            }}
          >
            <span
              style={{
                width: 40,
                flexShrink: 0,
                color: "var(--text-muted)",
                textAlign: "right",
                paddingRight: 12,
                userSelect: "none",
              }}
            >
              {i + 1}
            </span>
            <span style={{ color, whiteSpace: "pre" }}>{line}</span>
          </div>
        );
      })}
    </div>
  );
}
