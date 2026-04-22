export type TargetMode = "browser" | "http";

export type Target = {
  id: number;
  provider_id: number;
  provider_name?: string | null;
  provider_type?: string | null;
  name: string;
  url: string;
  mode: TargetMode;
  poll_interval_seconds: number;
  provider_default_poll_interval_seconds?: number | null;
  effective_poll_interval_seconds: number;
  poll_interval_source: "provider" | "global" | "custom";
  enabled: boolean;
  last_status?: string | null;
  last_checked_at?: string | null;
  last_run_started_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type TargetListResponse = {
  items: Target[];
  total: number;
};
