import { z } from "zod";

export const CustomScriptEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
});
export type CustomScriptEntry = z.infer<typeof CustomScriptEntrySchema>;

export const CustomScriptsSchema = z.array(CustomScriptEntrySchema).optional();
