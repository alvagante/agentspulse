interface EmptyStateProps {
  message: string;
  guidance?: string;
}

export default function EmptyState({ message, guidance }: EmptyStateProps) {
  return (
    <div
      style={{
        border: "2px dashed var(--border)",
        borderRadius: 10,
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 500 }}>
        {message}
      </div>
      {guidance && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
          {guidance}
        </div>
      )}
    </div>
  );
}
