import { z } from "zod";

export enum SystemRuleKey {
  BlockedStatusRule = "system.blocked_status",
  DuplicatedStatusRule = "system.duplicated_status",
}

/** Partial config as stored in mud.conf / global config (any subset of fields). */
export const BlockedStatusRuleConfigPartialSchema = z.object({
  enabled: z.boolean().optional(),
  blocked_status: z.string().optional(),
  unblocked_status: z.string().optional(),
  blocking_link: z.string().optional(),
  blocked_by_link: z.string().optional(),
});

export type BlockedStatusRuleConfigPartial = z.infer<
  typeof BlockedStatusRuleConfigPartialSchema
>;

/** Fully resolved blocked-status rule config (all fields present). */
export const BlockedStatusRuleConfigSchema =
  BlockedStatusRuleConfigPartialSchema.required();

export type BlockedStatusRuleConfig = z.infer<
  typeof BlockedStatusRuleConfigSchema
>;

export const DEFAULT_BLOCKED_STATUS_RULE_CONFIG: BlockedStatusRuleConfig = {
  enabled: true,
  blocked_status: "blocked",
  unblocked_status: "open",
  blocking_link: "blocking",
  blocked_by_link: "blocked_by",
};

/** Partial config as stored in mud.conf / global config (any subset of fields). */
export const DuplicatedStatusRuleConfigPartialSchema = z.object({
  enabled: z.boolean().optional(),
  duplicated_status: z.string().optional(),

  // The link the will trigger the rule
  duplicated_link: z.string().optional(),
});

export type DuplicatedStatusRuleConfigPartial = z.infer<
  typeof DuplicatedStatusRuleConfigPartialSchema
>;

/** Fully resolved duplicated-status rule config (all fields present). */
export const DuplicatedStatusRuleConfigSchema =
  DuplicatedStatusRuleConfigPartialSchema.required();

export type DuplicatedStatusRuleConfig = z.infer<
  typeof DuplicatedStatusRuleConfigSchema
>;

export const DEFAULT_DUPLICATED_STATUS_RULE_CONFIG: DuplicatedStatusRuleConfig =
  {
    enabled: true,
    duplicated_status: "duplicated",
    duplicated_link: "duplicated",
  };
