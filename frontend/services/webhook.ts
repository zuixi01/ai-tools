import { env } from "@/lib/env";

export type WebhookTestResponse = {
  success: boolean;
  message: string;
};

export async function sendWebhookTest(): Promise<WebhookTestResponse> {
  const response = await fetch(`${env.apiBaseUrl}/api/v1/settings/webhook/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let detail = "Webhook test failed";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as WebhookTestResponse;
}
