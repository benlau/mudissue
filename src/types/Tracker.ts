import { z } from "zod";
import type { GlobalConfig, IssueFileType } from "./GlobalConfig.ts";
import { IssueFileTypeSchema } from "./GlobalConfig.ts";
import {
  DEFAULT_PRIORITY_TABLE,
  PriorityTableAccessor,
  type PriorityTable,
} from "./priority.ts";
import { StringListSchema } from "./schema.ts";
import {
  DEFAULT_LINK_TYPES,
  LinkTypesInputSchema,
  LinkageTypesAccessor,
  type LinkagePair,
} from "./linkage.ts";
import {
  DEFAULT_RESOLVED_STATUS_LIST,
  DEFAULT_STATUS_LIST,
  StatusAliasesAccessor,
  StatusAliasesInputSchema,
  StatusListInputSchema,
  StatusListAccessor,
  SystemStatus,
  type StatusAliases,
} from "./status.ts";
import { CustomScriptsSchema, type CustomScriptEntry } from "./CustomScript.ts";
import {
  BlockedStatusRuleConfigPartialSchema,
  DEFAULT_BLOCKED_STATUS_RULE_CONFIG,
  DEFAULT_DUPLICATED_STATUS_RULE_CONFIG,
  DuplicatedStatusRuleConfigPartialSchema,
  type BlockedStatusRuleConfig,
  type DuplicatedStatusRuleConfig,
} from "./rules.ts";

export const DEFAULT_WORKTREE_PATH = ".claude/worktrees/";
export const DEFAULT_ISSUE_BRANCH_NAME_TEMPLATE = "<%= issue_folder_name %>";
export const DEFAULT_ISSUE_FILE_PATTERN: IssueFileType = "long";

export const TrackerRepoConfigSchema = z.object({
  issue_prefix: z.string().nullable().optional(),
  tracker_path: z.string().optional(),
  issue_path: z.string().optional(),
  projects: z.array(z.string()).optional(),
  issue_file: z.string().optional(),
  issue_file_pattern: IssueFileTypeSchema.optional(),
  worktree_path: z.string().optional(),
  issue_branch_name_template: z.string().optional(),
  editor: z.string().optional(),
  priority_list: StringListSchema.optional(),
  status_list: StatusListInputSchema.optional(),
  resolved_status_list: StringListSchema.optional(),
  status_aliases: StatusAliasesInputSchema.optional(),
  link_types: LinkTypesInputSchema.optional(),
  worktree_git_ff_only_enabled: z.boolean().optional(),
  scripts: CustomScriptsSchema,
  system_blocked_status_rule: BlockedStatusRuleConfigPartialSchema.optional(),
  system_duplicated_status_rule:
    DuplicatedStatusRuleConfigPartialSchema.optional(),
});
export type TrackerRepoConfig = z.infer<typeof TrackerRepoConfigSchema>;

export type TrackerRepo = {
  name: string;

  // The absolute path project (directory containing mud.conf or .git/mudissue/mud.conf)
  projectPath: string;

  // The absolute path of the tracker repo (containing issues folder)
  trackerPath: string;

  config: TrackerRepoConfig;

  // The mud.conf file path
  configFilePath?: string;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return value != null && value !== "";
}

/**
 * Merges repo {@link TrackerRepoConfig} and {@link GlobalConfig} POJOs into effective
 * values. This is a query/transform helper over config data — not a storage format.
 * Callers should construct it from loaded config POJOs at the use site; do not expose
 * accessor instances from stores or persist them as application state.
 */
export class TrackerRepoConfigAccessor {
  constructor(
    private readonly trackerRepoConfig: TrackerRepoConfig,
    private readonly globalConfig: GlobalConfig,
  ) {}

  getIssuePrefix(): string | null | undefined {
    return this.trackerRepoConfig.issue_prefix;
  }

  getTrackerPath(): string | undefined {
    return this.trackerRepoConfig.tracker_path;
  }

  getIssuePath(): string | undefined {
    return this.trackerRepoConfig.issue_path;
  }

  getEffectiveIssuePath(): string {
    return this.trackerRepoConfig.issue_path ?? "issues";
  }

  getProjects(): string[] | undefined {
    return this.trackerRepoConfig.projects;
  }

  getEffectiveEditorPreference(): string | null {
    if (isNonEmpty(this.trackerRepoConfig.editor)) {
      return this.trackerRepoConfig.editor;
    }
    if (isNonEmpty(this.globalConfig.default_editor)) {
      return this.globalConfig.default_editor;
    }
    return null;
  }

  getEffectiveIssueFilePattern(): IssueFileType {
    return (
      this.trackerRepoConfig.issue_file_pattern ??
      this.globalConfig.default_issue_file_pattern ??
      DEFAULT_ISSUE_FILE_PATTERN
    );
  }

  getEffectiveIssueFile(): string {
    return (
      this.trackerRepoConfig.issue_file ??
      this.globalConfig.default_issue_file ??
      "issue.md"
    );
  }

  getEffectiveWorktreePath(): string {
    return (
      this.trackerRepoConfig.worktree_path ??
      this.globalConfig.default_worktree_path ??
      DEFAULT_WORKTREE_PATH
    );
  }

  getEffectiveIssueBranchNameTemplate(): string {
    return (
      this.trackerRepoConfig.issue_branch_name_template ??
      this.globalConfig.default_issue_branch_name_template ??
      DEFAULT_ISSUE_BRANCH_NAME_TEMPLATE
    );
  }

  getEffectivePriorityTable(): PriorityTable {
    if (this.trackerRepoConfig.priority_list !== undefined) {
      return PriorityTableAccessor.parse(
        this.trackerRepoConfig.priority_list,
      ).get();
    }
    if (this.globalConfig.default_priority_list !== undefined) {
      return PriorityTableAccessor.parse(
        this.globalConfig.default_priority_list,
      ).get();
    }
    return DEFAULT_PRIORITY_TABLE;
  }

  getDefaultPriority(): string {
    return this.getEffectivePriorityTable().initialPriority;
  }

  getWorktreeGitFfOnlyEnabled(): boolean {
    return (
      this.trackerRepoConfig.worktree_git_ff_only_enabled ??
      this.globalConfig.worktree_git_ff_only_enabled ??
      false
    );
  }

  getEffectiveStatusList(): string[] {
    const source =
      this.trackerRepoConfig.status_list !== undefined
        ? this.trackerRepoConfig.status_list
        : this.globalConfig.default_status_list !== undefined
          ? this.globalConfig.default_status_list
          : DEFAULT_STATUS_LIST;
    return StatusListAccessor.parse(source).get();
  }

  getDefaultStatus(): string {
    return this.getEffectiveStatusList()[0];
  }

  getEffectiveStatusAliases(): StatusAliases {
    const globalAliases = this.resolveStatusAliasLayer(
      this.globalConfig.default_status_aliases,
      this.globalConfig.default_resolved_status_list,
    );
    const repoAliases = this.resolveStatusAliasLayer(
      this.trackerRepoConfig.status_aliases,
      this.trackerRepoConfig.resolved_status_list,
    );
    const merged = this.mergeStatusAliases(globalAliases, repoAliases);
    if (this.statusAliasKey(merged, SystemStatus.Resolved) === undefined) {
      return {
        ...merged,
        [SystemStatus.Resolved]: [...DEFAULT_RESOLVED_STATUS_LIST],
      };
    }
    return merged;
  }

  getEffectiveResolvedStatusList(): string[] {
    const aliases = this.getEffectiveStatusAliases();
    const key = this.statusAliasKey(aliases, SystemStatus.Resolved);
    if (key === undefined) {
      return [...DEFAULT_RESOLVED_STATUS_LIST];
    }
    return [...aliases[key]];
  }

  isResolved(status: string): boolean {
    return this.getEffectiveResolvedStatusList().includes(status);
  }

  private resolveStatusAliasLayer(
    rawAliases: unknown,
    legacyResolved: unknown,
  ): StatusAliases {
    const accessor =
      rawAliases !== undefined
        ? StatusAliasesAccessor.parse(rawAliases)
        : StatusAliasesAccessor.empty();
    if (legacyResolved !== undefined && !accessor.has(SystemStatus.Resolved)) {
      return accessor
        .withAliasIfAbsent(
          SystemStatus.Resolved,
          StringListSchema.parse(legacyResolved),
        )
        .get();
    }
    return accessor.get();
  }

  /** Repo alias names replace the same name from global, case-insensitively. */
  private mergeStatusAliases(
    base: StatusAliases,
    override: StatusAliases,
  ): StatusAliases {
    const overrideKeys = new Set(
      Object.keys(override).map((name) => name.trim().toLowerCase()),
    );
    const merged: StatusAliases = {};
    for (const [name, statuses] of Object.entries(base)) {
      if (overrideKeys.has(name.trim().toLowerCase())) {
        continue;
      }
      merged[name] = [...statuses];
    }
    for (const [name, statuses] of Object.entries(override)) {
      merged[name] = [...statuses];
    }
    return merged;
  }

  private statusAliasKey(
    aliases: StatusAliases,
    aliasName: string,
  ): string | undefined {
    const needle = aliasName.trim().toLowerCase();
    return Object.keys(aliases).find(
      (name) => name.trim().toLowerCase() === needle,
    );
  }

  getEffectiveLinkTypes(): LinkagePair[] {
    const raw =
      this.trackerRepoConfig.link_types ??
      this.globalConfig.default_link_types ??
      DEFAULT_LINK_TYPES;
    if (
      Array.isArray(raw) &&
      raw.length > 0 &&
      typeof raw[0] === "object" &&
      raw[0] !== null &&
      "forward" in raw[0] &&
      "reverse" in raw[0]
    ) {
      return LinkageTypesAccessor.fromPairs(raw as LinkagePair[]).get();
    }
    return LinkageTypesAccessor.parse(raw).get();
  }

  getScripts(): CustomScriptEntry[] {
    return this.trackerRepoConfig.scripts ?? [];
  }

  getEffectiveBlockedStatusRule(): BlockedStatusRuleConfig {
    return {
      ...DEFAULT_BLOCKED_STATUS_RULE_CONFIG,
      ...this.globalConfig.default_system_blocked_post_hook,
      ...this.trackerRepoConfig.system_blocked_status_rule,
    };
  }

  getEffectiveDuplicatedStatusRule(): DuplicatedStatusRuleConfig {
    return {
      ...DEFAULT_DUPLICATED_STATUS_RULE_CONFIG,
      ...this.globalConfig.default_system_duplicated_post_hook,
      ...this.trackerRepoConfig.system_duplicated_status_rule,
    };
  }
}
