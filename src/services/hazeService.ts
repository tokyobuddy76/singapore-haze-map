/**
 * Service to fetch and manage Singapore haze and air-quality data.
 * All haze data is retrieved strictly via the backend serverless proxy `/api/haze`.
 */

export interface RegionData {
  id: string;
  name: string;
  psi: number | null;
  psiBand: string;
  psiColor: string;
  psiBgColor?: string;
  psiTextColor?: string;
  psiDescription?: string;
  pm25: number | null; // 24-hourly PM2.5 in µg/m³
  pm25OneHourly: number | null; // 1-hourly PM2.5 in µg/m³
  pm25Band: string;
  pm25Color: string;
  latitude: number;
  longitude: number;
}

export interface HazeSummary {
  highestPsi: number | null;
  highestPsiRegion: string;
  highestPsiBand: string;
  highestPm25: number | null;
  highestPm25Region: string;
  highestPm25Band: string;
  updatedAt: string;
}

export interface OverallReading {
  psi: number | null;
  band: string;
  color: string;
  bgColor?: string;
  textColor?: string;
  description?: string;
}

export interface HazeData {
  timestamp: string;
  updateTimestamp: string;
  updatedAtFormatted: string;
  fullDateTimeFormatted: string;
  overall: OverallReading;
  summary: HazeSummary;
  regions: RegionData[];
  source: string;
}

export interface PsiCategoryInfo {
  range: string;
  band: string;
  color: string;
  bgColor: string;
  textColor: string;
  healthAdvisory: string;
  targetGroup: string;
}

export const OFFICIAL_PSI_CATEGORIES: PsiCategoryInfo[] = [
  {
    range: "0 – 50",
    band: "Good",
    color: "#16a34a",
    bgColor: "#dcfce7",
    textColor: "#15803d",
    healthAdvisory: "Normal outdoor activities can continue.",
    targetGroup: "Healthy Persons & Sensitive Groups",
  },
  {
    range: "51 – 100",
    band: "Moderate",
    color: "#2563eb",
    bgColor: "#dbeafe",
    textColor: "#1d4ed8",
    healthAdvisory: "Normal outdoor activities can continue for everyone.",
    targetGroup: "Healthy Persons & Sensitive Groups",
  },
  {
    range: "101 – 200",
    band: "Unhealthy",
    color: "#eab308",
    bgColor: "#fef9c3",
    textColor: "#a16207",
    healthAdvisory:
      "Sensitive groups should reduce prolonged or strenuous outdoor physical exertion. General public may continue normal activities.",
    targetGroup: "Sensitive Groups reduce outdoor exertion",
  },
  {
    range: "201 – 300",
    band: "Very Unhealthy",
    color: "#ea580c",
    bgColor: "#ffedd5",
    textColor: "#c2410c",
    healthAdvisory:
      "Sensitive groups should avoid prolonged outdoor exertion. Healthy persons should minimise prolonged outdoor physical exertion.",
    targetGroup: "All groups reduce/avoid outdoor exertion",
  },
  {
    range: "> 300",
    band: "Hazardous",
    color: "#dc2626",
    bgColor: "#fee2e2",
    textColor: "#b91c1c",
    healthAdvisory:
      "Emergency warning: Minimise outdoor activities. Children, elderly, and those with lung/heart disease should stay indoors.",
    targetGroup: "Everyone avoid outdoor activity",
  },
];

export async function fetchHazeData(forceRefresh = false): Promise<HazeData> {
  const url = forceRefresh ? `/api/haze?refresh=true&_t=${Date.now()}` : "/api/haze";
  
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const errorJson = await res.json().catch(() => null);
      throw new Error(
        errorJson?.error ||
          "Latest Singapore haze data is temporarily unavailable. Please try again."
      );
    }

    const data: HazeData = await res.json();
    if (!data || !Array.isArray(data.regions) || data.regions.length === 0) {
      throw new Error(
        "Latest Singapore haze data is temporarily unavailable. Please try again."
      );
    }

    return data;
  } catch (err) {
    if (err instanceof Error && err.message.includes("unavailable")) {
      throw err;
    }
    throw new Error(
      "Latest Singapore haze data is temporarily unavailable. Please try again."
    );
  }
}
