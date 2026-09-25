import { z } from "zod";

/** Initial capture target. Extend through a versioned trace contract later. */
export const BrowserEnvironmentSchema = z.strictObject({
  browser: z.literal("chromium"),
  viewport: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  userAgent: z.string().trim().min(1).max(512),
});

export type BrowserEnvironment = z.infer<typeof BrowserEnvironmentSchema>;
