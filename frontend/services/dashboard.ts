import { env } from "@/lib/env";
import type { DashboardSummary } from "@/types/dashboard";

const fallbackSummary: DashboardSummary = {
  project: "cloud-offer-watch",
  provider_count: 0,
  active_targets: 0,
  changes_last_24h: 0,
  scheduler: {
    enabled: false,
    running: false,
    scan_interval_seconds: 15,
    job_registered: false,
    scan_in_progress: false,
    next_run_time: null,
    last_scan_started_at: null,
    last_scan_finished_at: null,
    active_run_count: 0
  },
  recent_alerts: [],
  recent_failures: [],
  recent_opportunities: [],
  message: "Backend unavailable, showing fallback summary."
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const response = await fetch(`${env.apiBaseUrl}/api/v1/dashboard/summary`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return fallbackSummary;
    }

    return (await response.json()) as DashboardSummary;
  } catch {
    return fallbackSummary;
  }
}
