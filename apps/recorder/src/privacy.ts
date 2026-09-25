import {
  type CapturePayload,
  CapturePayloadSchema,
  DemoPathSchema,
} from "@reproflow/event-schema";

export function safePath(rawUrl: string, baseUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.origin !== new URL(baseUrl).origin) return "[REDACTED]" as const;
    const parsed = DemoPathSchema.safeParse(url.pathname);
    return parsed.success ? parsed.data : ("[REDACTED]" as const);
  } catch {
    return "[REDACTED]" as const;
  }
}

export function safeInteraction(raw: unknown): CapturePayload | null {
  const result = CapturePayloadSchema.safeParse(raw);
  if (
    !result.success ||
    !["click", "input", "submit", "navigation"].includes(result.data.type)
  )
    return null;
  const event = result.data;
  // Browser allowlist is repeated at the process boundary. Never trust a page binding.
  if (event.type === "input" && event.target !== "postal-code")
    return { ...event, value: "[REDACTED]" };
  return event;
}
