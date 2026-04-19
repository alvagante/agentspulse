interface FilterItem {
  label: string;
  value: string;
  active: boolean;
}

interface FilterBarProps {
  filters: FilterItem[];
  onToggle: (value: string) => void;
}

export default function FilterBar({ filters, onToggle }: FilterBarProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onToggle(f.value)}
          style={{
            padding: "4px 12px",
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: f.active ? "var(--text)" : "var(--panel)",
            color: f.active ? "#fff" : "var(--text-muted)",
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
