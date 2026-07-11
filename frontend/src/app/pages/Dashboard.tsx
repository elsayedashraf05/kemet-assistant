import {
  Sun, Sparkles, Search, Phone, CreditCard, Loader2, AlertCircle, RefreshCw,
  Landmark, Hotel, UtensilsCrossed, Waves, MapPin, Car, HeartPulse, MapPinned,
  Building2, ShoppingBag, Anchor, Briefcase,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { askAI } from "../lib/askAI";
import { API_BASE_URL } from "../lib/api";

const API_BASE = API_BASE_URL;

// -- الشكل اللي بيرجع من GET /api/dashboard/summary --
// كل حاجة هنا غير الطقس والعملة جايه من الـ Gold layer الحقيقي (مش أرقام ثابتة).
interface WeatherCity {
  city: string;
  temperature: number | null;
  humidity: number | null;
}
interface CurrencyRates {
  USD: number; EUR: number; GBP: number; SAR: number; AED: number;
}
interface Emergency {
  tourist_police: string; ambulance: string; fire: string;
  embassy_hotline: string; general_emergency: string;
}
interface UsefulApp { name: string; url: string; icon: string }

interface Highlights {
  attractions: number; hotels: number; restaurants: number;
  beaches: number; governorates: number;
}
interface GovernorateCount { governorate: string; count: number }
interface AttractionType { type: string; count: number }
interface CuisineCount { cuisine: string; count: number }
interface PriceTierCount { tier: string; count: number }
interface BeachRating { governorate: string; rating: number }
interface HistoricalPeriod {
  period: string; start_year: number; end_year: number; duration_years: number;
}
interface NationalStats {
  archaeological_sites: number; museums: number; hotels_total: number;
  diving_activity_centers: number; tourism_companies: number;
  souvenir_shops: number; tourist_restaurants_cafes: number;
  tourist_vehicles: number; snapshot_date: string;
}
interface SpotlightItem { name: string; subtitle: string; image: string }
interface SpotlightCategory { label: string; page: string; items: SpotlightItem[] }
interface Spotlights {
  beaches: SpotlightCategory;
  restaurants: SpotlightCategory;
  hotels: SpotlightCategory;
  ancient_sites: SpotlightCategory;
  monuments: SpotlightCategory;
  museums: SpotlightCategory;
  historical_periods: SpotlightCategory;
}
interface KemetData {
  highlights: Highlights;
  attractions_by_governorate: GovernorateCount[];
  attraction_types: AttractionType[];
  top_cuisines: CuisineCount[];
  hotel_price_tiers: PriceTierCount[];
  beach_ratings_by_governorate: BeachRating[];
  historical_timeline: HistoricalPeriod[];
  national_stats: NationalStats | null;
  spotlights: Spotlights;
}
interface DashboardSummary {
  weather: WeatherCity[];
  currency: CurrencyRates | null;
  kemet: KemetData;
  emergency: Emergency;
  useful_apps: UsefulApp[];
}

async function fetchSummary(forceRefresh = false): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/api/dashboard/summary${forceRefresh ? "?refresh=true" : ""}`);
  if (!res.ok) throw new Error("Failed to load dashboard data.");
  return res.json();
}

const TYPE_COLORS = ["#dfb257", "#4fc3f7", "#4caf50"];

// icon slug (from the backend, no emoji) -> real lucide component
const APP_ICONS: Record<string, typeof Car> = {
  car: Car,
  utensils: UtensilsCrossed,
  "heart-pulse": HeartPulse,
  map: MapPinned,
};

// '−2686' -> '2686 BC', '332' -> '332 AD' — matches how Silver already signs BC years.
function formatYear(year: number): string {
  return year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
}

// Real, stable photography (Wikimedia Commons) — used only for the hero background.
// Every other image on this page (the rotating "Discover Egypt" cards below) comes
// from real KEMET Storage data (fact_beaches.photo_url, fact_hotels.image, etc.),
// not a hardcoded list.
const HERO_IMAGE =
  "https://commons.wikimedia.org/wiki/Special:FilePath/All_Gizah_Pyramids.jpg?width=1920";

const SPOTLIGHT_ROTATE_MS = 60_000; // "changes every minute" per category, client-side

// One card per major directory page. Picks a random real item from that page's Gold
// data on load, then swaps to a different random real item every minute — no extra
// network calls needed, the pool of real items+images already came down with /summary.
function SpotlightCard({ category }: { category: SpotlightCategory }) {
  const navigate = useNavigate();
  const { label, page, items } = category;
  const [index, setIndex] = useState(() => (items.length ? Math.floor(Math.random() * items.length) : 0));

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        let next = prev;
        while (next === prev) next = Math.floor(Math.random() * items.length);
        return next;
      });
    }, SPOTLIGHT_ROTATE_MS);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-[3/4] flex items-center justify-center bg-white/5">
        <p className="text-xs text-gray-500 px-4 text-center">{label} data refreshing.</p>
      </div>
    );
  }

  const item = items[index % items.length];

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-[#D4AF37]/40 transition-all aspect-[3/4]">
      <div
        key={item.image}
        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
        style={{ backgroundImage: `url(${item.image})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B1E]/95 via-[#0A0B1E]/25 to-transparent" />
      <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-[10px] uppercase tracking-wider text-[#D4AF37] px-2 py-1 rounded-md">
        {label}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-semibold text-sm leading-snug">{item.name}</p>
        <p className="text-gray-300 text-xs mt-1">{item.subtitle}</p>
        <button
          onClick={() => navigate(page)}
          className="mt-3 w-full bg-[#D4AF37]/90 hover:bg-[#D4AF37] text-black text-xs font-semibold rounded-lg py-2 transition-all"
        >
          Open Page
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = (forceRefresh = false) => {
    forceRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    fetchSummary(forceRefresh)
      .then(setData)
      .catch(() => setError("Couldn't load live dashboard data. Please try again."))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  // بيفتح الـ chat bubble العائم ويبعت السؤال المكتوب في الخانة (لو فيه)،
  // بدل ما يودي المستخدم لصفحة تانية.
  const askKemet = () => {
    const q = searchQuery.trim();
    if (!q) return;
    askAI(q);
    setSearchQuery("");
  };

  // ملخصات الطقس (أبرد/أسخن/أرطب/أجف مدينة) محسوبة من بيانات حية فعلية
  const validTemps = (data?.weather || []).filter((w) => w.temperature !== null);
  const validHum = (data?.weather || []).filter((w) => w.humidity !== null);
  const hottest = validTemps.length ? [...validTemps].sort((a, b) => (b.temperature! - a.temperature!))[0] : null;
  const coldest = validTemps.length ? [...validTemps].sort((a, b) => (a.temperature! - b.temperature!))[0] : null;
  const mostHumid = validHum.length ? [...validHum].sort((a, b) => (b.humidity! - a.humidity!))[0] : null;
  const driest = validHum.length ? [...validHum].sort((a, b) => (a.humidity! - b.humidity!))[0] : null;

  const tempChartData = [...validTemps].sort((a, b) => a.temperature! - b.temperature!);
  const humChartData = [...validHum].sort((a, b) => a.humidity! - b.humidity!);

  // Gold-derived chart data, sorted for readability in their chart orientation
  const historyChartData = data ? [...data.kemet.historical_timeline].sort((a, b) => a.start_year - b.start_year) : [];

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-8 px-4 sm:px-6 lg:px-8 box-border">

      {/* HERO — real photo of the Giza Pyramids, no stock placeholder */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B1E]/95 via-[#0A0B1E]/85 to-[#0A0B1E]/70"></div>
        </div>

        <div className="relative z-10 p-6 sm:p-8 md:p-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
            Welcome to <span className="text-[#D4AF37]">KEMET</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 max-w-2xl">
            Your AI-powered guide to exploring the wonders of ancient and modern Egypt —
            5,000 years of history, curated from real data and a river that never stopped flowing.
          </p>

          {/* AI Search Bar -> بيفتح الـ chat bubble ويبعت السؤال */}
          <div className="max-w-3xl mb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#D4AF37] transition-colors" size={20} />
              <input
                type="text"
                placeholder="Ask KEMET to plan your trip..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askKemet()}
                className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl pl-12 pr-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all hover:bg-white/15"
              />
              <button
                onClick={askKemet}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-[#D4AF37] hover:bg-[#C9A646] text-black px-6 py-2 rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                <Sparkles size={18} />
                Ask AI
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-2xl px-4 py-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* EGYPT AT A GLANCE — national snapshot, sourced from the Ministry of Tourism */}
          {data.kemet.national_stats && (
            <div>
              <h3 className="text-2xl font-semibold text-gray-100 mb-1">Egypt at a Glance</h3>
              <p className="text-xs text-gray-500 mb-4">
                Source: Ministry of Tourism, Egypt — snapshot as of {data.kemet.national_stats.snapshot_date}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Landmark, label: "Archaeological Sites", value: data.kemet.national_stats.archaeological_sites },
                  { icon: Building2, label: "Museums", value: data.kemet.national_stats.museums },
                  { icon: Hotel, label: "Hotels", value: data.kemet.national_stats.hotels_total },
                  { icon: Anchor, label: "Diving & Activity Centers", value: data.kemet.national_stats.diving_activity_centers },
                  { icon: Briefcase, label: "Tourism Companies", value: data.kemet.national_stats.tourism_companies },
                  { icon: ShoppingBag, label: "Souvenir Shops", value: data.kemet.national_stats.souvenir_shops },
                  { icon: UtensilsCrossed, label: "Tourist Restaurants & Cafes", value: data.kemet.national_stats.tourist_restaurants_cafes },
                  { icon: Car, label: "Tourist Vehicles", value: data.kemet.national_stats.tourist_vehicles },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-[#D4AF37]/30 transition-all">
                    <Icon className="mb-2 text-[#D4AF37]" size={20} />
                    <p className="text-xl font-bold text-white">{value.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EGYPT IN NUMBERS — headline KPIs, sourced from KEMET Storage */}
          <div>
            <p className="text-xs text-gray-500 mb-3">Source: KEMET Storage</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { icon: Landmark, label: "Attractions", value: data.kemet.highlights.attractions },
                { icon: Hotel, label: "Hotels", value: data.kemet.highlights.hotels },
                { icon: UtensilsCrossed, label: "Restaurants", value: data.kemet.highlights.restaurants },
                { icon: Waves, label: "Beaches", value: data.kemet.highlights.beaches },
                { icon: MapPin, label: "Governorates", value: data.kemet.highlights.governorates },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-[#D4AF37]/30 transition-all text-center">
                  <Icon className="mx-auto mb-2 text-[#D4AF37]" size={22} />
                  <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* DISCOVER EGYPT — real, rotating items pulled from KEMET Storage; each
              card opens the real directory page for that data */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-100 mb-1">Discover Egypt</h3>
            <p className="text-xs text-gray-500 mb-4">Source: KEMET Storage — a new pick every minute</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <SpotlightCard category={data.kemet.spotlights.beaches} />
              <SpotlightCard category={data.kemet.spotlights.ancient_sites} />
              <SpotlightCard category={data.kemet.spotlights.hotels} />
              <SpotlightCard category={data.kemet.spotlights.restaurants} />
              <SpotlightCard category={data.kemet.spotlights.monuments} />
              <SpotlightCard category={data.kemet.spotlights.museums} />
            </div>
          </div>

          {/* WHAT AWAITS YOU + HOTELS BY BUDGET — side by side on tablet/desktop, stacked on mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-1 text-gray-100">What Awaits You</h3>
              <p className="text-xs text-gray-500 mb-4">{data.kemet.highlights.attractions} curated attractions, by type — Source: KEMET Storage</p>
              {data.kemet.attraction_types.length ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.kemet.attraction_types}
                        dataKey="count"
                        nameKey="type"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        labelLine={false}
                      >
                        {data.kemet.attraction_types.map((_, idx) => (
                          <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0A0B1E", border: "1px solid #D4AF37", borderRadius: "12px" }}
                        itemStyle={{ color: "#ffffff" }}
                        labelStyle={{ color: "#ffffff" }}
                        formatter={(value: number, name: string) => [`${value}`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {data.kemet.attraction_types.map((t, idx) => (
                      <div key={t.type} className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[idx % TYPE_COLORS.length] }} />
                        {t.type} ({t.count})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 py-16 text-center">Data refreshing.</p>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h4 className="text-white font-semibold mb-1">Hotels by Budget</h4>
              <p className="text-xs text-gray-500 mb-5">{data.kemet.highlights.hotels} hotels across every price range — Source: KEMET Storage</p>
              <div className="space-y-4">
                {data.kemet.hotel_price_tiers.map((tier) => {
                  const max = Math.max(...data.kemet.hotel_price_tiers.map((t) => t.count), 1);
                  return (
                    <div key={tier.tier}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{tier.tier}</span>
                        <span className="text-[#D4AF37] font-semibold">{tier.count}</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D4AF37] rounded-full"
                          style={{ width: `${(tier.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5,000 YEARS OF HISTORY — Gantt-style horizontal timeline chart */}
          {data.kemet.historical_timeline.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-4 sm:p-5 border border-white/10 hover:border-[#D4AF37]/20 transition-all max-w-3xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-100 mb-1">5,000 Years of History</h3>
              <p className="text-[11px] text-gray-500 mb-4">
                {data.kemet.national_stats
                  ? `${data.kemet.national_stats.archaeological_sites.toLocaleString()} archaeological sites and ${data.kemet.national_stats.museums} museums preserve every one of these periods`
                  : "Every era, from the Old Kingdom to the present day"}
              </p>
              <ResponsiveContainer width="100%" height={Math.max(180, historyChartData.length * 34)}>
                <BarChart data={historyChartData} layout="vertical" margin={{ left: 4, right: 16 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    stroke="#94a3b8"
                    style={{ fontSize: "10px" }}
                    tickFormatter={(v: number) => formatYear(v)}
                  />
                  <YAxis type="category" dataKey="period" stroke="#94a3b8" style={{ fontSize: "10px" }} width={110} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const p = payload[0].payload as HistoricalPeriod;
                      return (
                        <div className="bg-[#0A0B1E] border border-[#D4AF37] rounded-xl px-3 py-2">
                          <p className="text-white text-xs font-semibold mb-1">{p.period}</p>
                          <p className="text-[#D4AF37] text-xs">{formatYear(p.start_year)} – {formatYear(p.end_year)}</p>
                          <p className="text-gray-400 text-[11px] mt-0.5">{p.duration_years.toLocaleString()} years</p>
                        </div>
                      );
                    }}
                  />
                  {/* Invisible spacer bar pushes the visible bar out to start_year, creating the Gantt effect */}
                  <Bar dataKey="start_year" stackId="timeline" fill="transparent" />
                  <Bar dataKey="duration_years" stackId="timeline" radius={[0, 6, 6, 0]} fill="#dfb257" maxBarSize={16}>
                    <LabelList
                      dataKey="duration_years"
                      position="insideRight"
                      formatter={(v: number) => `${v.toLocaleString()}y`}
                      style={{ fill: "#000000", fontWeight: 700, fontSize: 9 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* LIVE WEATHER — بيانات حية */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-semibold text-gray-100 flex items-center gap-2">
                <Sun className="text-[#F59E0B]" size={24} />
                Live Weather
              </h3>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#D4AF37] border border-white/10 hover:border-[#D4AF37]/40 rounded-xl px-4 py-2 transition-all"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {hottest && coldest && mostHumid && driest && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Hottest City", value: `${hottest.temperature}°C`, sub: hottest.city, bg: "from-orange-900/40 to-orange-950/40" },
                  { label: "Coolest City", value: `${coldest.temperature}°C`, sub: coldest.city, bg: "from-sky-900/40 to-sky-950/40" },
                  { label: "Most Humid", value: `${mostHumid.humidity}%`, sub: mostHumid.city, bg: "from-sky-900/40 to-sky-950/40" },
                  { label: "Driest City", value: `${driest.humidity}%`, sub: driest.city, bg: "from-yellow-900/40 to-yellow-950/40" },
                ].map((c) => (
                  <div key={c.label} className={`bg-gradient-to-br ${c.bg} rounded-2xl p-5 border border-white/10`}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{c.label}</p>
                    <p className="text-2xl font-bold text-white mb-1">{c.value}</p>
                    <p className="text-xs text-gray-400">{c.sub}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10">
                <h4 className="text-white font-semibold mb-4">Temperature</h4>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={tempChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                    <YAxis type="category" dataKey="city" stroke="#94a3b8" style={{ fontSize: "12px" }} width={110} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0A0B1E", border: "1px solid #D4AF37", borderRadius: "12px" }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#ffffff" }}
                      formatter={(value: number) => [`${value}°C`, "Temperature"]}
                    />
                    <Bar dataKey="temperature" radius={[0, 8, 8, 0]} fill="#e07820">
                      <LabelList
                        dataKey="temperature"
                        position="insideRight"
                        formatter={(v: number) => `${v}°C`}
                        style={{ fill: "#000000", fontWeight: 700, fontSize: 12 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10">
                <h4 className="text-white font-semibold mb-4">Humidity</h4>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={humChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" stroke="#94a3b8" style={{ fontSize: "12px" }} domain={[0, 100]} />
                    <YAxis type="category" dataKey="city" stroke="#94a3b8" style={{ fontSize: "12px" }} width={110} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0A0B1E", border: "1px solid #D4AF37", borderRadius: "12px" }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#ffffff" }}
                      formatter={(value: number) => [`${value}%`, "Humidity"]}
                    />
                    <Bar dataKey="humidity" radius={[0, 8, 8, 0]} fill="#0070c0">
                      <LabelList
                        dataKey="humidity"
                        position="insideRight"
                        formatter={(v: number) => `${v}%`}
                        style={{ fill: "#000000", fontWeight: 700, fontSize: 12 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* EMERGENCY + CURRENCY + APPS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-4 text-gray-100 flex items-center gap-2">
                <Phone className="text-[#EF4444]" size={20} />
                Emergency Info
              </h3>
              <div className="space-y-3">
                {[
                  ["Tourist Police", data.emergency.tourist_police],
                  ["Ambulance", data.emergency.ambulance],
                  ["Fire", data.emergency.fire],
                  ["Embassy Hotline", data.emergency.embassy_hotline],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="font-semibold text-[#D4AF37]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-4 text-gray-100 flex items-center gap-2">
                <CreditCard className="text-[#10B981]" size={20} />
                Currency Exchange
              </h3>
              {data.currency ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-[#D4AF37]/10 to-[#D4AF37]/5 rounded-xl border border-[#D4AF37]/20">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-3xl font-bold text-[#D4AF37]">{data.currency.USD.toFixed(2)}</span>
                      <span className="text-sm text-gray-400">EGP</span>
                    </div>
                    <p className="text-xs text-gray-500">= 1 USD</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(["EUR", "GBP", "SAR", "AED"] as const).map((code) => (
                      <div key={code} className="p-2 bg-white/5 rounded-lg">
                        <p className="text-gray-400 text-xs mb-1">{code}</p>
                        <p className="font-semibold text-[#D4AF37]">{data.currency![code].toFixed(2)} EGP</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Exchange rates unavailable right now.</p>
              )}
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-4 text-gray-100 flex items-center gap-2">
                <Sparkles className="text-[#D4AF37]" size={20} />
                Useful Apps for Tourists
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {data.useful_apps.map((app) => {
                  const Icon = APP_ICONS[app.icon] ?? MapPinned;
                  return (
                    <a
                      key={app.name}
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center text-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-[#D4AF37]/40 transition-all"
                    >
                      <Icon className="text-[#D4AF37]" size={22} />
                      <span className="text-xs text-gray-300">{app.name}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}