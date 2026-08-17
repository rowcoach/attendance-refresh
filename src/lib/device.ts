const KEY = "tap4teams.device";

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setDeviceToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, token);
}

export function clearDeviceToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}