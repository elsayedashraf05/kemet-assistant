import { API_BASE_URL } from "./api";

// مصدر واحد مشترك لكل حاجة متعلقة بالـ JWT/الحساب، بدل ما كل كومبوننت
// (Account.tsx, TopNav.tsx, ...) يكرر نفس getToken/setToken/apiMe لوحده.
const API_BASE = API_BASE_URL;
const TOKEN_KEY = "kemet_token";

export interface AccountUser {
  username: string;
  email: string;
  profile_pic_url: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiAccountRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/account${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

export async function apiMe(): Promise<AccountUser> {
  const data = await apiAccountRequest("/me");
  return data.user as AccountUser;
}
