interface SparklineProps {
  data: number[];
  height?: number;
}

export default function Sparkline({ data, height = 24 }: SparklineProps) {
  const max = Math.max(...data, 1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        height,
      }}
    >
      {data.map((v, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            minWidth: 2,
            height: Math.max(1, (v / max) * height),
            background: v > 0 ? "var(--color-kiro)" : "var(--border)",
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}
