import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Bell, Boxes, ClipboardList, LayoutDashboard, Settings, TimerReset } from "lucide-react";

const navItems: Array<{
  href: Route;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/providers", label: "Providers", icon: Boxes },
  { href: "/targets", label: "Targets", icon: ClipboardList },
  { href: "/runs", label: "Runs", icon: TimerReset },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl border border-white/70 bg-slatepanel px-5 py-6 text-slate-50 shadow-panel">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Cloud Offer Watch</div>
            <div className="mt-3 text-2xl font-semibold">Operations Console</div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Focused on GLM and Aliyun page monitoring. This workspace only observes, captures changes, and guides the user back to official pages for manual confirmation.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <div className="font-medium text-white">Dev Helper</div>
            <p className="mt-2 leading-6">
              browser-use CLI is only for page exploration and selector debugging during development. Playwright remains the production monitoring runtime.
            </p>
          </div>
        </aside>

        <main className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-panel backdrop-blur">
          {children}
        </main>
      </div>
    </div>
  );
}
