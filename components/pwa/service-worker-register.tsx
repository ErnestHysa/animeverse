/**
 * PWA Service Worker Registration
 * Registers the service worker for offline support
 */

"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdate(true);
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });

    // Listen for controlling service worker
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdate(false);
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
      <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-4">
        <span className="text-sm">A new version is available!</span>
        <button
          onClick={handleUpdate}
          className="px-4 py-1 bg-white text-primary rounded font-medium text-sm hover:bg-white/90 transition-colors"
        >
          Update Now
        </button>
      </div>
    </div>
  );
}
