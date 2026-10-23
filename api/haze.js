/**
 * Vercel Serverless Function: GET /api/haze
 * Retrieves real-time Singapore air quality and PSI/PM2.5 readings
 * from official Singapore government data sources (api.data.gov.sg).
 */

// In-memory cache for Vercel lambdas & dev middleware
let cache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// Official Singapore PSI category helper
export function getPsiCategory(psi) {
  if (psi === null || psi === undefined || isNaN(psi)) {
    return { band: "Unknown", color: "#64748b", description: "Data unavailable" };
  }
  const val = Number(psi);
  if (val <= 50) {
    return {
      band: "Good",
      color: "#16a34a",
      bgColor: "#dcfce7",
      textColor: "#15803d",
      description: "Air quality is good. Normal outdoor activities can continue.",
    };
  }
  if (val <= 100) {
    return {
      band: "Moderate",
      color: "#2563eb",
      bgColor: "#dbeafe",
      textColor: "#1d4ed8",
      description: "Air quality is acceptable. Normal outdoor activities can continue for everyone.",
    };
  }
  if (val <= 200) {
    return {
      band: "Unhealthy",
      color: "#eab308",
      bgColor: "#fef9c3",
      textColor: "#a16207",
      description: "Sensitive groups should reduce prolonged or strenuous outdoor exertion.",
    };
  }
  if (val <= 300) {
    return {
      band: "Very Unhealthy",
      color: "#ea580c",
      bgColor: "#ffedd5",
      textColor: "#c2410c",
      description: "Healthy persons should avoid prolonged outdoor exertion. Sensitive persons stay indoors.",
    };
  }
  return {
    band: "Hazardous",
    color: "#dc2626",
    bgColor: "#fee2e2",
    textColor: "#b91c1c",
    description: "Emergency warning: Minimise outdoor activity. Sensitive individuals should remain indoors.",
  };
}

export function getPm25Category(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) {
    return { band: "Unknown", color: "#64748b" };
  }
  const val = Number(pm25);
  if (val <= 55) {
    return { band: "Normal", color: "#16a34a" };
  }
  if (val <= 150) {
    return { band: "Elevated", color: "#eab308" };
  }
  if (val <= 250) {
    return { band: "High", color: "#ea580c" };
  }
  return { band: "Very High", color: "#dc2626" };
}

function formatTimeString(isoString) {
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

function formatFullDateTime(isoString) {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("en-SG", {
      timeZone: "Asia/Singapore",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
      .format(date)
      .replace(/\bam\b/g, "AM")
      .replace(/\bpm\b/g, "PM");
  } catch {
    return isoString;
  }
}

export async function fetchHazeData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cache.data && (now - cache.timestamp < CACHE_TTL_MS)) {
    return cache.data;
  }

  const headers = {};
  if (process.env.SINGAPORE_API_KEY) {
    headers["api-key"] = process.env.SINGAPORE_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const [psiResponse, pm25Response] = await Promise.all([
      fetch("https://api.data.gov.sg/v1/environment/psi", {
        headers,
        signal: controller.signal,
      }),
      fetch("https://api.data.gov.sg/v1/environment/pm25", {
        headers,
        signal: controller.signal,
      }),
    ]);

    clearTimeout(timeoutId);

    if (!psiResponse.ok) {
      throw new Error(`PSI API responded with status ${psiResponse.status}`);
    }

    const psiJson = await psiResponse.json();
    const pm25Json = pm25Response.ok ? await pm25Response.json() : null;

    if (!psiJson.items || psiJson.items.length === 0) {
      throw new Error("No air quality items found in government API response");
    }

    const latestItem = psiJson.items[0];
    const latestPm25Item = pm25Json?.items?.[0];

    const psiReadings = latestItem.readings?.psi_twenty_four_hourly || {};
    const pm25TwentyFourHourly = latestItem.readings?.pm25_twenty_four_hourly || {};
    const pm25OneHourly = latestPm25Item?.readings?.pm25_one_hourly || {};

    const regionMetadata = psiJson.region_metadata || [];

    // Filter regional metadata (exclude national summary point from geographical pins)
    const regionalList = regionMetadata.filter(
      (r) => r.name && r.name.toLowerCase() !== "national"
    );

    let highestPsi = -Infinity;
    let highestPsiRegion = "";
    let highestPm25 = -Infinity;
    let highestPm25Region = "";

    const regions = regionalList.map((meta) => {
      const key = meta.name.toLowerCase();
      const rawPsi = psiReadings[key];
      const psi = rawPsi !== undefined ? Number(rawPsi) : null;

      const rawPm25 = pm25TwentyFourHourly[key];
      const pm25 = rawPm25 !== undefined ? Number(rawPm25) : null;

      const rawPm25_1h = pm25OneHourly[key];
      const pm25OneHour = rawPm25_1h !== undefined ? Number(rawPm25_1h) : null;

      const psiCategory = getPsiCategory(psi);
      const pm25Category = getPm25Category(pm25OneHour ?? pm25);

      const nameCapitalized = meta.name.charAt(0).toUpperCase() + meta.name.slice(1);

      if (psi !== null && psi > highestPsi) {
        highestPsi = psi;
        highestPsiRegion = nameCapitalized;
      }

      const comparisonPm25 = pm25OneHour ?? pm25;
      if (comparisonPm25 !== null && comparisonPm25 > highestPm25) {
        highestPm25 = comparisonPm25;
        highestPm25Region = nameCapitalized;
      }

      return {
        id: key,
        name: nameCapitalized,
        psi,
        psiBand: psiCategory.band,
        psiColor: psiCategory.color,
        psiBgColor: psiCategory.bgColor,
        psiTextColor: psiCategory.textColor,
        psiDescription: psiCategory.description,
        pm25, // 24-hourly PM2.5 in µg/m³
        pm25OneHourly: pm25OneHour, // 1-hourly PM2.5 in µg/m³
        pm25Band: pm25Category.band,
        pm25Color: pm25Category.color,
        latitude: meta.label_location?.latitude ?? 1.3521,
        longitude: meta.label_location?.longitude ?? 103.8198,
      };
    });

    const rawNationalPsi = psiReadings.national;
    const nationalPsi = rawNationalPsi !== undefined ? Number(rawNationalPsi) : (highestPsi !== -Infinity ? highestPsi : null);
    const overallCategory = getPsiCategory(nationalPsi);

    const reportingTimestamp = latestItem.timestamp;
    const updateTimestamp = latestItem.update_timestamp || reportingTimestamp;

    const normalizedData = {
      timestamp: reportingTimestamp,
      updateTimestamp,
      updatedAtFormatted: formatTimeString(updateTimestamp),
      fullDateTimeFormatted: formatFullDateTime(updateTimestamp),
      overall: {
        psi: nationalPsi,
        band: overallCategory.band,
        color: overallCategory.color,
        bgColor: overallCategory.bgColor,
        textColor: overallCategory.textColor,
        description: overallCategory.description,
      },
      summary: {
        highestPsi: highestPsi !== -Infinity ? highestPsi : null,
        highestPsiRegion: highestPsiRegion || "—",
        highestPsiBand: getPsiCategory(highestPsi).band,
        highestPm25: highestPm25 !== -Infinity ? highestPm25 : null,
        highestPm25Region: highestPm25Region || "—",
        highestPm25Band: getPm25Category(highestPm25).band,
        updatedAt: formatTimeString(updateTimestamp),
      },
      regions,
      source: "National Environment Agency (NEA) via data.gov.sg",
    };

    cache = {
      data: normalizedData,
      timestamp: Date.now(),
    };

    return normalizedData;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default async function handler(req, res) {
  // Support standard Vercel serverless request & response
  const url = new URL(req.url, `http://${req.headers?.host || "localhost"}`);
  const forceRefresh = url.searchParams.get("refresh") === "true";

  try {
    const data = await fetchHazeData(forceRefresh);

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
      return;
    }
  } catch (error) {
    console.error("Error retrieving Singapore haze data:", error);
    const errorBody = {
      error: "Latest Singapore haze data is temporarily unavailable. Please try again.",
      status: 503,
    };

    if (typeof res.status === "function") {
      return res.status(503).json(errorBody);
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorBody));
      return;
    }
  }
}
