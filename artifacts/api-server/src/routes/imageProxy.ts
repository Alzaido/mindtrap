import { Router, type IRouter } from "express";
import https from "https";
import http from "http";

const router: IRouter = Router();

const ALLOWED_HOSTS = [
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "en.wikipedia.org",
];

router.get("/image-proxy", (req, res) => {
  const url = req.query["url"];
  if (typeof url !== "string" || !url) {
    res.status(400).json({ error: "missing url" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).json({ error: "host not allowed" });
    return;
  }

  const lib = parsed.protocol === "https:" ? https : http;

  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MindTrap/1.0; +https://mindtrapgame.com)",
      "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://commons.wikimedia.org/",
    },
  };

  const proxyReq = lib.get(options, (proxyRes) => {
    if (proxyRes.statusCode && proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location;
      res.redirect(`/api/image-proxy?url=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    res.setHeader("Content-Type", proxyRes.headers["content-type"] ?? "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(proxyRes.statusCode ?? 200);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => {
    res.status(502).json({ error: "upstream error" });
  });
});

export default router;
