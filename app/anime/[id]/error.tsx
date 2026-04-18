'use client';
import { useEffect } from 'react';

export default function AnimeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Failed to load anime</h2>
        <p className="text-gray-400 mb-6">{process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong. Please try again.'}</p>
        <button onClick={reset} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Try again</button>
      </div>
    </div>
  );
}
