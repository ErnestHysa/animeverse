export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-700" />
        <div className="h-4 w-32 bg-gray-700 rounded" />
      </div>
    </div>
  );
}
