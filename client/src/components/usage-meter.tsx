import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UsageMeterProps {
  label: string;
  used: number;
  /** Infinity (unlimited tier) renders nothing — there's no ceiling worth showing. */
  limit: number;
  className?: string;
}

/** Proactive "X of Y used" indicator with an upgrade nudge once the limit is reached, shared across the dashboard, AI-suggestions panel, and map-detail pin count. */
export function UsageMeter({ label, used, limit, className }: UsageMeterProps) {
  if (!Number.isFinite(limit)) return null;

  const pct = Math.min(100, (used / limit) * 100);
  const atCap = used >= limit;
  const near = !atCap && pct >= 80;

  return (
    <div className={cn("space-y-1", className)} data-testid={`usage-meter-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium tabular-nums", atCap ? "text-destructive" : near ? "text-amber-600" : "text-foreground")}>
          {used} / {limit}
        </span>
      </div>
      <Progress
        value={pct}
        className={cn("h-1.5", atCap && "[&>div]:bg-destructive", near && "[&>div]:bg-amber-500")}
      />
      {(atCap || near) && (
        <Link href="/pricing" className="text-xs font-medium text-primary hover:underline">
          {atCap ? "Limit reached — upgrade for more →" : "Getting close — upgrade for more →"}
        </Link>
      )}
    </div>
  );
}
