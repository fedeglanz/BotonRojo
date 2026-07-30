// Minimal sidecar: renders a URL with headless Chromium and returns a
// screenshot. Kept deliberately small (no framework) — its only job is
// screenshotting, called internally by the main app over the Docker network.
const http = require("http");
const { chromium } = require("playwright");

const PORT = process.env.PORT || 4000;
const TOKEN = process.env.SCREENSHOT_SERVICE_TOKEN || "";

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  }
  return browserPromise;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }

  if (req.method !== "POST" || req.url !== "/screenshot") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "not_found" }));
  }

  if (TOKEN && req.headers["x-screenshot-token"] !== TOKEN) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "unauthorized" }));
  }

  let page;
  try {
    const raw = await readBody(req);
    const { url, width = 1280, height = 900, fullPage = false, type = "jpeg", quality = 75 } = JSON.parse(raw);
    if (!url) throw new Error("missing_url");

    const browser = await getBrowser();
    page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    } catch {
      // Some pages (analytics beacons, chat widgets, video embeds) never
      // fully go idle — the page has still loaded and rendered by now, so
      // screenshot it anyway instead of failing the whole request.
    }

    const shotOpts = { fullPage, type };
    if (type === "jpeg") shotOpts.quality = quality;
    const buffer = await page.screenshot(shotOpts);

    res.writeHead(200, { "Content-Type": type === "png" ? "image/png" : "image/jpeg" });
    res.end(buffer);
  } catch (err) {
    console.error("screenshot failed", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String((err && err.message) || err) }));
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

server.listen(PORT, () => {
  console.log(`screenshot-service listening on :${PORT}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    if (browserPromise) {
      const browser = await browserPromise;
      await browser.close().catch(() => {});
    }
    process.exit(0);
  });
}
