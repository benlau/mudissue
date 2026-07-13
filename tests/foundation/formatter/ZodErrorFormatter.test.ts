import { z } from "zod";
import { ZodErrorFormatter } from "../../../src/foundation/formatter/ZodErrorFormatter.ts";

describe("ZodErrorFormatter", () => {
  it("formats each Zod issue as field path and message joined by semicolons", () => {
    const schema = z.object({
      priority_list: z.array(z.string()),
      worktree_git_ff_only_enabled: z.boolean(),
    });
    const parsed = schema.safeParse({
      priority_list: [{ name: "urgent" }],
      worktree_git_ff_only_enabled: "yes",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(ZodErrorFormatter.format(parsed.error)).toEqual(
        "priority_list.0: Invalid input: expected string, received object; worktree_git_ff_only_enabled: Invalid input: expected boolean, received string",
      );
    }
  });
});
