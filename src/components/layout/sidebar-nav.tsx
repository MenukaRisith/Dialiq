"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  CalendarDays,
  ChartColumnIncreasing,
  KeyRound,
  LayoutDashboard,
  PhoneCall,
  PlugZap,
  ScrollText,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";

import type { NavigationItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  dashboard: LayoutDashboard,
  calls: PhoneCall,
  knowledge: Waypoints,
  integrations: PlugZap,
  agent: Bot,
  calendar: CalendarDays,
  analytics: ChartColumnIncreasing,
  team: Users,
  admin: ShieldCheck,
  tenants: Building2,
  providers: KeyRound,
  logs: ScrollText,
} as const;

export function SidebarNav({
  items,
}: {
  items: NavigationItem[];
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive =
          pathname === item.href ||
          (item.href !== "/workspace" &&
            item.href !== "/admin" &&
            pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-start gap-3 rounded-[22px] border px-4 py-3",
              isActive
                ? "border-[color:rgba(182,99,42,0.28)] bg-[var(--accent-soft)] text-[var(--foreground)] shadow-[var(--shadow-soft)]"
                : "border-transparent text-[var(--muted-strong)] hover:border-[color:var(--border)] hover:bg-white/60 hover:text-[var(--foreground)]",
            )}
          >
            <span
              className={cn(
                "mt-0.5 rounded-2xl p-2",
                isActive
                  ? "bg-white text-[var(--accent)]"
                  : "bg-black/4 text-[var(--muted)] group-hover:bg-white group-hover:text-[var(--accent)]",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="block text-xs leading-5 opacity-80">{item.caption}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
