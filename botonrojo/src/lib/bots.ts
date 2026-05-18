// Port of the bot detection used in the legacy ENDtrack plugin (class-endtrack-public.php).
// Returns true when the request looks like a bot, scraper, or non-browser client.

const BOTS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "embedly",
  "pinterest",
  "ahrefsbot",
  "screaming frog",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "uptimerobot",
  "pingdom",
  "statuscake",
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "ccbot",
  "anthropic-ai",
  "claude-web",
  "claudebot",
  "perplexitybot",
  "perplexity-user",
  "cohere-ai",
  "bytespider",
  "amazonbot",
  "meta-externalagent",
  "meta-externalfetcher",
  "applebot",
  "google-extended",
];

const PATTERNS: RegExp[] = [
  /\bbot\b/i,
  /\bspider\b/i,
  /\bcrawler\b/i,
  /^$/i,
  /^curl\//i,
  /^wget\//i,
  /^python-requests/i,
  /^python-urllib/i,
  /^java\//i,
  /^go-http-client/i,
  /^apache-httpclient/i,
  /^node-fetch/i,
  /^undici/i,
];

const BROWSER_KEYWORDS = ["mozilla", "webkit", "chrome", "safari", "firefox", "edge", "opera"];

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  if (BOTS.some((b) => ua.includes(b))) return true;
  if (PATTERNS.some((p) => p.test(ua))) return true;
  return false;
}

export function isSuspiciousUa(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return !BROWSER_KEYWORDS.some((k) => userAgent.toLowerCase().includes(k));
}
