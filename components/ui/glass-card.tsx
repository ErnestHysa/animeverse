/**
 * GlassCard Component
 * Glassmorphism effect with anime aesthetic
 */

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  shine?: boolean;
  glow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", size = "md", shine = false, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-xl border backdrop-blur-md transition-all duration-200",
          "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-br",
          // Variants
          {
            "bg-white/5 border-white/10 before:from-white/10 before:to-transparent": variant === "default",
            "bg-primary/10 border-primary/20 before:from-primary/20 before:to-transparent": variant === "primary",
            "bg-secondary/10 border-secondary/20 before:from-secondary/20 before:to-transparent": variant === "secondary",
            "bg-transparent border-white/20 before:from-white/5 before:to-transparent": variant === "outline",
          },
          // Sizes
          {
            "p-3": size === "sm",
            "p-4": size === "md",
            "p-6": size === "lg",
          },
          // Effects
          {
            "hover:border-primary/50": variant === "default",
            "hover:scale-[1.02] hover:shadow-xl": !glow,
            "hover:shadow-primary/20 hover:shadow-2xl": glow,
          },
          // Shine effect
          shine && "overflow-hidden group",
          className
        )}
        {...props}
      >
        {shine && (
          <div className="absolute inset-0 -translate-x-full group-hover:animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        )}
        {glow && (
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur-xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        )}
        <div className="relative">{children}</div>
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";
