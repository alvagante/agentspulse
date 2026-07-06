import { describe, it, expect } from "vitest";
import { ConfigViewer } from "./config-viewer.js";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";

describe("ConfigViewer path traversal guard", () => {
  const viewer = new ConfigViewer([join(homedir(), "Documents")]);

  it("rejects absolute paths outside allowed bases", async () => {
    const result = await viewer.readFile("/etc/passwd").catch((e) => e);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/outside allowed/);
  });

  it("rejects traversal sequences resolving outside allowed base", async () => {
    const sneaky = join(homedir(), "Documents", "..", "..", ".ssh", "id_rsa");
    const result = await viewer.readFile(sneaky).catch((e) => e);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/outside allowed/);
  });

  it("allows paths inside an allowed base (returns readable:false for missing file)", async () => {
    const safe = join(homedir(), "Documents", "nonexistent-file.md");
    const result = await viewer.readFile(safe);
    expect(result.readable).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("allows symlinked files when the symlink itself is inside an allowed base", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentspulse-viewer-"));
    const allowed = join(root, "allowed");
    const targetDir = join(root, "target");
    await mkdir(allowed);
    await mkdir(targetDir);

    const target = join(targetDir, "settings.json");
    const link = join(allowed, "settings.json");
    await writeFile(target, "{\"ok\":true}\n");
    await symlink(target, link);

    const result = await new ConfigViewer([allowed]).readFile(link);

    expect(result.readable).toBe(true);
    expect(result.content).toBe("{\"ok\":true}\n");
    expect(result.path).toBe(link);
  });
});
