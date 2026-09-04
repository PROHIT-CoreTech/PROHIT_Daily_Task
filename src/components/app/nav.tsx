"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/my-day", label: "My Day", ready: true },
  { href: "/lists", label: "Lists", ready: true },
  { href: "/board", label: "Flow Board", ready: true },
  { href: "/calendar", label: "Calendar", ready: true },
  { href: "/team", label: "Team", ready: true },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname?.startsWith(link.href + "/");
        if (!link.ready) {
          return (
            <span
              key={link.href}
              title="Coming soon"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground/60"
            >
              {link.label}
              <span className="text-xs">Soon</span>
            </span>
          );
        }
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              active && "bg-primary text-primary-foreground hover:bg-primary"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
