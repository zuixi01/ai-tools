import { env } from "@/lib/env";
import type { Provider, ProviderListResponse, ProviderType } from "@/types/provider";

type ProviderPayload = {
  name: string;
  type: ProviderType;
  enabled: boolean;
  config_json: Record<string, unknown>;
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

export async function listProviders(): Promise<ProviderListResponse> {
  return request<ProviderListResponse>("/api/v1/providers");
}

export async function createProvider(payload: ProviderPayload): Promise<Provider> {
  return request<Provider>("/api/v1/providers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateProvider(id: number, payload: Partial<ProviderPayload>): Promise<Provider> {
  return request<Provider>(`/api/v1/providers/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteProvider(id: number): Promise<void> {
  return request<void>(`/api/v1/providers/${id}`, {
    method: "DELETE"
  });
}
