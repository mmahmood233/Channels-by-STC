export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-end">
        <div className="h-9 w-32 rounded-xl bg-surface-100" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-100 bg-white px-5 py-4 shadow-soft">
            <div className="h-3 w-20 rounded bg-surface-100" />
            <div className="mt-2 h-7 w-14 rounded bg-surface-100" />
          </div>
        ))}
      </div>

      {/* Filter chips skeleton */}
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-full bg-surface-100" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-soft overflow-hidden">
        {/* Table header */}
        <div className="border-b border-surface-100 px-4 py-3 flex gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 w-20 rounded bg-surface-100" />
          ))}
        </div>
        {/* Table rows */}
        {[...Array(7)].map((_, i) => (
          <div key={i} className="border-b border-surface-50 px-4 py-3.5 flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-surface-100 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 rounded bg-surface-100" />
                <div className="h-2.5 w-36 rounded bg-surface-50" />
              </div>
            </div>
            <div className="h-5 w-20 rounded-full bg-surface-100" />
            <div className="h-3 w-24 rounded bg-surface-100" />
            <div className="h-5 w-16 rounded-full bg-surface-100" />
            <div className="h-3 w-28 rounded bg-surface-100" />
            <div className="h-3 w-24 rounded bg-surface-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
