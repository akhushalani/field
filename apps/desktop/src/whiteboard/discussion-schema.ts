import { z } from "zod";
export const discussionSchema = z.object({
  title: z.string().min(1).max(90),
  mode: z.enum(["explore", "compare", "decide"]),
  ideaIds: z.array(z.string()).min(1).max(12),
  options: z.array(z.string()).max(4),
  links: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        kind: z.enum([
          "supports",
          "challenges",
          "depends on",
          "alternative to",
        ]),
      }),
    )
    .max(24),
  decisionId: z.string().optional(),
});
