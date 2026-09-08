export default function Loading() {
  return (
    <div className="p-8">
      <div className="mb-4 h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="space-y-2">
        <div className="h-5 w-64 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-56 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}
