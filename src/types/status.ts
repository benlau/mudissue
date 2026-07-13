// Status types and validation. See status.md for more details.
import { z } from "zod";

export type StatusList = string[];

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
