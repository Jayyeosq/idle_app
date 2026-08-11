import { promises as fs } from "fs";
import path from "path";

/**
 * Thin storage abstraction so the rest of the app doesn't talk to `fs`
 * directly. Everything currently lands on local disk under /data, which is
 * simple and matches the "each user has a markdown file" idea directly.
 *
 * IMPORTANT — read before deploying:
 * Serverless hosts (Vercel, most "git push to deploy" platforms) either
 * have a read-only filesystem or reset it on every deploy/cold start, so
 * writes made here will silently disappear in that environment. This is
 * fine for local dev and for self-hosting on a long-running server (a VPS,
 * a Docker container with a mounted volume, Fly.io, Railway, etc.) where
 * /data persists on disk.
 *
 * If you outgrow that, swap the two functions below for calls to a real
 * datastore (Postgres, SQLite via a volume, S3/Vercel Blob for the .md
 * files) without touching any calling code — everything else in the app
 * only ever calls readFile/writeFile/readJSON/writeJSON from this module.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const PROFILES_DIR = path.join(DATA_DIR, "profiles");

async function ensureDirs() {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
}

export async function readTextFile(relativePath: string): Promise<string | null> {
  await ensureDirs();
  try {
    return await fs.readFile(path.join(DATA_DIR, relativePath), "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function writeTextFile(relativePath: string, content: string): Promise<void> {
  await ensureDirs();
  const fullPath = path.join(DATA_DIR, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

export async function readJSON<T>(relativePath: string, fallback: T): Promise<T> {
  const raw = await readTextFile(relativePath);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON(relativePath: string, data: unknown): Promise<void> {
  await writeTextFile(relativePath, JSON.stringify(data, null, 2));
}

export function profileFilePath(userId: string): string {
  return path.join("profiles", `${userId}.md`);
}
