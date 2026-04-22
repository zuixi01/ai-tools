import { env } from "@/lib/env";
import type { RunRecordListResponse } from "@/types/run-record";

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

export async function listRuns(
  sinceHours?: number | null,
  providerId?: number | null,
  targetId?: number | null
): Promise<RunRecordListResponse> {
  const params = new URLSearchParams();
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
  return request<RunRecordListResponse>(`/api/v1/runs${query}`);
}
