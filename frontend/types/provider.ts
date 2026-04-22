export type ProviderType = "glm" | "aliyun";

export type Provider = {
  id: number;
  name: string;
  type: ProviderType;
  enabled: boolean;
  config_json: Record<string, unknown>;
  target_count: number;
  created_at: string;
  updated_at: string;
};

export type ProviderListResponse = {
  items: Provider[];
  total: number;
};
