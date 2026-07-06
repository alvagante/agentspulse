import { execFile } from "node:child_process";
import { copyFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function querySqliteJson<T>(
  dbPath: string,
  query: string
): Promise<T[]> {
  try {
    return await querySqliteJsonDirect<T>(dbPath, query);
  } catch {
    return querySqliteJsonFromCopy<T>(dbPath, query);
  }
}

async function querySqliteJsonDirect<T>(
  dbPath: string,
  query: string
): Promise<T[]> {
  const { stdout } = await execFileAsync("sqlite3", [
    "-readonly",
    "-json",
    dbPath,
    query,
  ]);
  if (!stdout.trim()) return [];
  return JSON.parse(stdout) as T[];
}

async function querySqliteJsonFromCopy<T>(
  dbPath: string,
  query: string
): Promise<T[]> {
  const copyPath = join(
    snapshotBaseDir(),
    `agentspulse-sqlite-${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.db`
  );

  try {
    await copyFile(dbPath, copyPath);
    await writeFile(`${copyPath}-wal`, "");
    return await querySqliteJsonDirect<T>(copyPath, query);
  } finally {
    await rm(copyPath, { force: true });
    await rm(`${copyPath}-wal`, { force: true });
    await rm(`${copyPath}-shm`, { force: true });
  }
}

function snapshotBaseDir(): string {
  return process.platform === "darwin" ? "/private/tmp" : tmpdir();
}
