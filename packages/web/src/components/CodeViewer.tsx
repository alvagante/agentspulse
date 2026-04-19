interface CodeViewerProps {
  content: string;
  path: string;
  fileType: string;
  size?: number;
  lastModified?: string;
}

export default function CodeViewer({ content, path, fileType, size, lastModified }: CodeViewerProps) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "#f5f5f4",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          color: "var(--text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span>{path}</span>
        <span style={{ display: "flex", gap: 12 }}>
          <span>{fileType}</span>
          {size !== undefined && <span>{formatBytes(size)}</span>}
          {lastModified && <span>{lastModified}</span>}
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: 14,
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: "var(--font-mono)",
          overflow: "auto",
          background: "var(--panel)",
        }}
      >
        {content}
      </pre>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
