import { env } from "@/lib/env";
import type { RuntimeSettings } from "@/types/settings";

const fallbackSettings: RuntimeSettings = {
  project_name: "cloud-offer-watch",
  project_env: "development",
  timezone: "Asia/Shanghai",
  scheduler_enabled: false,
  scheduler_scan_interval_seconds: 15,
  default_poll_interval_seconds: 60,
  max_concurrent_watchers: 2,
  global_rate_limit_per_minute: 30,
  enforce_target_poll_interval: true,
  webhook_enabled: false,
  webhook_url: null,
  webhook_url_configured: false,
  webhook_timeout_seconds: 10,
  enable_screenshot: true,
  screenshot_dir: "./captures",
  playwright_headless: true,
  playwright_timeout_ms: 15000,
  playwright_wait_until: "domcontentloaded"
};

export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  try {
    const response = await fetch(`${env.apiBaseUrl}/api/v1/settings`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return fallbackSettings;
    }
    return (await response.json()) as RuntimeSettings;
  } catch {
    return fallbackSettings;
  }
}

export async function updateRuntimeSettings(payload: {
  scheduler_enabled: boolean;
  scheduler_scan_interval_seconds: number;
  default_poll_interval_seconds: number;
  max_concurrent_watchers: number;
  global_rate_limit_per_minute: number;
  enforce_target_poll_interval: boolean;
  webhook_enabled: boolean;
  webhook_url: string | null;
  webhook_timeout_seconds: number;
}): Promise<RuntimeSettings> {
  const response = await fetch(`${env.apiBaseUrl}/api/v1/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let detail = "Failed to update settings";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as RuntimeSettings;
}

export async function clearRuntimeSettingOverrides(): Promise<RuntimeSettings> {
  const response = await fetch(`${env.apiBaseUrl}/api/v1/settings/overrides`, {
    method: "DELETE",
    cache: "no-store"
  });

  if (!response.ok) {
    let detail = "Failed to clear settings overrides";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as RuntimeSettings;
}
