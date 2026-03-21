export interface NavigationItem {
  label: string;
  href: string;
  caption: string;
  icon:
    | "dashboard"
    | "calls"
    | "knowledge"
    | "integrations"
    | "agent"
    | "calendar"
    | "analytics"
    | "team"
    | "admin"
    | "tenants"
    | "providers"
    | "logs";
}

export const workspaceNavigation: NavigationItem[] = [
  {
    label: "Overview",
    href: "/workspace",
    caption: "Health, onboarding, and agent posture",
    icon: "dashboard",
  },
  {
    label: "Calls",
    href: "/workspace/calls",
    caption: "Call logs, transcripts, and handoff visibility",
    icon: "calls",
  },
  {
    label: "Knowledge",
    href: "/workspace/knowledge",
    caption: "Trusted sources, product data, and FAQs",
    icon: "knowledge",
  },
  {
    label: "Integrations",
    href: "/workspace/integrations",
    caption: "Voice, calendar, CRM, and provider links",
    icon: "integrations",
  },
  {
    label: "Agent",
    href: "/workspace/agent",
    caption: "Greeting, rules, and escalation behavior",
    icon: "agent",
  },
  {
    label: "Calendar",
    href: "/workspace/calendar",
    caption: "Booking types, confirmation rules, and actions",
    icon: "calendar",
  },
  {
    label: "Analytics",
    href: "/workspace/analytics",
    caption: "Intent mix, containment, and booking trends",
    icon: "analytics",
  },
  {
    label: "Team",
    href: "/workspace/team",
    caption: "Members, handoff targets, and coverage",
    icon: "team",
  },
];

export const adminNavigation: NavigationItem[] = [
  {
    label: "Overview",
    href: "/admin",
    caption: "Platform health and internal operating view",
    icon: "admin",
  },
  {
    label: "Tenants",
    href: "/admin/tenants",
    caption: "Business accounts, plans, and rollout risk",
    icon: "tenants",
  },
  {
    label: "Providers",
    href: "/admin/providers",
    caption: "Credentials, model routing, and rotations",
    icon: "providers",
  },
  {
    label: "Logs",
    href: "/admin/logs",
    caption: "Audit events, failures, and flags",
    icon: "logs",
  },
];
