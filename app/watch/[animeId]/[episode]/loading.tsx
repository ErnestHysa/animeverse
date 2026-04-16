"use client";

export default function WatchPageLoading() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Video Player Skeleton */}
      <div className="w-full max-w-6xl mx-auto px-4 pt-6">
        <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
          {/* Pulsing overlay to simulate loading */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-pulse" />
          {/* Play button placeholder */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gray-600/50 flex items-center justify-center">
              <div className="w-0 h-0 border-t-8 border-b-8 border-l-12 border-t-transparent border-b-transparent border-l-gray-400/50 ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Title & Info Skeleton */}
      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-4">
        {/* Title */}
        <div className="h-8 bg-gray-800 rounded-md w-2/3 animate-pulse" />
        {/* Episode info */}
        <div className="h-5 bg-gray-800 rounded-md w-1/3 animate-pulse" />
        {/* Description lines */}
        <div className="space-y-2 mt-4">
          <div className="h-4 bg-gray-800 rounded-md w-full animate-pulse" />
          <div className="h-4 bg-gray-800 rounded-md w-5/6 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded-md w-4/6 animate-pulse" />
        </div>
        {/* Action buttons */}
        <div className="flex gap-3 mt-4">
          <div className="h-10 w-28 bg-gray-800 rounded-md animate-pulse" />
          <div className="h-10 w-28 bg-gray-800 rounded-md animate-pulse" />
        </div>
      </div>
    </div>
  );
}
