import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  accent = false,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={cn(
        "dialiq-glow relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] backdrop-blur-xl",
        accent &&
          "bg-[linear-gradient(145deg,rgba(255,251,246,0.98),rgba(255,243,230,0.94))]",
        className,
      )}
    >
      <div className="relative z-10">{children}</div>
    </section>
  );
}
