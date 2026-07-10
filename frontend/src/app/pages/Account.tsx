import { useState, useEffect, useRef } from "react";
import {
  Eye, EyeOff, Mail, Lock, User,
  Check, ArrowLeft,
  LogOut, Camera,
  Loader2, AlertCircle,
  FileText, Bookmark, Heart, MessageCircle, Trash2, Map, Calendar,
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

async function apiRegister(username: string, email: string, password: string) {
  const data = await apiRequest("/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
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

const NATIONALITIES = [
  "United States", "United Kingdom", "Germany", "France", "Canada",
  "Australia", "Japan", "Brazil", "India", "Egypt"
];

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

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
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
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
        });
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Google sign-in failed."));

    return () => {
      cancelled = true;
    };
  }, [onLoggedIn, onError]);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={containerRef} className="flex justify-center [&>div]:w-full" />;
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
  const [nationality, setNationality] = useState("");
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
      const user = await apiRegister(derivedUsername, email, password);
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
      <div>
        <label className="block text-sm text-white/60 mb-1">Nationality</label>
        <select
          value={nationality}
          onChange={(e) => setNationality(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
          style={{ colorScheme: "dark" }}
        >
          <option value="" disabled style={{ background: "#12152B" }}>Select nationality</option>
          {NATIONALITIES.map((n) => (
            <option key={n} value={n} style={{ background: "#12152B" }}>{n}</option>
          ))}
        </select>
      </div>
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
    <div className="flex" style={{ background: "#0A0B1E" }}>
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
    <div className="flex flex-col gap-6 max-w-xl">
      {/* Profile header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {user.profile_pic_url ? (
            <img src={user.profile_pic_url} alt={user.username} className="w-20 h-20 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)", color: "#0A0B1E" }}
            >
              {getInitials(user.username)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white mb-1">{user.username}</h2>
            <p className="text-sm" style={{ color: "#D4AF37" }}>{user.email}</p>
          </div>
        </div>
      </div>

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
              {getInitials(user.username)}
            </div>
          )}
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-white/70 hover:bg-white/10 transition-all cursor-pointer">
            <Camera size={14} />
            {avatarLoading ? "Uploading..." : "Change Picture"}
            <input type="file" accept="image/png,image/jpeg" onChange={handleAvatarChange} className="hidden" disabled={avatarLoading} />
          </label>
        </div>
        {avatarError && <p className="text-sm text-red-400">{avatarError}</p>}
        <InputField label="Username" value={user.username} onChange={() => {}} icon={User} />
        <InputField label="Email" value={user.email} onChange={() => {}} icon={Mail} />
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

      {/* Sign out */}
      <div className="flex justify-center pb-4">
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 px-6 py-3 rounded-xl border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition-all text-sm"
        >
          <LogOut size={16} />
          Sign Out
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

type MainTab = "account" | "posts" | "saved" | "trips";

function TabBar({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  const tabs: { key: MainTab; label: string; icon: React.ElementType }[] = [
    { key: "account", label: "Account", icon: User },
    { key: "posts", label: "Your Posts", icon: FileText },
    { key: "saved", label: "Saved", icon: Bookmark },
    { key: "trips", label: "My Trips", icon: Map },
  ];
  return (
    <div className="sticky top-0 z-10 border-b border-white/10" style={{ background: "#0A0B1Ecc" }}>
      {/* overflow-x-auto is a safety net if labels ever wrap on a very narrow
          device; the real fix is hiding labels below sm so all 4 tabs
          always fit without clipping. */}
      <div className="flex md:justify-end gap-1 px-2 sm:px-4 md:px-8 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={label}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap flex-shrink-0 transition-all ${
              active === key ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
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
  const [tab, setTab] = useState<MainTab>("account");

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
    setTab("account");
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0A0B1E" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#D4AF37" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0A0B1E" }}>
      <TabBar active={tab} onChange={setTab} />
      <div className="p-4 md:p-8">
        {tab === "account" &&
          (user
            ? <SettingsTab user={user} onUserUpdate={(u) => { cachedUser = u; setUser(u); }} onSignOut={handleSignOut} />
            : <GuestMode onLoggedIn={(u) => { cachedUser = u; setUser(u); }} />)}
        {tab === "posts" && <YourPostsTab isLoggedIn={!!user} username={user?.username || ""} />}
        {tab === "saved" && <SavedPostsTab isLoggedIn={!!user} username={user?.username || ""} />}
        {tab === "trips" && <MyTripsTab isLoggedIn={!!user} />}
      </div>
    </div>
  );
}