import { useEffect, useState } from "react";
import {
  MapPin, Calendar, Wallet, Users, Compass, Sparkles, ArrowLeft, ArrowRight,
  Loader2, Hotel, Utensils, Landmark, CloudSun, Info, MessageCircle, Send,
  Bookmark, RefreshCw, Check, AlertCircle, Search, X, ChevronUp, ChevronDown,
} from "lucide-react";

// عنوان الـ Flask backend - نفس الباترن المستخدم في Account.tsx
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
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
interface InterestOption { name: string }
interface BudgetOption { name: string; daily: number; hotel: string; label: string }
interface StyleOption { name: string }
interface TransportOption { name: string; note: string }

interface Options {
  governorates: string[];
  interests: InterestOption[];
  budgets: BudgetOption[];
  travel_styles: StyleOption[];
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
}

interface Item { name: string; city: string; desc: string; url: string; price: string; link?: string }
interface DayPlan {
  day: number; city: string; title: string;
  morning: string; afternoon: string; evening: string; ai_note: string;
  food: Item; transport: string;
}
interface Plan {
  preferences: Preferences;
  summary: string;
  budget_tier: string;
  cities: string[];
  days: DayPlan[];
  budget: { low: number; high: number; daily: number; note: string };
  attractions: Item[];
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
  rag_powered: boolean;
}

const STEP_LABELS = ["Destination", "Basics", "Interests", "Needs", "Plan"];

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

function Progress({ step }: { step: number }) {
  return (
    <div className="grid grid-cols-5 gap-2 mb-8">
      {STEP_LABELS.map((label, idx) => {
        const n = idx + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div
            key={label}
            className="rounded-xl border text-center py-2.5 text-xs font-bold"
            style={{
              borderColor: active ? GOLD : done ? "#385c40" : "#2c3248",
              background: active ? `linear-gradient(135deg, ${GOLD}, #C9A84C)` : done ? "#142018" : "#131729",
              color: active ? "#0A0B1E" : done ? "#79d28b" : "#8a94a6",
            }}
          >
            {n}. {label}
          </div>
        );
      })}
    </div>
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

export function TripPlanner() {
  const [options, setOptions] = useState<Options | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [step, setStep] = useState(1);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    api("/options")
      .then((data: Options) => {
        setOptions(data);
        setPrefs(data.defaults);
      })
      .catch((e) => setOptionsError(e instanceof Error ? e.message : "Failed to load planner options."));
  }, []);

  const updatePrefs = (patch: Partial<Preferences>) => setPrefs((p) => (p ? { ...p, ...patch } : p));

  const toggleCity = (city: string) => {
    if (!prefs) return;
    const has = prefs.cities.includes(city);
    updatePrefs({ cities: has ? prefs.cities.filter((c) => c !== city) : [...prefs.cities, city] });
  };

  const toggleInterest = (interest: string) => {
    if (!prefs) return;
    const has = prefs.interests.includes(interest);
    updatePrefs({ interests: has ? prefs.interests.filter((i) => i !== interest) : [...prefs.interests, interest] });
  };

  const generatePlan = async () => {
    if (!prefs) return;
    setGenerating(true);
    setGenError("");
    try {
      const data = await api("/generate", { method: "POST", body: JSON.stringify(prefs) });
      setPlan(data.plan as Plan);
      setStep(5);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Could not generate your itinerary.");
    } finally {
      setGenerating(false);
    }
  };

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
        {step < 5 && (
          <div className="mb-8">
            <h1 className="text-white font-extrabold text-3xl md:text-4xl mb-2">Build your Egypt itinerary</h1>
            <p className="text-white/50 max-w-2xl leading-relaxed">
              Dataset-first recommendations from KEMET's hotels, restaurants, museums, monuments, and ancient sites —
              cross-checked against our AI knowledge base.
            </p>
            <Progress step={step} />
          </div>
        )}

        {step === 1 && (
          <StepDestination options={options} prefs={prefs} updatePrefs={updatePrefs} toggleCity={toggleCity} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <StepBasics options={options} prefs={prefs} updatePrefs={updatePrefs} onNext={() => setStep(3)} onBack={() => setStep(1)} />
        )}
        {step === 3 && (
          <StepInterests options={options} prefs={prefs} toggleInterest={toggleInterest} onNext={() => setStep(4)} onBack={() => setStep(2)} />
        )}
        {step === 4 && (
          <StepRequirements
            prefs={prefs}
            updatePrefs={updatePrefs}
            onBack={() => setStep(3)}
            onGenerate={generatePlan}
            generating={generating}
            genError={genError}
          />
        )}
        {step === 5 && plan && (
          <ResultView
            plan={plan}
            onStartOver={() => { setPlan(null); setStep(1); }}
            onAdjust={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}

// ── Step 1: Destination ──
function StepDestination({ options, prefs, updatePrefs, toggleCity, onNext }: {
  options: Options; prefs: Preferences; updatePrefs: (p: Partial<Preferences>) => void; toggleCity: (c: string) => void; onNext: () => void;
}) {
  const [citySearch, setCitySearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filteredGovernorates = options.governorates.filter(
    (g) => g.toLowerCase().includes(citySearch.toLowerCase()) && !prefs.cities.includes(g)
  );

  return (
    <div className="fade-in">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
        <h2 className="text-white font-bold text-xl mb-1">Where do you want to go?</h2>
        <p className="text-white/50 text-sm mb-4">Choose specific cities or describe a preferred area. Leave cities empty and KEMET will infer a route from your interests.</p>
        <input
          value={prefs.destination}
          onChange={(e) => updatePrefs({ destination: e.target.value })}
          placeholder="Example: Cairo and Luxor, Red Sea, Nile temples"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors"
        />
      </div>

      <SectionHeader icon={MapPin} title="Select governorates" />

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
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            placeholder="Search governorates (e.g. Luxor, Aswan, Red Sea...)"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors"
          />
        </div>

        {dropdownOpen && filteredGovernorates.length > 0 && (
          <div className="absolute z-10 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#12132a] shadow-xl">
            {filteredGovernorates.map((g) => (
              <button
                key={g}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  toggleCity(g);
                  setCitySearch("");
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 transition-colors"
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <GoldButton onClick={onNext}>Next <ArrowRight size={16} /></GoldButton>
      </div>
    </div>
  );
}

function NumberStepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const handleTextChange = (raw: string) => {
    if (raw === "") return; // allow the field to be briefly empty while typing
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
        <button
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="px-2 py-1 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors"
        >
          <ChevronUp size={14} />
        </button>
        <div className="h-px bg-white/10" />
        <button
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className="px-2 py-1 text-white/60 hover:bg-white/5 disabled:opacity-30 transition-colors"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Basics ──
function StepBasics({ options, prefs, updatePrefs, onNext, onBack }: {
  options: Options; prefs: Preferences; updatePrefs: (p: Partial<Preferences>) => void; onNext: () => void; onBack: () => void;
}) {
  const selectedBudget = options.budgets.find((b) => b.name === prefs.budget);
  return (
    <div className="fade-in">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
        <h2 className="text-white font-bold text-xl mb-1">Trip basics</h2>
        <p className="text-white/50 text-sm">Set your duration, budget, and group style.</p>
      </div>

      <SectionHeader icon={Calendar} title="Duration & budget" />
      <div className="grid md:grid-cols-2 gap-4 mb-2">
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
      {selectedBudget && (
        <div className="flex gap-2 flex-wrap mb-6 text-xs">
          <span className="px-3 py-1.5 rounded-full" style={{ background: "rgba(212,175,55,0.14)", color: GOLD }}>{selectedBudget.label}</span>
          <span className="px-3 py-1.5 rounded-full bg-white/5 text-white/60">{selectedBudget.hotel}</span>
          <span className="px-3 py-1.5 rounded-full bg-white/5 text-white/60">~{selectedBudget.daily.toLocaleString()} EGP/person/day</span>
        </div>
      )}

      <SectionHeader icon={Users} title="Travel style" />
      <div className="flex gap-2 flex-wrap mb-6">
        {options.travel_styles.map((s) => (
          <button
            key={s.name}
            onClick={() => updatePrefs({ travel_style: s.name })}
            className="px-3 py-2 rounded-xl border text-sm font-semibold"
            style={{
              borderColor: prefs.travel_style === s.name ? GOLD : "rgba(255,255,255,0.1)",
              background: prefs.travel_style === s.name ? "rgba(212,175,55,0.12)" : "transparent",
              color: prefs.travel_style === s.name ? GOLD : "#c8d0de",
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <SectionHeader icon={Compass} title="Recommendations limit" />
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-white/60 text-sm block mb-2">Hotel options: {prefs.num_hotels}</label>
          <input type="range" min={2} max={10} value={prefs.num_hotels} onChange={(e) => updatePrefs({ num_hotels: Number(e.target.value) })} className="w-full accent-yellow-500" />
        </div>
        <div>
          <label className="text-white/60 text-sm block mb-2">Restaurant options: {prefs.num_restaurants}</label>
          <input type="range" min={2} max={12} value={prefs.num_restaurants} onChange={(e) => updatePrefs({ num_restaurants: Number(e.target.value) })} className="w-full accent-yellow-500" />
        </div>
      </div>

      <div className="flex justify-between">
        <GhostButton onClick={onBack}><ArrowLeft size={16} /> Back</GhostButton>
        <GoldButton onClick={onNext}>Next <ArrowRight size={16} /></GoldButton>
      </div>
    </div>
  );
}

// ── Step 3: Interests ──
function StepInterests({ options, prefs, toggleInterest, onNext, onBack }: {
  options: Options; prefs: Preferences; toggleInterest: (i: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <div className="fade-in">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
        <h2 className="text-white font-bold text-xl mb-1">What should the trip feel like?</h2>
        <p className="text-white/50 text-sm">Pick the themes that matter most. These drive dataset retrieval before any AI text is added.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {options.interests.map((interest) => {
          const selected = prefs.interests.includes(interest.name);
          return (
            <button
              key={interest.name}
              onClick={() => toggleInterest(interest.name)}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all"
              style={{
                borderColor: selected ? GOLD : "rgba(255,255,255,0.1)",
                background: selected ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.03)",
              }}
            >
              <span className="text-white font-semibold text-sm">{interest.name}</span>
              {selected && <Check size={15} className="ml-auto" style={{ color: GOLD }} />}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between mt-6">
        <GhostButton onClick={onBack}><ArrowLeft size={16} /> Back</GhostButton>
        <GoldButton onClick={onNext} disabled={prefs.interests.length === 0}>Next <ArrowRight size={16} /></GoldButton>
      </div>
    </div>
  );
}

// ── Step 4: Requirements + Generate ──
function StepRequirements({ prefs, updatePrefs, onBack, onGenerate, generating, genError }: {
  prefs: Preferences; updatePrefs: (p: Partial<Preferences>) => void; onBack: () => void; onGenerate: () => void; generating: boolean; genError: string;
}) {
  return (
    <div className="fade-in">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
        <h2 className="text-white font-bold text-xl mb-1">Anything else we should know?</h2>
        <p className="text-white/50 text-sm">Accessibility needs, dietary notes, or anything that shapes your days.</p>
      </div>
      <textarea
        value={prefs.accessibility}
        onChange={(e) => updatePrefs({ accessibility: e.target.value })}
        placeholder="Example: traveling with a wheelchair user, avoid very early starts, vegetarian-friendly restaurants"
        rows={4}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 transition-colors resize-none"
      />

      {genError && (
        <div className="flex items-center gap-2 text-red-400 text-sm mt-4">
          <AlertCircle size={15} /> {genError}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <GhostButton onClick={onBack} disabled={generating}><ArrowLeft size={16} /> Back</GhostButton>
        <GoldButton onClick={onGenerate} disabled={generating}>
          {generating ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Sparkles size={16} /> Generate itinerary</>}
        </GoldButton>
      </div>
    </div>
  );
}

// ── Card grid for attractions/restaurants/hotels ──
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
          <a
            key={idx}
            href={item.link || undefined}
            target={item.link ? "_blank" : undefined}
            rel="noreferrer"
            className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:border-yellow-500/40 transition-all"
          >
            {item.url && <img src={item.url} alt={item.name} className="w-full h-32 object-cover" />}
            <div className="p-3">
              <div className="text-white font-semibold text-sm mb-0.5 truncate">{item.name}</div>
              <div className="text-white/40 text-xs mb-1">{item.city}</div>
              <div className="text-white/50 text-xs line-clamp-2 mb-2">{item.desc}</div>
              <div className="text-xs font-bold" style={{ color: GOLD }}>{item.price}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Result view ──
function ResultView({ plan, onStartOver, onAdjust }: { plan: Plan; onStartOver: () => void; onAdjust: () => void }) {
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
      {/* Hero */}
      <div className="rounded-2xl border border-white/10 p-6 mb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(18,21,43,0.6))" }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GOLD }}>
          {plan.cities.join(", ") || "Egypt Discovery"} · {plan.days.length} days
        </div>
        <p className="text-white/80 leading-relaxed">{plan.summary}</p>
        {plan.rag_powered && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <Sparkles size={11} style={{ color: GOLD }} /> Enriched with KEMET's knowledge base (RAG)
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          {plan.sources.map((s) => (
            <span key={s} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-white/50 border border-white/10">{s}</span>
          ))}
        </div>
      </div>

      {/* Budget + weather */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm mb-1"><Wallet size={14} style={{ color: GOLD }} /> Estimated budget</div>
          <div className="text-2xl font-bold text-white">{plan.budget.low.toLocaleString()} – {plan.budget.high.toLocaleString()} EGP</div>
          <p className="text-white/40 text-xs mt-1">{plan.budget.note}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white font-semibold text-sm mb-1"><CloudSun size={14} style={{ color: GOLD }} /> Weather note</div>
          <p className="text-white/60 text-sm">{plan.weather}</p>
        </div>
      </div>

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

      <ItemGrid icon={Landmark} title="Curated experiences" items={plan.attractions} />
      <ItemGrid icon={Utensils} title="Restaurants" items={plan.restaurants} note={plan.restaurants_note} />
      <ItemGrid icon={Hotel} title="Stays" items={plan.hotels} note={plan.hotels_note} />

      {/* Tips */}
      {plan.tips.length > 0 && (
        <div className="mb-8">
          <SectionHeader icon={Info} title="Good to know" />
          <ul className="space-y-2">
            {plan.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-white/60 text-sm">
                <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: GOLD }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AskAboutTrip plan={plan} />

      {/* Actions */}
      <div className="flex flex-col md:flex-row gap-3 mt-8 pb-8">
        <GhostButton onClick={onStartOver}><RefreshCw size={15} /> Start over</GhostButton>
        <GhostButton onClick={onAdjust}>Adjust preferences</GhostButton>
        <GoldButton onClick={handleSave} disabled={saving || !isLoggedIn} className="md:ml-auto">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Bookmark size={15} />}
          {isLoggedIn ? "Save plan to account" : "Sign in to save"}
        </GoldButton>
      </div>
      {saveMsg && (
        <p className={`text-sm -mt-4 mb-8 ${saveMsg.type === "success" ? "text-green-400" : "text-red-400"}`}>{saveMsg.text}</p>
      )}
    </div>
  );
}

// ── RAG-powered Q&A about the generated trip ──
function AskAboutTrip({ plan }: { plan: Plan }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string; direction: "ltr" | "rtl" }[]>([]);
  const [asking, setAsking] = useState(false);

  const send = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setMessages((m) => [...m, { role: "user", text: q, direction: "ltr" }]);
    setQuestion("");
    setAsking(true);
    try {
      const data = await api("/ask", { method: "POST", body: JSON.stringify({ question: q, plan }) });
      setMessages((m) => [...m, { role: "assistant", text: data.reply, direction: data.direction === "rtl" ? "rtl" : "ltr" }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "Something went wrong.", direction: "ltr" }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-8">
      <div className="flex items-center gap-2 text-white font-semibold text-sm mb-3">
        <MessageCircle size={15} style={{ color: GOLD }} /> Ask KEMET about this trip
      </div>
      <p className="text-white/40 text-xs mb-4">Grounded in the same knowledge base as the KEMET chat assistant.</p>

      {messages.length > 0 && (
        <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              dir={m.direction}
              className={`text-sm px-3.5 py-2.5 rounded-xl max-w-[85%] ${m.role === "user" ? "ml-auto bg-white/10 text-white" : "bg-white/5 text-white/80 border border-white/10"}`}
            >
              {m.text}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Example: is Day 2 too packed for kids?"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow-500/50"
        />
        <button
          onClick={send}
          disabled={asking || !question.trim()}
          className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center disabled:opacity-40"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #C9A84C)` }}
        >
          {asking ? <Loader2 size={16} className="animate-spin" color="#0A0B1E" /> : <Send size={16} color="#0A0B1E" />}
        </button>
      </div>
    </div>
  );
}