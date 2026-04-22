export type AlertLevel = "info" | "success" | "warning" | "error";

export type AlertRecord = {
  id: number;
  target_id: number;
  target_name?: string | null;
  target_url?: string | null;
  level: AlertLevel;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type AlertListResponse = {
  items: AlertRecord[];
  total: number;
};
