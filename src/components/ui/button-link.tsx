import Link from "next/link";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--foreground)] text-white shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:bg-[var(--surface-ink)]",
  secondary:
    "border border-[color:var(--border-strong)] bg-white/70 text-[var(--foreground)] hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:bg-white",
  ghost: "text-[var(--foreground)] hover:bg-white/70",
};

export function ButtonLink({
  href,
  children,
  className,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold tracking-[-0.01em]",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
