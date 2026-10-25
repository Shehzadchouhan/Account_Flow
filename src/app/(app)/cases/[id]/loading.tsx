export default function CaseDetailLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse" aria-busy="true" aria-label="Loading case details">
      {/* Header Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-7 w-64 sm:w-80 bg-slate-300 rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-slate-200 rounded-lg" />
            <div className="h-9 w-32 bg-blue-200 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
          <div className="h-5 w-28 bg-slate-100 rounded" />
          <div className="h-5 w-36 bg-slate-100 rounded" />
          <div className="h-5 w-32 bg-slate-100 rounded" />
        </div>
      </div>

      {/* Checklist Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="h-5 w-44 bg-slate-200 rounded" />
          <div className="h-8 w-36 bg-slate-200 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-52 bg-slate-200 rounded" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-6 w-24 bg-slate-200 rounded-full" />
                <div className="h-8 w-20 bg-slate-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
