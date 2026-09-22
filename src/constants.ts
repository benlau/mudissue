export const MUD_CONFIG_FILENAME = "mud.conf";
export const GIT_MUD_CONFIG_FILENAME = ".git/mudissue/mud.conf";

export const DEFAULT_SEARCH_DEPTH = 100;

/** Max depth for workspace project graph traversal and cycle limit. */
export const WORKSPACE_MAX_DEPTH = 10;

export const GLOBAL_CONFIG_DIR = ".mudissue";
export const GLOBAL_CONFIG_FILENAME = "global.conf";

/** Example ~/.mudissue/global.conf shown when GlobalConfigSchema validation fails. */
export const EXAMPLE_GLOBAL_CONFIG = `default_editor: vim
default_issue_file_pattern: long
default_priority_list: urgent, high, *medium, low
default_status_list: open, backlog, planned, in_progress, review, duplicated, closed, canceled
default_resolved_status_list: closed, canceled, duplicated
`;

/** System SQLite database filename (under GLOBAL_CONFIG_DIR). Holds registry and other data. */
export const SYSTEM_DB_FILENAME = "system.sqlite";

/** Max depth for FileUrlTraveler (gitdir + parent traversal). */
export const REGISTRY_FILE_TRAVELER_MAX_DEPTH = 100;

/** Registry URL for mudissue app state (e.g. RECENT_PROJECTS). */
export const MUDISSUE_STATE_URL = "mudissue:///state";

/** Registry URL for mud script variables (`mud script set-var` / `get-var`). */
export const MUDISSUE_SCRIPT_VARIABLES_URL = "mudissue://script/variables";

/** Maximum number of recent projects to retain. */
export const MAX_RECENT_PROJECTS = 20;

/** Maximum number of recent filters to retain. */
export const MAX_RECENT_FILTERS = 20;

/** Max length for issue folder names produced by `IssueResource.issueIdForTitle`. */
export const ISSUE_FOLDER_NAME_MAX_LENGTH = 48;

/** Max length for issue branch names produced by `getIssueBranchName`. */
export const ISSUE_BRANCH_NAME_MAX_LENGTH = 32;

/** Debounce delay before persisting markdown line edits to disk. */
export const SAVE_DEBOUNCE_MS = 300;

/** Max length for issue worktree folder names used by `getGitWorktreePath`. */
export const ISSUE_WORKTREE_FOLDER_NAME_MAX_LENGTH = 32;
