"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { PageHeader } from "@/components/page-header";
import { getAlertLevelBadge, getReadBadge } from "@/lib/status";
import { listAlerts, markAlertAsRead } from "@/services/alerts";
import { listProviders } from "@/services/providers";
import { listTargets } from "@/services/targets";
import type { AlertRecord } from "@/types/alert";
import type { Provider } from "@/types/provider";
import type { Target } from "@/types/target";

type TimeRange = "24h" | "7d" | "30d" | "all";

const timeRangeOptions: Array<{ value: TimeRange; label: string; sinceHours: number | null }> = [
  { value: "24h", label: "Last 24h", sinceHours: 24 },
  { value: "7d", label: "Last 7d", sinceHours: 24 * 7 },
  { value: "30d", label: "Last 30d", sinceHours: 24 * 30 },
  { value: "all", label: "All time", sinceHours: null }
];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function AlertsList() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [providerId, setProviderId] = useState("all");
  const [targetId, setTargetId] = useState("all");

  async function reload(nextUnreadOnly = unreadOnly, nextTimeRange = timeRange) {
    setLoading(true);
    try {
      const sinceHours =
        timeRangeOptions.find((option) => option.value === nextTimeRange)?.sinceHours ?? null;
      const response = await listAlerts(
        nextUnreadOnly,
        sinceHours,
        providerId === "all" ? null : Number(providerId),
        targetId === "all" ? null : Number(targetId)
      );
      setAlerts(response.items);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload(unreadOnly, timeRange);
  }, [providerId, targetId, timeRange, unreadOnly]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [providerResponse, targetResponse] = await Promise.all([
          listProviders(),
          listTargets()
        ]);
        setProviders(providerResponse.items);
        setTargets(targetResponse.items);
      } catch {}
    }

    void loadFilterOptions();
  }, []);

  useEffect(() => {
    if (
      targetId !== "all" &&
      providerId !== "all" &&
      !targets.some(
        (target) => String(target.id) === targetId && String(target.provider_id) === providerId
      )
    ) {
      setTargetId("all");
    }
  }, [providerId, targetId, targets]);

  const filteredTargets =
    providerId === "all"
      ? targets
      : targets.filter((target) => String(target.provider_id) === providerId);

  async function handleMarkAsRead(id: number) {
    try {
      await markAlertAsRead(id);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update alert state");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Review change alerts, opportunity alerts, and quick links back to official pages. The final action always stays with the user."
        actions={
          <>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <span>Provider</span>
              <select
                className="bg-transparent outline-none"
                value={providerId}
                onChange={(event) => setProviderId(event.target.value)}
              >
                <option value="all">All providers</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <span>Target</span>
              <select
                className="bg-transparent outline-none"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="all">All targets</option>
                {filteredTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <span>Time Range</span>
              <select
                className="bg-transparent outline-none"
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value as TimeRange)}
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
              />
              Unread only
            </label>
            <ActionButton type="button" tone="secondary" onClick={() => void reload()}>
              Refresh
            </ActionButton>
          </>
        }
      />

      {error ? <NoticeBanner tone="error" message={error} /> : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-6 py-4 font-medium">Level</th>
                <th className="px-6 py-4 font-medium">Title</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Created</th>
                <th className="px-6 py-4 font-medium">Details</th>
                <th className="px-6 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Loading alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No alerts yet. Run a target or wait for a meaningful page change to be detected.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="align-top">
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getAlertLevelBadge(alert.level).className}`}
                      >
                        {getAlertLevelBadge(alert.level).label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{alert.title}</div>
                      <div className="mt-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getReadBadge(alert.is_read).className}`}
                        >
                          {getReadBadge(alert.is_read).label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{alert.target_name ?? `Target #${alert.target_id}`}</td>
                    <td className="px-6 py-4 text-slate-700">{formatDateTime(alert.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-[360px] text-sm leading-6 text-slate-700">{alert.content}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {alert.target_url ? (
                          <ActionButton href={alert.target_url} target="_blank" rel="noreferrer" tone="link" size="sm">
                            Open Official Page
                          </ActionButton>
                        ) : null}
                        {!alert.is_read ? (
                          <ActionButton type="button" tone="secondary" size="sm" onClick={() => void handleMarkAsRead(alert.id)}>
                            Mark as Read
                          </ActionButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
