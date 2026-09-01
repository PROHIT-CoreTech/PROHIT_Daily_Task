"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Calendar, Kanban, Timer, BarChart3, Settings, Lock } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NOMENCLATURE } from "@/lib/constants";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const NAV_ITEMS = [
  { href: "/my-day", label: NOMENCLATURE.todayDashboard, icon: Sun },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/flow-board", label: NOMENCLATURE.kanbanView, icon: Kanban, feature: "flow_board" as const },
  { href: "/deep-work", label: NOMENCLATURE.focusTimer, icon: Timer, feature: "deep_work" as const },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { activeWorkspace } = useWorkspace();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-primary text-white/90 min-h-screen">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold">P</div>
        <span className="font-semibold text-white">PROHIT</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const locked = item.feature && activeWorkspace && !activeWorkspace.entitlements.features[item.feature];
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={17} />
                {item.label}
              </span>
              {locked && <Lock size={13} className="text-module" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <WorkspaceSwitcher />
      </div>
    </aside>
  );
}
