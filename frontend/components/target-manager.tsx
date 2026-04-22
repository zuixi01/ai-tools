"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { NoticeBanner } from "@/components/notice-banner";
import { PageHeader } from "@/components/page-header";
import {
  getEnabledBadge,
  getPollIntervalBehaviorBadge,
  getPollIntervalSourceBadge
} from "@/lib/status";
import { listProviders } from "@/services/providers";
import { getRuntimeSettings } from "@/services/settings";
import {
  createTarget,
  deleteTarget,
  disableTarget,
  enableTarget,
  executeTarget,
  listTargets,
  updateTarget
} from "@/services/targets";
import type { Provider } from "@/types/provider";
import type { Target, TargetMode } from "@/types/target";

type TargetFormState = {
  provider_id: string;
  name: string;
  url: string;
  mode: TargetMode;
  poll_interval_seconds: string;
  enabled: boolean;
  last_status: string;
};

type TargetFilters = {
  providerId: string;
  enabled: "all" | "enabled" | "disabled";
  source: "all" | "provider" | "global" | "custom";
};

type TargetSort = "updated_desc" | "source" | "enabled";

const defaultFilters: TargetFilters = {
  providerId: "all",
  enabled: "all",
  source: "all"
};

const filterPresets: Array<{
  label: string;
  filters: TargetFilters;
}> = [
  {
    label: "Custom only",
    filters: {
      providerId: "all",
      enabled: "all",
      source: "custom"
    }
  },
  {
    label: "Enabled + Custom",
    filters: {
      providerId: "all",
      enabled: "enabled",
      source: "custom"
    }
  },
  {
    label: "Provider default only",
    filters: {
      providerId: "all",
      enabled: "all",
      source: "provider"
    }
  }
];

function getProviderDefaultPollIntervalSeconds(provider: Provider | undefined): number | null {
  const value = provider?.config_json?.default_poll_interval_seconds;
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (value < 10 || value > 3600) {
    return null;
  }
  return value;
}

function createInitialFormState(inheritedPollIntervalSeconds: number): TargetFormState {
  return {
    provider_id: "",
    name: "",
    url: "",
    mode: "browser",
    poll_interval_seconds: String(inheritedPollIntervalSeconds),
    enabled: true,
    last_status: ""
  };
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not run yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TargetManager() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [targets, setTargets] = useState<Target[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [globalDefaultPollIntervalSeconds, setGlobalDefaultPollIntervalSeconds] = useState(60);
  const [form, setForm] = useState<TargetFormState>(() => createInitialFormState(60));
  const [filters, setFilters] = useState<TargetFilters>(defaultFilters);
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<TargetSort>("updated_desc");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null);

  const providerMap = useMemo(() => {
    return new Map(providers.map((provider) => [String(provider.id), provider]));
  }, [providers]);

  const filteredTargets = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    const filtered = targets.filter((target) => {
      if (filters.providerId !== "all" && String(target.provider_id) !== filters.providerId) {
        return false;
      }

      if (filters.enabled === "enabled" && !target.enabled) {
        return false;
      }

      if (filters.enabled === "disabled" && target.enabled) {
        return false;
      }

      if (filters.source !== "all" && target.poll_interval_source !== filters.source) {
        return false;
      }

      if (normalizedKeyword) {
        const haystacks = [
          target.name,
          target.url,
          target.provider_name ?? "",
          target.provider_type ?? ""
        ]
          .join(" ")
          .toLowerCase();

        if (!haystacks.includes(normalizedKeyword)) {
          return false;
        }
      }

      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "enabled") {
        if (left.enabled !== right.enabled) {
          return left.enabled ? -1 : 1;
        }
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }

      if (sortBy === "source") {
        const sourceWeight: Record<Target["poll_interval_source"], number> = {
          custom: 0,
          provider: 1,
          global: 2
        };
        const sourceDiff = sourceWeight[left.poll_interval_source] - sourceWeight[right.poll_interval_source];
        if (sourceDiff !== 0) {
          return sourceDiff;
        }
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }

      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });
  }, [filters, keyword, sortBy, targets]);

  const selectedProvider = providerMap.get(form.provider_id);
  const selectedProviderDefaultPollIntervalSeconds =
    getProviderDefaultPollIntervalSeconds(selectedProvider);
  const inheritedPollIntervalSeconds =
    selectedProviderDefaultPollIntervalSeconds ?? globalDefaultPollIntervalSeconds;

  useEffect(() => {
    const providerId = searchParams.get("provider") ?? "all";
    const enabled = searchParams.get("enabled");
    const source = searchParams.get("source");

    setFilters({
      providerId,
      enabled:
        enabled === "enabled" || enabled === "disabled" || enabled === "all"
          ? enabled
          : "all",
      source:
        source === "provider" || source === "global" || source === "custom" || source === "all"
          ? source
          : "all"
    });
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (filters.providerId === "all") {
      params.delete("provider");
    } else {
      params.set("provider", filters.providerId);
    }

    if (filters.enabled === "all") {
      params.delete("enabled");
    } else {
      params.set("enabled", filters.enabled);
    }

    if (filters.source === "all") {
      params.delete("source");
    } else {
      params.set("source", filters.source);
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace((nextQuery ? `${pathname}?${nextQuery}` : pathname) as Route, { scroll: false });
    }
  }, [filters, pathname, router, searchParams]);

  function resetForm(nextProviderId?: string, nextProviders?: Provider[], nextGlobalDefault?: number) {
    const providerList = nextProviders ?? providers;
    const globalDefault = nextGlobalDefault ?? globalDefaultPollIntervalSeconds;
    const resolvedProviderId = nextProviderId ?? (providerList[0] ? String(providerList[0].id) : "");
    const provider = providerList.find((item) => String(item.id) === resolvedProviderId);
    const inheritedDefault = getProviderDefaultPollIntervalSeconds(provider) ?? globalDefault;

    setEditingId(null);
    setForm({
      ...createInitialFormState(inheritedDefault),
      provider_id: resolvedProviderId
    });
  }

  async function reloadData() {
    setLoading(true);
    try {
      const [targetResponse, providerResponse, runtimeSettings] = await Promise.all([
        listTargets(),
        listProviders(),
        getRuntimeSettings()
      ]);

      setTargets(targetResponse.items);
      setProviders(providerResponse.items);
      setGlobalDefaultPollIntervalSeconds(runtimeSettings.default_poll_interval_seconds);
      setError(null);

      if (editingId === null) {
        setForm((current) => {
          const resolvedProviderId =
            current.provider_id || (providerResponse.items[0] ? String(providerResponse.items[0].id) : "");
          const currentProvider = providerResponse.items.find(
            (provider) => String(provider.id) === current.provider_id
          );
          const resolvedProvider = providerResponse.items.find(
            (provider) => String(provider.id) === resolvedProviderId
          );

          const currentInheritedDefault =
            getProviderDefaultPollIntervalSeconds(currentProvider) ?? globalDefaultPollIntervalSeconds;
          const resolvedInheritedDefault =
            getProviderDefaultPollIntervalSeconds(resolvedProvider) ??
            runtimeSettings.default_poll_interval_seconds;
          const shouldApplyInheritedDefault =
            !current.poll_interval_seconds ||
            current.poll_interval_seconds === String(currentInheritedDefault);

          return {
            ...current,
            provider_id: resolvedProviderId,
            poll_interval_seconds: shouldApplyInheritedDefault
              ? String(resolvedInheritedDefault)
              : current.poll_interval_seconds
          };
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load targets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadData();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!form.provider_id) {
      setError("Create a provider first, then add a target.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        provider_id: Number(form.provider_id),
        name: form.name,
        url: form.url,
        mode: form.mode,
        poll_interval_seconds: Number(form.poll_interval_seconds),
        enabled: form.enabled,
        last_status: form.last_status || null
      };

      if (editingId) {
        await updateTarget(editingId, payload);
      } else {
        await createTarget(payload);
      }

      const nextProviderId = form.provider_id;
      resetForm(nextProviderId);
      await reloadData();
      setNotice(
        editingId
          ? "Target updated."
          : "Target created with the current inherited polling interval."
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save target");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(target: Target) {
    setEditingId(target.id);
    setForm({
      provider_id: String(target.provider_id),
      name: target.name,
      url: target.url,
      mode: target.mode,
      poll_interval_seconds: String(target.poll_interval_seconds),
      enabled: target.enabled,
      last_status: target.last_status ?? ""
    });
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("Delete this target?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteTarget(id);
      if (editingId === id) {
        resetForm();
      }
      await reloadData();
      setNotice("Target deleted.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete target");
    }
  }

  async function handleToggleTarget(target: Target) {
    setActioningId(target.id);
    setNotice(null);
    setError(null);
    try {
      if (target.enabled) {
        await disableTarget(target.id);
        setNotice(`Target disabled: ${target.name}`);
      } else {
        await enableTarget(target.id);
        setNotice(`Target enabled: ${target.name}`);
      }
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update target status");
    } finally {
      setActioningId(null);
    }
  }

  async function handleExecuteTarget(target: Target) {
    setActioningId(target.id);
    setNotice(null);
    setError(null);
    try {
      const result = await executeTarget(target.id);
      const base = result.has_change
        ? "Target executed and a change was detected."
        : "Target executed with no significant change.";
      const extra = result.diff_summary ? ` ${result.diff_summary}` : "";
      setNotice(`${base}${extra}`);
      await reloadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to execute target");
    } finally {
      setActioningId(null);
    }
  }

  const formUsesProviderDefault =
    selectedProviderDefaultPollIntervalSeconds !== null &&
    Number(form.poll_interval_seconds || 0) === inheritedPollIntervalSeconds;
  const formUsesGlobalDefault =
    selectedProviderDefaultPollIntervalSeconds === null &&
    Number(form.poll_interval_seconds || 0) === globalDefaultPollIntervalSeconds;
  const hasActiveFilters =
    filters.providerId !== defaultFilters.providerId ||
    filters.enabled !== defaultFilters.enabled ||
    filters.source !== defaultFilters.source;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Targets"
        description="Manage monitored URLs, polling intervals, and runtime mode. Every result remains monitoring-only and always ends in manual confirmation."
      />

      {error ? <NoticeBanner tone="error" message={error} /> : null}

      {notice ? <NoticeBanner tone="success" message={notice} /> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Quick Filters</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Filter by provider, enabled state, and poll interval source to quickly locate custom targets or inherited defaults.
            </p>
          </div>
          <div className="text-sm text-slate-500">
            Showing {filteredTargets.length} of {targets.length} targets
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterPresets.map((preset) => {
            const isActive =
              filters.providerId === preset.filters.providerId &&
              filters.enabled === preset.filters.enabled &&
              filters.source === preset.filters.source;

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => setFilters(preset.filters)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilters(defaultFilters)}
            disabled={!hasActiveFilters}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            Reset Filters
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Provider</span>
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              value={filters.providerId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, providerId: event.target.value }))
              }
            >
              <option value="all">All providers</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.type})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Enabled</span>
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              value={filters.enabled}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  enabled: event.target.value as TargetFilters["enabled"]
                }))
              }
            >
              <option value="all">All states</option>
              <option value="enabled">Enabled only</option>
              <option value="disabled">Disabled only</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Source</span>
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              value={filters.source}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  source: event.target.value as TargetFilters["source"]
                }))
              }
            >
              <option value="all">All sources</option>
              <option value="provider">Provider default</option>
              <option value="global">Global default</option>
              <option value="custom">Custom only</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Search</span>
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search by target name, URL, or provider"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Sort</span>
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TargetSort)}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="source">Poll source</option>
              <option value="enabled">Enabled first</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{editingId ? "Edit Target" : "Create Target"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            New targets inherit `provider.config_json.default_poll_interval_seconds` when present. If a provider does not define one, the form falls back to the global default interval.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Provider</span>
              <select
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.provider_id}
                onChange={(event) =>
                  setForm((current) => {
                    const nextProviderId = event.target.value;
                    const nextProvider = providerMap.get(nextProviderId);
                    const nextInheritedDefault =
                      getProviderDefaultPollIntervalSeconds(nextProvider) ??
                      globalDefaultPollIntervalSeconds;
                    const currentUsesInheritedDefault =
                      !current.poll_interval_seconds ||
                      current.poll_interval_seconds === String(inheritedPollIntervalSeconds);

                    return {
                      ...current,
                      provider_id: nextProviderId,
                      poll_interval_seconds: currentUsesInheritedDefault
                        ? String(nextInheritedDefault)
                        : current.poll_interval_seconds
                    };
                  })
                }
                disabled={providers.length === 0}
              >
                {providers.length === 0 ? <option value="">Create a provider first</option> : null}
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.type})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Example: GLM offer page"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">URL</span>
              <input
                type="url"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.url}
                onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://open.bigmodel.cn/"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Mode</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  value={form.mode}
                  onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as TargetMode }))}
                >
                  <option value="browser">browser</option>
                  <option value="http">http</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Poll Interval (sec)</span>
                <input
                  type="number"
                  min={10}
                  max={3600}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                  value={form.poll_interval_seconds}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, poll_interval_seconds: event.target.value }))
                  }
                  required
                />
                <div className="mt-2 text-xs text-slate-500">
                  Provider default: {selectedProviderDefaultPollIntervalSeconds ?? "not set"} sec. Global fallback:{" "}
                  {globalDefaultPollIntervalSeconds} sec.
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {formUsesProviderDefault
                    ? "This target is currently using the provider-level default interval."
                    : formUsesGlobalDefault
                    ? "This target is currently using the global default interval."
                    : "This target is currently using a per-target custom interval."}
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Status Note</span>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
                value={form.last_status}
                onChange={(event) => setForm((current) => ({ ...current, last_status: event.target.value }))}
                placeholder="Example: idle / waiting / observing"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enable this target
            </label>

            <div className="flex gap-3">
              <ActionButton
                type="submit"
                tone="primary"
                disabled={submitting || providers.length === 0}
              >
                {submitting ? "Saving..." : editingId ? "Save Changes" : "Create Target"}
              </ActionButton>
              <ActionButton type="button" tone="secondary" onClick={() => resetForm()}>
                Reset
              </ActionButton>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Target List</h2>
            <p className="mt-2 text-sm text-slate-600">
              Add multiple monitoring targets per provider, run them manually, toggle them on or off, or open the official page for manual follow-up.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Provider</th>
                  <th className="px-6 py-4 font-medium">Mode</th>
                  <th className="px-6 py-4 font-medium">Polling Strategy</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Last Checked</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      Loading targets...
                    </td>
                  </tr>
                ) : filteredTargets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      No targets match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredTargets.map((target) => {
                    const behaviorBadge = getPollIntervalBehaviorBadge(target.poll_interval_source);
                    const sourceBadge = getPollIntervalSourceBadge(target.poll_interval_source);
                    const enabledBadge = getEnabledBadge(target.enabled);

                    return (
                      <tr key={target.id} className="align-top">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{target.name}</div>
                          <a
                            href={target.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block max-w-[340px] truncate text-xs text-blue-600 hover:text-blue-700"
                          >
                            {target.url}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          <div>{target.provider_name ?? "Unknown"}</div>
                          <div className="mt-1 text-xs text-slate-500">{target.provider_type ?? "-"}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{target.mode}</td>
                        <td className="px-6 py-4">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <div className="space-y-2">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">effective</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {target.effective_poll_interval_seconds} sec
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">provider</div>
                                <div className="mt-1">
                                  {target.provider_default_poll_interval_seconds ?? "not set"} sec
                                </div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">global</div>
                                <div className="mt-1">{globalDefaultPollIntervalSeconds} sec</div>
                              </div>
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">source</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] ${sourceBadge.className}`}
                                  >
                                    {sourceBadge.label}
                                  </span>
                                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${behaviorBadge.className}`}>
                                    {behaviorBadge.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-700">{target.last_status ?? "Not set"}</div>
                          <div className="mt-2 text-xs text-slate-500">
                            Last start: {formatDateTime(target.last_run_started_at)}
                          </div>
                          <div className="mt-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${enabledBadge.className}`}>
                              {enabledBadge.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{formatDateTime(target.last_checked_at)}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton
                              type="button"
                              tone="link"
                              size="sm"
                              onClick={() => void handleExecuteTarget(target)}
                              disabled={actioningId === target.id || !target.enabled}
                            >
                              Run Now
                            </ActionButton>
                            <ActionButton
                              type="button"
                              tone="secondary"
                              size="sm"
                              onClick={() => void handleToggleTarget(target)}
                              disabled={actioningId === target.id}
                            >
                              {target.enabled ? "Disable" : "Enable"}
                            </ActionButton>
                            <ActionButton type="button" tone="secondary" size="sm" onClick={() => startEdit(target)}>
                              Edit
                            </ActionButton>
                            <ActionButton href={target.url} target="_blank" rel="noreferrer" tone="link" size="sm">
                              Open Official Page
                            </ActionButton>
                            <ActionButton type="button" tone="danger" size="sm" onClick={() => void handleDelete(target.id)}>
                              Delete
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
