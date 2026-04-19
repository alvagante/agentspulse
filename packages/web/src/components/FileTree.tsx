import { useState } from "react";

export interface FileTreeItem {
  name: string;
  type: "file" | "directory";
  children?: FileTreeItem[];
  path?: string;
}

interface FileTreeProps {
  items: FileTreeItem[];
  onSelect?: (path: string) => void;
}

export default function FileTree({ items, onSelect }: FileTreeProps) {
  return (
    <div style={{ fontSize: 13 }}>
      {items.map((item) => (
        <TreeNode key={item.name} item={item} depth={0} onSelect={onSelect} />
      ))}
    </div>
  );
}

function TreeNode({
  item,
  depth,
  onSelect,
}: {
  item: FileTreeItem;
  depth: number;
  onSelect?: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = item.type === "directory";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: depth * 16,
          padding: "3px 8px 3px " + depth * 16 + "px",
          cursor: isDir ? "pointer" : "default",
          borderRadius: 4,
        }}
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else if (item.path && onSelect) onSelect(item.path);
        }}
      >
        {isDir && (
          <span
            style={{
              display: "inline-block",
              width: 12,
              fontSize: 10,
              color: "var(--text-muted)",
              transition: "transform 0.15s",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            ▶
          </span>
        )}
        <span style={{ color: isDir ? "var(--text)" : "var(--text-muted)" }}>
          {isDir ? "📁" : "📄"} {item.name}
        </span>
      </div>
      {isDir && expanded && item.children?.map((child) => (
        <TreeNode key={child.name} item={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}
