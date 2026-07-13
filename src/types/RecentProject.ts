import { z } from "zod";

export const RecentProjectItemSchema = z.object({
  name: z.string(),
  projectPath: z.string(),
});

export type RecentProjectItem = z.infer<typeof RecentProjectItemSchema>;

export const RecentProjectListSchema = z.array(RecentProjectItemSchema);
