import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Calendar, Compass, Sparkles, ArrowLeft, ArrowRight,
  Loader2, Hotel, Utensils, Landmark, Info, Waves, Library, Columns,
  Bookmark, RefreshCw, AlertCircle, Search, X, ChevronUp, ChevronDown, Check,
  Star, Phone, MapPin as MapPinIcon,
  User, Heart, Users, PartyPopper,
  Bus, Car, CarFront, Footprints,
  Accessibility, ShieldCheck, Sun, Lightbulb, Wallet, BadgeCheck,
  MessageCircle, Send,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

// عنوان الـ Flask backend - نفس الباترن المستخدم في Account.tsx
const API_BASE = API_BASE_URL;
const TOKEN_KEY = "kemet_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function api(path: string, options: RequestInit = {}) {
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
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ── Types (mirror trip_planner_service.py) ──
interface BudgetOption { name: string; daily: number; hotel: string; label: string }
interface InterestOption { name: string }
interface TravelStyleOption { name: string }
interface TransportOption { name: string; note: string }

interface Options {
  governorates: string[];
  interests: InterestOption[];
  budgets: BudgetOption[];
  travel_styles: TravelStyleOption[];
  transport_modes: TransportOption[];
  defaults: Preferences;
}

interface Preferences {
  destination: string;
  cities: string[];
  days: number;
  budget: string;
  interests: string[];
  travel_style: string;
  transport: string;
  accessibility: string;
  pace: string;
  num_hotels: number;
  num_restaurants: number;
  num_beaches: number;
}

interface Item {
  name: string; city: string; desc: string; url: string; price: string;
  link?: string; hours?: string; rating?: number | null; rating_label?: string; phone?: string; address?: string;
}
interface DayPlan {
  day: number; city: string; title: string;
  morning: string; afternoon: string; evening: string; ai_note: string;
  food: Item; transport: string;
}
interface BudgetEstimate { low: number; high: number; daily: number; note: string }
interface Plan {
  preferences: Preferences;
  summary: string;
  budget_tier: string;
  cities: string[];
  days: DayPlan[];
  budget: BudgetEstimate;
  sites: Item[];
  monuments: Item[];
  museums: Item[];
  beaches: Item[];
  restaurants: Item[];
  hotels: Item[];
  transport: string;
  transport_note: string;
  weather: string;
  tips: string[];
  accessibility: string;
  sources: string[];
  restaurants_note: string;
  hotels_note: string;
  beaches_note: string;
  rag_powered: boolean;
}

const GOLD = "#D4AF37";
const BG = "#0A0B1E";

// One-time keyframes for this page's animations — kept local rather than
// touching the global stylesheet, since `.fade-in` etc. already come from
// there and this only adds a few extras this page needs.
function TripPlannerStyles() {
  return (
    <style>{`
      @keyframes tp-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes tp-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes tp-pop { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes tp-pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(212,175,55,0.45); } 100% { box-shadow: 0 0 0 14px rgba(212,175,55,0); } }
      @keyframes tp-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      @keyframes tp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      .tp-fade-up { animation: tp-fade-up 0.5s ease both; }
      .tp-fade-in { animation: tp-fade-in 0.4s ease both; }
      .tp-pop { animation: tp-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
      .tp-pulse { animation: tp-pulse-ring 2s infinite; }
      .tp-float { animation: tp-float 3s ease-in-out infinite; }
      .tp-shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 37%, rgba(255,255,255,0.04) 63%); background-size: 800px 100%; animation: tp-shimmer 1.6s linear infinite; }
      .tp-stagger > * { animation: tp-fade-up 0.45s ease both; }
      .tp-stagger > *:nth-child(1) { animation-delay: 0.03s; }
      .tp-stagger > *:nth-child(2) { animation-delay: 0.07s; }
      .tp-stagger > *:nth-child(3) { animation-delay: 0.11s; }
      .tp-stagger > *:nth-child(4) { animation-delay: 0.15s; }
      .tp-stagger > *:nth-child(5) { animation-delay: 0.19s; }
      .tp-stagger > *:nth-child(6) { animation-delay: 0.23s; }
      .tp-stagger > *:nth-child(n+7) { animation-delay: 0.26s; }
    `}</style>
  );
}

function GoldButton({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
      style={{ background: disabled ? "rgba(212,175,55,0.25)" : `linear-gradient(135deg, ${GOLD}, #C9A84C)`, color: "#0A0B1E" }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border border-white/10 text-white/70 hover:bg-white/5 hover:border-white/20 transition-all duration-200 active:scale-[0.97] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)` }}>
        <Icon size={15} color="#0A0B1E" />
      </div>
      <span className="text-white font-bold text-base">{title}</span>
    </div>
  );
}

function NumberStepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const handleTextChange = (raw: string) => {
    if (raw === "") return;
    const n = parseInt(raw, 10);
    if (!Number.isNaN(n)) onChange(clamp(n));
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => handleTextChange(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={(e) => onChange(clamp(Number(e.target.value) || min))}
        className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-center font-semibold focus:outline-none focus:border-yellow-500/50 transition-colors"
      />
      <div className="flex flex-col rounded-xl border border-white/10 overflow-hidden">
        <button onClick={() => onChange(clamp(value + 1))} disabled={value >= max} className="px-2 py-1 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors">
          <ChevronUp size={14} />
        </button>
        <div className="h-px bg-white/10" />
        <button onClick={() => onChange(clamp(value - 1))} disabled={value <= min} className="px-2 py-1 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors">
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}

// Same sessionStorage draft-persistence pattern as before, unchanged.
const STORAGE_KEY_STEP = "kemet_trip_planner_step";
const STORAGE_KEY_PREFS = "kemet_trip_planner_prefs";
const STORAGE_KEY_PLAN = "kemet_trip_planner_plan";

function loadStoredJSON<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadStoredStep(): number {
  try {
    const n = parseInt(sessionStorage.getItem(STORAGE_KEY_STEP) || "1", 10);
    return n === 2 ? 2 : 1;
  } catch {
    return 1;
  }
}

export function TripPlanner() {
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [step, setStep] = useState(loadStoredStep); // 1 = form, 2 = result
  const [prefs, setPrefs] = useState<Preferences | null>(() => loadStoredJSON<Preferences>(STORAGE_KEY_PREFS));
  const [plan, setPlan] = useState<Plan | null>(() => loadStoredJSON<Plan>(STORAGE_KEY_PLAN));
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // A saved trip opened from Account → My Trips links here as
  // /trip-planner?saved=<plan_id>. It's a separate read-only view, kept out
  // of the step 1/2 flow (and its sessionStorage draft) entirely.
  const [searchParams] = useSearchParams();
  const savedId = searchParams.get("saved");
  const [savedPlan, setSavedPlan] = useState<Plan | null>(null);
  const [savedCreatedAt, setSavedCreatedAt] = useState("");
  const [savedLoading, setSavedLoading] = useState(!!savedId);
  const [savedError, setSavedError] = useState("");

  useEffect(() => {
    api("/options")
      .then((data: Options) => {
        setOptions(data);
        setPrefs((p) => p ?? data.defaults);
      })
      .catch((e) => setOptionsError(e instanceof Error ? e.message : "Failed to load planner options."));
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY_STEP, String(step)); } catch { /* ignore */ }
  }, [step]);

  useEffect(() => {
    if (!prefs) return;
    try { sessionStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  useEffect(() => {
    try {
      if (plan) sessionStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plan));
      else sessionStorage.removeItem(STORAGE_KEY_PLAN);
    } catch { /* ignore */ }
  }, [plan]);

  useEffect(() => {
    if (!savedId) {
      setSavedPlan(null);
      setSavedError("");
      return;
    }
    setSavedLoading(true);
    setSavedError("");
    api(`/plans/${savedId}`)
      .then((data) => {
        setSavedPlan(data.plan.Itinerary as Plan);
        setSavedCreatedAt(data.plan.CreatedAt as string);
      })
      .catch((e) => setSavedError(e instanceof Error ? e.message : "Could not load this saved trip."))
      .finally(() => setSavedLoading(false));
  }, [savedId]);

  const updatePrefs = (patch: Partial<Preferences>) => setPrefs((p) => (p ? { ...p, ...patch } : p));

  const toggleCity = (city: string) => {
    if (!prefs) return;
    const has = prefs.cities.includes(city);
    updatePrefs({ cities: has ? prefs.cities.filter((c) => c !== city) : [...prefs.cities, city] });
  };

  const toggleInterest = (name: string) => {
    if (!prefs) return;
    const has = prefs.interests.includes(name);
    updatePrefs({ interests: has ? prefs.interests.filter((i) => i !== name) : [...prefs.interests, name] });
  };

  const generatePlan = async () => {
    if (!prefs) return;
    setGenerating(true);
    setGenError("");
    try {
      const data = await api("/generate", { method: "POST", body: JSON.stringify(prefs) });
      setPlan(data.plan as Plan);
      setStep(2);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Could not generate your itinerary.");
    } finally {
      setGenerating(false);
    }
  };

  const startOver = () => {
    setPlan(null);
    setStep(1);
    if (options) setPrefs(options.defaults);
  };

  // ── Saved trip view (from Account → My Trips) — independent of /options ──
  if (savedId) {
    return (
      <div className="min-h-screen p-4 md:p-8" style={{ background: BG }}>
        <TripPlannerStyles />
        <div className="max-w-4xl mx-auto">
          <Link to="/trip-planner" className="flex items-center gap-1 text-sm text-white/50 hover:text-white/80 transition-colors mb-6 w-fit">
            <ArrowLeft size={14} /> Back to planner
          </Link>
          {savedLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
            </div>
          ) : savedError ? (
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle size={18} /> {savedError}
            </div>
          ) : savedPlan ? (
            <>
              <div className="mb-8 tp-fade-up">
                <h1 className="text-white font-extrabold text-3xl md:text-4xl mb-2">Saved trip</h1>
                <p className="text-white/50">
                  {savedPlan.cities?.join(", ") || "Egypt"}
                  {savedCreatedAt && ` · Saved ${new Date(savedCreatedAt).toLocaleDateString()}`}
                </p>
              </div>
              <ResultView plan={savedPlan} onStartOver={startOver} onAdjust={() => setStep(1)} savedView />
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (optionsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: BG }}>
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle size={18} /> {optionsError}
        </div>
      </div>
    );
  }

  if (!options || !prefs) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: BG }}>
      <TripPlannerStyles />
      <div className="max-w-4xl mx-auto">
        {step === 1 && !generating && (
          <div className="mb-8 tp-fade-up">
            <h1 className="text-white font-extrabold text-3xl md:text-4xl mb-2 flex items-center gap-3">
              Plan your trip
              <Sparkles size={26} style={{ color: GOLD }} className="tp-float" />
            </h1>
            <p className="text-white/50 max-w-2xl leading-relaxed">
              Dataset-first recommendations from KEMET's hotels, restaurants, museums, monuments, ancient sites,
              and beaches — cross-checked against our AI knowledge base.
            </p>
          </div>
        )}

        {step === 1 && (
          <TripDetailsForm
            options={options}
            prefs={prefs}
            updatePrefs={updatePrefs}
            toggleCity={toggleCity}
            toggleInterest={toggleInterest}
            onGenerate={generatePlan}
            generating={generating}
            genError={genError}
          />
        )}
        {step === 2 && plan && (
          <ResultView plan={plan} onStartOver={startOver} onAdjust={() => setStep(1)} />
        )}
      </div>
    </div>
  );
}

// ── Rotating, engaging status text while the AI builds the itinerary ──
const GENERATING_MESSAGES = [
  "Reading KEMET Storage for your destinations…",
  "Matching hotels within your budget…",
  "Selecting ancient sites, monuments & museums…",
  "Curating restaurants along your route…",
  "Asking KEMET's AI for local tips…",
  "Building your day-by-day itinerary…",
];

function GeneratingScreen() {
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % GENERATING_MESSAGES.length), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-24 tp-fade-in">
      <div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center mb-6 tp-pulse"
        style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)` }}
      >
        <Sparkles size={30} color="#0A0B1E" className="tp-float" />
      </div>
      <p className="text-white font-semibold text-lg mb-2">Building your Egypt itinerary</p>
      <p key={msgIndex} className="text-white/50 text-sm tp-fade-in">{GENERATING_MESSAGES[msgIndex]}</p>
      <div className="w-56 h-1.5 rounded-full bg-white/10 overflow-hidden mt-6">
        <div className="h-full rounded-full tp-shimmer" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, width: "60%" }} />
      </div>
    </div>
  );
}

// ── Icon lookups for travel style / transport, with safe fallbacks for any
// future options.* value the backend adds that isn't in the map yet ──
const TRAVEL_STYLE_ICONS: Record<string, React.ElementType> = {
  Solo: User, Couple: Heart, Family: Users, Friends: PartyPopper,
};
const TRANSPORT_ICONS: Record<string, React.ElementType> = {
  "Public transport": Bus, "Ride-hailing": Car, "Private driver": CarFront, "Walking + taxis": Footprints,
};

const FORM_STEPS = [
  { key: 1, label: "Destination", icon: Compass },
  { key: 2, label: "Trip Basics", icon: Calendar },
  { key: 3, label: "Style & Interests", icon: Sparkles },
];

function FormStepper({ active }: { active: number }) {
  return (
    <div className="flex items-center mb-8 tp-fade-up">
      {FORM_STEPS.map((s, idx) => {
        const done = active > s.key;
        const current = active === s.key;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300"
                style={{
                  borderColor: done || current ? GOLD : "rgba(255,255,255,0.15)",
                  background: done ? GOLD : current ? "rgba(212,175,55,0.12)" : "transparent",
                }}
              >
                {done ? <Check size={16} color="#0A0B1E" /> : <s.icon size={15} style={{ color: current ? GOLD : "rgba(255,255,255,0.4)" }} />}
              </div>
              <span
                className="text-[11px] font-semibold whitespace-nowrap hidden sm:block"
                style={{ color: current ? GOLD : done ? "#c8d0de" : "rgba(255,255,255,0.35)" }}
              >
                {s.label}
              </span>
            </div>
            {idx < FORM_STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-2 rounded-full overflow-hidden bg-white/10">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{ width: active > s.key ? "100%" : "0%", background: GOLD }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Merged 3-step form: destination → trip basics → style & interests ──
function TripDetailsForm({ options, prefs, updatePrefs, toggleCity, toggleInterest, onGenerate, generating, genError }: {
  options: Options; prefs: Preferences; updatePrefs: (p: Partial<Preferences>) => void; toggleCity: (c: string) => void;
  toggleInterest: (i: string) => void; onGenerate: () => void; generating: boolean; genError: string;
}) {
  const [formStep, setFormStep] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (generating) return <GeneratingScreen />;

  const filteredGovernorates = prefs.destination
    ? options.governorates.filter(
        (g) => g.toLowerCase().includes(prefs.destination.toLowerCase()) && !prefs.cities.includes(g)
      )
    : options.governorates.filter((g) => !prefs.cities.includes(g));

  const canContinueStep1 = prefs.cities.length > 0;

  return (
    <div>
      <FormStepper active={formStep} />

      {formStep === 1 && (
        <div className="tp-fade-up" key="form-step-1">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6 relative z-20">
            <h2 className="text-white font-bold text-xl mb-1">Where do you want to go?</h2>
            <p className="text-white/50 text-sm mb-4">Search and pick governorates, or just type a preferred area (e.g. "Red Sea", "Nile temples") and KEMET will infer a route.</p>

            {prefs.cities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {prefs.cities.map((city) => (
                  <span
                    key={city}
                    className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-semibold tp-pop"
                    style={{ background: "rgba(212,175,55,0.14)", color: GOLD, border: "1px solid rgba(212,175,55,0.3)" }}
                  >
                    {city}
                    <button onClick={() => toggleCity(city)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/20">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={prefs.destination}
                onChange={(e) => updatePrefs({ destination: e.target.value })}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                placeholder="Search governorates (e.g. Luxor, Aswan, Red Sea...)"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors"
              />
              {dropdownOpen && filteredGovernorates.length > 0 && (
                <div className="absolute z-30 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#12132a] shadow-xl tp-fade-in">
                  {filteredGovernorates.map((g) => (
                    <button
                      key={g}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { toggleCity(g); updatePrefs({ destination: "" }); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <GoldButton onClick={() => setFormStep(2)} disabled={!canContinueStep1}>
              Continue <ArrowRight size={16} />
            </GoldButton>
          </div>
        </div>
      )}

      {formStep === 2 && (
        <div className="tp-fade-up" key="form-step-2">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-bold text-xl mb-1">Trip basics</h2>
            <p className="text-white/50 text-sm">Set your duration, budget, travel style, and how you'll get around.</p>
          </div>

          <SectionHeader icon={Calendar} title="Duration & budget" />
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-white/60 text-sm block mb-2">Trip duration (days)</label>
              <NumberStepper value={prefs.days} onChange={(v) => updatePrefs({ days: v })} min={1} max={30} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mb-8 tp-stagger">
            {options.budgets.map((b) => (
              <button
                key={b.name}
                onClick={() => updatePrefs({ budget: b.name })}
                className="text-left px-4 py-3 rounded-xl border transition-all"
                style={{
                  borderColor: prefs.budget === b.name ? GOLD : "rgba(255,255,255,0.1)",
                  background: prefs.budget === b.name ? "rgba(212,175,55,0.1)" : "transparent",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm" style={{ color: prefs.budget === b.name ? GOLD : "#e5e7eb" }}>{b.name}</span>
                  {prefs.budget === b.name && <Check size={14} style={{ color: GOLD }} />}
                </div>
                <div className="text-white/40 text-xs mb-1">{b.label}</div>
                <div className="text-white/30 text-[11px]">{b.hotel}</div>
                <div className="text-xs font-bold mt-2" style={{ color: GOLD }}>~{b.daily.toLocaleString()} EGP/day</div>
              </button>
            ))}
          </div>

          <SectionHeader icon={Users} title="Travel style" />
          <div className="flex flex-wrap gap-3 mb-8">
            {options.travel_styles.map((s) => {
              const Icon = TRAVEL_STYLE_ICONS[s.name] || User;
              const active = prefs.travel_style === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() => updatePrefs({ travel_style: s.name })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all"
                  style={{
                    borderColor: active ? GOLD : "rgba(255,255,255,0.1)",
                    background: active ? "rgba(212,175,55,0.12)" : "transparent",
                    color: active ? GOLD : "#c8d0de",
                  }}
                >
                  <Icon size={15} /> {s.name}
                </button>
              );
            })}
          </div>

          <SectionHeader icon={Car} title="Getting around" />
          <div className="grid sm:grid-cols-2 gap-3 mb-8 tp-stagger">
            {options.transport_modes.map((t) => {
              const Icon = TRANSPORT_ICONS[t.name] || Car;
              const active = prefs.transport === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => updatePrefs({ transport: t.name })}
                  className="text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all"
                  style={{
                    borderColor: active ? GOLD : "rgba(255,255,255,0.1)",
                    background: active ? "rgba(212,175,55,0.1)" : "transparent",
                  }}
                >
                  <Icon size={17} className="mt-0.5 flex-shrink-0" style={{ color: active ? GOLD : "#c8d0de" }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: active ? GOLD : "#e5e7eb" }}>{t.name}</div>
                    <div className="text-white/35 text-[11px] mt-0.5 leading-snug">{t.note}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between">
            <GhostButton onClick={() => setFormStep(1)}><ArrowLeft size={15} /> Back</GhostButton>
            <GoldButton onClick={() => setFormStep(3)}>Continue <ArrowRight size={16} /></GoldButton>
          </div>
        </div>
      )}

      {formStep === 3 && (
        <div className="tp-fade-up" key="form-step-3">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-bold text-xl mb-1">Style & interests</h2>
            <p className="text-white/50 text-sm">Pick what excites you — KEMET weights your day plan and picks around this.</p>
          </div>

          <SectionHeader icon={Sparkles} title="Interests" />
          <div className="flex flex-wrap gap-2 mb-8 tp-stagger">
            {options.interests.map((i) => {
              const active = prefs.interests.includes(i.name);
              return (
                <button
                  key={i.name}
                  onClick={() => toggleInterest(i.name)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all"
                  style={{
                    borderColor: active ? GOLD : "rgba(255,255,255,0.1)",
                    background: active ? "rgba(212,175,55,0.14)" : "transparent",
                    color: active ? GOLD : "#c8d0de",
                  }}
                >
                  {active && <Check size={12} />} {i.name}
                </button>
              );
            })}
          </div>

          <SectionHeader icon={Compass} title="Recommendations limit" />
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div>
              <label className="text-white/60 text-sm block mb-2">Hotels: {prefs.num_hotels}</label>
              <input type="range" min={2} max={10} value={prefs.num_hotels} onChange={(e) => updatePrefs({ num_hotels: Number(e.target.value) })} className="w-full accent-yellow-500" />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-2">Restaurants: {prefs.num_restaurants}</label>
              <input type="range" min={2} max={12} value={prefs.num_restaurants} onChange={(e) => updatePrefs({ num_restaurants: Number(e.target.value) })} className="w-full accent-yellow-500" />
            </div>
            <div>
              <label className="text-white/60 text-sm block mb-2">Beaches: {prefs.num_beaches}</label>
              <input type="range" min={0} max={10} value={prefs.num_beaches} onChange={(e) => updatePrefs({ num_beaches: Number(e.target.value) })} className="w-full accent-yellow-500" />
            </div>
          </div>

          <SectionHeader icon={Accessibility} title="Accessibility needs (optional)" />
          <textarea
            value={prefs.accessibility}
            onChange={(e) => updatePrefs({ accessibility: e.target.value })}
            placeholder="e.g. wheelchair-friendly routes, avoid long walks, traveling with young kids…"
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors mb-8 resize-none"
          />

          {/* Recap before generating */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6 tp-fade-up">
            <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-2">Your trip at a glance</p>
            <p className="text-white/70 text-sm leading-relaxed">
              <span className="font-semibold text-white">{prefs.days}-day</span> {prefs.budget.toLowerCase()} trip to{" "}
              <span className="font-semibold text-white">{prefs.cities.join(", ") || "Egypt"}</span> for a{" "}
              {prefs.travel_style.toLowerCase()} traveler, focused on {prefs.interests.join(", ") || "the essentials"}, getting around by {prefs.transport.toLowerCase()}.
            </p>
          </div>

          {genError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
              <AlertCircle size={15} /> {genError}
            </div>
          )}

          <div className="flex justify-between">
            <GhostButton onClick={() => setFormStep(2)}><ArrowLeft size={15} /> Back</GhostButton>
            <GoldButton onClick={onGenerate}>
              <Sparkles size={16} /> Generate itinerary
            </GoldButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic card grid, used for sites/monuments/museums/beaches/hotels ──
function ItemGrid({ icon: Icon, title, items, note }: { icon: React.ElementType; title: string; items: Item[]; note?: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-8">
      <SectionHeader icon={Icon} title={title} />
      {note && (
        <div className="flex items-start gap-2 text-xs text-white/50 mb-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Info size={13} className="mt-0.5 flex-shrink-0" /> {note}
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 tp-stagger">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-yellow-500/40 hover:-translate-y-0.5 transition-all duration-200">
            {item.url ? (
              <img src={item.url} alt={item.name} className="w-full h-32 object-cover" />
            ) : (
              <div className="w-full h-32 flex items-center justify-center bg-white/[0.03]">
                <Icon size={22} className="text-white/15" />
              </div>
            )}
            <div className="p-3">
              <div className="text-white font-semibold text-sm mb-0.5 truncate">{item.name}</div>
              <div className="text-white/40 text-xs mb-1">{item.city}</div>
              <div className="text-white/50 text-xs line-clamp-2 mb-2">{item.desc}</div>
              {item.hours && item.hours !== "Not Available" && (
                <div className="text-white/40 text-[11px] mb-2">🕐 {item.hours}</div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold" style={{ color: GOLD }}>{item.price}</div>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noreferrer" className="text-[11px] font-semibold underline" style={{ color: GOLD }}>
                    View on map
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Richer restaurant card: category badge, rating, phone/call + directions ──
function RestaurantGrid({ items, note }: { items: Item[]; note?: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-8">
      <SectionHeader icon={Utensils} title="Restaurants" />
      {note && (
        <div className="flex items-start gap-2 text-xs text-white/50 mb-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <Info size={13} className="mt-0.5 flex-shrink-0" /> {note}
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 tp-stagger">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-yellow-500/40 hover:-translate-y-0.5 transition-all duration-200">
            <div className="relative">
              {item.url ? (
                <img src={item.url} alt={item.name} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 flex items-center justify-center bg-white/[0.03]">
                  <Utensils size={22} className="text-white/15" />
                </div>
              )}
              {item.desc && (
                <span className="absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white">
                  {item.desc}
                </span>
              )}
              {item.rating != null && (
                <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white">
                  <Star size={10} fill={GOLD} style={{ color: GOLD }} /> {item.rating.toFixed(1)}
                  {item.rating_label && <span className="text-white/60">{item.rating_label}</span>}
                </span>
              )}
            </div>
            <div className="p-3">
              <div className="text-white font-semibold text-sm mb-0.5 truncate">{item.name}</div>
              <div className="flex items-center gap-1 text-white/40 text-xs mb-2">
                <MapPinIcon size={11} /> {item.city}
              </div>
              {item.address && (
                <div className="text-white/35 text-[11px] mb-2 line-clamp-2">{item.address}</div>
              )}
              {item.phone && (
                <div className="flex items-center gap-1 text-white/40 text-[11px] mb-2">
                  <Phone size={11} /> {item.phone}
                </div>
              )}
              <div className="text-xs font-bold mb-2" style={{ color: GOLD }}>{item.price}</div>
              <div className="flex gap-2">
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)`, color: "#0A0B1E" }}
                  >
                    <MapPinIcon size={11} /> Directions
                  </a>
                )}
                {item.phone && (
                  <a
                    href={`tel:${item.phone}`}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg border border-white/10 text-white/70"
                  >
                    <Phone size={11} /> Call
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NEW: Trip Overview — surfaces the AI summary, budget estimate, weather
// note, tips, and data-source badges the backend already computes in
// build_plan() but the page never showed before. ──
function TripOverviewCard({ plan }: { plan: Plan }) {
  const hasBudget = plan.budget && plan.budget.low > 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1730] to-[#12132a] p-6 mb-8 tp-fade-up">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: GOLD }} />
          <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">Trip overview</span>
        </div>
        {plan.rag_powered && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}>
            <ShieldCheck size={12} /> AI-verified against live KEMET data
          </span>
        )}
      </div>

      {plan.summary && <p className="text-white/80 text-sm leading-relaxed mb-5">{plan.summary}</p>}

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {hasBudget && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              <Wallet size={12} /> Estimated budget
            </div>
            <div className="text-white font-bold text-sm">{plan.budget.low.toLocaleString()} – {plan.budget.high.toLocaleString()} EGP</div>
            <div className="text-white/35 text-[11px] mt-1 leading-snug">{plan.budget.note}</div>
          </div>
        )}
        {plan.weather && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              <Sun size={12} /> Weather note
            </div>
            <div className="text-white/70 text-xs leading-snug">{plan.weather}</div>
          </div>
        )}
        {plan.accessibility && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-semibold uppercase tracking-wide mb-1.5">
              <Accessibility size={12} /> Accessibility notes
            </div>
            <div className="text-white/70 text-xs leading-snug">{plan.accessibility}</div>
          </div>
        )}
      </div>

      {plan.tips?.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-1.5 text-white/40 text-[11px] font-semibold uppercase tracking-wide mb-2">
            <Lightbulb size={12} /> Travel tips
          </div>
          <ul className="space-y-1.5">
            {plan.tips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-white/70 text-xs leading-relaxed">
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.sources?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
          {plan.sources.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white/5 text-white/50">
              <BadgeCheck size={11} style={{ color: GOLD }} /> {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NEW: floating "Ask about this trip" panel — wired to the /ask endpoint,
// which was already fully built server-side (same RAG the main chatbot
// uses, plus the plan itself as context) but never had a UI. ──
interface AskMessage { role: "user" | "assistant"; text: string; direction: "ltr" | "rtl" }

function AskAboutTrip({ plan }: { plan: Plan }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, asking]);

  const send = async () => {
    const question = input.trim();
    if (!question || asking) return;
    setMessages((m) => [...m, { role: "user", text: question, direction: "ltr" }]);
    setInput("");
    setAsking(true);
    try {
      const data = await api("/ask", { method: "POST", body: JSON.stringify({ question, plan }) });
      setMessages((m) => [...m, { role: "assistant", text: data.reply as string, direction: (data.direction as "ltr" | "rtl") || "ltr" }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong.", direction: "ltr" }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 pl-4 pr-5 py-3.5 rounded-full font-semibold text-sm shadow-2xl tp-pulse tp-pop"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)`, color: "#0A0B1E" }}
        >
          <MessageCircle size={18} /> Ask about this trip
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[calc(100vw-3rem)] sm:w-96 h-[28rem] max-h-[70vh] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden tp-pop" style={{ background: "#12132a" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10" style={{ background: `linear-gradient(135deg, rgba(212,175,55,0.15), transparent)` }}>
            <div className="flex items-center gap-2">
              <Sparkles size={15} style={{ color: GOLD }} />
              <span className="text-white font-semibold text-sm">Ask about this trip</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-white/35 text-xs text-center py-8 leading-relaxed">
                Ask anything about this itinerary — swap a day, ask about a site, check if a restaurant fits your budget.
              </p>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} tp-fade-up`}>
                <div
                  dir={m.direction}
                  className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                  style={
                    m.role === "user"
                      ? { background: `linear-gradient(135deg, ${GOLD}, #C9A84C)`, color: "#0A0B1E" }
                      : { background: "rgba(255,255,255,0.06)", color: "#e5e7eb" }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2.5 bg-white/5">
                  <Loader2 size={14} className="animate-spin text-white/40" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-3 border-t border-white/10">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a question…"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors"
            />
            <button
              onClick={send}
              disabled={asking || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)` }}
            >
              <Send size={14} color="#0A0B1E" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Result view ──
function ResultView({ plan, onStartOver, onAdjust, savedView }: { plan: Plan; onStartOver: () => void; onAdjust: () => void; savedView?: boolean }) {
  const [activeDay, setActiveDay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isLoggedIn = !!getToken();

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api("/save", { method: "POST", body: JSON.stringify({ preferences: plan.preferences, plan }) });
      setSaveMsg({ type: "success", text: "Itinerary saved to your account." });
    } catch (e) {
      setSaveMsg({ type: "error", text: e instanceof Error ? e.message : "Could not save this plan." });
    } finally {
      setSaving(false);
    }
  };

  const day = plan.days[activeDay];

  return (
    <div className="tp-fade-in">
      <TripOverviewCard plan={plan} />

      {/* Day switcher */}
      <SectionHeader icon={Calendar} title="Day-by-day plan" />
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {plan.days.map((d, idx) => (
          <button
            key={d.day}
            onClick={() => setActiveDay(idx)}
            className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-all duration-200"
            style={{
              borderColor: activeDay === idx ? GOLD : "rgba(255,255,255,0.1)",
              background: activeDay === idx ? `linear-gradient(135deg, ${GOLD}, #C9A84C)` : "transparent",
              color: activeDay === idx ? "#0A0B1E" : "#c8d0de",
            }}
          >
            Day {d.day}
          </button>
        ))}
      </div>
      {day && (
        <div key={activeDay} className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-8 tp-fade-up">
          <h3 className="text-white font-bold text-lg mb-1">{day.title}</h3>
          <p className="text-white/40 text-xs mb-4">{day.city}</p>
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold" style={{ color: GOLD }}>Morning — </span><span className="text-white/70">{day.morning}</span></p>
            <p><span className="font-semibold" style={{ color: GOLD }}>Afternoon — </span><span className="text-white/70">{day.afternoon}</span></p>
            <p><span className="font-semibold" style={{ color: GOLD }}>Evening — </span><span className="text-white/70">{day.evening}</span></p>
            {day.ai_note && (
              <p className="flex items-start gap-2 text-white/50 italic text-xs pt-1">
                <Sparkles size={12} className="mt-0.5 flex-shrink-0" style={{ color: GOLD }} /> {day.ai_note}
              </p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
            <span className="font-semibold text-white/60">Getting around: </span>{day.transport}
          </div>
        </div>
      )}

      <ItemGrid icon={Landmark} title="Ancient sites" items={plan.sites} />
      <ItemGrid icon={Columns} title="Monuments" items={plan.monuments} />
      <ItemGrid icon={Library} title="Museums" items={plan.museums} />
      <ItemGrid icon={Waves} title="Beaches" items={plan.beaches} note={plan.beaches_note} />
      <RestaurantGrid items={plan.restaurants} note={plan.restaurants_note} />
      <ItemGrid icon={Hotel} title="Stays" items={plan.hotels} note={plan.hotels_note} />

      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-3 mt-8 pb-8">
        {savedView ? (
          <Link
            to="/trip-planner"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)`, color: "#0A0B1E" }}
          >
            <Sparkles size={15} /> Plan a new trip
          </Link>
        ) : (
          <>
            <GhostButton onClick={onStartOver}><RefreshCw size={15} /> Start over</GhostButton>
            <GhostButton onClick={onAdjust}><ArrowLeft size={15} /> Adjust preferences</GhostButton>
            <GoldButton onClick={handleSave} disabled={saving || !isLoggedIn} className="md:ml-auto">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Bookmark size={15} />}
              {isLoggedIn ? "Save plan to account" : "Sign in to save"}
            </GoldButton>
          </>
        )}
      </div>
      {!savedView && saveMsg && (
        <div className="text-sm -mt-4 mb-8 flex items-center gap-3">
          <span className={saveMsg.type === "success" ? "text-green-400" : "text-red-400"}>{saveMsg.text}</span>
          {saveMsg.type === "success" && (
            <Link to="/account" className="underline font-semibold" style={{ color: GOLD }}>
              View in your account
            </Link>
          )}
        </div>
      )}

      <AskAboutTrip plan={plan} />
    </div>
  );
}