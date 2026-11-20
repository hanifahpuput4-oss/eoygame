'use client';

export default function DashboardLoader({
  label = 'Memuat data...',
  cards = 2,
  compact = false,
}: {
  label?: string;
  cards?: number;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="my-3 flex items-center gap-2.5 text-xs font-medium text-[var(--wood-text)]/70" role="status">
        <svg className="h-4 w-4 animate-spin text-[var(--orange-primary)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--wood-text)]/65">
        <svg className="h-4 w-4 animate-spin text-[var(--orange-primary)]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span>{label}</span>
      </div>

      {cards > 0 && (
        <div className={`grid gap-4 ${cards > 1 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="card-panel space-y-3 animate-pulse">
              <div className="flex items-center justify-between gap-3">
                <div className="h-5 w-2/5 rounded-lg bg-[#e8d5b0]/55" />
                <div className="h-5 w-16 rounded-lg bg-[#e8d5b0]/45" />
              </div>
              <div className="h-3.5 w-3/4 rounded bg-[#e8d5b0]/40" />
              <div className="h-3.5 w-1/2 rounded bg-[#e8d5b0]/35" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
