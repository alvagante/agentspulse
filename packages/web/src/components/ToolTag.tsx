import { TOOL_COLORS, TOOL_DISPLAY_NAMES } from "../constants";
import type { ToolId } from "../types";

interface ToolTagProps {
  toolId: ToolId;
  size?: "sm" | "md";
}

export default function ToolTag({ toolId, size = "md" }: ToolTagProps) {
  const color = TOOL_COLORS[toolId] ?? "#888";
  const name = TOOL_DISPLAY_NAMES[toolId] ?? toolId;
  const px = size === "sm" ? 8 : 10;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: size === "sm" ? 12 : 13,
        color: "var(--text)",
      }}
    >
      <span
        style={{
          width: px,
          height: px,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      {name}
    </span>
  );
}
