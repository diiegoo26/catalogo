export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-busy className="animate-pulse">
      <div className="mb-3 h-3 w-28 rounded bg-line" />
      <div className="mb-6 h-8 w-64 rounded bg-line" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i}>
            <div className="aspect-square rounded-card bg-mist ring-1 ring-line" />
            <div className="mt-3 h-3 w-3/4 rounded bg-line" />
            <div className="mt-2 h-3 w-1/3 rounded bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div aria-busy className="grid animate-pulse gap-8 md:grid-cols-2">
      <div className="aspect-square rounded-card bg-mist ring-1 ring-line" />
      <div className="space-y-4">
        <div className="h-3 w-24 rounded bg-line" />
        <div className="h-8 w-3/4 rounded bg-line" />
        <div className="h-5 w-24 rounded bg-line" />
        <div className="h-24 rounded-2xl bg-mist ring-1 ring-line" />
        <div className="h-12 rounded-full bg-line" />
      </div>
    </div>
  );
}
