import { parseAuthInput } from "./intranet.ts";

const COOKIE_ATTRIBUTES = new Set(["path", "expires", "max-age", "domain", "secure", "httponly", "samesite"]);

export function parseCookiePairs(header: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (!name || COOKIE_ATTRIBUTES.has(name.toLowerCase())) continue;
    pairs.push([name, trimmed.slice(eq + 1)]);
  }
  return pairs;
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const [key, value] of parseCookiePairs(header)) {
    if (key === name) return value;
  }
  return undefined;
}

export function mergeUpstreamCookie(browserCookie: string | undefined, settingsPayload: string): string | undefined {
  const map = new Map<string, string>();
  if (browserCookie) {
    for (const [name, value] of parseCookiePairs(browserCookie)) {
      if (name === "locker_session") continue;
      map.set(name, value);
    }
  }
  const settings = parseAuthInput(settingsPayload);
  if (settings.kind === "cookie") {
    for (const [name, value] of parseCookiePairs(settings.cookie)) {
      map.set(name, value);
    }
  }
  if (map.size === 0) return undefined;
  return [...map.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

export function rewriteUpstreamLocation(location: string, upstream: URL, publicOrigin: string): string {
  let target: URL;
  try {
    target = new URL(location, upstream);
  } catch {
    return location;
  }
  if (target.host !== upstream.host) return location;
  return `${publicOrigin.replace(/\/$/, "")}${target.pathname}${target.search}${target.hash}`;
}

export function stripCookieDomain(cookie: string): string {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part && !/^domain=/i.test(part))
    .join("; ");
}
