import { z } from "zod";

export type LinkagePair = {
  forward: string;
  reverse: string;
};

export type LinkageSide = "forward" | "reverse";

export type LinkageLookupResult = {
  pair: LinkagePair;
  side: LinkageSide;
};

export const DEFAULT_LINK_TYPES: LinkagePair[] = [
  { forward: "parent", reverse: "subissues" },
  { forward: "related", reverse: "related" },
  { forward: "duplicated", reverse: "has_duplicate" },
  { forward: "blocking", reverse: "blocked_by" },
];

function normalizeLinkTypesInput(raw: unknown): unknown {
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return raw;
}

const LinkagePairEntrySchema = z
  .string()
  .min(1)
  .superRefine((entry, ctx) => {
    const parts = entry.split("/");
    if (
      parts.length !== 2 ||
      parts[0].trim() === "" ||
      parts[1].trim() === ""
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid link type "${entry}": expected forward/reverse`,
      });
    }
  })
  .transform((entry) => {
    const [forward, reverse] = entry.split("/");
    return { forward: forward.trim(), reverse: reverse.trim() };
  });

export const LinkTypesSchema = z
  .array(LinkagePairEntrySchema)
  .min(1)
  .superRefine((pairs, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const fieldNames =
        pair.forward.toLowerCase() === pair.reverse.toLowerCase()
          ? [pair.forward]
          : [pair.forward, pair.reverse];
      for (const name of fieldNames) {
        const key = name.toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate link type field name "${name}"`,
            path: [i],
          });
        }
        seen.add(key);
      }
    }
  });

export const LinkTypesInputSchema = z.preprocess(
  normalizeLinkTypesInput,
  LinkTypesSchema,
);

export class LinkageTypesAccessor {
  private readonly data: LinkagePair[];

  private constructor(data: LinkagePair[]) {
    this.data = data.map((p) => ({ ...p }));
  }

  static parse(raw: unknown): LinkageTypesAccessor {
    const parsed = LinkTypesInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }
    return new LinkageTypesAccessor(parsed.data);
  }

  static fromPairs(pairs: LinkagePair[]): LinkageTypesAccessor {
    return new LinkageTypesAccessor(
      pairs.map((p) => ({ forward: p.forward, reverse: p.reverse })),
    );
  }

  static fromDefaults(): LinkageTypesAccessor {
    return LinkageTypesAccessor.fromPairs(DEFAULT_LINK_TYPES);
  }

  get(): LinkagePair[] {
    return this.data.map((p) => ({ ...p }));
  }

  lookupByFieldName(name: string): LinkageLookupResult | undefined {
    const key = name.trim().toLowerCase();
    for (const pair of this.data) {
      if (pair.forward.toLowerCase() === key) {
        return { pair, side: "forward" };
      }
      if (pair.reverse.toLowerCase() === key) {
        return { pair, side: "reverse" };
      }
    }
    return undefined;
  }

  getAllFieldNames(): string[] {
    const names = new Set<string>();
    for (const pair of this.data) {
      names.add(pair.forward);
      names.add(pair.reverse);
    }
    return [...names];
  }
}
