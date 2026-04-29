import { readFile as fsReadFile, stat, realpath } from "node:fs/promises";
import { extname, resolve, relative } from "node:path";
import type { FileViewResult } from "../types.js";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_EXTENSIONS = new Set([
  ".json", ".yaml", ".yml", ".toml", ".md", ".txt", ".env", "",
]);

export class ConfigViewer {
  private readonly allowedBases: string[];

  constructor(allowedBases: string[]) {
    this.allowedBases = allowedBases.map((b) => resolve(b));
  }

  private async assertSafePath(filePath: string): Promise<void> {
    let abs: string;
    try {
      abs = await realpath(filePath);
    } catch {
      // File doesn't exist — fall back to lexical resolve so ENOENT is handled downstream
      abs = resolve(filePath);
    }
    const allowed = this.allowedBases.some(
      (base) => !relative(base, abs).startsWith("..")
    );
    if (!allowed) {
      throw Object.assign(new Error("Path outside allowed directories"), {
        code: "EPERM",
      });
    }
  }

  async readFile(filePath: string): Promise<FileViewResult> {
    const fileType = this.getFileType(filePath);

    // Fix #5: reject disallowed file types before touching the filesystem
    const ext = extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return {
        path: filePath, content: "", size: 0,
        lastModified: new Date(0), fileType, readable: false,
        error: "File type not allowed",
      };
    }

    // Fix #3: realpath-based traversal + symlink check
    await this.assertSafePath(filePath);

    try {
      const stats = await stat(filePath);

      // Fix #4: reject files above the size cap
      if (stats.size > MAX_FILE_SIZE) {
        return {
          path: filePath, content: "", size: stats.size,
          lastModified: stats.mtime, fileType, readable: false,
          error: "File too large to display (max 2 MB)",
        };
      }

      const content = await fsReadFile(filePath, "utf-8");
      return { path: filePath, content, size: stats.size, lastModified: stats.mtime, fileType, readable: true };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;

      if (error.code === "EACCES") {
        return {
          path: filePath, content: "", size: 0,
          lastModified: new Date(0), fileType, readable: false,
          error: "Permission denied: file is not readable",
        };
      }

      if (error.code === "ENOENT") {
        return {
          path: filePath, content: "", size: 0,
          lastModified: new Date(0), fileType, readable: false,
          error: "File not found",
        };
      }

      return {
        path: filePath, content: "", size: 0,
        lastModified: new Date(0), fileType, readable: false,
        error: (error as Error).message ?? "Unknown error reading file",
      };
    }
  }

  private getFileType(filePath: string): "json" | "yaml" | "toml" | "markdown" | "other" {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case ".json": return "json";
      case ".yaml":
      case ".yml":  return "yaml";
      case ".toml": return "toml";
      case ".md":   return "markdown";
      default:      return "other";
    }
  }
}
