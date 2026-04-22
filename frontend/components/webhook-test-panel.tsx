"use client";

import { useState } from "react";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { sendWebhookTest } from "@/services/webhook";

export function WebhookTestPanel() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await sendWebhookTest();
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Webhook test failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Webhook Test</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Send a minimal test event to verify that the webhook endpoint can receive monitoring notifications without triggering any automatic action.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <ActionButton type="button" tone="primary" onClick={() => void handleTest()} disabled={loading}>
          {loading ? "Sending..." : "Send Test Event"}
        </ActionButton>
      </div>

      {message ? <NoticeBanner tone="success" message={message} className="mt-4" /> : null}

      {error ? <NoticeBanner tone="error" message={error} className="mt-4" /> : null}
    </section>
  );
}
