"use client";

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { clearRuntimeSettingOverrides, updateRuntimeSettings } from "@/services/settings";
import type { RuntimeSettings } from "@/types/settings";

type SettingsFormState = {
  scheduler_enabled: boolean;
  scheduler_scan_interval_seconds: number;
  default_poll_interval_seconds: number;
  max_concurrent_watchers: number;
  global_rate_limit_per_minute: number;
  enforce_target_poll_interval: boolean;
  webhook_enabled: boolean;
  webhook_url: string;
  webhook_timeout_seconds: number;
};

function toFormState(settings: RuntimeSettings): SettingsFormState {
  return {
    scheduler_enabled: settings.scheduler_enabled,
    scheduler_scan_interval_seconds: settings.scheduler_scan_interval_seconds,
    default_poll_interval_seconds: settings.default_poll_interval_seconds,
    max_concurrent_watchers: settings.max_concurrent_watchers,
    global_rate_limit_per_minute: settings.global_rate_limit_per_minute,
    enforce_target_poll_interval: settings.enforce_target_poll_interval,
    webhook_enabled: settings.webhook_enabled,
    webhook_url: settings.webhook_url ?? "",
    webhook_timeout_seconds: settings.webhook_timeout_seconds
  };
}

export function SettingsForm({ initialSettings }: { initialSettings: RuntimeSettings }) {
  const [form, setForm] = useState<SettingsFormState>(() => toFormState(initialSettings));
  const [saved, setSaved] = useState<RuntimeSettings>(initialSettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const nextSettings = await updateRuntimeSettings({
        scheduler_enabled: form.scheduler_enabled,
        scheduler_scan_interval_seconds: form.scheduler_scan_interval_seconds,
        default_poll_interval_seconds: form.default_poll_interval_seconds,
        max_concurrent_watchers: form.max_concurrent_watchers,
        global_rate_limit_per_minute: form.global_rate_limit_per_minute,
        enforce_target_poll_interval: form.enforce_target_poll_interval,
        webhook_enabled: form.webhook_enabled,
        webhook_url: form.webhook_url.trim() || null,
        webhook_timeout_seconds: form.webhook_timeout_seconds
      });

      setSaved(nextSettings);
      setForm(toFormState(nextSettings));
      setMessage("Settings saved and applied to the current runtime.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetToEnvironmentDefaults() {
    const confirmed = window.confirm(
      "Clear persisted overrides and restore scheduler/webhook settings from environment defaults?"
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const nextSettings = await clearRuntimeSettingOverrides();
      setSaved(nextSettings);
      setForm(toFormState(nextSettings));
      setMessage("Persisted overrides cleared. Runtime settings now match environment defaults.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to restore environment defaults"
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClassName =
    "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Editable Runtime Settings</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Only safe monitoring controls are editable here. Automatic ordering, payment, captcha handling, and bypass behavior remain permanently disabled.
        </p>
      </div>

      <form className="mt-5 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">Scheduler enabled</div>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.scheduler_enabled}
                onChange={(event) => setField("scheduler_enabled", event.target.checked)}
              />
              <span>Allow safe scheduler scans for enabled targets only.</span>
            </div>
          </label>

          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">Enforce target poll interval</div>
            <div className="mt-2 flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enforce_target_poll_interval}
                onChange={(event) => setField("enforce_target_poll_interval", event.target.checked)}
              />
              <span>Keep target runs throttled by their configured poll interval.</span>
            </div>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-900">Scheduler scan interval</div>
            <input
              className={inputClassName}
              type="number"
              min={5}
              value={form.scheduler_scan_interval_seconds}
              onChange={(event) => setField("scheduler_scan_interval_seconds", Number(event.target.value))}
            />
            <div className="mt-2 text-xs text-slate-500">Minimum 5 seconds.</div>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-900">Default poll interval</div>
            <input
              className={inputClassName}
              type="number"
              min={15}
              value={form.default_poll_interval_seconds}
              onChange={(event) => setField("default_poll_interval_seconds", Number(event.target.value))}
            />
            <div className="mt-2 text-xs text-slate-500">Minimum 15 seconds.</div>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-900">Max concurrent watchers</div>
            <input
              className={inputClassName}
              type="number"
              min={1}
              max={5}
              value={form.max_concurrent_watchers}
              onChange={(event) => setField("max_concurrent_watchers", Number(event.target.value))}
            />
            <div className="mt-2 text-xs text-slate-500">Allowed range: 1 to 5.</div>
          </label>

          <label className="block">
            <div className="text-sm font-medium text-slate-900">Global runs per minute</div>
            <input
              className={inputClassName}
              type="number"
              min={1}
              max={120}
              value={form.global_rate_limit_per_minute}
              onChange={(event) => setField("global_rate_limit_per_minute", Number(event.target.value))}
            />
            <div className="mt-2 text-xs text-slate-500">Allowed range: 1 to 120.</div>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-medium text-slate-900">Webhook enabled</div>
              <div className="mt-2 flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.webhook_enabled}
                  onChange={(event) => setField("webhook_enabled", event.target.checked)}
                />
                <span>Send monitoring notifications to the configured webhook endpoint.</span>
              </div>
            </label>

            <label className="block">
              <div className="text-sm font-medium text-slate-900">Webhook timeout</div>
              <input
                className={inputClassName}
                type="number"
                min={3}
                max={60}
                value={form.webhook_timeout_seconds}
                onChange={(event) => setField("webhook_timeout_seconds", Number(event.target.value))}
              />
              <div className="mt-2 text-xs text-slate-500">Allowed range: 3 to 60 seconds.</div>
            </label>
          </div>

          <label className="mt-4 block">
            <div className="text-sm font-medium text-slate-900">Webhook URL</div>
            <input
              className={inputClassName}
              type="url"
              placeholder="https://example.com/webhook"
              value={form.webhook_url}
              onChange={(event) => setField("webhook_url", event.target.value)}
            />
            <div className="mt-2 text-xs text-slate-500">
              Leave empty to keep webhook notifications disabled even if the switch is on.
            </div>
          </label>
        </div>

        {message ? <NoticeBanner tone="success" message={message} /> : null}

        {error ? <NoticeBanner tone="error" message={error} /> : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-slate-500">
            Saved state: scheduler {saved.scheduler_enabled ? "enabled" : "disabled"}, webhook{" "}
            {saved.webhook_enabled ? "enabled" : "disabled"}.
          </div>

          <div className="flex gap-3">
            <ActionButton
              type="button"
              tone="secondary"
              onClick={() => void handleResetToEnvironmentDefaults()}
              disabled={loading}
            >
              Restore Env Defaults
            </ActionButton>
            <ActionButton type="submit" tone="primary" disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </ActionButton>
          </div>
        </div>
      </form>
    </section>
  );
}
