import { env } from "@/lib/env";
import type { AlertListResponse, AlertRecord } from "@/types/alert";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? detail;
    } catch {}
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function listAlerts(
  unreadOnly = false,
  sinceHours?: number | null,
  providerId?: number | null,
  targetId?: number | null
): Promise<AlertListResponse> {
  const params = new URLSearchParams();
  if (unreadOnly) {
    params.set("unread_only", "true");
  }
  if (sinceHours) {
    params.set("since_hours", String(sinceHours));
  }
  if (providerId) {
    params.set("provider_id", String(providerId));
  }
  if (targetId) {
    params.set("target_id", String(targetId));
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<AlertListResponse>(`/api/v1/alerts${query}`);
}

export async function markAlertAsRead(id: number): Promise<AlertRecord> {
  return request<AlertRecord>(`/api/v1/alerts/${id}/read`, {
    method: "POST"
  });
}
