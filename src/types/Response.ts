import type { ErrorCode } from "./errors.ts";
import type { ProjectIssueFolders } from "./Issue.ts";

/** Optional context for an error (path, property, issueId, etc.). */
export type ErrorDetail = Record<string, unknown>;

export interface ErrorResponse {
  status: "error";
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail;
  };
}

/** Shape used for unexpected exceptions in ErrorResponse. */
export type UnexpectedExceptionErrorResult = ErrorResponse["error"] & {
  code: "UNEXCEPTED_EXCEPTION";
  message: "Unexcepted exception error was caught";
  details: { errorMessage: string };
};

export interface SuccessResponse<T = unknown> {
  status: "ok";
  result: T;
}

/** Type guard for thrown value that is already an ErrorResponse. */
export function isErrorResponse(x: unknown): x is ErrorResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    "status" in x &&
    (x as ErrorResponse).status === "error"
  );
}

/**
 * Monad accessor to build an ErrorResponse from a caught Error (e.g. unexpected exceptions).
 * Use fromError(error).get() to obtain the ErrorResponse POJO.
 */
export class ErrorResponseAccessor {
  private data: ErrorResponse;

  private constructor(data: ErrorResponse) {
    this.data = data;
  }

  static fromError(error: Error): ErrorResponseAccessor {
    const errorMessage = error.message ?? String(error);
    const data: ErrorResponse = {
      status: "error",
      error: {
        code: "UNEXCEPTED_EXCEPTION",
        message: `Unexpected exception caught: ${errorMessage}`,
        details: { errorMessage },
      },
    };
    return new ErrorResponseAccessor(data);
  }

  get(): ErrorResponse {
    return this.data;
  }
}

export type IssueAttachCommandSuccessResult = {
  issueFolder: { absPath: string; folderName: string };
  attached: Array<{
    sourcePath: string;
    destPath: string;
    filename: string;
  }>;
};

export type IssueTagCommandSuccessResult = {
  issueFolder: string;
  tags: string[];
};

export type IssueUntagCommandSuccessResult = {
  issueFolder: string;
  tags: string[];
};

export type IssueLinkCommandSuccessResult = {
  srcIssueFolder: string;
  dstIssueFolder: string;
  linkType: string;
  srcField: string;
  dstField: string;
};

export type IssueUnlinkCommandSuccessResult = {
  srcIssueFolder: string;
  dstIssueFolder: string | null;
  linkType: string;
  srcField: string;
  dstField: string;
  dstNotFound?: boolean;
};

export type IssueCommentCommandSuccessResult = {
  issueFolder: string;
  issueFilePath: string;
  author: string;
  timestamp: string;
};

/** Generic reference to an issue file on disk. */
export type IssueResponse = {
  issueId: string;
  issueFolderName: string;
  issueFilePath: string;
};

export type IssueAppendCommandSuccessResult = IssueResponse;
export type IssuePrependCommandSuccessResult = IssueResponse;

export type IssueCreateCommandSuccessResult = {
  createdIssue: IssueResponse;
};

export type IssueWorktreePathSuccessResult = {
  worktree_path: string;
};

export type IssueWorktreeLocateCommandSuccessResult = {
  path: string;
};

export type IssueWorktreeListCommandSuccessResult = {
  paths: string[];
};

export type IssueWorktreeCreateGraphCommandSuccessResult = {
  mermaidGraph: string;
  path: string;
};

export type IssueWorktreeRemoveCommandSuccessResult = {
  path: string;
  branch?: string;
};

export type IssueWorktreeGitCommandSuccessResult = {
  cwd: string;
  command: string;
};

export type IssueBranchNameSuccessResult = {
  branch: string;
};

export type ConfigEditCommandSuccessResult = {
  openedFile: string;
  command: string;
};

export type IssueEditCommandSuccessResult = {
  openedFile: string;
  command: string;
};

export type RegistryGetCommandSuccessResult = {
  url: string;
  records: Record<string, string>;
};

export type InitCommandSuccessResult = {
  created: boolean;
  configPath: string;
};

export type ConfigLocateCommandSuccessResult = {
  path: string;
};

export type ConfigSetPropertyCommandSuccessResult = {
  configFilePath: string;
  property: string;
  value: unknown;
  skipped?: boolean;
};

export type ConfigGetPropertyCommandSuccessResult = {
  configFilePath: string;
  property: string;
  value: unknown;
};

export type IssueLocateCommandSuccessResult = {
  paths: string[];
};

export type TrackerRepoLocateCommandSuccessResult = {
  path: string;
};

export type TrackerRepoOpenCommandSuccessResult = {
  path: string;
};

export type TmuxRunCommandSuccessResult = {
  cwd: string;
  session_name: string;
};

export type IssueRenameCommandSuccessResult = {
  oldIssueFolderName: string;
  newIssueFolderName: string;
};

export type IssueChangeIdCommandSuccessResult = {
  oldIssueFolderName: string;
  newIssueFolderName: string;
};

export type IssueRemoveCommandSuccessResult = {
  removed: string[];
};

export type IssueArchiveCommandSuccessResult = {
  archivedIssue: IssueResponse;
  oldIssueFolderPath: string;
  newIssueFolderPath: string;
};

export type IssueMergeCommandSuccessResult = {
  createdIssue: IssueCreateCommandSuccessResult;
  archivedIssues: IssueArchiveCommandSuccessResult[];
};

export type SearchCommandSuccessResult = {
  projects: ProjectIssueFolders[];
};

export type IssueSetPropertyCommandSuccessResult = {
  issueFilePath: string;
  property: string;
  value: unknown;
  skipped?: boolean;
};

export type IssueTouchCommandSuccessResult = {
  issueFilePath: string;
  updatedAt: string;
};

export type IssueGetPropertyCommandSuccessResult = {
  issueFilePath: string;
  property: string;
  value: unknown;
};

export type IssueCatCommandSuccessResult = {
  content: string;
};

export type RegistrySetCommandSuccessResult = {
  url: string;
  key: string;
  value: string;
  catalog: string;
};

export type VersionCommandSuccessResult = { version: string };

export type ScriptSelectIssueCommandSuccessResult = {
  issueFolderName: string;
};

export type ScriptUniqCommandSuccessResult = {
  issueFolderName: string;
};
