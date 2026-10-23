/**
 * Vercel Serverless Function: GET /api/qr
 * Generates a dynamic QR code via api.qrserver.com.
 * No API key required.
 *
 * Query parameters:
 *  - data / url: The target URL or text to encode (defaults to the deployed app URL)
 *  - size: Image dimensions in WxH (default: "240x240")
 *  - format: "image" (default, streams PNG) or "json" (returns metadata and data URI)
 */

export default async function handler(req: any, res: any) {
  const host = req.headers?.host || "singapore-haze-map.vercel.app";
  const protocol = req.headers?.["x-forwarded-proto"] || "https";
  const defaultAppUrl = `${protocol}://${host}`;

  const requestUrl = new URL(req.url, `http://${host}`);
  const targetData =
    requestUrl.searchParams.get("data") ||
    requestUrl.searchParams.get("url") ||
    defaultAppUrl;

  const size = requestUrl.searchParams.get("size") || "240x240";
  const format = requestUrl.searchParams.get("format") || "image";

  // Construct upstream api.qrserver.com URL
  const upstreamUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${encodeURIComponent(
    size
  )}&data=${encodeURIComponent(targetData)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      throw new Error(
        `api.qrserver.com responded with status ${upstreamRes.status}`
      );
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (format === "json") {
      const base64Data = buffer.toString("base64");
      const dataUri = `data:image/png;base64,${base64Data}`;

      const payload = {
        data: targetData,
        size,
        dataUri,
        upstreamUrl,
      };

      if (res.setHeader) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "public, s-maxage=86400, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
      }

      if (typeof res.status === "function") {
        return res.status(200).json(payload);
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
        return;
      }
    }

    // Default: stream image directly
    if (res.setHeader) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=86400, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (typeof res.status === "function") {
      return res.status(200).send(buffer);
    } else {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(buffer);
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Error generating QR code via api.qrserver.com:", error);

    const errorPayload = {
      error: "Unable to generate QR code at this time.",
      details: error?.message || "Upstream service error",
    };

    if (res.setHeader) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (typeof res.status === "function") {
      return res.status(502).json(errorPayload);
    } else {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorPayload));
    }
  }
}
