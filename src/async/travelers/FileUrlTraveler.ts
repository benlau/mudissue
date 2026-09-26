import * as path from "path";
import { pathToFileURL } from "url";
import type { Traveler } from "./Traveler.ts";
import { FileService } from "../../services/FileService.ts";
import { GitService } from "../../services/GitService.ts";
import { REGISTRY_FILE_TRAVELER_MAX_DEPTH } from "../../constants.ts";

export type FileUrlTravelerProps = {
  maxDepth?: number;
};

/**
 * Depth-bounded DFS for file:// URLs: start from path (or CWD), follow .git gitdir
 * then parent. Emits file:// URLs for each directory. Tracks visited paths to avoid cycles.
 */
export class FileUrlTraveler implements Traveler {
  private fileService: FileService;
  private gitService: GitService;
  private maxDepth: number;

  constructor(props?: FileUrlTravelerProps) {
    this.fileService = FileService.getInstance();
    this.gitService = GitService.getInstance();
    this.maxDepth = props?.maxDepth ?? REGISTRY_FILE_TRAVELER_MAX_DEPTH;
  }

  async travel(
    url: string,
    callback: (path: string) => Promise<boolean>,
  ): Promise<string | undefined> {
    const startPath = this.resolveStartPath(url);
    if (startPath === "") return undefined;
    const visited = new Set<string>();
    const result = await this.dfs(startPath, 0, visited, callback);
    return result;
  }

  /**
   * Resolves URL to filesystem path. Returns "" when input is "" (don't travel; don't use cwd).
   */
  private resolveStartPath(url: string): string {
    const trimmed = url.trim();
    if (trimmed === "") return "";
    if (trimmed.startsWith("file://")) {
      try {
        const u = new URL(trimmed);
        return path.resolve(decodeURIComponent(u.pathname));
      } catch {
        return "";
      }
    }
    return path.resolve(trimmed);
  }

  private pathToFileUrl(dirPath: string): string {
    const normalized = path.resolve(dirPath);
    const url = pathToFileURL(normalized + path.sep);
    let href = url.href;
    if (href.endsWith("/")) href = href.slice(0, -1);
    return href;
  }

  private async dfs(
    currentDir: string,
    depth: number,
    visited: Set<string>,
    callback: (path: string) => Promise<boolean>,
  ): Promise<string | undefined> {
    if (depth > this.maxDepth) return undefined;
    const normalized = path.resolve(currentDir);
    if (visited.has(normalized)) return undefined;
    visited.add(normalized);

    const fileUrl = this.pathToFileUrl(currentDir);
    const stop = await callback(fileUrl);
    if (stop) return fileUrl;

    const gitdirPath =
      await this.gitService.parseDotGitFileAtFolder(currentDir);
    if (gitdirPath !== null) {
      const exists = await this.fileService.exists(gitdirPath);
      if (exists) {
        const stat = await this.fileService.stat(gitdirPath);
        if (stat.isDirectory()) {
          const fromChild = await this.dfs(
            gitdirPath,
            depth + 1,
            visited,
            callback,
          );
          if (fromChild !== undefined) return fromChild;
        }
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    const fromParent = await this.dfs(parentDir, depth + 1, visited, callback);
    return fromParent;
  }
}
