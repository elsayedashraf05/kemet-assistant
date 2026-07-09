const rawApiBaseUrl = import.meta.env.VITE_API_URL;

if (!rawApiBaseUrl) {
  throw new Error("VITE_API_URL is required to build backend API requests.");
}

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options);
}
