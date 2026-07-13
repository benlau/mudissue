import { z } from "zod";
import { LinkTypesInputSchema } from "./linkage.ts";
import { PriorityListInputSchema } from "./priority.ts";
import {
  BlockedStatusRuleConfigPartialSchema,
  DuplicatedStatusRuleConfigPartialSchema,
} from "./rules.ts";
import { StringListSchema } from "./schema.ts";
import { StatusListInputSchema } from "./status.ts";

export const IssueFileTypeSchema = z.enum(["fixed", "short", "long"]);
export type IssueFileType = z.infer<typeof IssueFileTypeSchema>;

export const GlobalConfigSchema = z.object({
  default_editor: z.string().optional(),
  default_issue_file: z.string().optional(),
  default_issue_file_pattern: IssueFileTypeSchema.optional(),
  default_worktree_path: z.string().optional(),
  default_issue_branch_name_template: z.string().optional(),
  default_priority_list: PriorityListInputSchema.optional(),
  default_status_list: StatusListInputSchema.optional(),
  default_resolved_status_list: StringListSchema.optional(),
  default_link_types: LinkTypesInputSchema.optional(),
  worktree_git_ff_only_enabled: z.boolean().optional(),
  default_system_blocked_post_hook:
    BlockedStatusRuleConfigPartialSchema.optional(),
  default_system_duplicated_post_hook:
    DuplicatedStatusRuleConfigPartialSchema.optional(),
});
export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
