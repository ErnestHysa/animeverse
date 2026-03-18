/**
 * Badge Component
 * For displaying status, tags, and labels
 */

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-primary/20 text-primary border border-primary/20",
        secondary: "bg-secondary/20 text-secondary border border-secondary/20",
        success: "bg-green-500/20 text-green-400 border border-green-500/20",
        warning: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/20",
        destructive: "bg-red-500/20 text-red-400 border border-red-500/20",
        outline: "border border-white/20 bg-transparent text-foreground",
        glass: "bg-white/5 backdrop-blur-sm border border-white/10",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        default: "px-3 py-1 text-sm",
        lg: "px-4 py-1.5 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </div>
  );
}

/**
 * Status Badge Presets
 */
export function AiringBadge() {
  return (
    <Badge variant="success" dot>
      AIRING
    </Badge>
  );
}

export function UpcomingBadge() {
  return (
    <Badge variant="secondary">
      UPCOMING
    </Badge>
  );
}

export function CompletedBadge() {
  return (
    <Badge variant="outline">
      COMPLETED
    </Badge>
  );
}

export function HdBadge() {
  return (
    <Badge variant="glass" size="sm">
      HD
    </Badge>
  );
}

export function NewBadge() {
  return (
    <Badge variant="destructive" size="sm">
      NEW
    </Badge>
  );
}
