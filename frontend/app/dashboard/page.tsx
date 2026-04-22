import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getDashboardSummary } from "@/services/dashboard";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Focused on GLM and Aliyun opportunity monitoring, the platform only observes pages, stores snapshots, raises alerts, and routes users to official pages for manual confirmation."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Providers"
          value={summary.provider_count}
          hint="Current provider count. The MVP is intentionally scoped to glm and aliyun."
        />
        <MetricCard
          title="Active Targets"
          value={summary.active_targets}
          hint="Enabled monitoring targets used only for observation and change detection."
        />
        <MetricCard
          title="24h Changes"
          value={summary.changes_last_24h}
          hint="Changes detected from snapshot diffs during the last 24 hours."
        />
        <MetricCard
          title="Recent Opportunities"
          value={summary.recent_opportunities.length}
          hint="Opportunity alerts only point users to official pages for manual follow-up."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard
          title="Scheduler Status"
          description={summary.message}
          items={[
            `Scheduler: ${summary.scheduler.enabled ? "Enabled" : "Disabled"}`,
            `Runtime: ${summary.scheduler.running ? "Running" : "Stopped"}`,
            `Scan interval: ${summary.scheduler.scan_interval_seconds} sec`,
            `Job: ${summary.scheduler.job_registered ? "Registered" : "Missing"}`,
            `Scan loop: ${summary.scheduler.scan_in_progress ? "In progress" : "Idle"}`,
            `Active runs: ${summary.scheduler.active_run_count}`,
            `Next run: ${formatTimestamp(summary.scheduler.next_run_time)}`,
            `Last finish: ${formatTimestamp(summary.scheduler.last_scan_finished_at)}`
          ]}
        />

        <SectionCard
          title="Recent Opportunities"
          description="Each opportunity remains a human-in-the-loop signal. The platform never places orders, submits payment, or acts on the user's behalf."
          items={
            summary.recent_opportunities.length > 0
              ? summary.recent_opportunities.map((item) => `#${item.id} Target #${item.target_id} ${item.title}`)
              : ["No recent opportunity alerts"]
          }
        />

        <SectionCard
          title="Recent Failures"
          description="Recent failed runs help us inspect page changes, network issues, or local runtime problems."
          items={
            summary.recent_failures.length > 0
              ? summary.recent_failures.map(
                  (item) =>
                    `Run #${item.run_id} / Target #${item.target_id}: ${item.error_message ?? "Unknown error"}`
                )
              : ["No recent failed runs"]
          }
        />

        <SectionCard
          title="Unread Alerts"
          description="Alerts surface changes and opportunities quickly, while the final action always stays on the official site and under user control."
          items={
            summary.recent_alerts.length > 0
              ? summary.recent_alerts.map((item) => `[${item.level}] ${item.title}`)
              : ["No unread alerts"]
          }
        />
      </div>
    </div>
  );
}
