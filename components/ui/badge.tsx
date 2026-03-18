/**
 * Badge Component
 * Visual indicator badges for anime metadata
 */

import { cn } from "@/lib/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Badge({ children, variant = "default", size = "md", className }: BadgeProps) {
  const variants = {
    default: "bg-white/10 text-foreground",
    primary: "bg-primary/20 text-primary",
    secondary: "bg-secondary/20 text-secondary",
    success: "bg-green-500/20 text-green-400",
    warning: "bg-yellow-500/20 text-yellow-400",
    danger: "bg-red-500/20 text-red-400",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Language Badge - Shows Sub/Dub availability
 */
export interface LanguageBadgeProps {
  sub?: boolean;
  dub?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LanguageBadge({ sub = true, dub = false, size = "sm", className }: LanguageBadgeProps) {
  if (sub && dub) {
    return (
      <Badge variant="primary" size={size} className={className}>
        Sub | Dub
      </Badge>
    );
  }

  if (dub) {
    return (
      <Badge variant="secondary" size={size} className={className}>
        Dub
      </Badge>
    );
  }

  if (sub) {
    return (
      <Badge variant="default" size={size} className={className}>
        Sub
      </Badge>
    );
  }

  return null;
}
