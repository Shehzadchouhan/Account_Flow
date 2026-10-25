export default function AppLoading() {
  return (
    <div className="w-full space-y-5 animate-pulse" aria-busy="true" aria-label="Loading page content">
      {/* Top Banner Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-48 sm:w-64 bg-slate-200 rounded-md" />
          <div className="h-4 w-72 sm:w-96 bg-slate-100 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded-lg shrink-0" />
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="h-10 w-full sm:w-72 bg-slate-100 rounded-lg" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="h-10 w-28 bg-slate-100 rounded-lg" />
          <div className="h-10 w-28 bg-slate-100 rounded-lg" />
          <div className="h-10 w-24 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
            <div className="h-3.5 w-24 bg-slate-200 rounded" />
            <div className="h-7 w-16 bg-slate-300 rounded" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Main Table / Queue Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-7 w-20 bg-slate-200 rounded-md" />
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-4 w-48 sm:w-64 bg-slate-200 rounded" />
                <div className="h-3 w-32 sm:w-44 bg-slate-100 rounded" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-6 w-20 bg-slate-200 rounded-full" />
                <div className="h-8 w-16 bg-slate-100 rounded-lg hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
