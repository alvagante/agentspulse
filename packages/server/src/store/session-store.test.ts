import { describe, it, expect } from "vitest";
import { SessionStore } from "./session-store.js";
import type { ScanResult, ConfigFile, ToolArtifact } from "../types.js";

function emptyResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    sessions: [],
    projects: [],
    configs: [],
    artifacts: [],
    errors: [],
    scannedAt: new Date(),
    durationMs: 0,
    ...overrides,
  };
}

describe("SessionStore.isViewableFilePath", () => {
  const config: ConfigFile = {
    path: "/home/user/.claude/settings.json",
    toolId: "claude",
    scope: "user-home",
    fileType: "json",
    size: 10,
    lastModified: new Date(),
  };
  const artifact: ToolArtifact = {
    path: "/home/user/.claude/agents/reviewer.md",
    toolId: "claude",
    category: "agents",
    scope: "user-home",
    fileType: "markdown",
    size: 20,
    lastModified: new Date(),
  };

  it("accepts a discovered config path", () => {
    const store = new SessionStore();
    store.update(emptyResult({ configs: [config] }));
    expect(store.isViewableFilePath(config.path)).toBe(true);
  });

  it("accepts a discovered artifact path", () => {
    const store = new SessionStore();
    store.update(emptyResult({ artifacts: [artifact] }));
    expect(store.isViewableFilePath(artifact.path)).toBe(true);
  });

  it("normalizes traversal in the request before matching", () => {
    const store = new SessionStore();
    store.update(emptyResult({ configs: [config] }));
    expect(
      store.isViewableFilePath("/home/user/.claude/../.claude/settings.json")
    ).toBe(true);
  });

  it("rejects an undiscovered path", () => {
    const store = new SessionStore();
    store.update(emptyResult({ configs: [config] }));
    expect(store.isViewableFilePath("/etc/passwd")).toBe(false);
    expect(store.isViewableFilePath("/home/user/.ssh/id_rsa")).toBe(false);
  });

  it("drops stale paths after a rescan replaces the data", () => {
    const store = new SessionStore();
    store.update(emptyResult({ configs: [config] }));
    store.update(emptyResult({ artifacts: [artifact] }));
    expect(store.isViewableFilePath(config.path)).toBe(false);
    expect(store.isViewableFilePath(artifact.path)).toBe(true);
  });
});
