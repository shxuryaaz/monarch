/** Must match useWalletAuth — used when apiFetch clears an invalid session */
export const MONARCH_JWT_STORAGE_KEY = "monarch_jwt";

export const MONARCH_JWT_INVALID_EVENT = "monarch:jwt-invalid";

export function clearMonarchJwtFromStorage(): void {
  try {
    localStorage.removeItem(MONARCH_JWT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyMonarchJwtInvalid(): void {
  window.dispatchEvent(new CustomEvent(MONARCH_JWT_INVALID_EVENT));
}
