/**
 * Error Fallback Components
 * Reusable error UI components for different contexts
 */

import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home, Film } from "lucide-react";
import Link from "next/link";

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showHome?: boolean;
  icon?: "alert" | "film";
}

export function ErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred while loading this content.",
  onRetry,
  showHome = true,
  icon = "alert",
}: ErrorFallbackProps) {
  return (
    <div role="alert" className="flex items-center justify-center p-8 min-h-[200px]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          {icon === "alert" ? (
            <AlertCircle className="w-8 h-8 text-red-500" />
          ) : (
            <Film className="w-8 h-8 text-red-500" />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm mb-4">{message}</p>
        <div className="flex gap-3 justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="default" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          {showHome && (
            <Link href="/" className="no-underline">
              <Button variant="outline" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error fallback for cards/grids
 */
export function CardErrorFallback({ message = "Failed to load" }: { message?: string }) {
  return (
    <div className="aspect-[3/4] rounded-xl bg-muted/30 flex flex-col items-center justify-center p-4 text-center">
      <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Section error fallback with minimal UI
 */
export function SectionErrorFallback({
  title,
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl bg-muted/20 p-8 text-center">
      <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
      <h3 className="font-medium mb-1">{title || "Failed to load section"}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This content could not be loaded at this time.
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      )}
    </div>
  );
}
