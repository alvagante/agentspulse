import { readFile as fsReadFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import type { FileViewResult } from "../types.js";

/**
 * Reads and returns file contents for display in the UI.
 */
export class ConfigViewer {
  /** Read a file and return its contents with metadata */
  async readFile(filePath: string): Promise<FileViewResult> {
    const fileType = this.getFileType(filePath);

    try {
      const [content, stats] = await Promise.all([
        fsReadFile(filePath, "utf-8"),
        stat(filePath),
      ]);

      return {
        path: filePath,
        content,
        size: stats.size,
        lastModified: stats.mtime,
        fileType,
        readable: true,
      };
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException;

      if (error.code === "EACCES") {
        return {
          path: filePath,
          content: "",
          size: 0,
          lastModified: new Date(0),
          fileType,
          readable: false,
          error: "Permission denied: file is not readable",
        };
      }

      if (error.code === "ENOENT") {
        return {
          path: filePath,
          content: "",
          size: 0,
          lastModified: new Date(0),
          fileType,
          readable: false,
          error: "File not found",
        };
      }

      return {
        path: filePath,
        content: "",
        size: 0,
        lastModified: new Date(0),
        fileType,
        readable: false,
        error: error.message ?? "Unknown error reading file",
      };
    }
  }

  /** Determine file type from extension */
  private getFileType(
    filePath: string
  ): "json" | "yaml" | "toml" | "markdown" | "other" {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case ".json":
        return "json";
      case ".yaml":
      case ".yml":
        return "yaml";
      case ".toml":
        return "toml";
      case ".md":
        return "markdown";
      default:
        return "other";
    }
  }
}
