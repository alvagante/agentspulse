import { describe, it, expect } from "vitest";
import { ConfigViewer } from "./config-viewer.js";
import { homedir } from "node:os";
import { join } from "node:path";

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
});
