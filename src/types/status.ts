// Status types and validation. See status.md for more details.
import { z } from "zod";
import { StringListSchema } from "./schema.ts";

/** Built-in status alias names used by search and predicates. */
export enum SystemStatus {
  Resolved = "resolved",
}

export type StatusList = string[];

/** Effective alias name → workflow status names. */
export type StatusAliases = Record<string, string[]>;

export type StatusAliasEntry = {
  statuses: string[];
};

/** Config shape: each alias maps to `{ statuses: ... }`. */
export type StatusAliasesConfig = Record<string, StatusAliasEntry>;

function refineStatusList(names: string[], ctx: z.RefinementCtx): void {
  const seenNames = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const key = name.trim().toLowerCase();
    if (seenNames.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate status name "${name}"`,
        path: [i],
      });
    }
    seenNames.add(key);
  }
}

function normalizeStatusListInput(raw: unknown): unknown {
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return raw;
}

export const StatusListSchema = z
  .array(z.string().min(1))
  .min(1)
  .superRefine((names, ctx) => {
    refineStatusList(names, ctx);
  });

export const StatusListInputSchema = z.preprocess(
  normalizeStatusListInput,
  StatusListSchema,
);

/** Built-in resolved statuses when config omits resolved_status_list overrides. */
export const DEFAULT_RESOLVED_STATUS_LIST: StatusList = [
  "closed",
  "canceled",
  "duplicated",
];

/** Built-in status list when global.conf and mud.conf omit status overrides. */
export const DEFAULT_STATUS_LIST: StatusList = [
  "open",
  "backlog",
  "planned",
  "in_progress",
  "review",
  "duplicated",
  "closed",
  "canceled",
];

/** Status list accessor: parse config input into a validated {@link StatusList}. */
export class StatusListAccessor {
  private readonly data: StatusList;

  private constructor(data: StatusList) {
    this.data = [...data];
  }

  static parse(raw: unknown): StatusListAccessor {
    const parsed = StatusListInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    return new StatusListAccessor(parsed.data);
  }

  static from(data: StatusList): StatusListAccessor {
    return StatusListAccessor.parse(data);
  }

  get(): StatusList {
    return [...this.data];
  }

  getDefaultStatus(): string {
    return this.data[0];
  }
}

const StatusAliasEntrySchema = z.object({
  statuses: StringListSchema,
});

function refineStatusAliasNames(
  aliases: StatusAliasesConfig,
  ctx: z.RefinementCtx,
): void {
  const seenNames = new Set<string>();
  for (const name of Object.keys(aliases)) {
    const key = name.trim().toLowerCase();
    if (key.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Status alias name must not be empty",
        path: [name],
      });
      continue;
    }
    if (seenNames.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate status alias name "${name}"`,
        path: [name],
      });
    }
    seenNames.add(key);
  }
}

export const StatusAliasesInputSchema = z
  .record(z.string().min(1), StatusAliasEntrySchema)
  .superRefine((aliases, ctx) => {
    refineStatusAliasNames(aliases, ctx);
  });

/** Status alias map: parse config into alias name → status list. */
export class StatusAliasesAccessor {
  private data: StatusAliases;

  private constructor(data: StatusAliases) {
    this.data = data;
  }

  static empty(): StatusAliasesAccessor {
    return new StatusAliasesAccessor({});
  }

  static parse(raw: unknown): StatusAliasesAccessor {
    const parsed = StatusAliasesInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    const flat: StatusAliases = {};
    for (const [name, entry] of Object.entries(parsed.data)) {
      flat[name] = [...entry.statuses];
    }
    return new StatusAliasesAccessor(flat);
  }

  get(): StatusAliases {
    const copy: StatusAliases = {};
    for (const [name, statuses] of Object.entries(this.data)) {
      copy[name] = [...statuses];
    }
    return copy;
  }

  has(aliasName: string): boolean {
    return this.findKey(aliasName) !== undefined;
  }

  /** Sets `aliasName` only when no case-insensitive match already exists. */
  withAliasIfAbsent(aliasName: string, statuses: string[]): this {
    if (this.has(aliasName)) {
      return this;
    }
    this.data = {
      ...this.get(),
      [aliasName]: [...statuses],
    };
    return this;
  }

  private findKey(aliasName: string): string | undefined {
    const needle = aliasName.trim().toLowerCase();
    return Object.keys(this.data).find(
      (name) => name.trim().toLowerCase() === needle,
    );
  }
}
