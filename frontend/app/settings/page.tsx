import { PageHeader } from "@/components/page-header";
import { SchedulerStatusPanel } from "@/components/scheduler-status-panel";
import { SettingsForm } from "@/components/settings-form";
import { SettingPanel } from "@/components/setting-panel";
import { WebhookTestPanel } from "@/components/webhook-test-panel";
import { getRuntimeSettings } from "@/services/settings";

export default async function SettingsPage() {
  const settings = await getRuntimeSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Runtime settings are environment driven and only control safe observation, snapshots, alerts, scheduling, and manual confirmation workflows."
      />

      <SettingsForm initialSettings={settings} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingPanel
          title="Browser Runtime"
          description="Playwright is the production observer. browser-use CLI is only a development helper for page exploration and selector debugging."
          values={[
            `Headless: ${settings.playwright_headless ? "On" : "Off"}`,
            `Page timeout: ${settings.playwright_timeout_ms} ms`,
            `Wait strategy: ${settings.playwright_wait_until}`,
            `Screenshot dir: ${settings.screenshot_dir}`
          ]}
        />

        <SettingPanel
          title="Safety Boundary"
          description="These actions are permanently out of scope. Every opportunity must end in a manual user confirmation step."
          values={[
            "No auto order submission",
            "No auto payment",
            "No captcha handling",
            "No forged request bypass",
            "No anti-detection or risk-control bypass"
          ]}
        />
      </div>

      <SchedulerStatusPanel />
      <WebhookTestPanel />
    </div>
  );
}
