import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
} from "@tanstack/react-query";
import type {
  SessionFilter,
  ArtifactFilter,
  SessionSummary,
  ProjectSummary,
  DashboardStats,
  ToolSummary,
  Session,
  SessionConfig,
  FileChange,
  Project,
  ProjectStats,
  ToolBreakdownEntry,
  ToolArtifact,
  ConfigFile,
  ScanError,
  FileViewResult,
  GitInfo,
  Dependency,
} from "../types";

// ============================================================
// QueryClient Configuration
// ============================================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ============================================================
// API Response Types
// ============================================================

export interface DashboardResponse {
  stats: DashboardStats;
  activeSessions: SessionSummary[];
  recentProjects: ProjectSummary[];
  toolSummaries: ToolSummary[];
  lastScanAt: string | null;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  page: number;
  limit: number;
  filters: {
    tool?: string;
    status?: string;
    dateRange?: string;
    projectId?: string;
  };
}

export interface SessionDetailResponse {
  session: Session;
  files: FileChange[];
  config: SessionConfig;
  sourceFiles: string[];
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectDetailResponse {
  project: Project;
  stats: ProjectStats;
  sessions: SessionSummary[];
  toolBreakdown: ToolBreakdownEntry[];
  artifacts: ToolArtifact[];
  gitInfo: GitInfo | null;
  dependencies: Dependency[];
  activitySparkline: number[];
}

export interface ConfigListResponse {
  configs: ConfigFile[];
}

export interface ArtifactListResponse {
  artifacts: ToolArtifact[];
}

export interface RescanResponse {
  success: boolean;
  scannedAt: string;
  durationMs: number;
  errors: ScanError[];
}

export interface ToolListResponse {
  tools: ToolSummary[];
}

export interface SearchResponse {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
  configs: ConfigFile[];
}


// ============================================================
// Fetch Functions
// ============================================================

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export function fetchDashboard(): Promise<DashboardResponse> {
  return fetchJson("/api/dashboard");
}

export function fetchSessions(filter?: SessionFilter): Promise<SessionListResponse> {
  const q = buildQuery({
    tool: filter?.tool,
    status: filter?.status,
    dateRange: filter?.dateRange,
    projectId: filter?.projectId,
    search: filter?.search,
    sortBy: filter?.sortBy,
    sortOrder: filter?.sortOrder,
    page: filter?.page,
    limit: filter?.limit,
  });
  return fetchJson(`/api/sessions${q}`);
}

export function fetchSession(id: string): Promise<SessionDetailResponse> {
  return fetchJson(`/api/sessions/${encodeURIComponent(id)}`);
}

export function fetchProjects(): Promise<ProjectListResponse> {
  return fetchJson("/api/projects");
}

export function fetchProject(id: string): Promise<ProjectDetailResponse> {
  return fetchJson(`/api/projects/${encodeURIComponent(id)}`);
}

export function fetchConfigs(filter?: { scope?: string; fileType?: string; tool?: string }): Promise<ConfigListResponse> {
  const q = buildQuery({
    scope: filter?.scope,
    fileType: filter?.fileType,
    tool: filter?.tool,
  });
  return fetchJson(`/api/configs${q}`);
}

export function fetchConfigView(path: string): Promise<FileViewResult> {
  return fetchJson(`/api/configs/view?path=${encodeURIComponent(path)}`);
}

export function fetchArtifacts(filter?: ArtifactFilter): Promise<ArtifactListResponse> {
  const q = buildQuery({
    tool: filter?.tool,
    category: filter?.category,
    scope: filter?.scope,
  });
  return fetchJson(`/api/artifacts${q}`);
}

export function fetchArtifactView(path: string): Promise<FileViewResult> {
  return fetchJson(`/api/artifacts/view?path=${encodeURIComponent(path)}`);
}

export function triggerRescan(): Promise<RescanResponse> {
  return fetchJson("/api/rescan", { method: "POST" });
}

export function fetchTools(): Promise<ToolListResponse> {
  return fetchJson("/api/tools");
}

export function fetchSearch(query: string): Promise<SearchResponse> {
  return fetchJson(`/api/search?q=${encodeURIComponent(query)}`);
}

// ============================================================
// TanStack Query Hooks
// ============================================================

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 5000,
  });
}

export function useSessions(filter?: SessionFilter) {
  return useQuery({
    queryKey: ["sessions", filter],
    queryFn: () => fetchSessions(filter),
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: ["session", id],
    queryFn: () => fetchSession(id),
    enabled: !!id,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

export function useConfigs(filter?: { scope?: string; fileType?: string; tool?: string }) {
  return useQuery({
    queryKey: ["configs", filter],
    queryFn: () => fetchConfigs(filter),
  });
}

export function useArtifacts(filter?: ArtifactFilter) {
  return useQuery({
    queryKey: ["artifacts", filter],
    queryFn: () => fetchArtifacts(filter),
  });
}

export function useTools() {
  return useQuery({
    queryKey: ["tools"],
    queryFn: fetchTools,
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearch(query),
    enabled: query.length > 0,
  });
}

export function useRescan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerRescan,
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}
