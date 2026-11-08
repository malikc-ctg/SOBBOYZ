import { Skeleton } from '@/components/ui/skeleton';

export default function SalesOSLoading() {
  return (
    <div className="min-h-screen bg-[#020813] p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl bg-slate-800/80" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 bg-slate-800/80" />
            <Skeleton className="h-3 w-56 bg-slate-800/60" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg bg-slate-800/80" />
          <Skeleton className="h-9 w-28 rounded-lg bg-slate-800/80" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[520px] rounded-2xl bg-slate-900/70" />
        <Skeleton className="h-[520px] lg:col-span-2 rounded-2xl bg-slate-900/70" />
      </div>
    </div>
  );
}
