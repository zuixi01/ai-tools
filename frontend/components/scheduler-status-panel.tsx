"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { env } from "@/lib/env";

type SchedulerStatus = {
  scheduler_enabled: boolean;
  scheduler_running: boolean;
  scan_interval_seconds: number;
  enabled_target_count: number;
  due_target_count: number;
  job_registered: boolean;
  next_run_time: string | null;
  scan_in_progress: boolean;
  last_scan_started_at: string | null;
  last_scan_finished_at: string | null;
  last_scan_error: string | null;
  last_enabled_target_count: number;
  last_due_target_count: number;
  last_dispatched_target_count: number;
  active_run_count: number;
  runs_started_last_minute: number;
  running_targets: Array<{
    id: number;
    name: string;
    url: string;
    last_run_started_at: string | null;
  }>;
};

const fallbackStatus: SchedulerStatus = {
  scheduler_enabled: false,
  scheduler_running: false,
  scan_interval_seconds: 15,
  enabled_target_count: 0,
  due_target_count: 0,
  job_registered: false,
  next_run_time: null,
  scan_in_progress: false,
  last_scan_started_at: null,
  last_scan_finished_at: null,
  last_scan_error: null,
  last_enabled_target_count: 0,
  last_due_target_count: 0,
  last_dispatched_target_count: 0,
  active_run_count: 0,
  runs_started_last_minute: 0,
  running_targets: []
};

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function SchedulerStatusPanel() {
  const [status, setStatus] = useState<SchedulerStatus>(fallbackStatus);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reloadStatus() {
    setLoading(true);
    try {
      const response = await fetch(`${env.apiBaseUrl}/api/v1/settings/scheduler/status`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Failed to load scheduler status");
      }

      setStatus((await response.json()) as SchedulerStatus);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load scheduler status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadStatus();
  }, []);

  async function handleScanNow() {
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`${env.apiBaseUrl}/api/v1/settings/scheduler/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        throw new Error("Failed to trigger scheduler scan");
      }

      const payload = (await response.json()) as { message?: string };
      setMessage(payload.message ?? "Requested one safe scheduler scan.");
      await reloadStatus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to trigger scheduler scan");
    } finally {
      setSubmitting(false);
    }
  }

  const items = [
    {
      label: "Scheduler",
      value: loading ? "Loading..." : status.scheduler_enabled ? "Enabled" : "Disabled"
    },
    {
      label: "Runtime",
      value: loading ? "Loading..." : status.scheduler_running ? "Running" : "Stopped"
    },
    {
      label: "Job",
      value: loading ? "Loading..." : status.job_registered ? "Registered" : "Missing"
    },
    {
      label: "Scan Interval",
      value: loading ? "Loading..." : `${status.scan_interval_seconds} sec`
    },
    {
      label: "Enabled Targets",
      value: loading ? "Loading..." : `${status.enabled_target_count}`
    },
    {
      label: "Due Targets",
      value: loading ? "Loading..." : `${status.due_target_count}`
    },
    {
      label: "Next Run",
      value: loading ? "Loading..." : formatTimestamp(status.next_run_time)
    },
    {
      label: "Last Scan End",
      value: loading ? "Loading..." : formatTimestamp(status.last_scan_finished_at)
    },
    {
      label: "Scan Loop",
      value: loading ? "Loading..." : status.scan_in_progress ? "In Progress" : "Idle"
    },
    {
      label: "Active Runs",
      value: loading ? "Loading..." : `${status.active_run_count}`
    },
    {
      label: "Runs / Minute",
      value: loading ? "Loading..." : `${status.runs_started_last_minute}`
    }
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Scheduler Status</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The safe scheduler scans enabled targets only and reuses the existing execution guard, monitoring pipeline, snapshots, alerts, and webhook flow.
          </p>
        </div>

        <div className="flex gap-3">
          <ActionButton type="button" tone="secondary" onClick={() => void reloadStatus()}>
            Refresh
          </ActionButton>
          <ActionButton type="button" tone="primary" onClick={() => void handleScanNow()} disabled={submitting}>
            {submitting ? "Running..." : "Scan Now"}
          </ActionButton>
        </div>
      </div>

      {message ? <NoticeBanner tone="success" message={message} className="mt-4" /> : null}

      {error ? <NoticeBanner tone="error" message={error} className="mt-4" /> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
            <div className="mt-2 text-base font-medium text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Last Scan Snapshot</div>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <div>Last start: {loading ? "Loading..." : formatTimestamp(status.last_scan_started_at)}</div>
            <div>Last finish: {loading ? "Loading..." : formatTimestamp(status.last_scan_finished_at)}</div>
            <div>Enabled in last scan: {loading ? "Loading..." : status.last_enabled_target_count}</div>
            <div>Due in last scan: {loading ? "Loading..." : status.last_due_target_count}</div>
            <div>Dispatched in last scan: {loading ? "Loading..." : status.last_dispatched_target_count}</div>
            <div>Last scan error: {loading ? "Loading..." : status.last_scan_error ?? "None"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">Running Targets</div>
          <div className="mt-3 space-y-3">
            {loading ? (
              <div className="text-sm text-slate-600">Loading...</div>
            ) : status.running_targets.length > 0 ? (
              status.running_targets.map((target) => (
                <div key={target.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">
                    #{target.id} {target.name}
                  </div>
                  <div className="mt-1 break-all text-slate-600">{target.url}</div>
                  <div className="mt-1 text-slate-500">
                    Started: {formatTimestamp(target.last_run_started_at)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-600">No targets are currently running.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
