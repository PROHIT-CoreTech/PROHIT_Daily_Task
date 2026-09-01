"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, Calendar, Kanban, Timer, BarChart3, Settings } from "lucide-react";
import { NOMENCLATURE } from "@/lib/constants";

const ITEMS = [
  { href: "/my-day", label: NOMENCLATURE.todayDashboard, icon: Sun },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/flow-board", label: NOMENCLATURE.kanbanView, icon: Kanban },
  { href: "/deep-work", label: NOMENCLATURE.focusTimer, icon: Timer },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-border bg-surface py-1.5">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-1 py-1 text-[10px] leading-tight text-center ${active ? "text-accent" : "text-muted"}`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
