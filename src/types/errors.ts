export type ErrorCode =
  | "PROJECT_NOT_FOUND"
  | "ISSUE_NOT_FOUND"
  | "ISSUE_MULTI_MATCHED"
  | "ATTACH_ARGS_INVALID"
  | "ATTACH_FILE_NOT_FOUND"
  | "ATTACH_FILE_PATH_NOT_FILE"
  | "ISSUE_MD_MISSING"
  | "TAG_ARGS_INVALID"
  | "UNTAG_ARGS_INVALID"
  | "COMMENT_ARGS_INVALID"
  | "COMMENT_AUTHOR_NOT_FOUND"
  | "COMMENT_CONTENT_REQUIRED"
  | "COMMENT_CONTENT_EMPTY"
  | "APPEND_ARGS_INVALID"
  | "APPEND_CONTENT_EMPTY"
  | "PREPEND_ARGS_INVALID"
  | "PREPEND_CONTENT_EMPTY"
  | "LINK_TYPE_UNKNOWN"
  | "LINK_SELF_REFERENCE"
  | "INIT_NOT_GIT_REPO"
  | "INIT_GIT_NOT_DIRECTORY"
  | "INIT_TEMPLATE_MISSING"
  | "INIT_CONFIG_EXISTS"
  | "EDIT_ISSUE_MULTIPLE_MATCHES"
  | "EDIT_ISSUE_NO_ISSUE_FILE"
  | "SET_ISSUE_INVALID_PROPERTY"
  | "GET_ISSUE_PROPERTY_NOT_FOUND"
  | "LOCATE_ISSUE_MULTIPLE_MATCHES"
  | "LOCATE_ISSUE_NO_ISSUE_FILE"
  | "MUD_CONFIG_NOT_FOUND"
  | "EDIT_CONFIG_NO_REPO_CONFIG"
  | "EDITOR_NOT_FOUND"
  | "OPEN_MDS_PATH_REQUIRED"
  | "OPEN_MDS_PATH_NOT_FOUND"
  | "OPEN_MDS_NOT_FILE_OR_DIR"
  | "SET_FILE_BINARY"
  | "CREATE_CONTAINER_FOLDER_NOT_FOUND"
  | "CREATE_CONTAINER_FOLDER_NOT_A_FILE"
  | "CREATE_CONTAINER_FOLDER_ALREADY_EXISTS"
  | "CREATE_ISSUE_FILE_NOT_FOUND"
  | "CREATE_ISSUE_PATH_NOT_FILE"
  | "CREATE_ISSUE_FILE_BINARY"
  | "CREATE_ISSUE_CONTENT_EMPTY"
  | "RENAME_ISSUE_INVALID_NEW_FOLDER"
  | "RENAME_ISSUE_INVALID_TITLE"
  | "RENAME_ISSUE_TARGET_EXISTS"
  | "RENAME_ISSUE_NOT_FOUND"
  | "CHANGE_ISSUE_ID_INVALID"
  | "CHANGE_ISSUE_ID_UNCHANGED"
  | "CHANGE_ISSUE_ID_INVALID_NEW_FOLDER"
  | "CHANGE_ISSUE_ID_TARGET_EXISTS"
  | "REMOVE_ISSUE_FOLDER_NOT_EMPTY"
  | "ARCHIVE_TARGET_EXISTS"
  | "ISSUE_MERGE_TOO_FEW"
  | "ISSUE_MERGE_DUPLICATE"
  | "REGISTRY_KEY_NOT_FOUND"
  | "UNEXCEPTED_EXCEPTION"
  | "DOT_GIT_NOT_FOUND"
  | "GIT_BINARY_NOT_FOUND"
  | "WORKTREE_PATH_ALREADY_EXISTS"
  | "WORKTREE_REMOVE_FORCE_REQUIRED"
  | "WORKTREE_GIT_FORCE_REQUIRED"
  | "FRONT_MATTER_PARSING_ERROR"
  | "TMUX_NOT_FOUND"
  | "TMUX_EXIT_NONZERO"
  | "WORKTREE_GRAPH_NO_ISSUE_WORKTREES"
  | "WORKTREE_GRAPH_NO_MERGE_BASE"
  | "WORKTREE_GRAPH_SUBGRAPH_NOT_CONNECTED"
  | "SCRIPT_SELECT_ISSUE_CANCELLED"
  | "COMMAND_INVALID_ARG";

export type CommandInvalidArg = {
  argument: string;
  value: string;
};
export type RegistryKeyNotFound = { key: string };
export type MultipleProjectsFound = { projects: string };
export type SetIssueCommonMultipleProjectFound = MultipleProjectsFound;
export type ProjectNotFound = { project: string };
export type MudConfigNotFound = { path: string };
export type LocateIssueNoIssueFile = { path: string };
export type FrontMatterParsingError = { path: string; message?: string };
export type AttachFileNotFound = { path: string };
export type AttachFilePathNotFile = { path: string };
export type IssueMdMissing = { path: string };
export type LinkTypeUnknown = { linkType: string; validTypes: string[] };
export type LinkSelfReference = {
  srcFolder: string;
  dstFolder: string;
};
export type RemoveIssueFolderNotEmpty = { path: string };
export type ArchiveTargetExists = { path: string };
export type GetIssuePropertyNotFound = {
  property: string;
  issueFilePath: string;
};

export type ErrorPayloadCodeMap =
  | { code: "COMMAND_INVALID_ARG"; details: CommandInvalidArg }
  | { code: "REGISTRY_KEY_NOT_FOUND"; details: RegistryKeyNotFound }
  | { code: "PROJECT_NOT_FOUND"; details: ProjectNotFound }
  | {
      code: "SET_ISSUE_MULTIPLE_MATCHES";
      details: SetIssueCommonMultipleProjectFound;
    }
  | { code: "MUD_CONFIG_NOT_FOUND"; details: MudConfigNotFound }
  | { code: "LOCATE_ISSUE_NO_ISSUE_FILE"; details: LocateIssueNoIssueFile }
  | { code: "ATTACH_FILE_NOT_FOUND"; details: AttachFileNotFound }
  | { code: "ATTACH_FILE_PATH_NOT_FILE"; details: AttachFilePathNotFile }
  | { code: "ISSUE_MD_MISSING"; details: IssueMdMissing }
  | { code: "LINK_TYPE_UNKNOWN"; details: LinkTypeUnknown }
  | { code: "LINK_SELF_REFERENCE"; details: LinkSelfReference }
  | { code: "FRONT_MATTER_PARSING_ERROR"; details: FrontMatterParsingError }
  | {
      code: "REMOVE_ISSUE_FOLDER_NOT_EMPTY";
      details: RemoveIssueFolderNotEmpty;
    }
  | { code: "ARCHIVE_TARGET_EXISTS"; details: ArchiveTargetExists }
  | {
      code: "GET_ISSUE_PROPERTY_NOT_FOUND";
      details: GetIssuePropertyNotFound;
    }
  | { code: "INIT_GIT_NOT_DIRECTORY"; details?: undefined };

export type ErrorPayload<K extends ErrorCode> =
  Extract<ErrorPayloadCodeMap, { code: K }> extends { details: infer D }
    ? D
    : undefined;
