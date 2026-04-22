import { env } from "@/lib/env";
import type { Target, TargetListResponse, TargetMode } from "@/types/target";

type TargetPayload = {
  provider_id: number;
  name: string;
  url: string;
  mode: TargetMode;
  poll_interval_seconds: number;
  enabled: boolean;
  last_status?: string | null;
};

type RunExecutionResponse = {
  run_id: number | null;
  target_id: number;
  status: string;
  duration_ms: number | null;
  has_change: boolean;
  snapshot_id: number | null;
  screenshot_path: string | null;
  diff_summary?: string | null;
  alert_ids: number[];
  webhook_sent: boolean;
};

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

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listTargets(): Promise<TargetListResponse> {
  return request<TargetListResponse>("/api/v1/targets");
}

export async function createTarget(payload: TargetPayload): Promise<Target> {
  return request<Target>("/api/v1/targets", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateTarget(id: number, payload: Partial<TargetPayload>): Promise<Target> {
  return request<Target>(`/api/v1/targets/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteTarget(id: number): Promise<void> {
  return request<void>(`/api/v1/targets/${id}`, {
    method: "DELETE"
  });
}

export async function enableTarget(id: number): Promise<Target> {
  return request<Target>(`/api/v1/targets/${id}/enable`, {
    method: "POST"
  });
}

export async function disableTarget(id: number): Promise<Target> {
  return request<Target>(`/api/v1/targets/${id}/disable`, {
    method: "POST"
  });
}

export async function executeTarget(id: number): Promise<RunExecutionResponse> {
  return request<RunExecutionResponse>(`/api/v1/runs/targets/${id}/execute`, {
    method: "POST"
  });
}
