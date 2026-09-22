export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-slate-200 rounded-md" />
        <div className="h-4 w-72 bg-slate-200 rounded-md" />
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-4"
          >
            <div className="h-12 w-12 bg-slate-100 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-6 w-16 bg-slate-300 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Table Skeleton */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="h-5 w-44 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
        </div>
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
              <div className="h-4 w-1/3 bg-slate-100 rounded" />
              <div className="h-4 w-1/4 bg-slate-100 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-6 w-16 bg-slate-200 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
