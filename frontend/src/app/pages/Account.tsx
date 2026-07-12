import { useState, useEffect, useRef } from "react";
import {
  Eye, EyeOff, Mail, Lock, User,
  Check, ArrowLeft,
  LogOut, Camera,
  Loader2, AlertCircle,
  FileText, Bookmark, Heart, MessageCircle, Trash2, Map, Calendar,
  ChevronDown, Search, Edit, Plane, Settings as SettingsIcon,
  MapPin, Users, Plus,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

// عنوان الـ Flask backend
const API_BASE = API_BASE_URL;
const TOKEN_KEY = "kemet_token";
const GUEST_NAME_KEY = "kemet_guest_name"; // shared with Community.tsx

// نفس الـ Google Client ID اللي متسجل في الباك اند (GOOGLE_CLIENT_ID secret) —
// لازم يتظبط كـ env var في الفرونت اند (VITE_GOOGLE_CLIENT_ID) عشان زرار
// "Sign in with Google" يظهر. لو مش موجود، الزرار ببساطة مش هيظهر.
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface AccountUser {
  username: string;
  email: string;
  profile_pic_url: string;
  full_name: string;
  country: string;
  language: string;
  travel_preferences: string[];
  created_at: string;
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
function getGuestName(): string {
  return localStorage.getItem(GUEST_NAME_KEY) || "";
}
function setGuestName(name: string) {
  localStorage.setItem(GUEST_NAME_KEY, name);
}

async function apiRequest(path: string, options: RequestInit = {}) {
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

// -- Posts API (same backend, different blueprint: /api/posts) --
async function postsApiRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const guestName = getGuestName();
  const res = await fetch(`${API_BASE}/api/posts${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!token && guestName ? { "X-Guest-Name": guestName } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

interface Comment {
  author: string;
  text: string;
  timestamp: string;
}
interface PostSummary {
  owner_username: string;
  content_index: number;
  text: string;
  image_url: string | null;
  timestamp: string;
  profile_pic_url: string;
  likes: number;
  liked_by_me: boolean;
  saves: number;
  saved_by_me: boolean;
  comments: Comment[];
  comments_count: number;
}

const apiMyPosts = () => postsApiRequest("/mine").then((d) => d.posts as PostSummary[]);
const apiSavedPosts = () => postsApiRequest("/saved").then((d) => d.posts as PostSummary[]);
const apiDeletePost = (owner: string, idx: number) => postsApiRequest(`/${owner}/${idx}`, { method: "DELETE" });
const apiToggleSave = (owner: string, idx: number) =>
  postsApiRequest(`/${owner}/${idx}/save`, { method: "POST" }) as Promise<{ saved_by_me: boolean; saves: number }>;

// -- Trip Planner API (same backend, different blueprint: /api/trip-planner) --
async function tripsApiRequest(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/trip-planner${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

interface TripPlanSummary {
  id: string;
  CreatedAt: string;
  Preferences: { cities?: string[]; destination?: string; days?: number; budget?: string };
}

const apiTripPlans = () => tripsApiRequest("/plans").then((d) => d.plans as TripPlanSummary[]);
const apiDeleteTripPlan = (id: string) => tripsApiRequest(`/plans/${id}`, { method: "DELETE" });

async function apiRegister(username: string, email: string, password: string, country: string, language: string) {
  const data = await apiRequest("/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password, country, language }),
  });
  setToken(data.token);
  return data.user as AccountUser;
}

async function apiLogin(identifier: string, password: string) {
  const data = await apiRequest("/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  setToken(data.token);
  return data.user as AccountUser;
}

async function apiGoogleLogin(credential: string) {
  const data = await apiRequest("/google-login", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  setToken(data.token);
  return data.user as AccountUser;
}

async function apiMe(): Promise<AccountUser> {
  const data = await apiRequest("/me");
  return data.user as AccountUser;
}

async function apiChangePassword(oldPassword: string, newPassword: string) {
  const data = await apiRequest("/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
  return data.message as string;
}

async function apiDeleteAccount(password: string) {
  const data = await apiRequest("/delete", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  return data.message as string;
}

async function apiForgotPassword(email: string): Promise<string> {
  // Tell the backend where this page currently lives, so the emailed link
  // points back here (with ?token=... appended) instead of a hardcoded URL.
  const resetUrlBase = `${window.location.origin}${window.location.pathname}`;
  const data = await apiRequest("/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email, reset_url_base: resetUrlBase }),
  });
  return data.message as string;
}

async function apiResetPassword(token: string, newPassword: string): Promise<string> {
  const data = await apiRequest("/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  return data.message as string;
}

async function apiUpdateProfile(updates: Partial<{ full_name: string; country: string; language: string; travel_preferences: string[] }>) {
  const data = await apiRequest("/profile", {
    method: "POST",
    body: JSON.stringify(updates),
  });
  return data.user as AccountUser;
}

async function apiUploadAvatar(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const data = await apiRequest("/avatar", { method: "POST", body: formData });
  return data.profile_pic_url as string;
}

function getInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
}

function timeAgo(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

type AuthView = "login" | "register" | "forgot" | "reset";

interface CountryOption {
  name: string;
  code: string;
}

// ISO 3166-1 country list (name + alpha-2 code) — used for the registration
// "Country" field and shown as a flag + code on the profile header.
const COUNTRIES: CountryOption[] = [
  { name: "Afghanistan", code: "AF" },
  { name: "Albania", code: "AL" },
  { name: "Algeria", code: "DZ" },
  { name: "American Samoa", code: "AS" },
  { name: "Andorra", code: "AD" },
  { name: "Angola", code: "AO" },
  { name: "Anguilla", code: "AI" },
  { name: "Antigua and Barbuda", code: "AG" },
  { name: "Argentina", code: "AR" },
  { name: "Armenia", code: "AM" },
  { name: "Aruba", code: "AW" },
  { name: "Australia", code: "AU" },
  { name: "Austria", code: "AT" },
  { name: "Azerbaijan", code: "AZ" },
  { name: "Bahamas", code: "BS" },
  { name: "Bahrain", code: "BH" },
  { name: "Bangladesh", code: "BD" },
  { name: "Barbados", code: "BB" },
  { name: "Belarus", code: "BY" },
  { name: "Belgium", code: "BE" },
  { name: "Belize", code: "BZ" },
  { name: "Benin", code: "BJ" },
  { name: "Bermuda", code: "BM" },
  { name: "Bhutan", code: "BT" },
  { name: "Bolivia, Plurinational State of", code: "BO" },
  { name: "Bonaire, Sint Eustatius and Saba", code: "BQ" },
  { name: "Bosnia and Herzegovina", code: "BA" },
  { name: "Botswana", code: "BW" },
  { name: "Brazil", code: "BR" },
  { name: "British Indian Ocean Territory", code: "IO" },
  { name: "Brunei Darussalam", code: "BN" },
  { name: "Bulgaria", code: "BG" },
  { name: "Burkina Faso", code: "BF" },
  { name: "Burundi", code: "BI" },
  { name: "Cabo Verde", code: "CV" },
  { name: "Cambodia", code: "KH" },
  { name: "Cameroon", code: "CM" },
  { name: "Canada", code: "CA" },
  { name: "Cayman Islands", code: "KY" },
  { name: "Central African Republic", code: "CF" },
  { name: "Chad", code: "TD" },
  { name: "Chile", code: "CL" },
  { name: "China", code: "CN" },
  { name: "Christmas Island", code: "CX" },
  { name: "Cocos (Keeling) Islands", code: "CC" },
  { name: "Colombia", code: "CO" },
  { name: "Comoros", code: "KM" },
  { name: "Congo", code: "CG" },
  { name: "Congo, The Democratic Republic of the", code: "CD" },
  { name: "Cook Islands", code: "CK" },
  { name: "Costa Rica", code: "CR" },
  { name: "Croatia", code: "HR" },
  { name: "Cuba", code: "CU" },
  { name: "Curaçao", code: "CW" },
  { name: "Cyprus", code: "CY" },
  { name: "Czechia", code: "CZ" },
  { name: "Côte d'Ivoire", code: "CI" },
  { name: "Denmark", code: "DK" },
  { name: "Djibouti", code: "DJ" },
  { name: "Dominica", code: "DM" },
  { name: "Dominican Republic", code: "DO" },
  { name: "Ecuador", code: "EC" },
  { name: "Egypt", code: "EG" },
  { name: "El Salvador", code: "SV" },
  { name: "Equatorial Guinea", code: "GQ" },
  { name: "Eritrea", code: "ER" },
  { name: "Estonia", code: "EE" },
  { name: "Eswatini", code: "SZ" },
  { name: "Ethiopia", code: "ET" },
  { name: "Falkland Islands (Malvinas)", code: "FK" },
  { name: "Faroe Islands", code: "FO" },
  { name: "Fiji", code: "FJ" },
  { name: "Finland", code: "FI" },
  { name: "France", code: "FR" },
  { name: "French Guiana", code: "GF" },
  { name: "French Polynesia", code: "PF" },
  { name: "Gabon", code: "GA" },
  { name: "Gambia", code: "GM" },
  { name: "Georgia", code: "GE" },
  { name: "Germany", code: "DE" },
  { name: "Ghana", code: "GH" },
  { name: "Gibraltar", code: "GI" },
  { name: "Greece", code: "GR" },
  { name: "Greenland", code: "GL" },
  { name: "Grenada", code: "GD" },
  { name: "Guadeloupe", code: "GP" },
  { name: "Guam", code: "GU" },
  { name: "Guatemala", code: "GT" },
  { name: "Guernsey", code: "GG" },
  { name: "Guinea", code: "GN" },
  { name: "Guinea-Bissau", code: "GW" },
  { name: "Guyana", code: "GY" },
  { name: "Haiti", code: "HT" },
  { name: "Holy See (Vatican City State)", code: "VA" },
  { name: "Honduras", code: "HN" },
  { name: "Hong Kong", code: "HK" },
  { name: "Hungary", code: "HU" },
  { name: "Iceland", code: "IS" },
  { name: "India", code: "IN" },
  { name: "Indonesia", code: "ID" },
  { name: "Iran, Islamic Republic of", code: "IR" },
  { name: "Iraq", code: "IQ" },
  { name: "Ireland", code: "IE" },
  { name: "Isle of Man", code: "IM" },
  { name: "Israel", code: "IL" },
  { name: "Italy", code: "IT" },
  { name: "Jamaica", code: "JM" },
  { name: "Japan", code: "JP" },
  { name: "Jersey", code: "JE" },
  { name: "Jordan", code: "JO" },
  { name: "Kazakhstan", code: "KZ" },
  { name: "Kenya", code: "KE" },
  { name: "Kiribati", code: "KI" },
  { name: "Korea, Democratic People's Republic of", code: "KP" },
  { name: "Korea, Republic of", code: "KR" },
  { name: "Kuwait", code: "KW" },
  { name: "Kyrgyzstan", code: "KG" },
  { name: "Lao People's Democratic Republic", code: "LA" },
  { name: "Latvia", code: "LV" },
  { name: "Lebanon", code: "LB" },
  { name: "Lesotho", code: "LS" },
  { name: "Liberia", code: "LR" },
  { name: "Libya", code: "LY" },
  { name: "Liechtenstein", code: "LI" },
  { name: "Lithuania", code: "LT" },
  { name: "Luxembourg", code: "LU" },
  { name: "Macao", code: "MO" },
  { name: "Madagascar", code: "MG" },
  { name: "Malawi", code: "MW" },
  { name: "Malaysia", code: "MY" },
  { name: "Maldives", code: "MV" },
  { name: "Mali", code: "ML" },
  { name: "Malta", code: "MT" },
  { name: "Marshall Islands", code: "MH" },
  { name: "Martinique", code: "MQ" },
  { name: "Mauritania", code: "MR" },
  { name: "Mauritius", code: "MU" },
  { name: "Mayotte", code: "YT" },
  { name: "Mexico", code: "MX" },
  { name: "Micronesia, Federated States of", code: "FM" },
  { name: "Moldova, Republic of", code: "MD" },
  { name: "Monaco", code: "MC" },
  { name: "Mongolia", code: "MN" },
  { name: "Montenegro", code: "ME" },
  { name: "Montserrat", code: "MS" },
  { name: "Morocco", code: "MA" },
  { name: "Mozambique", code: "MZ" },
  { name: "Myanmar", code: "MM" },
  { name: "Namibia", code: "NA" },
  { name: "Nauru", code: "NR" },
  { name: "Nepal", code: "NP" },
  { name: "Netherlands", code: "NL" },
  { name: "New Caledonia", code: "NC" },
  { name: "New Zealand", code: "NZ" },
  { name: "Nicaragua", code: "NI" },
  { name: "Niger", code: "NE" },
  { name: "Nigeria", code: "NG" },
  { name: "Niue", code: "NU" },
  { name: "Norfolk Island", code: "NF" },
  { name: "North Macedonia", code: "MK" },
  { name: "Northern Mariana Islands", code: "MP" },
  { name: "Norway", code: "NO" },
  { name: "Oman", code: "OM" },
  { name: "Pakistan", code: "PK" },
  { name: "Palau", code: "PW" },
  { name: "Palestine, State of", code: "PS" },
  { name: "Panama", code: "PA" },
  { name: "Papua New Guinea", code: "PG" },
  { name: "Paraguay", code: "PY" },
  { name: "Peru", code: "PE" },
  { name: "Philippines", code: "PH" },
  { name: "Pitcairn", code: "PN" },
  { name: "Poland", code: "PL" },
  { name: "Portugal", code: "PT" },
  { name: "Puerto Rico", code: "PR" },
  { name: "Qatar", code: "QA" },
  { name: "Romania", code: "RO" },
  { name: "Russian Federation", code: "RU" },
  { name: "Rwanda", code: "RW" },
  { name: "Réunion", code: "RE" },
  { name: "Saint Barthélemy", code: "BL" },
  { name: "Saint Helena, Ascension and Tristan da Cunha", code: "SH" },
  { name: "Saint Kitts and Nevis", code: "KN" },
  { name: "Saint Lucia", code: "LC" },
  { name: "Saint Martin (French part)", code: "MF" },
  { name: "Saint Pierre and Miquelon", code: "PM" },
  { name: "Saint Vincent and the Grenadines", code: "VC" },
  { name: "Samoa", code: "WS" },
  { name: "San Marino", code: "SM" },
  { name: "Sao Tome and Principe", code: "ST" },
  { name: "Saudi Arabia", code: "SA" },
  { name: "Senegal", code: "SN" },
  { name: "Serbia", code: "RS" },
  { name: "Seychelles", code: "SC" },
  { name: "Sierra Leone", code: "SL" },
  { name: "Singapore", code: "SG" },
  { name: "Sint Maarten (Dutch part)", code: "SX" },
  { name: "Slovakia", code: "SK" },
  { name: "Slovenia", code: "SI" },
  { name: "Solomon Islands", code: "SB" },
  { name: "Somalia", code: "SO" },
  { name: "South Africa", code: "ZA" },
  { name: "South Sudan", code: "SS" },
  { name: "Spain", code: "ES" },
  { name: "Sri Lanka", code: "LK" },
  { name: "Sudan", code: "SD" },
  { name: "Suriname", code: "SR" },
  { name: "Svalbard and Jan Mayen", code: "SJ" },
  { name: "Sweden", code: "SE" },
  { name: "Switzerland", code: "CH" },
  { name: "Syrian Arab Republic", code: "SY" },
  { name: "Taiwan, Province of China", code: "TW" },
  { name: "Tajikistan", code: "TJ" },
  { name: "Tanzania, United Republic of", code: "TZ" },
  { name: "Thailand", code: "TH" },
  { name: "Timor-Leste", code: "TL" },
  { name: "Togo", code: "TG" },
  { name: "Tokelau", code: "TK" },
  { name: "Tonga", code: "TO" },
  { name: "Trinidad and Tobago", code: "TT" },
  { name: "Tunisia", code: "TN" },
  { name: "Turkmenistan", code: "TM" },
  { name: "Turks and Caicos Islands", code: "TC" },
  { name: "Tuvalu", code: "TV" },
  { name: "Türkiye", code: "TR" },
  { name: "Uganda", code: "UG" },
  { name: "Ukraine", code: "UA" },
  { name: "United Arab Emirates", code: "AE" },
  { name: "United Kingdom", code: "GB" },
  { name: "United States", code: "US" },
  { name: "Uruguay", code: "UY" },
  { name: "Uzbekistan", code: "UZ" },
  { name: "Vanuatu", code: "VU" },
  { name: "Venezuela, Bolivarian Republic of", code: "VE" },
  { name: "Viet Nam", code: "VN" },
  { name: "Virgin Islands, British", code: "VG" },
  { name: "Virgin Islands, U.S.", code: "VI" },
  { name: "Wallis and Futuna", code: "WF" },
  { name: "Western Sahara", code: "EH" },
  { name: "Yemen", code: "YE" },
  { name: "Zambia", code: "ZM" },
  { name: "Zimbabwe", code: "ZW" },
  { name: "Åland Islands", code: "AX" },
];

// Common world languages, used for the registration + settings "Language" field.
const LANGUAGES: string[] = [
  "English", "Arabic", "Mandarin Chinese", "Spanish", "French", "German",
  "Hindi", "Portuguese", "Bengali", "Russian", "Japanese", "Urdu",
  "Indonesian", "Italian", "Turkish", "Vietnamese", "Korean", "Persian (Farsi)",
  "Swahili", "Thai", "Polish", "Ukrainian", "Dutch", "Greek", "Hebrew",
  "Romanian", "Hungarian", "Czech", "Swedish", "Danish", "Finnish",
  "Norwegian", "Malay", "Filipino (Tagalog)", "Punjabi", "Tamil", "Telugu",
  "Marathi", "Gujarati", "Amharic", "Somali", "Hausa", "Yoruba", "Zulu",
  "Serbian", "Croatian", "Bulgarian", "Slovak", "Slovenian", "Lithuanian",
  "Latvian", "Estonian", "Albanian", "Georgian", "Armenian", "Azerbaijani",
  "Kazakh", "Uzbek", "Mongolian", "Nepali", "Sinhala", "Burmese", "Khmer",
  "Lao", "Pashto", "Kurdish", "Icelandic", "Irish", "Welsh",
];

// Turns an ISO alpha-2 country code into its flag emoji by mapping each
// letter to a Unicode "regional indicator symbol" (A -> 🇦, B -> 🇧, ...).
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  const base = 127397; // codepoint offset between 'A' and the regional indicator symbols
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + base));
}

function findCountry(name: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.name === name);
}

// Injects the KEMET-themed thin gold scrollbar used inside dropdown lists
// (SearchableSelect's option panel). Safe to render more than once — the
// class name is the same everywhere, so duplicate <style> tags just repeat
// the same rule with no visual difference.
function KemetScrollbarStyle() {
  return (
    <style>{`
      .kemet-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(212,175,55,0.4) transparent; }
      .kemet-scrollbar::-webkit-scrollbar { width: 6px; }
      .kemet-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .kemet-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(212,175,55,0.4); border-radius: 9999px; }
      .kemet-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(212,175,55,0.7); }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  );
}

// A searchable, scrollable dropdown — used for Country and Language pickers
// where a plain <select> would bury the right option under 200+ others.
// Type to filter; click (or Enter) to choose; click outside to close.
function SearchableSelect({
  label, value, onChange, options, placeholder, renderOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  renderOption?: (opt: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={rootRef} className="relative">
      <KemetScrollbarStyle />
      <label className="block text-sm text-white/60 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-left text-white focus:outline-none focus:border-yellow-500/50 transition-colors hover:border-white/20"
      >
        <span className={value ? "" : "text-white/30"}>
          {value ? (renderOption ? renderOption(value) : value) : (placeholder || "Select…")}
        </span>
        <ChevronDown size={15} className={`text-white/40 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full bg-[#12152B] border border-[#D4AF37]/30 rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/40"
              />
            </div>
          </div>
          <div className="kemet-scrollbar max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-4">No matches.</p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); setQuery(""); }}
                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    opt === value ? "bg-[#D4AF37]/15 text-[#D4AF37]" : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  {renderOption ? renderOption(opt) : opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getPasswordStrength(password: string): number {
  if (password.length === 0) return 0;
  if (password.length < 4) return 1;
  if (password.length < 7) return 2;
  if (password.length < 10) return 3;
  return 4;
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-500", "bg-yellow-500", "bg-blue-400", "bg-green-500"];
  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              strength >= level ? colors[strength] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-xs mt-1" style={{ color: strength <= 1 ? "#ef4444" : strength === 2 ? "#eab308" : strength === 3 ? "#60a5fa" : "#22c55e" }}>
          {labels[strength]}
        </p>
      )}
    </div>
  );
}

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#D4AF37", opacity: 0.6 }} />
      <div className="absolute top-1/3 right-1/3 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#C9A84C", opacity: 0.4, animationDelay: "0.7s" }} />
      <div className="absolute bottom-1/4 left-1/3 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#D4AF37", opacity: 0.5, animationDelay: "1.4s" }} />
      <div className="absolute bottom-1/3 right-1/4 w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: "#C9A84C", opacity: 0.3, animationDelay: "2.1s" }} />
    </div>
  );
}

function DecorativePanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=800')" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(10,11,30,0.85) 0%, rgba(18,21,43,0.75) 100%)" }} />
      <FloatingParticles />
      <div className="relative z-10 text-center">
        <div className="text-7xl mb-4" style={{ color: "#D4AF37" }}>𓋹</div>
        <h1 className="text-4xl font-bold tracking-widest mb-2" style={{ color: "#D4AF37" }}>KEMET</h1>
        <p className="text-white/70 text-lg">Your AI Guide to Ancient &amp; Modern Egypt</p>
      </div>
    </div>
  );
}

function InputField({
  label, type = "text", value, onChange, placeholder, icon: Icon, children
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; icon?: React.ElementType; children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#D4AF37" }} />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors"
          style={{ paddingLeft: Icon ? "2.5rem" : undefined }}
        />
        {children && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{children}</div>
        )}
      </div>
    </div>
  );
}

function GoldButton({ children, onClick, className = "" }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98] ${className}`}
      style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)", color: "#0A0B1E" }}
    >
      {children}
    </button>
  );
}

// --- Google Sign-In ---

declare global {
  interface Window {
    google?: any;
  }
}

let googleScriptPromise: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Google sign-in."));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

// Renders Google's own "Continue with Google" button and hands the
// resulting ID token to our backend's /google-login route, which verifies
// it server-side and logs the user in (or creates an account the first time).
function GoogleSignInButton({
  onLoggedIn,
  onError,
}: {
  onLoggedIn: (user: AccountUser) => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;
    let cancelled = false;

    // Google's renderButton wants an exact pixel width (max 400) — a fixed
    // number like 320 doesn't shrink on narrow phones and was pushing the
    // whole card wider than the screen. We measure the actual container
    // width instead, and re-render on resize to stay in sync.
    const renderButton = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
      const measured = containerRef.current.offsetWidth;
      const width = Math.max(200, Math.min(400, measured || 320));
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width,
      });
    };

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: { credential: string }) => {
            try {
              const user = await apiGoogleLogin(response.credential);
              onLoggedIn(user);
            } catch (e) {
              onError(e instanceof Error ? e.message : "Google sign-in failed.");
            }
          },
        });
        renderButton();
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Google sign-in failed."));

    window.addEventListener("resize", renderButton);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", renderButton);
    };
  }, [onLoggedIn, onError]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={containerRef} className="w-full flex justify-center overflow-hidden" />;
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-xs text-white/40">or</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

function LoginView({ onSwitch, onLoggedIn }: { onSwitch: (v: AuthView) => void; onLoggedIn: (user: AccountUser) => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!identifier || !password) {
      setError("Please enter your username/email and password.");
      return;
    }
    setLoading(true);
    try {
      const user = await apiLogin(identifier, password);
      onLoggedIn(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center lg:hidden mb-2">
        <div className="text-5xl mb-1" style={{ color: "#D4AF37" }}>𓋹</div>
        <h1 className="text-2xl font-bold tracking-widest" style={{ color: "#D4AF37" }}>KEMET</h1>
        <p className="text-white/50 text-xs mt-1">Your AI Guide to Ancient &amp; Modern Egypt</p>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
        <p className="text-white/50 text-sm mt-1">Sign in to continue your journey</p>
      </div>
      <InputField label="Username or Email" value={identifier} onChange={setIdentifier} placeholder="you@example.com" icon={Mail} />
      <InputField label="Password" type={showPass ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" icon={Lock}>
        <button onClick={() => setShowPass(!showPass)} className="text-white/40 hover:text-white/70 transition-colors">
          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </InputField>
      <div className="flex items-center justify-end">
        <button onClick={() => onSwitch("forgot")} className="text-sm hover:opacity-100 transition-opacity" style={{ color: "#D4AF37" }}>
          Forgot Password?
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <GoldButton onClick={handleSubmit}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Sign In"}
      </GoldButton>
      {GOOGLE_CLIENT_ID && (
        <>
          <OrDivider />
          <GoogleSignInButton onLoggedIn={onLoggedIn} onError={setError} />
        </>
      )}
      <p className="text-center text-sm text-white/50">
        Don't have an account?{" "}
        <button onClick={() => onSwitch("register")} className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "#D4AF37" }}>
          Register
        </button>
      </p>
    </div>
  );
}

function RegisterView({ onSwitch, onLoggedIn }: { onSwitch: (v: AuthView) => void; onLoggedIn: (user: AccountUser) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("English");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // backend الحالي بيتعامل مع "username" واحد بس (مفيهوش first/last name منفصلين)
  const derivedUsername = `${firstName}${lastName}`.trim().replace(/\s+/g, "").toLowerCase();

  const handleSubmit = async () => {
    setError("");
    if (!firstName || !lastName || !email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!country) {
      setError("Please select your country.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!terms) {
      setError("Please accept the Terms & Conditions.");
      return;
    }
    setLoading(true);
    try {
      const user = await apiRegister(derivedUsername, email, password, country, language);
      onLoggedIn(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center lg:hidden mb-2">
        <div className="text-5xl mb-1" style={{ color: "#D4AF37" }}>𓋹</div>
        <h1 className="text-2xl font-bold tracking-widest" style={{ color: "#D4AF37" }}>KEMET</h1>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white">Create account</h2>
        <p className="text-white/50 text-sm mt-1">Join thousands of Egypt explorers</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <InputField label="First Name" value={firstName} onChange={setFirstName} placeholder="Sarah" icon={User} />
        <InputField label="Last Name" value={lastName} onChange={setLastName} placeholder="Ahmed" icon={User} />
      </div>
      <SearchableSelect
        label="Country"
        value={country}
        onChange={setCountry}
        options={COUNTRIES.map((c) => c.name)}
        placeholder="Search for your country…"
        renderOption={(name) => {
          const c = findCountry(name);
          return <span className="flex items-center gap-2"><span>{c ? flagEmoji(c.code) : "🌍"}</span>{name}</span>;
        }}
      />
      <SearchableSelect
        label="Language"
        value={language}
        onChange={setLanguage}
        options={LANGUAGES}
        placeholder="Search for your language…"
      />
      <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={Mail} />
      <div>
        <InputField label="Password" type={showPass ? "text" : "password"} value={password} onChange={setPassword} placeholder="••••••••" icon={Lock}>
          <button onClick={() => setShowPass(!showPass)} className="text-white/40 hover:text-white/70 transition-colors">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </InputField>
        <PasswordStrengthMeter password={password} />
      </div>
      <InputField label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" icon={Lock} />
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          className="w-4 h-4 mt-0.5 rounded border border-white/20 bg-white/5"
        />
        <span className="text-sm text-white/60">
          I agree to the{" "}
          <span className="cursor-pointer hover:opacity-80" style={{ color: "#D4AF37" }}>Terms &amp; Conditions</span>
          {" "}and{" "}
          <span className="cursor-pointer hover:opacity-80" style={{ color: "#D4AF37" }}>Privacy Policy</span>
        </span>
      </label>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <GoldButton onClick={handleSubmit}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Account"}
      </GoldButton>
      {GOOGLE_CLIENT_ID && (
        <>
          <OrDivider />
          <GoogleSignInButton onLoggedIn={onLoggedIn} onError={setError} />
        </>
      )}
      <p className="text-center text-sm text-white/50">
        Already have an account?{" "}
        <button onClick={() => onSwitch("login")} className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "#D4AF37" }}>
          Sign In
        </button>
      </p>
    </div>
  );
}

function ForgotView({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email) return;
    setError("");
    setLoading(true);
    try {
      await apiForgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <button onClick={() => onSwitch("login")} className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors mb-4">
          <ArrowLeft size={14} />
          Back to Sign In
        </button>
        <h2 className="text-2xl font-bold text-white">Reset password</h2>
        <p className="text-white/50 text-sm mt-1">Enter your email and we'll send you a reset link</p>
      </div>
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}>
            <Check size={28} style={{ color: "#0A0B1E" }} />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Check your email</p>
            <p className="text-white/50 text-sm mt-1">
              If an account exists for <span style={{ color: "#D4AF37" }}>{email}</span>, a reset link is on its way.
            </p>
          </div>
          <button onClick={() => onSwitch("login")} className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#D4AF37" }}>
            Back to Sign In
          </button>
        </div>
      ) : (
        <>
          <InputField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" icon={Mail} />
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
          <GoldButton onClick={handleSubmit}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Send Reset Link"}
          </GoldButton>
          <button onClick={() => onSwitch("login")} className="text-center text-sm hover:opacity-80 transition-opacity" style={{ color: "#D4AF37" }}>
            Back to Sign In
          </button>
        </>
      )}
    </div>
  );
}

function ResetPasswordView({ token, onDone }: { token: string; onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await apiResetPassword(token, newPassword);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}>
          <Check size={28} style={{ color: "#0A0B1E" }} />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-lg">Password updated</p>
          <p className="text-white/50 text-sm mt-1">You can now sign in with your new password.</p>
        </div>
        <button onClick={onDone} className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#D4AF37" }}>
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-white">Choose a new password</h2>
        <p className="text-white/50 text-sm mt-1">This reset link expires 30 minutes after it was sent.</p>
      </div>
      <div>
        <InputField label="New Password" type={showPass ? "text" : "password"} value={newPassword} onChange={setNewPassword} placeholder="••••••••" icon={Lock}>
          <button onClick={() => setShowPass(!showPass)} className="text-white/40 hover:text-white/70 transition-colors">
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </InputField>
        <PasswordStrengthMeter password={newPassword} />
      </div>
      <InputField label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} placeholder="••••••••" icon={Lock} />
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <GoldButton onClick={handleSubmit}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Update Password"}
      </GoldButton>
    </div>
  );
}

function GuestMode({ onLoggedIn }: { onLoggedIn: (user: AccountUser) => void }) {
  // A password-reset email links back here with ?token=... — if it's
  // present, jump straight to "set a new password" instead of the login form.
  const urlToken = new URLSearchParams(window.location.search).get("token") || "";
  const [view, setView] = useState<AuthView>(urlToken ? "reset" : "login");

  const handleResetDone = () => {
    // Drop the token from the URL so refreshing doesn't reopen this screen.
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
    setView("login");
  };

  return (
    <div className="flex overflow-x-hidden" style={{ background: "#0A0B1E" }}>
      <KemetScrollbarStyle />
      <DecorativePanel />
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
          {view === "login" && <LoginView onSwitch={setView} onLoggedIn={onLoggedIn} />}
          {view === "register" && <RegisterView onSwitch={setView} onLoggedIn={onLoggedIn} />}
          {view === "forgot" && <ForgotView onSwitch={setView} />}
          {view === "reset" && <ResetPasswordView token={urlToken} onDone={handleResetDone} />}
        </div>
      </div>
    </div>
  );
}

// --- Logged-in profile settings ---

function SettingsTab({ user, onUserUpdate, onSignOut }: { user: AccountUser; onUserUpdate: (u: AccountUser) => void; onSignOut: () => void }) {
  const [fullName, setFullName] = useState(user.full_name);
  const [country, setCountry] = useState(user.country);
  const [language, setLanguage] = useState(user.language || "English");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSaveProfile = async () => {
    setProfileMessage(null);
    setProfileLoading(true);
    try {
      const updated = await apiUpdateProfile({ full_name: fullName, country, language });
      onUserUpdate(updated);
      setProfileMessage({ type: "success", text: "Profile updated." });
    } catch (e) {
      setProfileMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update profile." });
    } finally {
      setProfileLoading(false);
    }
  };

  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (newPw !== confirmPw) {
      setPwMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    setPwLoading(true);
    try {
      const msg = await apiChangePassword(oldPw, newPw);
      setPwMessage({ type: "success", text: msg });
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setPwMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to update password." });
    } finally {
      setPwLoading(false);
    }
  };

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setAvatarLoading(true);
    try {
      const url = await apiUploadAvatar(file);
      onUserUpdate({ ...user, profile_pic_url: url });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload picture.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const [deletePw, setDeletePw] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (!confirmDelete) {
      setDeleteError("Please check the confirmation box first.");
      return;
    }
    if (!deletePw) {
      setDeleteError("Please enter your password to confirm.");
      return;
    }
    setDeleteLoading(true);
    try {
      await apiDeleteAccount(deletePw);
      onSignOut();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto animate-[fadeIn_0.2s_ease-out]">
      {/* Profile info + avatar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <User size={16} style={{ color: "#D4AF37" }} /> Profile Information
        </h3>
        <div className="flex items-center gap-4">
          {user.profile_pic_url ? (
            <img src={user.profile_pic_url} alt={user.username} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)", color: "#0A0B1E" }}
            >
              {getInitials(user.full_name || user.username)}
            </div>
          )}
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-white/70 hover:bg-white/10 transition-all cursor-pointer">
            <Camera size={14} />
            {avatarLoading ? "Uploading..." : "Change Picture"}
            <input type="file" accept="image/png,image/jpeg" onChange={handleAvatarChange} className="hidden" disabled={avatarLoading} />
          </label>
        </div>
        {avatarError && <p className="text-sm text-red-400">{avatarError}</p>}

        <InputField label="Full Name" value={fullName} onChange={setFullName} placeholder="Sarah Ahmed" icon={User} />
        <div>
          <InputField label="Username" value={user.username} onChange={() => {}} icon={User} />
          <p className="text-xs text-white/30 mt-1">Your username is your public @handle and can't be changed.</p>
        </div>
        <div>
          <InputField label="Email" value={user.email} onChange={() => {}} icon={Mail} />
          <p className="text-xs text-white/30 mt-1">Email can't be changed here.</p>
        </div>
        <SearchableSelect
          label="Country"
          value={country}
          onChange={setCountry}
          options={COUNTRIES.map((c) => c.name)}
          placeholder="Search for your country…"
          renderOption={(name) => {
            const c = findCountry(name);
            return <span className="flex items-center gap-2"><span>{c ? flagEmoji(c.code) : "🌍"}</span>{name}</span>;
          }}
        />
        <SearchableSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} placeholder="Search for your language…" />

        {profileMessage && (
          <p className={`text-sm ${profileMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {profileMessage.text}
          </p>
        )}
        <GoldButton className="!w-auto self-end px-6" onClick={handleSaveProfile}>
          {profileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
        </GoldButton>
      </div>

      {/* Change password */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Lock size={16} style={{ color: "#D4AF37" }} /> Change Password
        </h3>
        <InputField label="Current Password" type="password" value={oldPw} onChange={setOldPw} placeholder="••••••••" icon={Lock} />
        <InputField label="New Password" type="password" value={newPw} onChange={setNewPw} placeholder="••••••••" icon={Lock} />
        <InputField label="Confirm New Password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="••••••••" icon={Lock} />
        {pwMessage && (
          <p className={`text-sm ${pwMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {pwMessage.text}
          </p>
        )}
        <GoldButton className="!w-auto self-end px-6" onClick={handleChangePassword}>
          {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
        </GoldButton>
      </div>

      {/* Delete account */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex flex-col gap-4">
        <h3 className="text-red-400 font-semibold flex items-center gap-2">
          <AlertCircle size={16} /> Delete Account
        </h3>
        <p className="text-sm text-white/50">This permanently deletes your account and all your posts. This cannot be undone.</p>
        <InputField label="Confirm your password" type="password" value={deletePw} onChange={setDeletePw} placeholder="••••••••" icon={Lock} />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.checked)}
            className="w-4 h-4 rounded border border-white/20 bg-white/5"
          />
          <span className="text-sm text-white/60">I understand this cannot be undone</span>
        </label>
        {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleteLoading}
          className="self-end px-6 py-2.5 rounded-xl text-sm font-semibold bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-all"
        >
          {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Permanently Delete My Account"}
        </button>
      </div>
    </div>
  );
}

// --- "Your Posts" tab: works for logged-in users automatically, and for
// guests once they've typed the name they posted under. ---

function PostRow({ post, canDelete, onDelete }: { post: PostSummary; canDelete: boolean; onDelete: () => void }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">@{post.owner_username}</p>
          <p className="text-xs text-gray-500">{timeAgo(post.timestamp)}</p>
        </div>
        {canDelete && (
          <button onClick={onDelete} className="text-gray-500 hover:text-red-400 transition-colors" title="Delete post">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {post.text && <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{post.text}</p>}
      {post.image_url && (
        <div className="rounded-xl overflow-hidden">
          <img src={post.image_url} alt="post" loading="lazy" decoding="async" className="w-full max-h-72 object-cover" />
        </div>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-white/5">
        <span className="flex items-center gap-1"><Heart size={12} /> {post.likes}</span>
        <span className="flex items-center gap-1"><MessageCircle size={12} /> {post.comments_count}</span>
        <span className="flex items-center gap-1"><Bookmark size={12} /> {post.saves}</span>
      </div>
    </div>
  );
}

function GuestNameGate({
  title, description, onSubmit,
}: {
  title: string; description: string; onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(getGuestName());
  return (
    <div className="max-w-md mx-auto text-center py-16 flex flex-col items-center gap-4">
      <div className="text-4xl">🔐</div>
      <h3 className="text-white text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
      <div className="w-full flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit(name.trim())}
          placeholder="Enter the name you posted with"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]/40 transition-colors"
        />
        <button
          onClick={() => name.trim() && onSubmit(name.trim())}
          disabled={!name.trim()}
          className="px-5 py-2 bg-[#D4AF37] hover:bg-[#C9A84C] text-black text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
        >
          View
        </button>
      </div>
    </div>
  );
}

// Module-level cache keyed by identity name: survives switching tabs/pages
// and back. Resets only on a full browser reload, or when the identity
// changes (a different name means different data, so we don't show the
// wrong person's cached posts).
let cachedMyPosts: { name: string; posts: PostSummary[] } | null = null;

function YourPostsTab({ isLoggedIn, username }: { isLoggedIn: boolean; username: string }) {
  const [activeName, setActiveName] = useState(isLoggedIn ? username : getGuestName());
  const [posts, setPosts] = useState<PostSummary[] | null>(
    cachedMyPosts && cachedMyPosts.name === activeName ? cachedMyPosts.posts : null
  );
  const [loading, setLoading] = useState(!(cachedMyPosts && cachedMyPosts.name === activeName));
  const [error, setError] = useState("");

  const load = async (name: string) => {
    if (!isLoggedIn) setGuestName(name);
    setActiveName(name);
    // Only spin if we don't already have this exact person's posts cached.
    const hasCache = cachedMyPosts && cachedMyPosts.name === name;
    if (!hasCache) setLoading(true);
    setError("");
    try {
      const data = await apiMyPosts();
      cachedMyPosts = { name, posts: data };
      setPosts(data);
    } catch (e) {
      if (!hasCache) setError(e instanceof Error ? e.message : "Failed to load your posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      load(username);
    } else if (activeName) {
      load(activeName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, username]);

  const handleDelete = async (idx: number) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await apiDeletePost(activeName, idx);
      setPosts((prev) => {
        const next = prev ? prev.filter((p) => p.content_index !== idx) : prev;
        if (next) cachedMyPosts = { name: activeName, posts: next };
        return next;
      });
    } catch {
      /* ignore */
    }
  };

  if (!isLoggedIn && !activeName) {
    return (
      <GuestNameGate
        title="Not signed in"
        description="Enter the name you posted with as a guest to view and manage your posts."
        onSubmit={load}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          Your <span style={{ color: "#D4AF37" }}>Posts</span>
        </h2>
        {!isLoggedIn && (
          <button
            onClick={() => { setGuestName(""); setActiveName(""); setPosts(null); cachedMyPosts = null; }}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Not you? Switch name
          </button>
        )}
      </div>
      <p className="text-sm text-gray-400">
        All posts by <span style={{ color: "#D4AF37" }}>@{activeName}</span>
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" style={{ color: "#D4AF37" }} /></div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !posts || posts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm">No posts yet. Go share something!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <PostRow key={p.content_index} post={p} canDelete onDelete={() => handleDelete(p.content_index)} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- "Saved" tab: bookmarked posts, from anyone, for this identity. ---

let cachedSavedPosts: { name: string; posts: PostSummary[] } | null = null;

function SavedPostsTab({ isLoggedIn, username }: { isLoggedIn: boolean; username: string }) {
  const [activeName, setActiveName] = useState(isLoggedIn ? username : getGuestName());
  const [posts, setPosts] = useState<PostSummary[] | null>(
    cachedSavedPosts && cachedSavedPosts.name === activeName ? cachedSavedPosts.posts : null
  );
  const [loading, setLoading] = useState(!(cachedSavedPosts && cachedSavedPosts.name === activeName));
  const [error, setError] = useState("");

  const load = async (name: string) => {
    if (!isLoggedIn) setGuestName(name);
    setActiveName(name);
    const hasCache = cachedSavedPosts && cachedSavedPosts.name === name;
    if (!hasCache) setLoading(true);
    setError("");
    try {
      const data = await apiSavedPosts();
      cachedSavedPosts = { name, posts: data };
      setPosts(data);
    } catch (e) {
      if (!hasCache) setError(e instanceof Error ? e.message : "Failed to load saved posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      load(username);
    } else if (activeName) {
      load(activeName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, username]);

  const handleUnsave = async (owner: string, idx: number) => {
    try {
      await apiToggleSave(owner, idx);
      setPosts((prev) => {
        const next = prev ? prev.filter((p) => !(p.owner_username === owner && p.content_index === idx)) : prev;
        if (next) cachedSavedPosts = { name: activeName, posts: next };
        return next;
      });
    } catch {
      /* ignore */
    }
  };

  if (!isLoggedIn && !activeName) {
    return (
      <GuestNameGate
        title="Not signed in"
        description="Enter the name you use in the community to see the posts you've saved."
        onSubmit={load}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <h2 className="text-xl font-bold text-white">
        Saved <span style={{ color: "#D4AF37" }}>Posts</span>
      </h2>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" style={{ color: "#D4AF37" }} /></div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !posts || posts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Bookmark size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nothing saved yet. Tap "Save" on a post in the Community feed.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((p) => (
            <div key={`${p.owner_username}-${p.content_index}`} className="relative">
              <PostRow post={p} canDelete={false} onDelete={() => {}} />
              <button
                onClick={() => handleUnsave(p.owner_username, p.content_index)}
                className="absolute top-5 right-5 text-xs text-[#D4AF37] hover:opacity-80 transition-opacity"
              >
                Unsave
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Tab bar shell ---

// --- "My Trips" tab: itineraries saved from the Trip Planner. ---

function formatTripDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function MyTripsTab({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [plans, setPlans] = useState<TripPlanSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    apiTripPlans()
      .then(setPlans)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your saved trips."))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this saved trip?")) return;
    try {
      await apiDeleteTripPlan(id);
      setPlans((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch {
      /* ignore */
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 text-gray-500">
        <Map size={32} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">Sign in to see itineraries you've saved from the Trip Planner.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          My <span style={{ color: "#D4AF37" }}>Trips</span>
        </h2>
        <a href="/trip-planner" className="text-xs font-semibold" style={{ color: "#D4AF37" }}>
          Plan a new trip
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" style={{ color: "#D4AF37" }} /></div>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !plans || plans.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Map size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No saved trips yet — build one in the Trip Planner and save it here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((p) => {
            const cities = p.Preferences?.cities?.length ? p.Preferences.cities.join(", ") : (p.Preferences?.destination || "Egypt");
            return (
              <a
                key={p.id}
                href={`/trip-planner?saved=${encodeURIComponent(p.id)}`}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-3 hover:border-yellow-500/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{cities}</div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {p.Preferences?.days || "?"} days</span>
                    <span>{p.Preferences?.budget}</span>
                    <span>Saved {formatTripDate(p.CreatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(p.id); }}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors flex-shrink-0"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

type MainTab = "overview" | "trips" | "posts" | "saved" | "settings";

// --- Profile header: avatar, name, country flag + code, member-since, real stats ---

function ProfileHeader({
  user, tripsCount, postsCount, savedCount, onEditProfile,
}: {
  user: AccountUser;
  tripsCount: number | null;
  postsCount: number | null;
  savedCount: number | null;
  onEditProfile: () => void;
}) {
  const country = findCountry(user.country);
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short" })
    : "";

  const stats: { value: string; label: string }[] = [
    { value: tripsCount === null ? "–" : String(tripsCount), label: "Trips Planned" },
    { value: postsCount === null ? "–" : String(postsCount), label: "Posts" },
    { value: savedCount === null ? "–" : String(savedCount), label: "Saved Posts" },
  ];

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-[fadeIn_0.2s_ease-out]">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        {user.profile_pic_url ? (
          <img src={user.profile_pic_url} alt={user.username} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)", color: "#0A0B1E" }}
          >
            {getInitials(user.full_name || user.username)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-white truncate">{user.full_name || user.username}</h2>
            {country && (
              <span className="text-sm text-white/40 flex items-center gap-1 flex-shrink-0">
                <span>{flagEmoji(country.code)}</span>{country.code}
              </span>
            )}
          </div>
          <p className="text-sm truncate" style={{ color: "#D4AF37" }}>@{user.username}</p>
          {memberSince && <p className="text-xs text-white/40 mt-1">Member since {memberSince}</p>}
        </div>
        <button
          onClick={onEditProfile}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-white/70 hover:bg-white/10 transition-all flex-shrink-0"
        >
          <Edit size={14} />
          Edit Profile
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <p className="text-xl font-bold" style={{ color: "#D4AF37" }}>{value}</p>
            <p className="text-xs text-white/50 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Tab navigation (pill style) ---

function TabsNav({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  const tabs: { key: MainTab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Map },
    { key: "trips", label: "My Trips", icon: Plane },
    { key: "posts", label: "My Posts", icon: FileText },
    { key: "saved", label: "Saved Posts", icon: Bookmark },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];
  return (
    <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 overflow-x-auto">
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center ${
            active === key ? "text-[#0A0B1E]" : "text-white/50 hover:text-white/80"
          }`}
          style={active === key ? { background: "linear-gradient(135deg, #D4AF37, #C9A84C)" } : {}}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// --- Overview tab: recent activity + next trip + editable travel preferences,
// all built from real data (posts, saved posts, saved trip plans, profile). ---

const PREFERENCE_TAGS = [
  "History", "Beaches", "Luxury", "Photography", "Adventure", "Food & Cuisine",
  "Diving", "Desert Safari", "Culture", "Nightlife", "Family", "Shopping",
  "Nature", "Wellness",
];

function OverviewTab({
  user, onUserUpdate, trips, posts, savedPosts,
}: {
  user: AccountUser;
  onUserUpdate: (u: AccountUser) => void;
  trips: TripPlanSummary[] | null;
  posts: PostSummary[] | null;
  savedPosts: PostSummary[] | null;
}) {
  const sortedTrips = trips ? [...trips].sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime()) : null;
  const sortedPosts = posts ? [...posts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : null;
  const sortedSaved = savedPosts ? [...savedPosts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : null;
  const nextTrip = sortedTrips && sortedTrips[0];

  type ActivityItem = { icon: React.ElementType; text: string; time: string; ts: number; color: string };
  const activity: ActivityItem[] = [];
  if (sortedTrips && sortedTrips[0]) {
    const t = sortedTrips[0];
    const dest = t.Preferences?.cities?.length ? t.Preferences.cities.join(", ") : (t.Preferences?.destination || "Egypt");
    activity.push({ icon: Plane, text: `Planned a trip to ${dest}`, time: formatTripDate(t.CreatedAt), ts: new Date(t.CreatedAt).getTime() || 0, color: "#D4AF37" });
  }
  if (sortedPosts && sortedPosts[0]) {
    const p = sortedPosts[0];
    const preview = p.text ? `Posted: "${p.text.slice(0, 50)}${p.text.length > 50 ? "…" : ""}"` : "Shared a new post";
    activity.push({ icon: FileText, text: preview, time: timeAgo(p.timestamp), ts: new Date(p.timestamp).getTime() || 0, color: "#C9A84C" });
  }
  if (sortedSaved && sortedSaved[0]) {
    const s = sortedSaved[0];
    activity.push({ icon: Bookmark, text: `Saved a post by @${s.owner_username}`, time: timeAgo(s.timestamp), ts: new Date(s.timestamp).getTime() || 0, color: "#60a5fa" });
  }
  if (user.created_at) {
    activity.push({ icon: Users, text: "Joined the KEMET Community", time: timeAgo(user.created_at), ts: new Date(user.created_at).getTime() || 0, color: "#22c55e" });
  }
  activity.sort((a, b) => b.ts - a.ts);

  const [editingPrefs, setEditingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<string[]>(user.travel_preferences);
  const [prefsSaving, setPrefsSaving] = useState(false);

  const togglePref = (tag: string) => {
    setPrefs((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const savePrefs = async () => {
    setPrefsSaving(true);
    try {
      const updated = await apiUpdateProfile({ travel_preferences: prefs });
      onUserUpdate(updated);
      setEditingPrefs(false);
    } catch {
      /* keep the editor open so they can retry */
    } finally {
      setPrefsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-6">
        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Recent Activity</h3>
          {activity.length === 0 ? (
            <p className="text-sm text-white/40">Nothing yet — plan a trip or share a post to get started.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {activity.map(({ icon: Icon, text, time, color }, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 break-words">{text}</p>
                    <p className="text-xs text-white/40 mt-0.5">{time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Travel Preferences (editable) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Travel Preferences</h3>
            <button
              onClick={() => { setPrefs(user.travel_preferences); setEditingPrefs((v) => !v); }}
              className="text-xs flex items-center gap-1 text-white/50 hover:text-white transition-colors"
            >
              <Edit size={12} /> {editingPrefs ? "Cancel" : "Change"}
            </button>
          </div>
          {editingPrefs ? (
            <div className="flex flex-col gap-4 animate-[fadeIn_0.15s_ease-out]">
              <div className="flex flex-wrap gap-2">
                {PREFERENCE_TAGS.map((tag) => {
                  const isActive = prefs.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => togglePref(tag)}
                      className="text-sm px-3 py-1.5 rounded-full border transition-all flex items-center gap-1"
                      style={isActive
                        ? { background: "#D4AF3720", borderColor: "#D4AF3760", color: "#D4AF37" }
                        : { background: "transparent", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.5)" }}
                    >
                      {isActive ? <Check size={12} /> : <Plus size={12} />}
                      {tag}
                    </button>
                  );
                })}
              </div>
              <GoldButton className="!w-auto self-end px-6" onClick={savePrefs}>
                {prefsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Preferences"}
              </GoldButton>
            </div>
          ) : user.travel_preferences.length === 0 ? (
            <p className="text-sm text-white/40">No preferences set yet — tap "Change" to add some.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.travel_preferences.map((tag) => (
                <span key={tag} className="text-sm px-3 py-1.5 rounded-full border" style={{ background: "#D4AF3720", borderColor: "#D4AF3740", color: "#D4AF37" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Next Trip */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4 h-fit">
        <h3 className="text-white font-semibold">Next Trip</h3>
        {nextTrip ? (
          <>
            <div className="rounded-xl h-28 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #D4AF3720, #0A0B1E)" }}>
              <Plane size={28} style={{ color: "#D4AF3760" }} />
            </div>
            <div>
              <p className="text-white font-semibold">
                {nextTrip.Preferences?.cities?.length ? nextTrip.Preferences.cities.join(", ") : (nextTrip.Preferences?.destination || "Egypt")}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Calendar size={12} style={{ color: "#D4AF37" }} />
                <p className="text-xs text-white/50">Saved {formatTripDate(nextTrip.CreatedAt)}</p>
              </div>
            </div>
            {(nextTrip.Preferences?.days || nextTrip.Preferences?.budget) && (
              <div className="flex items-center gap-2 text-xs text-white/50">
                <MapPin size={12} style={{ color: "#D4AF37" }} />
                <span>
                  {nextTrip.Preferences?.days ? `${nextTrip.Preferences.days} days` : ""}
                  {nextTrip.Preferences?.days && nextTrip.Preferences?.budget ? " · " : ""}
                  {nextTrip.Preferences?.budget || ""}
                </span>
              </div>
            )}
            <a
              href={`/trip-planner?saved=${encodeURIComponent(nextTrip.id)}`}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)", color: "#0A0B1E" }}
            >
              View Plan
            </a>
          </>
        ) : (
          <>
            <div className="rounded-xl h-28 bg-white/5 flex items-center justify-center">
              <Plane size={28} className="text-white/20" />
            </div>
            <p className="text-sm text-white/40">No trips planned yet.</p>
            <a
              href="/trip-planner"
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)", color: "#0A0B1E" }}
            >
              Plan a Trip
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// --- Logged-in shell: header + tabs + content, shared across all logged-in views ---

function LoggedInShell({
  user, onUserUpdate, onSignOut,
}: {
  user: AccountUser;
  onUserUpdate: (u: AccountUser) => void;
  onSignOut: () => void;
}) {
  const [tab, setTab] = useState<MainTab>("overview");
  const [trips, setTrips] = useState<TripPlanSummary[] | null>(null);
  const [posts, setPosts] = useState<PostSummary[] | null>(null);
  const [savedPosts, setSavedPosts] = useState<PostSummary[] | null>(null);

  useEffect(() => {
    apiTripPlans().then(setTrips).catch(() => setTrips([]));
    apiMyPosts().then(setPosts).catch(() => setPosts([]));
    apiSavedPosts().then(setSavedPosts).catch(() => setSavedPosts([]));
  }, [user.username]);

  return (
    <div className="min-h-screen overflow-x-hidden p-4 md:p-8" style={{ background: "#0A0B1E" }}>
      <KemetScrollbarStyle />
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <ProfileHeader
          user={user}
          tripsCount={trips ? trips.length : null}
          postsCount={posts ? posts.length : null}
          savedCount={savedPosts ? savedPosts.length : null}
          onEditProfile={() => setTab("settings")}
        />
        <TabsNav active={tab} onChange={setTab} />

        <div className="animate-[fadeIn_0.2s_ease-out]">
          {tab === "overview" && <OverviewTab user={user} onUserUpdate={onUserUpdate} trips={trips} posts={posts} savedPosts={savedPosts} />}
          {tab === "trips" && <MyTripsTab isLoggedIn />}
          {tab === "posts" && <YourPostsTab isLoggedIn username={user.username} />}
          {tab === "saved" && <SavedPostsTab isLoggedIn username={user.username} />}
          {tab === "settings" && <SettingsTab user={user} onUserUpdate={onUserUpdate} onSignOut={onSignOut} />}
        </div>

        <div className="flex justify-center pt-2 pb-8">
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition-all text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// Cached across mounts so navigating away from Account and back doesn't
// re-show the full-screen "checking session" spinner every time.
let cachedUser: AccountUser | null | undefined = undefined; // undefined = not checked yet this session

export function Account() {
  const [user, setUser] = useState<AccountUser | null>(cachedUser ?? null);
  const [checkingSession, setCheckingSession] = useState(cachedUser === undefined);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      cachedUser = null;
      setCheckingSession(false);
      return;
    }
    if (cachedUser !== undefined) {
      // Already verified this session — trust it, and just re-check quietly
      // in the background in case the token expired server-side meanwhile.
      apiMe()
        .then((u) => { cachedUser = u; setUser(u); })
        .catch(() => { clearToken(); cachedUser = null; setUser(null); });
      return;
    }
    apiMe()
      .then((u) => { cachedUser = u; setUser(u); })
      .catch(() => { clearToken(); cachedUser = null; })
      .finally(() => setCheckingSession(false));
  }, []);

  const handleSignOut = () => {
    clearToken();
    cachedUser = null;
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0B1E" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#D4AF37" }} />
      </div>
    );
  }

  return user
    ? <LoggedInShell user={user} onUserUpdate={(u) => { cachedUser = u; setUser(u); }} onSignOut={handleSignOut} />
    : <GuestMode onLoggedIn={(u) => { cachedUser = u; setUser(u); }} />;
}