"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { PageHeader } from "@/components/page-header";
import { getRunStatusBadge } from "@/lib/status";
import { listProviders } from "@/services/providers";
import { listTargets } from "@/services/targets";
import { listRuns } from "@/services/runs";
import type { Provider } from "@/types/provider";
import type { RunRecord } from "@/types/run-record";
import type { Target } from "@/types/target";

type TimeRange = "24h" | "7d" | "30d" | "all";

const timeRangeOptions: Array<{ value: TimeRange; label: string; sinceHours: number | null }> = [
  { value: "24h", label: "Last 24h", sinceHours: 24 },
  { value: "7d", label: "Last 7d", sinceHours: 24 * 7 },
  { value: "30d", label: "Last 30d", sinceHours: 24 * 30 },
  { value: "all", label: "All time", sinceHours: null }
];

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not finished";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDuration(value?: number | null) {
  if (!value && value !== 0) {
    return "-";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

function renderSnapshotLine(run: RunRecord) {
  const snapshot = run.snapshot ?? {};
  const title = typeof snapshot.title === "string" ? snapshot.title : "";
  const buttonText = typeof snapshot.button_text === "string" ? snapshot.button_text : "";
  const priceText = typeof snapshot.price_text === "string" ? snapshot.price_text : "";
  const stockText = typeof snapshot.stock_text === "string" ? snapshot.stock_text : "";

  return [title, buttonText, priceText, stockText].filter(Boolean).join(" / ");
}

export function RunsList() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [providerId, setProviderId] = useState("all");
  const [targetId, setTargetId] = useState("all");

  async function reload(nextTimeRange = timeRange) {
    setLoading(true);
    try {
      const sinceHours =
        timeRangeOptions.find((option) => option.value === nextTimeRange)?.sinceHours ?? null;
      const response = await listRuns(
        sinceHours,
        providerId === "all" ? null : Number(providerId),
        targetId === "all" ? null : Number(targetId)
      );
      setRuns(response.items);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload(timeRange);
  }, [providerId, targetId, timeRange]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runs"
        description="Review the result of each monitoring run, including duration, diff summary, screenshot path, and parsed page signals."
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
                <th className="px-6 py-4 font-medium">Started</th>
                <th className="px-6 py-4 font-medium">Target</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Duration</th>
                <th className="px-6 py-4 font-medium">Summary</th>
                <th className="px-6 py-4 font-medium">Screenshot</th>
                <th className="px-6 py-4 font-medium">Official Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Loading runs...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    No runs yet. Trigger a target manually to create the first monitoring record.
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id} className="align-top">
                    <td className="px-6 py-4 text-slate-700">
                      <div>{formatDateTime(run.started_at)}</div>
                      <div className="mt-1 text-xs text-slate-500">Finished: {formatDateTime(run.finished_at)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{run.target_name ?? `Target #${run.target_id}`}</div>
                      <div className="mt-2 max-w-[260px] text-xs leading-6 text-slate-500">
                        {renderSnapshotLine(run) || "No snapshot summary"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getRunStatusBadge(run.status).className}`}
                      >
                        {getRunStatusBadge(run.status).label}
                      </span>
                      <div className="mt-2 text-xs text-slate-500">
                        {run.has_change ? "Meaningful change detected" : "No meaningful change"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{formatDuration(run.duration_ms)}</td>
                    <td className="px-6 py-4">
                      <div className="max-w-[360px] text-sm leading-6 text-slate-700">
                        {run.diff_summary ?? run.error_message ?? "No diff summary generated for this run"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {run.screenshot_path ? (
                        <div className="max-w-[240px] break-all text-xs text-slate-600">{run.screenshot_path}</div>
                      ) : (
                        <span className="text-slate-400">Not saved</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {run.target_url ? (
                        <ActionButton href={run.target_url} target="_blank" rel="noreferrer" tone="link" size="sm">
                          Open Official Page
                        </ActionButton>
                      ) : (
                        <span className="text-slate-400">No URL</span>
                      )}
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
