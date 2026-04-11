const TOKEN_KEY = "monarch_jwt";

function isExpiredOrMalformed(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return true;
    return Date.now() / 1000 >= payload.exp - 30;
  } catch {
    return true;
  }
}

/** Sync read of JWT from localStorage; drops expired or malformed tokens. */
export function getValidStoredJwt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw?.trim()) return null;
    if (isExpiredOrMalformed(raw)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export { TOKEN_KEY };
