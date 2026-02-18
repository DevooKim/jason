export const SHARE_QUERY_KEY = "data";
export const SHARE_QUERY_KEYS = ["json", "data", "payload", "source"] as const;
export const SHARE_DEFAULT_BASE_DOMAIN = "";

export const SHARE_BASE_DOMAIN = (
  process.env.NEXT_PUBLIC_SHARE_DOMAIN ??
  process.env.BUN_PUBLIC_SHARE_DOMAIN ??
  SHARE_DEFAULT_BASE_DOMAIN
).trim();
export const SHARE_BASE_PATH = (
  process.env.NEXT_PUBLIC_SHARE_PATH ??
  process.env.BUN_PUBLIC_SHARE_PATH ??
  ""
).trim();

function normalizePath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function stripTrailingSlash(url: string): string {
  if (!url) return "";
  return url.endsWith("/") ? url.replace(/\/+$/u, "") : url;
}

export function getShareBaseUrl(): string {
  const currentOrigin = typeof window === "undefined" ? "" : window.location.origin;
  const base = stripTrailingSlash(SHARE_BASE_DOMAIN || currentOrigin);
  const path = normalizePath(SHARE_BASE_PATH || (typeof window === "undefined" ? "/" : window.location.pathname));
  return `${base}${path}`;
}
