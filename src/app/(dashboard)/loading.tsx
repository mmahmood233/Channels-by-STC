function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-100 ${className}`} />;
}

export default function DashboardRouteLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page data">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-28 rounded-full" />
        </div>

        <div className="flex gap-3">
          <SkeletonBlock className="h-11 w-32 rounded-xl" />
          <SkeletonBlock className="h-11 w-36 rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>

      <div className="flex flex-wrap gap-2">
        <SkeletonBlock className="h-8 w-24 rounded-full" />
        <SkeletonBlock className="h-8 w-36 rounded-full" />
        <SkeletonBlock className="h-8 w-32 rounded-full" />
        <SkeletonBlock className="h-8 w-28 rounded-full" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-soft">
        <div className="grid grid-cols-5 gap-4 border-b border-surface-100 px-5 py-4">
          <SkeletonBlock className="h-4 rounded-full" />
          <SkeletonBlock className="h-4 rounded-full" />
          <SkeletonBlock className="h-4 rounded-full" />
          <SkeletonBlock className="h-4 rounded-full" />
          <SkeletonBlock className="h-4 rounded-full" />
        </div>

        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid grid-cols-5 gap-4 border-b border-surface-50 px-5 py-5 last:border-0">
            <SkeletonBlock className="h-5 rounded-full" />
            <SkeletonBlock className="h-5 rounded-full" />
            <SkeletonBlock className="h-5 rounded-full" />
            <SkeletonBlock className="h-5 rounded-full" />
            <SkeletonBlock className="h-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
