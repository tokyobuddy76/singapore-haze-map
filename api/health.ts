/**
 * Vercel Serverless Function: GET /api/health
 * Health check endpoint reporting service status, timestamp, uptime,
 * and upstream Singapore Government API (api.data.gov.sg) connectivity.
 */

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  upstream: {
    dataGovSg: "reachable" | "degraded" | "unreachable";
    latencyMs?: number;
    error?: string;
  };
}

const startTime = Date.now();

export default async function handler(req: any, res: any) {
  const checkStart = Date.now();
  let upstreamStatus: "reachable" | "degraded" | "unreachable" = "unreachable";
  let latencyMs: number | undefined;
  let upstreamError: string | undefined;

  // Check upstream data.gov.sg connectivity with a short 4-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const headers: Record<string, string> = {
      "User-Agent": "SingaporeHazeMap/1.0",
      Accept: "application/json",
    };
    if (process.env.SINGAPORE_API_KEY) {
      headers["api-key"] = process.env.SINGAPORE_API_KEY;
    }

    const upstreamRes = await fetch("https://api.data.gov.sg/v1/environment/psi", {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    latencyMs = Date.now() - checkStart;

    if (upstreamRes.ok) {
      upstreamStatus = "reachable";
    } else {
      upstreamStatus = "degraded";
      upstreamError = `Upstream returned HTTP ${upstreamRes.status}`;
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    upstreamStatus = "unreachable";
    upstreamError = err?.message || "Connection timed out";
  }

  const isHealthy = upstreamStatus === "reachable";
  const statusCode = isHealthy ? 200 : upstreamStatus === "degraded" ? 200 : 503;

  const payload: HealthResponse = {
    status: isHealthy ? "healthy" : upstreamStatus === "degraded" ? "degraded" : "unhealthy",
    service: "singapore-haze-map",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    upstream: {
      dataGovSg: upstreamStatus,
      latencyMs,
      ...(upstreamError ? { error: upstreamError } : {}),
    },
  };

  if (res.setHeader) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Access-Control-Allow-Origin", "*");
  }

  if (typeof res.status === "function") {
    return res.status(statusCode).json(payload);
  } else {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  }
}
