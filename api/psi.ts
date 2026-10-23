/**
 * Vercel Serverless Function: GET /api/psi
 * Retrieves real-time Singapore Pollutant Standards Index (PSI) readings
 * from the official Singapore government data source (api.data.gov.sg/v1/environment/psi).
 */

interface PsiRegion {
  id: string;
  name: string;
  psi: number | null;
  psiBand: string;
  color: string;
  bgColor: string;
  textColor: string;
  healthAdvisory: string;
  latitude: number;
  longitude: number;
}

interface PsiResponse {
  timestamp: string;
  updateTimestamp: string;
  updatedAtFormatted: string;
  overall: {
    nationalPsi: number | null;
    highestPsi: number | null;
    highestPsiRegion: string;
    band: string;
    color: string;
    healthAdvisory: string;
  };
  regions: PsiRegion[];
  readings: Record<string, Record<string, number | undefined>>;
  source: string;
}

let psiCache: {
  data: PsiResponse | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getPsiCategory(psi: number | null | undefined) {
  if (psi === null || psi === undefined || isNaN(psi)) {
    return {
      band: "Unknown",
      color: "#64748b",
      bgColor: "#f1f5f9",
      textColor: "#475569",
      healthAdvisory: "Data unavailable",
    };
  }
  const val = Number(psi);
  if (val <= 50) {
    return {
      band: "Good",
      color: "#16a34a",
      bgColor: "#dcfce7",
      textColor: "#15803d",
      healthAdvisory: "Normal outdoor activities can continue.",
    };
  }
  if (val <= 100) {
    return {
      band: "Moderate",
      color: "#2563eb",
      bgColor: "#dbeafe",
      textColor: "#1d4ed8",
      healthAdvisory: "Normal outdoor activities can continue for everyone.",
    };
  }
  if (val <= 200) {
    return {
      band: "Unhealthy",
      color: "#eab308",
      bgColor: "#fef9c3",
      textColor: "#a16207",
      healthAdvisory: "Sensitive groups should reduce prolonged or strenuous outdoor exertion.",
    };
  }
  if (val <= 300) {
    return {
      band: "Very Unhealthy",
      color: "#ea580c",
      bgColor: "#ffedd5",
      textColor: "#c2410c",
      healthAdvisory: "Healthy persons should avoid prolonged outdoor exertion. Sensitive persons stay indoors.",
    };
  }
  return {
    band: "Hazardous",
    color: "#dc2626",
    bgColor: "#fee2e2",
    textColor: "#b91c1c",
    healthAdvisory: "Emergency warning: Minimise outdoor activity. Sensitive individuals should remain indoors.",
  };
}

function formatTimeString(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("en-SG", {
      timeZone: "Asia/Singapore",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(date)
      .toUpperCase();
  } catch {
    return isoString;
  }
}

export async function fetchPsiData(forceRefresh = false): Promise<PsiResponse> {
  const now = Date.now();
  if (!forceRefresh && psiCache.data && now - psiCache.timestamp < CACHE_TTL_MS) {
    return psiCache.data;
  }

  const headers: Record<string, string> = {};
  if (process.env.SINGAPORE_API_KEY) {
    headers["api-key"] = process.env.SINGAPORE_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("https://api.data.gov.sg/v1/environment/psi", {
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Upstream PSI API responded with status ${res.status}`);
    }

    const json = await res.json();
    if (!json.items || json.items.length === 0) {
      throw new Error("No air quality items returned from government PSI API");
    }

    const latestItem = json.items[0];
    const psiReadings = latestItem.readings?.psi_twenty_four_hourly || {};
    const regionMetadata = json.region_metadata || [];

    const filteredMetadata = regionMetadata.filter(
      (r: any) => r.name && r.name.toLowerCase() !== "national"
    );

    let highestPsi = -Infinity;
    let highestPsiRegion = "";

    const regions: PsiRegion[] = filteredMetadata.map((meta: any) => {
      const key = meta.name.toLowerCase();
      const rawPsi = psiReadings[key];
      const psi = rawPsi !== undefined ? Number(rawPsi) : null;
      const cat = getPsiCategory(psi);
      const name = meta.name.charAt(0).toUpperCase() + meta.name.slice(1);

      if (psi !== null && psi > highestPsi) {
        highestPsi = psi;
        highestPsiRegion = name;
      }

      return {
        id: key,
        name,
        psi,
        psiBand: cat.band,
        color: cat.color,
        bgColor: cat.bgColor,
        textColor: cat.textColor,
        healthAdvisory: cat.healthAdvisory,
        latitude: meta.label_location?.latitude ?? 1.3521,
        longitude: meta.label_location?.longitude ?? 103.8198,
      };
    });

    const nationalRaw = psiReadings.national;
    const nationalPsi =
      nationalRaw !== undefined
        ? Number(nationalRaw)
        : highestPsi !== -Infinity
        ? highestPsi
        : null;
    const nationalCat = getPsiCategory(nationalPsi);

    const reportingTimestamp = latestItem.timestamp;
    const updateTimestamp = latestItem.update_timestamp || reportingTimestamp;

    const payload: PsiResponse = {
      timestamp: reportingTimestamp,
      updateTimestamp,
      updatedAtFormatted: formatTimeString(updateTimestamp),
      overall: {
        nationalPsi,
        highestPsi: highestPsi !== -Infinity ? highestPsi : null,
        highestPsiRegion: highestPsiRegion || "—",
        band: nationalCat.band,
        color: nationalCat.color,
        healthAdvisory: nationalCat.healthAdvisory,
      },
      regions,
      readings: latestItem.readings || {},
      source: "National Environment Agency (NEA) via data.gov.sg",
    };

    psiCache = {
      data: payload,
      timestamp: Date.now(),
    };

    return payload;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  try {
    const data = await fetchPsiData(forceRefresh);

    if (res.setHeader) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (typeof res.status === "function") {
      return res.status(200).json(data);
    } else {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    }
  } catch (error) {
    console.error("Error retrieving Singapore PSI data:", error);
    const errorBody = {
      error: "Latest Singapore PSI data is temporarily unavailable. Please try again.",
      status: 503,
    };

    if (typeof res.status === "function") {
      return res.status(503).json(errorBody);
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorBody));
    }
  }
}
