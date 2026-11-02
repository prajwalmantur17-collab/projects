/** Shimmering placeholders shown while lists load. Decorative only. */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`hr-skeleton ${className}`} aria-hidden="true" />
}

export function MachineCardSkeleton() {
  return (
    <div className="card-surface flex flex-col overflow-hidden" aria-hidden="true">
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-12 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function BookingRowSkeleton() {
  return (
    <div className="card-surface flex gap-3 p-4" aria-hidden="true">
      <Skeleton className="size-16 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

export function StatTileSkeleton() {
  return (
    <div className="card-surface flex items-center gap-4 p-4" aria-hidden="true">
      <Skeleton className="size-12 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-7 w-1/4" />
      </div>
    </div>
  )
}
