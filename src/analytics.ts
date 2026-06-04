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

type McpRequestEvent = {
  method: string;
  durationMs: number;
  success: boolean;
  distinctId?: string;
  properties?: Record<string, unknown>;
};

export function captureMcpRequest(event: McpRequestEvent): void {
  if (!client) return;

  client.capture({
    distinctId: event.distinctId ?? "anonymous",
    event: "mcp_request",
    properties: {
      method: event.method,
      duration_ms: event.durationMs,
      success: event.success,
      app_version: process.env.APP_VERSION ?? null,
      ...event.properties,
    },
  });
}

export function identifyClient(
  distinctId: string,
  clientName: string | null,
  clientVersion: string | null,
): void {
  if (!client) return;

  client.identify({
    distinctId,
    properties: {
      mcp_client_name: clientName,
      mcp_client_version: clientVersion,
    },
  });
}

export async function shutdownAnalytics(): Promise<void> {
  if (!client) return;
  await client.shutdown();
}
