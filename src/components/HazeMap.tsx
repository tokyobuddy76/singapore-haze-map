import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
  AttributionControl,
  GeoJSONSource,
  StyleSpecification,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { FeatureCollection } from "geojson";
import { RegionData, HazeData } from "../services/hazeService";

// Register the worker URL with MapLibre to resolve Vite worker bundling
if (typeof window !== "undefined") {
  setWorkerUrl(maplibreWorkerUrl);
}

interface HazeMapProps {
  data: HazeData | null;
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
  userLocation: { lng: number; lat: number } | null;
}

// Singapore center & bounds
const SINGAPORE_CENTER: [number, number] = [103.8198, 1.3521];
const DEFAULT_ZOOM = 10.5;

// Reputable, free, keyless OpenStreetMap-based basemap style.
// Uses direct inline specification to guarantee 100% availability without external JSON fetching,
// zero third-party font/sprite dependencies, and zero ad-blocker domain restrictions.
const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-tiles": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-layer",
      type: "raster",
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
      paint: {
        // Clean Light default: softened saturation and balanced brightness for haze overlay contrast
        "raster-saturation": -0.75,
        "raster-contrast": -0.05,
        "raster-brightness-min": 0.15,
        "raster-opacity": 0.92,
      },
    },
  ],
};

export const HazeMap: React.FC<HazeMapProps> = ({
  data,
  selectedRegionId,
  onSelectRegion,
  userLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [styleMode, setStyleMode] = useState<"clean" | "detailed">("clean");

  // Format GeoJSON from regions
  const createGeoJSON = useCallback(
    (regions: RegionData[]): FeatureCollection => {
      return {
        type: "FeatureCollection",
        features: regions.map((r) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [r.longitude, r.latitude],
          },
          properties: {
            id: r.id,
            region: r.name,
            psi: r.psi ?? 0,
            pm25: r.pm25 ?? 0,
            pm25OneHourly: r.pm25OneHourly ?? 0,
            band: r.psiBand,
            color: r.psiColor,
            updatedAt: data?.summary.updatedAt || "",
            description: r.psiDescription || "",
          },
        })),
      };
    },
    [data]
  );

  // Open Popup for a specific region
  const showRegionPopup = useCallback(
    (region: RegionData) => {
      if (!mapRef.current) return;

      if (popupRef.current) {
        popupRef.current.remove();
      }

      const pm25Display =
        region.pm25OneHourly !== null
          ? `${region.pm25OneHourly} µg/m³ (1-hr) · ${region.pm25 ?? "—"} µg/m³ (24-hr)`
          : region.pm25 !== null
          ? `${region.pm25} µg/m³`
          : "Data unavailable";

      const popupHtml = `
        <div style="font-family: inherit; min-width: 210px; padding: 14px 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px;">
            <div style="font-weight: 700; font-size: 16px; color: #0f172a;">${region.name}</div>
            <div style="font-size: 11px; font-weight: 700; color: ${region.psiColor}; background: ${region.psiBgColor || '#f8fafc'}; padding: 2px 8px; border-radius: 6px;">
              ${region.psiBand}
            </div>
          </div>
          <div style="display: grid; gap: 6px; font-size: 13px; color: #334155;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="color: #64748b;">PSI:</span>
              <span style="font-weight: 700; font-family: monospace; font-size: 16px; color: ${region.psiColor};">${region.psi ?? "—"}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="color: #64748b;">PM2.5:</span>
              <span style="font-weight: 600; font-family: monospace; font-size: 13px;">${pm25Display}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="color: #64748b;">Updated:</span>
              <span style="font-weight: 500; font-size: 12px; color: #475569;">${data?.summary.updatedAt || "—"}</span>
            </div>
          </div>
          ${
            region.psiDescription
              ? `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; font-size: 11px; line-height: 1.4; color: #64748b;">
                  ${region.psiDescription}
                </div>`
              : ""
          }
        </div>
      `;

      const popup = new Popup({
        offset: 24,
        closeButton: true,
        closeOnClick: false,
      })
        .setLngLat([region.longitude, region.latitude])
        .setHTML(popupHtml)
        .addTo(mapRef.current);

      popup.on("close", () => {
        onSelectRegion(null);
      });

      popupRef.current = popup;
    },
    [data, onSelectRegion]
  );

  // Initialize Map (Mounts once)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let mapInstance: MapLibreMap;

    try {
      mapInstance = new MapLibreMap({
        container: mapContainerRef.current,
        style: BASEMAP_STYLE,
        center: SINGAPORE_CENTER,
        zoom: DEFAULT_ZOOM,
        minZoom: 9.5,
        maxZoom: 17,
        attributionControl: false,
      });

      // Add navigation & attribution controls
      mapInstance.addControl(
        new NavigationControl({ showCompass: false }),
        "top-right"
      );
      mapInstance.addControl(
        new AttributionControl({ compact: true }),
        "bottom-right"
      );

      mapInstance.on("load", () => {
        setMapLoaded(true);
        setMapError(null);
        mapInstance.resize();
      });

      mapRef.current = mapInstance;
    } catch (err) {
      console.error("MapLibre initialization error:", err);
      setMapError("Interactive map could not be initialized in this browser.");
    }

    // Auto-resize on layout or container size adjustments
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    const timer1 = setTimeout(() => mapRef.current?.resize(), 150);
    const timer2 = setTimeout(() => mapRef.current?.resize(), 600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      if (popupRef.current) {
        popupRef.current.remove();
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoaded(false);
    };
  }, []);

  // Handle switching between Clean Light and Detailed mode seamlessly without reloading the map
  const toggleStyleMode = (mode: "clean" | "detailed") => {
    setStyleMode(mode);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (mode === "clean") {
      map.setPaintProperty("osm-layer", "raster-saturation", -0.75);
      map.setPaintProperty("osm-layer", "raster-brightness-min", 0.15);
      map.setPaintProperty("osm-layer", "raster-contrast", -0.05);
      map.setPaintProperty("osm-layer", "raster-opacity", 0.92);
    } else {
      map.setPaintProperty("osm-layer", "raster-saturation", 0);
      map.setPaintProperty("osm-layer", "raster-brightness-min", 0);
      map.setPaintProperty("osm-layer", "raster-contrast", 0);
      map.setPaintProperty("osm-layer", "raster-opacity", 1);
    }
  };

  // Update GeoJSON layers and Markers whenever data changes or map loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !data || !data.regions || data.regions.length === 0) return;

    const geojson = createGeoJSON(data.regions);

    // Update or add GeoJSON source
    const existingSource = map.getSource("haze-regions") as GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojson);
    } else {
      map.addSource("haze-regions", {
        type: "geojson",
        data: geojson,
      });
    }

    // Layer 1: Ambient outer glow halo
    if (!map.getLayer("haze-halo")) {
      map.addLayer({
        id: "haze-halo",
        type: "circle",
        source: "haze-regions",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9, 26,
            11, 40,
            14, 56,
          ],
          "circle-color": [
            "step",
            ["get", "psi"],
            "#16a34a",
            51, "#2563eb",
            101, "#eab308",
            201, "#ea580c",
            301, "#dc2626",
          ],
          "circle-opacity": 0.25,
          "circle-stroke-width": 0,
        },
      });
    }

    // Layer 2: Core solid PSI circle
    if (!map.getLayer("haze-circles")) {
      map.addLayer({
        id: "haze-circles",
        type: "circle",
        source: "haze-regions",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9, 16,
            11, 24,
            14, 34,
          ],
          "circle-color": [
            "step",
            ["get", "psi"],
            "#16a34a",
            51, "#2563eb",
            101, "#eab308",
            201, "#ea580c",
            301, "#dc2626",
          ],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });

      // Click event on circles
      map.on("click", "haze-circles", (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const regionId = feature.properties?.id;
        const region = data.regions.find((r) => r.id === regionId);
        if (region) {
          onSelectRegion(region.id);
          showRegionPopup(region);
        }
      });

      // Cursor pointer on hover
      map.on("mouseenter", "haze-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "haze-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // Clear old HTML markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Create prominent, touch-friendly HTML badges for each region
    data.regions.forEach((region) => {
      const el = document.createElement("div");
      el.className = "group cursor-pointer select-none";
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", `${region.name} PSI ${region.psi}`);
      el.tabIndex = 0;

      // Inner badge styling
      el.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        ">
          <div style="
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 9px;
            border-radius: 9999px;
            box-shadow: 0 4px 8px -1px rgba(0, 0, 0, 0.25);
            white-space: nowrap;
            letter-spacing: 0.05em;
            display: flex;
            align-items: center;
            gap: 6px;
            border: 1.5px solid rgba(255, 255, 255, 0.35);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          ">
            <span>${region.name.toUpperCase()}</span>
            <span style="
              background: ${region.psiColor};
              color: #ffffff;
              padding: 1px 7px;
              border-radius: 6px;
              font-family: monospace;
              font-weight: 800;
              font-size: 12px;
            ">${region.psi ?? "—"}</span>
          </div>
        </div>
      `;

      el.addEventListener("click", () => {
        onSelectRegion(region.id);
        showRegionPopup(region);
      });

      el.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          onSelectRegion(region.id);
          showRegionPopup(region);
        }
      });

      const marker = new Marker({ element: el })
        .setLngLat([region.longitude, region.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [mapLoaded, data, createGeoJSON, onSelectRegion, showRegionPopup]);

  // Handle selected region changes (e.g. from buttons or external click)
  useEffect(() => {
    if (!selectedRegionId || !data) return;
    const region = data.regions.find((r) => r.id === selectedRegionId);
    if (region && mapRef.current) {
      mapRef.current.easeTo({
        center: [region.longitude, region.latitude],
        zoom: 11.5,
        duration: 800,
      });
      showRegionPopup(region);
    }
  }, [selectedRegionId, data, showRegionPopup]);

  // Handle User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (userLocation) {
      if (!userMarkerRef.current) {
        const userEl = document.createElement("div");
        userEl.className = "user-location-pin";
        userEl.title = "Your Location";

        const marker = new Marker({ element: userEl })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(
            new Popup({ offset: 12 }).setHTML(
              '<div style="padding: 6px 10px; font-weight: 600; font-size: 12px; color: #1e3a8a;">Your Location</div>'
            )
          )
          .addTo(map);

        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }

      // Fly to user location
      map.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 12.5,
        essential: true,
      });
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }
  }, [userLocation, mapLoaded]);

  // Reset to full Singapore view
  const handleResetView = () => {
    if (!mapRef.current) return;
    onSelectRegion(null);
    if (popupRef.current) {
      popupRef.current.remove();
    }
    mapRef.current.flyTo({
      center: SINGAPORE_CENTER,
      zoom: DEFAULT_ZOOM,
      essential: true,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[440px] sm:min-h-[520px] rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-200">
      {/* MapLibre DOM Container: Strictly absolute inset-0 with concrete size */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: "440px" }}
      />

      {/* Basemap load error fallback notice */}
      {mapError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-100/95 backdrop-blur-xs text-center">
          <div className="max-w-md p-5 bg-white border border-slate-200 rounded-2xl shadow-md">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Basemap Notice
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              {mapError}
            </p>
            <button
              type="button"
              onClick={() => toggleStyleMode("clean")}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              Reload Map
            </button>
          </div>
        </div>
      )}

      {/* Top Floating Map Controls Overlay (Fit Singapore & Region Shortcuts) */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 pointer-events-none max-w-[calc(100%-80px)]">
        <button
          type="button"
          onClick={handleResetView}
          aria-label="Reset Map to Full Singapore View"
          className="pointer-events-auto px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 bg-white/95 hover:bg-white active:bg-slate-100 rounded-lg shadow-sm border border-slate-200 backdrop-blur-md transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
        >
          <svg
            className="w-3.5 h-3.5 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          <span>Fit Singapore</span>
        </button>

        {/* Quick Region Selector buttons */}
        {data?.regions.map((reg) => (
          <button
            key={reg.id}
            type="button"
            onClick={() => {
              onSelectRegion(reg.id);
            }}
            className={`pointer-events-auto px-2.5 py-1.5 text-[11px] font-semibold rounded-lg shadow-xs border transition-all backdrop-blur-md flex items-center gap-1.5 ${
              selectedRegionId === reg.id
                ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400"
                : "bg-white/95 text-slate-700 hover:bg-white border-slate-200"
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: reg.psiColor }}
            />
            <span>{reg.name}</span>
            <span className="font-mono text-[10px] tabular-nums font-bold">
              {reg.psi ?? "—"}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom-left Basemap style toggle button */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-auto">
        <div className="flex items-center p-1 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xs text-[11px]">
          <button
            type="button"
            onClick={() => toggleStyleMode("clean")}
            className={`px-2.5 py-1 font-semibold rounded-lg transition-colors ${
              styleMode === "clean"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Clean Light
          </button>
          <button
            type="button"
            onClick={() => toggleStyleMode("detailed")}
            className={`px-2.5 py-1 font-semibold rounded-lg transition-colors ${
              styleMode === "detailed"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            OSM Detailed
          </button>
        </div>
      </div>
    </div>
  );
};
