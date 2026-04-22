export type DashboardSummary = {
  project: string;
  provider_count: number;
  active_targets: number;
  changes_last_24h: number;
  scheduler: {
    enabled: boolean;
    running: boolean;
    scan_interval_seconds: number;
    job_registered: boolean;
    scan_in_progress: boolean;
    next_run_time: string | null;
    last_scan_started_at: string | null;
    last_scan_finished_at: string | null;
    active_run_count: number;
  };
  recent_alerts: Array<{ id: number; title: string; level: string }>;
  recent_failures: Array<{ run_id: number; target_id: number; error_message: string | null }>;
  recent_opportunities: Array<{ id: number; target_id: number; title: string }>;
  message: string;
};
