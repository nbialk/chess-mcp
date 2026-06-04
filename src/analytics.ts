import { PostHog } from "posthog-node";

let client: PostHog | null = null;

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";

if (apiKey) {
  client = new PostHog(apiKey, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });
}

type ToolCallEvent = {
  tool: string;
  durationMs: number;
  success: boolean;
  distinctId?: string;
  properties?: Record<string, unknown>;
};

export function captureToolCall(event: ToolCallEvent): void {
  if (!client) return;

  client.capture({
    distinctId: event.distinctId ?? "anonymous",
    event: "mcp_tool_called",
    properties: {
      tool: event.tool,
      duration_ms: event.durationMs,
      success: event.success,
      app_version: process.env.APP_VERSION ?? null,
      ...event.properties,
    },
  });
}

export async function shutdownAnalytics(): Promise<void> {
  if (!client) return;
  await client.shutdown();
}
