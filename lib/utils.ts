import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns `path` only if it is a same-origin relative path (e.g. "/sobadmin/jobs?x=1"),
 * otherwise `fallback`. Blocks absolute URLs, protocol-relative URLs ("//evil.com"),
 * backslash tricks ("/\evil.com"), userinfo tricks ("@evil.com") and "javascript:" URLs.
 */
export function safeRedirectPath(path: string | null | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback
  }
  if (/[\u0000-\u001f\\]/.test(path)) {
    return fallback
  }
  return path
}
