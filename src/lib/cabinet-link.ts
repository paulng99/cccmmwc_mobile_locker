const PORT = process.env.NEXT_PUBLIC_CABINET_PROXY_PORT || "3001";

export function cabinetAppUrl(hash: string): string {
  const fragment = hash.startsWith("#") ? hash : `#${hash}`;
  const host = typeof window === "undefined" ? "127.0.0.1" : window.location.hostname;
  const protocol = typeof window === "undefined" ? "http:" : window.location.protocol;
  return `${protocol}//${host}:${PORT}/${fragment}`;
}
