import { useState, useEffect, useCallback } from "react";
import { useTools, useConfigs, useArtifacts, useRescan, fetchConfigView } from "../api/client";
import ToolTag from "../components/ToolTag";
import FileTree, { type FileTreeItem } from "../components/FileTree";
import CodeViewer from "../components/CodeViewer";
import EmptyState from "../components/EmptyState";
import FilterBar from "../components/FilterBar";
import { ARTIFACT_CATEGORY_LABELS } from "../constants";
import { formatRelativeTime } from "../utils";
import type {
  ToolId,
  ToolSummary,
  ConfigFile,
  ToolArtifact,
  FileViewResult,
} from "../types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ViewMode = "grouped" | "tree" | "flat";

const VIEW_STORAGE_KEY = "agentspulse-user-view";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function UserSystemPage() {
  const { data: toolsData, isLoading: toolsLoading } = useTools();
  const { data: configsData, isLoading: configsLoading } = useConfigs();
  const { data: artifactsData, isLoading: artifactsLoading } = useArtifacts({
    scope: "user-home",
  });
  const rescan = useRescan();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grouped" || stored === "tree" || stored === "flat") return stored;
    return "grouped";
  });

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const isLoading = toolsLoading || configsLoading || artifactsLoading;

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading user &amp; system data…
      </div>
    );
  }

  const tools = toolsData?.tools ?? [];
  const configs = configsData?.configs ?? [];
  const artifacts = artifactsData?.artifacts ?? [];

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 4,
            }}
          >
            ~/.agentspulse / user
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>User &amp; System</h1>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
            Every AI-tool config file found at user-home or system level.
          </div>
        </div>
        <button
          onClick={() => rescan.mutate()}
          disabled={rescan.isPending}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            fontSize: 13,
            cursor: rescan.isPending ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: rescan.isPending ? 0.6 : 1,
          }}
        >
          {rescan.isPending ? "⟳ Scanning…" : "⟳ Rescan"}
        </button>
      </div>

      {/* View switcher tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20 }}>
        {([
          { key: "grouped" as ViewMode, label: "Grouped by Tool" },
          { key: "tree" as ViewMode, label: "File Tree + Viewer" },
          { key: "flat" as ViewMode, label: "Flat Searchable List" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            style={{
              padding: "8px 18px",
              fontSize: 13,
              border: "1px solid var(--border)",
              borderRight: tab.key === "flat" ? "1px solid var(--border)" : "none",
              borderRadius:
                tab.key === "grouped"
                  ? "8px 0 0 8px"
                  : tab.key === "flat"
                    ? "0 8px 8px 0"
                    : "0",
              background: viewMode === tab.key ? "var(--text)" : "var(--panel)",
              color: viewMode === tab.key ? "#fff" : "var(--text-muted)",
              cursor: "pointer",
              fontWeight: viewMode === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {tools.length === 0 && configs.length === 0 ? (
        <EmptyState
          message="No tools detected"
          guidance="Install an AI coding tool and run it once — its config files will appear here."
        />
      ) : (
        <>
          {viewMode === "grouped" && (
            <GroupedByToolView tools={tools} configs={configs} artifacts={artifacts} />
          )}
          {viewMode === "tree" && <FileTreeViewerView configs={configs} />}
          {viewMode === "flat" && <FlatSearchableView configs={configs} />}
        </>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  View A: Grouped by Tool                                            */
/* ------------------------------------------------------------------ */

function GroupedByToolView({
  tools,
  configs,
  artifacts,
}: {
  tools: ToolSummary[];
  configs: ConfigFile[];
  artifacts: ToolArtifact[];
}) {
  const [viewingFile, setViewingFile] = useState<FileViewResult | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const handleView = useCallback(async (path: string) => {
    setLoadingPath(path);
    try {
      const result = await fetchConfigView(path);
      setViewingFile(result);
    } catch {
      setViewingFile(null);
    } finally {
      setLoadingPath(null);
    }
  }, []);

  // Group configs by toolId
  const configsByTool = new Map<string, ConfigFile[]>();
  for (const c of configs) {
    const key = c.toolId;
    if (!configsByTool.has(key)) configsByTool.set(key, []);
    configsByTool.get(key)!.push(c);
  }

  // Group artifacts by toolId then category
  const artifactsByTool = new Map<string, Map<string, ToolArtifact[]>>();
  for (const a of artifacts) {
    if (!artifactsByTool.has(a.toolId)) artifactsByTool.set(a.toolId, new Map());
    const catMap = artifactsByTool.get(a.toolId)!;
    if (!catMap.has(a.category)) catMap.set(a.category, []);
    catMap.get(a.category)!.push(a);
  }

  return (
    <div>
      {viewingFile && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={() => setViewingFile(null)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕ Close viewer
            </button>
          </div>
          <CodeViewer
            content={viewingFile.readable ? viewingFile.content : viewingFile.error ?? "File not readable"}
            path={viewingFile.path}
            fileType={viewingFile.fileType}
            size={viewingFile.size}
            lastModified={formatDate(viewingFile.lastModified)}
          />
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {tools.map((tool) => {
          const toolConfigs = configsByTool.get(tool.toolId) ?? [];
          const toolArtifactCats = artifactsByTool.get(tool.toolId);

          return (
            <div
              key={tool.toolId}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              {/* Card header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <ToolTag toolId={tool.toolId} />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                >
                  {tool.homePath} · {tool.fileCount}
                </span>
              </div>

              {/* Config file list */}
              <div style={{ padding: "8px 16px" }}>
                {toolConfigs.length === 0 && (
                  <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }}>
                    No config files found.
                  </div>
                )}
                {toolConfigs.map((c) => (
                  <div
                    key={c.path}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.path}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatBytes(c.size)}
                    </span>
                    <button
                      onClick={() => handleView(c.path)}
                      disabled={loadingPath === c.path}
                      style={{
                        padding: "2px 10px",
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {loadingPath === c.path ? "…" : "view"}
                    </button>
                  </div>
                ))}

                {/* Artifacts grouped by category */}
                {toolArtifactCats && toolArtifactCats.size > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {Array.from(toolArtifactCats.entries()).map(([category, items]) => (
                      <div key={category} style={{ marginBottom: 8 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                            marginBottom: 4,
                            paddingTop: 4,
                          }}
                        >
                          {ARTIFACT_CATEGORY_LABELS[category] ?? category}
                        </div>
                        {items.map((a) => {
                          const fileName = a.path.split("/").pop() ?? a.path;
                          return (
                            <div
                              key={a.path}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto auto",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 0",
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 12,
                                  color: "var(--text-muted)",
                                }}
                              >
                                {fileName}
                              </span>
                              <span
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                }}
                              >
                                {formatBytes(a.size)}
                              </span>
                              <button
                                onClick={() => handleView(a.path)}
                                disabled={loadingPath === a.path}
                                style={{
                                  padding: "2px 10px",
                                  borderRadius: 4,
                                  border: "1px solid var(--border)",
                                  background: "var(--bg)",
                                  fontSize: 12,
                                  cursor: "pointer",
                                }}
                              >
                                {loadingPath === a.path ? "…" : "view"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  View B: File Tree + Viewer                                         */
/* ------------------------------------------------------------------ */

function FileTreeViewerView({ configs }: { configs: ConfigFile[] }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileView, setFileView] = useState<FileViewResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelect = useCallback(async (path: string) => {
    setSelectedPath(path);
    setLoading(true);
    try {
      const result = await fetchConfigView(path);
      setFileView(result);
    } catch {
      setFileView(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Build tree items grouped by home/system
  const treeItems = buildScopedTree(configs);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: 12,
        minHeight: 400,
      }}
    >
      {/* Left panel: File tree */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 8,
          overflow: "auto",
          maxHeight: "70vh",
        }}
      >
        {treeItems.length === 0 ? (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
            No config files found.
          </div>
        ) : (
          <FileTree items={treeItems} onSelect={handleSelect} />
        )}
      </div>

      {/* Right panel: Code viewer */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {!selectedPath && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Select a file from the tree to view its contents.
          </div>
        )}
        {selectedPath && loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Loading…
          </div>
        )}
        {selectedPath && !loading && fileView && (
          <CodeViewer
            content={fileView.readable ? fileView.content : fileView.error ?? "File not readable"}
            path={fileView.path}
            fileType={fileView.fileType}
            size={fileView.size}
            lastModified={formatDate(fileView.lastModified)}
          />
        )}
        {selectedPath && !loading && !fileView && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--status-error)",
              fontSize: 14,
            }}
          >
            Failed to load file.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Build a FileTreeItem[] grouped by scope (home / system).
 * Within each scope, group by tool directory.
 */
function buildScopedTree(configs: ConfigFile[]): FileTreeItem[] {
  const homeConfigs = configs.filter((c) => c.scope === "user-home");
  const systemConfigs = configs.filter((c) => c.scope === "system");

  const items: FileTreeItem[] = [];

  if (homeConfigs.length > 0) {
    items.push({
      name: "~/ (home)",
      type: "directory",
      children: buildToolGroupedChildren(homeConfigs),
    });
  }

  if (systemConfigs.length > 0) {
    items.push({
      name: "/etc (system)",
      type: "directory",
      children: buildToolGroupedChildren(systemConfigs),
    });
  }

  return items;
}

function buildToolGroupedChildren(configs: ConfigFile[]): FileTreeItem[] {
  // Group by toolId
  const byTool = new Map<string, ConfigFile[]>();
  for (const c of configs) {
    const key = c.toolId;
    if (!byTool.has(key)) byTool.set(key, []);
    byTool.get(key)!.push(c);
  }

  return Array.from(byTool.entries()).map(([toolId, files]) => ({
    name: toolId === "shared" ? "shared/" : `.${toolId}/`,
    type: "directory" as const,
    children: files.map((f) => ({
      name: f.path.split("/").pop() ?? f.path,
      type: "file" as const,
      path: f.path,
    })),
  }));
}


/* ------------------------------------------------------------------ */
/*  View C: Flat Searchable List                                       */
/* ------------------------------------------------------------------ */

type LocationFilter = "all" | "user-home" | "system";
type FileTypeFilter = "all" | "json" | "yaml-toml" | "markdown";

function FlatSearchableView({ configs }: { configs: ConfigFile[] }) {
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>("all");
  const [viewingFile, setViewingFile] = useState<FileViewResult | null>(null);
  const [loadingPath, setLoadingPath] = useState<string | null>(null);

  const handleView = useCallback(async (path: string) => {
    setLoadingPath(path);
    try {
      const result = await fetchConfigView(path);
      setViewingFile(result);
    } catch {
      setViewingFile(null);
    } finally {
      setLoadingPath(null);
    }
  }, []);

  // Apply filters
  let filtered = configs;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.path.toLowerCase().includes(q) ||
        c.toolId.toLowerCase().includes(q) ||
        c.fileType.toLowerCase().includes(q),
    );
  }

  if (locationFilter !== "all") {
    filtered = filtered.filter((c) => c.scope === locationFilter);
  }

  if (fileTypeFilter !== "all") {
    if (fileTypeFilter === "json") {
      filtered = filtered.filter((c) => c.fileType === "json");
    } else if (fileTypeFilter === "yaml-toml") {
      filtered = filtered.filter((c) => c.fileType === "yaml" || c.fileType === "toml");
    } else if (fileTypeFilter === "markdown") {
      filtered = filtered.filter((c) => c.fileType === "markdown");
    }
  }

  // Build filter chips for location
  const locationChips = [
    { label: `All ${configs.length}`, value: "all", active: locationFilter === "all" },
    { label: "user home", value: "user-home", active: locationFilter === "user-home" },
    { label: "system", value: "system", active: locationFilter === "system" },
  ];

  const fileTypeChips = [
    { label: "json", value: "json", active: fileTypeFilter === "json" },
    { label: "yaml/toml", value: "yaml-toml", active: fileTypeFilter === "yaml-toml" },
    { label: "markdown", value: "markdown", active: fileTypeFilter === "markdown" },
  ];

  return (
    <div>
      {/* Viewer overlay */}
      {viewingFile && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={() => setViewingFile(null)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--panel)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕ Close viewer
            </button>
          </div>
          <CodeViewer
            content={viewingFile.readable ? viewingFile.content : viewingFile.error ?? "File not readable"}
            path={viewingFile.path}
            fileType={viewingFile.fileType}
            size={viewingFile.size}
            lastModified={formatDate(viewingFile.lastModified)}
          />
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", width: 260 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              fontSize: 14,
              pointerEvents: "none",
            }}
          >
            ⌕
          </span>
          <input
            type="text"
            placeholder="filter configs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 10px 6px 30px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              background: "var(--bg)",
              outline: "none",
            }}
          />
        </div>

        <FilterBar
          filters={locationChips}
          onToggle={(val) =>
            setLocationFilter(val === locationFilter ? "all" : (val as LocationFilter))
          }
        />

        <div style={{ width: 1, height: 20, background: "var(--border)" }} />

        <FilterBar
          filters={fileTypeChips}
          onToggle={(val) =>
            setFileTypeFilter(val === fileTypeFilter ? "all" : (val as FileTypeFilter))
          }
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 80px 70px 70px 50px",
            padding: "10px 16px",
            fontSize: 12,
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
            fontWeight: 600,
          }}
        >
          <span>Tool</span>
          <span>Path</span>
          <span>Type</span>
          <span>Size</span>
          <span>Edited</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState message="No configs match filters" />
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.path}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 80px 70px 70px 50px",
                padding: "8px 16px",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
              }}
            >
              <span>
                {c.toolId !== "shared" ? (
                  <ToolTag toolId={c.toolId as ToolId} size="sm" />
                ) : (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>shared</span>
                )}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.path}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {c.fileType}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {formatBytes(c.size)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                {formatDate(c.lastModified)}
              </span>
              <button
                onClick={() => handleView(c.path)}
                disabled={loadingPath === c.path}
                style={{
                  padding: "2px 10px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {loadingPath === c.path ? "…" : "view"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
