import type { AlertLevel } from "@/types/alert";
import type { Target } from "@/types/target";

type StatusBadge = {
  label: string;
  className: string;
};

const toneClassNames = {
  neutral: "bg-slate-200 text-slate-700",
  neutralSoft: "bg-slate-100 text-slate-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-blue-100 text-blue-700"
} as const;

export function getAlertLevelBadge(level: AlertLevel): StatusBadge {
  if (level === "success") {
    return { label: "Success", className: toneClassNames.success };
  }
  if (level === "warning") {
    return { label: "Warning", className: toneClassNames.warning };
  }
  if (level === "error") {
    return { label: "Error", className: toneClassNames.danger };
  }
  return { label: "Info", className: toneClassNames.neutral };
}

export function getRunStatusBadge(status: string): StatusBadge {
  if (status === "success") {
    return { label: "Success", className: toneClassNames.success };
  }
  if (status === "failed") {
    return { label: "Failed", className: toneClassNames.danger };
  }
  return { label: "Running", className: toneClassNames.warning };
}

export function getEnabledBadge(enabled: boolean): StatusBadge {
  return enabled
    ? { label: "Enabled", className: toneClassNames.success }
    : { label: "Disabled", className: toneClassNames.neutral };
}

export function getReadBadge(isRead: boolean): StatusBadge {
  return isRead
    ? { label: "Read", className: toneClassNames.neutralSoft }
    : { label: "Unread", className: toneClassNames.info };
}

export function getPollIntervalSourceBadge(
  source: Target["poll_interval_source"]
): StatusBadge {
  if (source === "provider") {
    return { label: "Provider", className: toneClassNames.info };
  }
  if (source === "global") {
    return { label: "Global", className: toneClassNames.neutralSoft };
  }
  return { label: "Custom", className: toneClassNames.warning };
}

export function getPollIntervalBehaviorBadge(
  source: Target["poll_interval_source"]
): StatusBadge {
  if (source === "provider") {
    return { label: "Using provider default", className: toneClassNames.info };
  }
  if (source === "global") {
    return { label: "Using global default", className: toneClassNames.info };
  }
  return { label: "Custom per-target interval", className: toneClassNames.warning };
}
