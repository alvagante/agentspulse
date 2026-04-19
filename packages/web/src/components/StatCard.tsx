interface StatCardProps {
  value: string | number;
  label: string;
  subLabel?: string;
}

export default function StatCard({ value, label, subLabel }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "20px 24px",
      }}
    >
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, fontFamily: "var(--font-mono)" }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
        {label}
      </div>
      {subLabel && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {subLabel}
        </div>
      )}
    </div>
  );
}
