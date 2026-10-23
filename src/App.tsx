/**
 * Singapore Haze Map
 * Live air-quality conditions across Singapore on an interactive MapLibre map.
 * Data source: Official Singapore Government API (NEA via data.gov.sg) via /api/haze.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchHazeData,
  HazeData,
  OFFICIAL_PSI_CATEGORIES,
} from "./services/hazeService";
import { HazeMap } from "./components/HazeMap";
import { HazeSummary } from "./components/HazeSummary";
import { HazeLegend } from "./components/HazeLegend";

export default function App() {
  const [data, setData] = useState<HazeData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Map state
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [activeBandFilter, setActiveBandFilter] = useState<string | null>(null);

  // User location state
  const [userLocation, setUserLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Load Haze Data from /api/haze
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const result = await fetchHazeData(isRefresh);
      setData(result);
    } catch (err: unknown) {
      console.error("Error loading haze data:", err);
      // Clean, user-friendly error message as required
      setErrorMessage(
        "Latest Singapore haze data is temporarily unavailable. Please try again."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Handle Geolocation request
  const handleShowLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Location permission was not granted.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setUserLocation({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
        });
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation failure:", err);
        setLocationError("Location permission was not granted.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
                Singapore Haze Map
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live PSI &amp; PM2.5 conditions across Singapore
            </p>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-3 shrink-0 text-right">
            {data?.summary.updatedAt && (
              <div className="hidden sm:flex flex-col items-end text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  Updated {data.summary.updatedAt}
                </span>
                <span className="text-[11px] text-slate-400">
                  NEA Official Feed
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 flex flex-col gap-4">
        {/* Loading Banner when initial data is being fetched */}
        {isLoading && !data && (
          <div
            role="status"
            className="w-full p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-2xs animate-pulse"
          >
            <svg
              className="w-4 h-4 animate-spin text-blue-600 shrink-0"
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
            <span>Loading latest Singapore haze data...</span>
          </div>
        )}

        {/* Error Notification with Try Again Button */}
        {errorMessage && (
          <div
            role="alert"
            className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-red-800">
              <svg
                className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="font-semibold">{errorMessage}</p>
                <p className="text-red-700 mt-0.5 text-xs">
                  Please verify your network connection and retry.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadData(true)}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl transition-colors self-start sm:self-auto shrink-0 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Compact Summary Panel Above Map */}
        <HazeSummary
          data={data}
          isLoading={isRefreshing}
          onRefresh={() => loadData(true)}
          onShowLocation={handleShowLocation}
          isLocating={isLocating}
          locationError={locationError}
          onDismissLocationError={() => setLocationError(null)}
        />

        {/* Interactive Map Component */}
        <section aria-label="Interactive Singapore Air Quality Map" className="w-full">
          <div className="relative h-[55vh] min-h-[440px] sm:min-h-[520px] max-h-[680px] w-full">
            <HazeMap
              data={data}
              selectedRegionId={selectedRegionId}
              onSelectRegion={setSelectedRegionId}
              userLocation={userLocation}
            />
          </div>
        </section>

        {/* Legend & Scale */}
        <section aria-label="PSI and PM2.5 Scale Legend" className="w-full">
          <HazeLegend
            activeBand={activeBandFilter ?? undefined}
            onSelectBand={(band) => setActiveBandFilter(band)}
          />
        </section>

        {/* Detailed Regional Breakdown Cards */}
        {data && data.regions && (
          <section aria-label="Regional Air Quality Breakdown" className="w-full mt-1">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Regional Readings
              </h3>
              <span className="text-xs text-slate-500">
                Tap any region to focus on map
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {data.regions.map((reg) => {
                const isSelected = selectedRegionId === reg.id;
                const isMatchFilter =
                  !activeBandFilter || reg.psiBand === activeBandFilter;

                return (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() =>
                      setSelectedRegionId(isSelected ? null : reg.id)
                    }
                    className={`text-left p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-white border-slate-900 shadow-md ring-2 ring-slate-900/10"
                        : "bg-white border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                    } ${!isMatchFilter ? "opacity-50" : "opacity-100"}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-bold text-sm text-slate-900">
                          {reg.name}
                        </span>
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                          style={{
                            color: reg.psiTextColor || reg.psiColor,
                            backgroundColor: reg.psiBgColor || "#f1f5f9",
                          }}
                        >
                          {reg.psiBand}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-slate-600">
                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-500">24-hr PSI:</span>
                          <span
                            className="font-bold font-mono text-base tabular-nums"
                            style={{ color: reg.psiColor }}
                          >
                            {reg.psi ?? "—"}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-500">1-hr PM2.5:</span>
                          <span className="font-semibold font-mono tabular-nums text-slate-800">
                            {reg.pm25OneHourly !== null
                              ? `${reg.pm25OneHourly} µg/m³`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between text-[11px] text-slate-500">
                          <span>24-hr PM2.5:</span>
                          <span className="font-mono tabular-nums">
                            {reg.pm25 !== null ? `${reg.pm25} µg/m³` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>View on Map</span>
                      <svg
                        className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Official NEA Health Advisory Reference Guide */}
        <section
          aria-label="Official Air Quality Health Guidelines"
          className="mt-2 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-2xs text-xs text-slate-600"
        >
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">
            Understanding Singapore Air Quality Indicators
          </h4>
          <p className="leading-relaxed mb-3">
            The National Environment Agency (NEA) reports both the <strong>24-Hour PSI</strong> and <strong>1-Hour PM2.5</strong> concentrations. 
            The 1-hour PM2.5 reading serves as an indicative guide on current haze conditions to help you make immediate decisions on outdoor activities.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <p className="font-semibold text-slate-800 mb-1">
                When PSI is Moderate (51–100):
              </p>
              <p>Normal activities can be continued by healthy persons and sensitive groups.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-1">
                When PSI is Unhealthy (101–200):
              </p>
              <p>
                Sensitive persons (elderly, pregnant women, children, persons with chronic lung disease) should reduce prolonged or strenuous outdoor physical exertion.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Official Attribution */}
      <footer className="mt-8 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <p className="font-medium text-slate-700">
            Singapore Haze Map
          </p>
          <p>
            Official data provided by the National Environment Agency (NEA) via data.gov.sg.
          </p>
          <p className="text-[11px] text-slate-400">
            Basemap &copy; OpenStreetMap contributors &copy; CARTO.
          </p>
        </div>
      </footer>
    </div>
  );
}
