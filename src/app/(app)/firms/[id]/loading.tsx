export default function FirmDetailLoading() {
  return (
    <div className="w-full space-y-6 animate-pulse max-w-5xl mx-auto" aria-busy="true" aria-label="Loading firm details">
      {/* Header Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-3">
        <div className="h-4 w-36 bg-slate-200 rounded" />
        <div className="h-7 w-64 bg-slate-300 rounded" />
        <div className="h-4 w-48 bg-slate-100 rounded" />
      </div>

      {/* Editor Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="space-y-3">
            <div className="h-10 w-full bg-slate-100 rounded-lg" />
            <div className="h-10 w-full bg-slate-100 rounded-lg" />
            <div className="h-10 w-full bg-slate-100 rounded-lg" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full bg-slate-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
