"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2 } from "lucide-react";

interface RefreshDashboardButtonProps {
  lastUpdated?: string;
}

export default function RefreshDashboardButton({
  lastUpdated,
}: RefreshDashboardButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2.5">
      {lastUpdated && (
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>Live at {lastUpdated}</span>
        </span>
      )}

      <button
        onClick={handleRefresh}
        disabled={isPending}
        title="Re-query database for real-time counts"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg transition shadow-xs disabled:opacity-60"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 text-blue-600 ${isPending ? "animate-spin" : ""}`}
        />
        <span>{isPending ? "Auditing..." : "Refresh Live Audit"}</span>
      </button>
    </div>
  );
}
