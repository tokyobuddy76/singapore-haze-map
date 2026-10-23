import React, { useState } from "react";
import { OFFICIAL_PSI_CATEGORIES } from "../services/hazeService";

interface HazeLegendProps {
  activeBand?: string;
  onSelectBand?: (band: string | null) => void;
}

export const HazeLegend: React.FC<HazeLegendProps> = ({
  activeBand,
  onSelectBand,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"psi" | "pm25">("psi");

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3 shadow-md shadow-slate-900/5 text-xs text-slate-700">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-900 text-xs">
            Air Quality Scale
          </span>
          <span className="text-slate-400 text-[11px]">·</span>
          <span className="text-[11px] text-slate-500">Official NEA Benchmark</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Tab selector */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg mr-1 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("psi")}
              className={`px-2 py-0.5 font-medium rounded-md transition-colors ${
                activeTab === "psi"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              PSI
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pm25")}
              className={`px-2 py-0.5 font-medium rounded-md transition-colors ${
                activeTab === "pm25"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              PM2.5
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 hover:text-slate-800 p-1 rounded-md hover:bg-slate-100 transition-colors"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse legend" : "Expand legend"}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {activeTab === "psi" ? (
        <div>
          {/* Horizontal compact indicator strip */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {OFFICIAL_PSI_CATEGORIES.map((cat) => {
              const isSelected = activeBand === cat.band;
              return (
                <button
                  key={cat.band}
                  type="button"
                  onClick={() =>
                    onSelectBand?.(isSelected ? null : cat.band)
                  }
                  className={`flex flex-col text-left p-1.5 rounded-lg border transition-all ${
                    isSelected
                      ? "ring-2 ring-slate-900 border-transparent shadow-xs"
                      : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/80"
                  }`}
                  style={{
                    backgroundColor: isSelected ? cat.bgColor : undefined,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-[11px] text-slate-900 truncate">
                      {cat.band}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-slate-600">
                    {cat.range}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Expanded details & health advisory */}
          {isExpanded && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2 text-[11px] text-slate-600">
              <p className="font-medium text-slate-800">
                Official NEA Health Advisories (24-Hour PSI):
              </p>
              <div className="space-y-1.5">
                {OFFICIAL_PSI_CATEGORIES.map((cat) => (
                  <div key={cat.band} className="flex items-start gap-2">
                    <span
                      className="w-2 h-2 rounded-full mt-1 shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <span className="font-semibold text-slate-900">
                        {cat.band} ({cat.range}):{" "}
                      </span>
                      <span>{cat.healthAdvisory}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PM2.5 1-Hour Banding Tab */
        <div className="pt-1">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { band: "Normal", range: "0 – 55 µg/m³", color: "#16a34a" },
              { band: "Elevated", range: "56 – 150 µg/m³", color: "#eab308" },
              { band: "High", range: "151 – 250 µg/m³", color: "#ea580c" },
              { band: "Very High", range: "> 250 µg/m³", color: "#dc2626" },
            ].map((p) => (
              <div
                key={p.band}
                className="flex flex-col p-1.5 rounded-lg border border-slate-100 bg-slate-50/60"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-[11px] text-slate-900 truncate">
                    {p.band}
                  </span>
                </div>
                <span className="text-[10px] font-mono tabular-nums text-slate-600">
                  {p.range}
                </span>
              </div>
            ))}
          </div>

          {isExpanded && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600">
              <p>
                <strong>1-Hour PM2.5</strong> provides real-time guidance on immediate outdoor activities, while <strong>24-Hour PSI</strong> represents overall daily exposure.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
