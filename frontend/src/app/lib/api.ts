const rawApiBaseUrl = import.meta.env.VITE_API_URL;

if (!rawApiBaseUrl) {
  const message = "Missing VITE_API_URL. Set it to your backend base URL.";
  if (import.meta.env.DEV) {
    console.error(message);
  }
  throw new Error(message);
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(input), init);
}
