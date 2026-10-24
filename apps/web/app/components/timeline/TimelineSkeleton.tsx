export default function TimelineSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex animate-pulse gap-3">
          <div className="mt-2 h-3 w-3 shrink-0 rounded-full bg-dim" />
          <div className="flex-1 rounded-[10px] border border-border bg-surface-alt p-4">
            <div className="mb-3 h-3 w-1/3 rounded bg-dim" />
            <div className="mb-2 h-5 w-5/6 rounded bg-dim" />
            <div className="h-3 w-full rounded bg-border" />
          </div>
        </div>
      ))}
    </div>
  );
}
