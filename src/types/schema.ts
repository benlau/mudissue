import { z } from "zod";

export type StringList = string[];

function normalizeStringListInput(raw: unknown): unknown {
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return raw;
}

export const StringListSchema = z.preprocess(
  normalizeStringListInput,
  z.array(z.string().min(1)).min(1),
);
