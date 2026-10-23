import React from "react";
import { HazeData } from "../services/hazeService";

interface HazeSummaryProps {
  data: HazeData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onShowLocation: () => void;
  isLocating: boolean;
  locationError: string | null;
  onDismissLocationError: () => void;
}

export const HazeSummary: React.FC<HazeSummaryProps> = ({
  data,
  isLoading,
  onRefresh,
  onShowLocation,
  isLocating,
  locationError,
  onDismissLocationError,
}) => {
  const summary = data?.summary;
  const overall = data?.overall;

  return (
    <section aria-label="Singapore Haze Situation Summary" className="w-full">
      {/* Location Error notification if denied */}
      {locationError && (
        <div
          role="alert"
          className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-medium">{locationError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissLocationError}
            className="text-amber-800 hover:text-amber-950 font-medium px-2 py-1 rounded-md text-xs hover:bg-amber-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Summary Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        {/* Top Header of Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Singapore Haze Situation
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>National 24-Hour PSI:</span>
              <span
                className="font-bold tabular-nums"
                style={{ color: overall?.color || "#0f172a" }}
              >
                {overall?.psi ?? "—"}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium" style={{ color: overall?.color || "#64748b" }}>
                {overall?.band ?? "Checking..."}
              </span>
            </div>
          </div>

          {/* Action Buttons: Refresh & Show My Location */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={onShowLocation}
              disabled={isLocating}
              aria-label="Show My Location"
              className="min-h-[40px] px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              {isLocating ? (
                <svg
                  className="w-3.5 h-3.5 animate-spin text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
              <span>{isLocating ? "Locating..." : "Show My Location"}</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              aria-label="Refresh Data"
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <svg
                className={`w-3.5 h-3.5 text-slate-200 ${
                  isLoading ? "animate-spin" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isLoading ? "Refreshing..." : "Refresh Data"}</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Summary Pillars */}
        <div className="grid grid-cols-3 gap-3 pt-3">
          {/* Highest PSI */}
          <div className="flex flex-col">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Highest PSI
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                {summary?.highestPsi !== null && summary?.highestPsi !== undefined
                  ? summary.highestPsi
                  : "—"}
              </span>
            </div>
            <div className="text-xs font-medium text-slate-600 truncate mt-0.5">
              {summary?.highestPsiRegion || "—"}
            </div>
          </div>

          {/* Highest PM2.5 */}
          <div className="flex flex-col border-l border-slate-100 pl-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Highest PM2.5
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900">
                {summary?.highestPm25 !== null && summary?.highestPm25 !== undefined
                  ? summary.highestPm25
                  : "—"}
              </span>
              <span className="text-[11px] text-slate-500 font-sans">µg/m³</span>
            </div>
            <div className="text-xs font-medium text-slate-600 truncate mt-0.5">
              {summary?.highestPm25Region || "—"}
            </div>
          </div>

          {/* Updated */}
          <div className="flex flex-col border-l border-slate-100 pl-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Updated
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base sm:text-xl font-bold text-slate-900 truncate">
                {summary?.updatedAt || "—"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              Singapore Time (SGT)
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
