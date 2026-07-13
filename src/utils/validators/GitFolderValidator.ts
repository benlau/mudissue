import * as path from "path";
import { FileService } from "../../services/FileService.ts";
import { ShellService } from "../../services/ShellService.ts";
import type { ErrorResponse } from "../../types/Response.ts";

export class GitFolderValidator {
  private repoRoot: string = "";
  private readonly fileService: FileService;
  private readonly shellService: ShellService;

  constructor() {
    this.fileService = FileService.getInstance();
    this.shellService = ShellService.getInstance();
  }

  set(repoRoot: string): this {
    this.repoRoot = repoRoot;
    return this;
  }

  async validateDotGit(): Promise<this> {
    const gitPath = path.join(this.repoRoot, ".git");
    const exists = await this.fileService.exists(gitPath);
    if (!exists) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "DOT_GIT_NOT_FOUND",
          message: "Not a git repository (no .git at repo root).",
        },
      };
      throw response;
    }
    return this;
  }

  async validateGitBinary(): Promise<this> {
    const gitPath = await this.shellService.which("git");
    if (gitPath === null) {
      const response: ErrorResponse = {
        status: "error",
        error: {
          code: "GIT_BINARY_NOT_FOUND",
          message: "Git binary not found.",
        },
      };
      throw response;
    }
    return this;
  }
}
