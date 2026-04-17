/**
 * Root Template
 * Wraps all pages with consistent layout and transition effects
 */

import { Suspense } from "react";

export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<PageTransitionFallback />}>
        <div className="flex-1 animate-fadeIn">
          {children}
        </div>
      </Suspense>
    </div>
  );
}

function PageTransitionFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
