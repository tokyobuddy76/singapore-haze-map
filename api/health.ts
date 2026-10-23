/**
 * Vercel Serverless Function: GET /api/health
 * Health check endpoint reporting service status, timestamp, uptime,
 * and upstream API connectivity (data.gov.sg and api.qrserver.com).
 */

interface UpstreamEndpointStatus {
  status: "reachable" | "degraded" | "unreachable";
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  upstream: {
    dataGovSg: UpstreamEndpointStatus;
    qrServer: UpstreamEndpointStatus;
  };
}

const startTime = Date.now();

export default async function handler(req: any, res: any) {
  const timeoutMs = 4000;

  // Probe 1: data.gov.sg
  const checkDataGovSg = async (): Promise<UpstreamEndpointStatus> => {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "User-Agent": "SingaporeHazeMap/1.0",
        Accept: "application/json",
      };
      if (process.env.SINGAPORE_API_KEY) {
        headers["api-key"] = process.env.SINGAPORE_API_KEY;
      }

      const response = await fetch("https://api.data.gov.sg/v1/environment/psi", {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { status: "reachable", latencyMs };
      }
      return {
        status: "degraded",
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { status: "unreachable", error: err?.message || "Timeout" };
    }
  };

  // Probe 2: api.qrserver.com
  const checkQrServer = async (): Promise<UpstreamEndpointStatus> => {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        "https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=healthcheck",
        {
          method: "GET",
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (response.ok) {
        return { status: "reachable", latencyMs };
      }
      return {
        status: "degraded",
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { status: "unreachable", error: err?.message || "Timeout" };
    }
  };

  const [dataGovSgStatus, qrServerStatus] = await Promise.all([
    checkDataGovSg(),
    checkQrServer(),
  ]);

  const allReachable =
    dataGovSgStatus.status === "reachable" && qrServerStatus.status === "reachable";
  const anyUnreachable =
    dataGovSgStatus.status === "unreachable" && qrServerStatus.status === "unreachable";

  const overallStatus = allReachable
    ? "healthy"
    : anyUnreachable
    ? "unhealthy"
    : "degraded";

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  const payload: HealthResponse = {
    status: overallStatus,
    service: "singapore-haze-map",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    upstream: {
      dataGovSg: dataGovSgStatus,
      qrServer: qrServerStatus,
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
