import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Calendar, Compass, Sparkles, ArrowLeft,
  Loader2, Hotel, Utensils, Landmark, Info, Waves, Library, Columns,
  Bookmark, RefreshCw, AlertCircle, Search, X, ChevronUp, ChevronDown,
  Star, Phone, MapPin as MapPinIcon,
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

interface Options {
  governorates: string[];
  budgets: BudgetOption[];
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
interface Plan {
  preferences: Preferences;
  cities: string[];
  days: DayPlan[];
  sites: Item[];
  monuments: Item[];
  museums: Item[];
  beaches: Item[];
  restaurants: Item[];
  hotels: Item[];
  transport_note: string;
  restaurants_note: string;
  hotels_note: string;
  beaches_note: string;
}

const GOLD = "#D4AF37";
const BG = "#0A0B1E";

function GoldButton({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
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
      className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border border-white/10 text-white/70 hover:bg-white/5 transition-all disabled:opacity-30"
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

// نفس نمط sessionStorage المستخدم في ChatBubble.tsx - يخلي الصفحة تفضل زي
// ما هي (المرحلة الحالية + الاختيارات + الخطة اللي اتعملت) لو المستخدم راح
// صفحة تانية ورجع، بدل ما يرجع يبدأ من الأول تاني.
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
              <div className="mb-8">
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
      <div className="max-w-4xl mx-auto">
        {step === 1 && (
          <div className="mb-8">
            <h1 className="text-white font-extrabold text-3xl md:text-4xl mb-2">Plan your trip</h1>
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

// ── One merged page: destination + trip basics ──
function TripDetailsForm({ options, prefs, updatePrefs, toggleCity, onGenerate, generating, genError }: {
  options: Options; prefs: Preferences; updatePrefs: (p: Partial<Preferences>) => void; toggleCity: (c: string) => void;
  onGenerate: () => void; generating: boolean; genError: string;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filteredGovernorates = prefs.destination
    ? options.governorates.filter(
        (g) => g.toLowerCase().includes(prefs.destination.toLowerCase()) && !prefs.cities.includes(g)
      )
    : options.governorates.filter((g) => !prefs.cities.includes(g));

  return (
    <div className="fade-in">
      {/* Destination */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6 relative z-20">
        <h2 className="text-white font-bold text-xl mb-1">Where do you want to go?</h2>
        <p className="text-white/50 text-sm mb-4">Search and pick governorates, or just type a preferred area (e.g. "Red Sea", "Nile temples") and KEMET will infer a route.</p>

        {prefs.cities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {prefs.cities.map((city) => (
              <span
                key={city}
                className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-sm font-semibold"
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
            <div className="absolute z-30 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#12132a] shadow-xl">
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

      {/* Trip basics */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
        <h2 className="text-white font-bold text-xl mb-1">Trip basics</h2>
        <p className="text-white/50 text-sm">Set your duration, budget, and how many picks you'd like in each category.</p>
      </div>

      <SectionHeader icon={Calendar} title="Duration & budget" />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-white/60 text-sm block mb-2">Trip duration (days)</label>
          <NumberStepper value={prefs.days} onChange={(v) => updatePrefs({ days: v })} min={1} max={30} />
        </div>
        <div className="flex gap-2 flex-wrap items-start">
          {options.budgets.map((b) => (
            <button
              key={b.name}
              onClick={() => updatePrefs({ budget: b.name })}
              className="px-3 py-2 rounded-xl border text-sm font-semibold"
              style={{
                borderColor: prefs.budget === b.name ? GOLD : "rgba(255,255,255,0.1)",
                background: prefs.budget === b.name ? "rgba(212,175,55,0.12)" : "transparent",
                color: prefs.budget === b.name ? GOLD : "#c8d0de",
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <SectionHeader icon={Compass} title="Recommendations limit" />
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
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

      {genError && (
        <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
          <AlertCircle size={15} /> {genError}
        </div>
      )}

      <div className="flex justify-end">
        <GoldButton onClick={onGenerate} disabled={generating}>
          {generating ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Sparkles size={16} /> Generate itinerary</>}
        </GoldButton>
      </div>
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-yellow-500/40 transition-all">
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-yellow-500/40 transition-all">
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
    <div className="fade-in">
      {/* Day switcher */}
      <SectionHeader icon={Calendar} title="Day-by-day plan" />
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {plan.days.map((d, idx) => (
          <button
            key={d.day}
            onClick={() => setActiveDay(idx)}
            className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border"
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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-8">
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
    </div>
  );
}
