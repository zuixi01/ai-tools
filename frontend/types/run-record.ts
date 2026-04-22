export type RunRecord = {
  id: number;
  target_id: number;
  target_name?: string | null;
  target_url?: string | null;
  status: string;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  has_change: boolean;
  summary?: string | null;
  diff_summary?: string | null;
  error_message?: string | null;
  screenshot_path?: string | null;
  snapshot?: Record<string, unknown> | null;
};

export type RunRecordListResponse = {
  items: RunRecord[];
  total: number;
};
