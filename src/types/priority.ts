import { z } from "zod";
import { StringListSchema } from "./schema.ts";

export type PriorityList = string[];

export type PriorityTable = {
  initialPriority: string;
  priorities: string[];
};

function refinePriorityItems(items: string[], ctx: z.RefinementCtx): void {
  const seenNames = new Set<string>();
  let defaultCount = 0;

  for (let i = 0; i < items.length; i++) {
    const trimmed = items[i]!.trim();
    const marked = trimmed.startsWith("*");
    const name = marked ? trimmed.slice(1).trim() : trimmed;
    if (name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Priority name cannot be empty",
        path: [i],
      });
      continue;
    }

    const key = name.trim().toLowerCase();
    if (seenNames.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate priority name "${name}"`,
        path: [i],
      });
    }
    seenNames.add(key);

    if (marked) {
      defaultCount++;
      if (defaultCount > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At most one default priority marker (*) is allowed",
          path: [i],
        });
      }
    }
  }
}

function itemsToPriorityTable(items: string[]): PriorityTable {
  let initialPriority: string | undefined;
  const priorities = items.map((item) => {
    const trimmed = item.trim();
    const marked = trimmed.startsWith("*");
    const name = marked ? trimmed.slice(1).trim() : trimmed;
    if (marked) {
      initialPriority = name;
    }
    return name;
  });
  return {
    initialPriority: initialPriority ?? priorities[0]!,
    priorities,
  };
}

const PriorityItemsSchema = z
  .array(z.string().min(1))
  .min(1)
  .superRefine((items, ctx) => {
    refinePriorityItems(items, ctx);
  });

/** Priority list input (comma-string or array) with duplicate / * marker rules. */
export const PriorityListInputSchema =
  StringListSchema.pipe(PriorityItemsSchema);

/** Built-in priority names for sorting and display. */
export const DEFAULT_PRIORITY_LIST: PriorityList = [
  "urgent",
  "high",
  "medium",
  "low",
];

/** Built-in priority table when global.conf and mud.conf omit priority overrides. */
export const DEFAULT_PRIORITY_TABLE: PriorityTable = {
  initialPriority: "medium",
  priorities: DEFAULT_PRIORITY_LIST,
};

/** Priority table accessor: parse config input into a validated {@link PriorityTable}. */
export class PriorityTableAccessor {
  private readonly data: PriorityTable;

  private constructor(data: PriorityTable) {
    this.data = {
      initialPriority: data.initialPriority,
      priorities: [...data.priorities],
    };
  }

  static parse(raw: unknown): PriorityTableAccessor {
    const parsed = PriorityListInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    return new PriorityTableAccessor(itemsToPriorityTable(parsed.data));
  }

  get(): PriorityTable {
    return this.data;
  }
}
