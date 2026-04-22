"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { PageHeader } from "@/components/page-header";
import { createProvider, deleteProvider, listProviders, updateProvider } from "@/services/providers";
import { getRuntimeSettings } from "@/services/settings";
import type { Provider, ProviderType } from "@/types/provider";
import type { RuntimeSettings } from "@/types/settings";

type ProviderFormState = {
  name: string;
  type: ProviderType;
  enabled: boolean;
  defaultPollIntervalSeconds: string;
  configText: string;
};

const initialFormState: ProviderFormState = {
  name: "",
  type: "glm",
  enabled: true,
  defaultPollIntervalSeconds: "",
  configText: "{}"
};

const fallbackRuntimeSettings: Pick<
  RuntimeSettings,
  | "default_poll_interval_seconds"
  | "max_concurrent_watchers"
  | "global_rate_limit_per_minute"
  | "enforce_target_poll_interval"
  | "scheduler_scan_interval_seconds"
> = {
  default_poll_interval_seconds: 60,
  max_concurrent_watchers: 2,
  global_rate_limit_per_minute: 30,
  enforce_target_poll_interval: true,
  scheduler_scan_interval_seconds: 15
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function readProviderDefaultPollIntervalSeconds(config: Record<string, unknown>): string {
  const value = config.default_poll_interval_seconds;
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  return String(value);
}

function buildProviderConfigJson(
  configText: string,
  defaultPollIntervalSeconds: string
): Record<string, unknown> {
  const parsed = JSON.parse(configText || "{}") as Record<string, unknown>;
  const trimmed = defaultPollIntervalSeconds.trim();

  if (!trimmed) {
    delete parsed.default_poll_interval_seconds;
    return parsed;
  }

  const numericValue = Number(trimmed);
  if (!Number.isInteger(numericValue) || numericValue < 10 || numericValue > 3600) {
    throw new Error("Provider default poll interval must be an integer between 10 and 3600 seconds");
  }

  parsed.default_poll_interval_seconds = numericValue;
  return parsed;
}

function getProviderDefaultPollIntervalLabel(
  provider: Provider,
  globalDefaultPollIntervalSeconds: number
) {
  const configured = readProviderDefaultPollIntervalSeconds(provider.config_json ?? {});
  if (!configured) {
    return {
      primary: `${globalDefaultPollIntervalSeconds} sec`,
      secondary: "Using global fallback",
      className: "bg-slate-100 text-slate-700"
    };
  }

  return {
    primary: `${configured} sec`,
    secondary: "Provider-level default",
    className: "bg-blue-100 text-blue-700"
  };
}

export function ProviderManager() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [runtimeSettings, setRuntimeSettings] = useState(fallbackRuntimeSettings);
  const [form, setForm] = useState<ProviderFormState>(initialFormState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const panelTitle = useMemo(() => {
    return editingId ? "Edit Provider" : "Create Provider";
  }, [editingId]);

  async function reloadProviders() {
    setLoading(true);
    try {
      const [providerData, settings] = await Promise.all([listProviders(), getRuntimeSettings()]);
      setProviders(providerData.items);
      setRuntimeSettings({
        default_poll_interval_seconds: settings.default_poll_interval_seconds,
        max_concurrent_watchers: settings.max_concurrent_watchers,
        global_rate_limit_per_minute: settings.global_rate_limit_per_minute,
        enforce_target_poll_interval: settings.enforce_target_poll_interval,
        scheduler_scan_interval_seconds: settings.scheduler_scan_interval_seconds
      });
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadProviders();
  }, []);

  function resetForm() {
    setForm(initialFormState);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const configJson = buildProviderConfigJson(
        form.configText,
        form.defaultPollIntervalSeconds
      );
      const payload = {
        name: form.name,
        type: form.type,
        enabled: form.enabled,
        config_json: configJson
      };

      if (editingId) {
        await updateProvider(editingId, payload);
      } else {
        await createProvider(payload);
      }

      resetForm();
      await reloadProviders();
      setNotice(editingId ? "Provider updated." : "Provider created.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save provider");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(provider: Provider) {
    setEditingId(provider.id);
    setForm({
      name: provider.name,
      type: provider.type,
      enabled: provider.enabled,
      defaultPollIntervalSeconds: readProviderDefaultPollIntervalSeconds(provider.config_json ?? {}),
      configText: JSON.stringify(provider.config_json ?? {}, null, 2)
    });
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm(
      "Delete this provider? The backend will reject the delete if targets are still attached."
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteProvider(id);
      if (editingId === id) {
        resetForm();
      }
      await reloadProviders();
      setNotice("Provider deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete provider");
    }
  }

  async function toggleEnabled(provider: Provider) {
    try {
      await updateProvider(provider.id, {
        enabled: !provider.enabled
      });
      await reloadProviders();
      setNotice(`Provider ${provider.enabled ? "disabled" : "enabled"}: ${provider.name}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update provider status");
    }
  }

  const strategyItems = [
    `Default target poll interval: ${runtimeSettings.default_poll_interval_seconds} sec`,
    `Scheduler scan interval: ${runtimeSettings.scheduler_scan_interval_seconds} sec`,
    `Max concurrent watchers: ${runtimeSettings.max_concurrent_watchers}`,
    `Global runs per minute: ${runtimeSettings.global_rate_limit_per_minute}`,
    `Enforce target poll interval: ${runtimeSettings.enforce_target_poll_interval ? "On" : "Off"}`
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        description="Manage `glm` and `aliyun` providers and review the shared monitoring defaults that new targets currently inherit."
      />

      {error ? <NoticeBanner tone="error" message={error} /> : null}

      {notice ? <NoticeBanner tone="success" message={notice} /> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Default Strategy</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These are the current global monitoring defaults used across providers. This area stays read-only for now and gives us a clean place to extend provider-level defaults later.
            </p>
          </div>
          <ActionButton href="/settings" tone="secondary">
            Open Settings
          </ActionButton>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {strategyItems.map((item) => (
            <div key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{panelTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Provider config stays strictly inside the monitoring boundary. It does not include automatic ordering, payment, captcha handling, or bypass logic.
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Optional config hint: add `default_poll_interval_seconds` to `config_json` to give new targets for this provider a provider-level default interval.
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Example: GLM Official"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Type</span>
              <select
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({ ...current, type: event.target.value as ProviderType }))
                }
              >
                <option value="glm">glm</option>
                <option value="aliyun">aliyun</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Provider Default Poll Interval (sec)
              </span>
              <input
                type="number"
                min={10}
                max={3600}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.defaultPollIntervalSeconds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultPollIntervalSeconds: event.target.value
                  }))
                }
                placeholder={`Fallback is global default: ${runtimeSettings.default_poll_interval_seconds}`}
              />
              <div className="mt-2 text-xs text-slate-500">
                Optional. When set, new targets for this provider inherit this value before falling back to the global default.
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Config JSON</span>
              <textarea
                className="min-h-36 w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm outline-none transition focus:border-blue-400"
                value={form.configText}
                onChange={(event) => setForm((current) => ({ ...current, configText: event.target.value }))}
                placeholder='{"base_url":"https://open.bigmodel.cn/"}'
              />
              <div className="mt-2 text-xs text-slate-500">
                The helper field above writes to `config_json.default_poll_interval_seconds` on save. Raw JSON stays available for other provider-specific keys.
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enable this provider
            </label>

            <div className="flex gap-3">
              <ActionButton type="submit" tone="primary" disabled={submitting}>
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Provider"}
              </ActionButton>
              <ActionButton type="button" tone="secondary" onClick={resetForm}>
                Reset
              </ActionButton>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Provider List</h2>
            <p className="mt-2 text-sm text-slate-600">
              Targets reference these providers as monitored platform sources. Future provider-level defaults can extend from this page without changing the safety boundary.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Default Poll</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Targets</th>
                  <th className="px-6 py-4 font-medium">Updated</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      Loading providers...
                    </td>
                  </tr>
                ) : providers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No providers yet. Create one from the form on the left.
                    </td>
                  </tr>
                ) : (
                  providers.map((provider) => (
                    (() => {
                      const pollDisplay = getProviderDefaultPollIntervalLabel(
                        provider,
                        runtimeSettings.default_poll_interval_seconds
                      );

                      return (
                        <tr key={provider.id} className="align-top">
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{provider.name}</div>
                            <pre className="mt-2 max-w-[280px] overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                              {JSON.stringify(provider.config_json ?? {}, null, 2)}
                            </pre>
                          </td>
                          <td className="px-6 py-4 text-slate-700">{provider.type}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{pollDisplay.primary}</div>
                            <div className="mt-2">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${pollDisplay.className}`}>
                                {pollDisplay.secondary}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => void toggleEnabled(provider)}
                              className={`rounded-full px-3 py-1 text-xs font-medium ${
                                provider.enabled
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                              }`}
                            >
                              {provider.enabled ? "Enabled" : "Disabled"}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-slate-700">{provider.target_count}</td>
                          <td className="px-6 py-4 text-slate-700">{formatDateTime(provider.updated_at)}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <ActionButton type="button" tone="secondary" size="sm" onClick={() => startEdit(provider)}>
                                Edit
                              </ActionButton>
                              <ActionButton type="button" tone="danger" size="sm" onClick={() => void handleDelete(provider.id)}>
                                Delete
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })()
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
