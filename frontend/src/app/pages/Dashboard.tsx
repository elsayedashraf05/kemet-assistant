import {
  Sun, Sparkles,
  Search, Phone, CreditCard, Loader2, AlertCircle, RefreshCw
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

// -- الشكل اللي بيرجع من GET /api/dashboard/summary --
interface WeatherCity {
  city: string;
  temperature: number | null;
  humidity: number | null;
}
interface CurrencyRates {
  USD: number; EUR: number; GBP: number; SAR: number; AED: number;
}
interface ArrivalYear { year: number; millions: number }
interface Nationality { name: string; percent: number }
interface Emergency {
  tourist_police: string; ambulance: string; fire: string;
  embassy_hotline: string; general_emergency: string;
}
interface UsefulApp { name: string; url: string; emoji: string }
interface Stats {
  tourists_2025: { value: string; change: string };
  ytd_2026: { value: string; period: string; change: string };
  top_nationalities: { value: string; top: string };
  target_2026: { value: string; label: string };
  arrivals_by_year: ArrivalYear[];
  nationalities: Nationality[];
  emergency: Emergency;
  useful_apps: UsefulApp[];
}
interface DashboardSummary {
  weather: WeatherCity[];
  currency: CurrencyRates | null;
  stats: Stats;
}

async function fetchSummary(forceRefresh = false): Promise<DashboardSummary> {
  const res = await fetch(`${API_BASE}/api/dashboard/summary${forceRefresh ? "?refresh=true" : ""}`);
  if (!res.ok) throw new Error("Failed to load dashboard data.");
  return res.json();
}

const NATIONALITY_COLORS = [
  "#4fc3f7", "#dfb257", "#4caf50", "#ff6b6b", "#ab47bc",
  "#26c6da", "#ef9a9a", "#80cbc4", "#ffb74d", "#ce93d8",
];

function arrivalBarColor(millions: number) {
  if (millions < 5) return "#c45000";
  if (millions < 10) return "#e07820";
  return "#f5a040";
}

export function Dashboard() {
  const navigate = useNavigate();
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

  // بيودي لصفحة الشاتبوت، ولو فيه سؤال مكتوب في الخانة بيبعته كـ query param
  // (?q=...) عشان صفحة الـ Chat تقرأه وتبعته أوتوماتيك زي ما هو.
  const goToChat = () => {
    const q = searchQuery.trim();
    navigate(q ? `/chat?q=${encodeURIComponent(q)}` : "/chat");
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

  return (
    <div className="space-y-8">

      {/* HERO SECTION — زي ما هو بالظبط */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(https://images.unsplash.com/photo-1678038592327-c5730737f867?w=1600)`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B1E]/95 via-[#0A0B1E]/85 to-[#0A0B1E]/70"></div>
        </div>

        <div className="relative z-10 p-8 md:p-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            Welcome to <span className="text-[#D4AF37]">KEMET</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl">
            Your AI-powered guide to exploring the wonders of ancient and modern Egypt
          </p>

          {/* AI Search Bar -> بتوديك لصفحة الشاتبوت (/chat) */}
          <div className="max-w-3xl mb-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-[#D4AF37] transition-colors" size={20} />
              <input
                type="text"
                placeholder="Ask KEMET to plan your trip..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && goToChat()}
                className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl pl-12 pr-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all hover:bg-white/15"
              />
              <button
                onClick={goToChat}
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
          {/* MAP + ARRIVALS/NATIONALITIES CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Tourist Arrivals 2016-2025 (real static gov. figures) */}
            <div className="lg:col-span-3 bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-2xl font-semibold text-gray-100 mb-1">Tourist Arrivals 2016–2025</h3>
              <p className="text-xs text-gray-500 mb-6">Millions of international visitors</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.stats.arrivals_by_year} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="year" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} tickFormatter={(v) => `${v}M`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0A0B1E", border: "1px solid #D4AF37", borderRadius: "12px" }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#ffffff" }}
                    formatter={(value: number) => [`${value}M tourists`, "Arrivals"]}
                  />
                  <Bar dataKey="millions" radius={[8, 8, 0, 0]}>
                    {data.stats.arrivals_by_year.map((y) => (
                      <Cell key={y.year} fill={arrivalBarColor(y.millions)} />
                    ))}
                    <LabelList
                      dataKey="millions"
                      position="insideTop"
                      formatter={(v: number) => `${v}M`}
                      style={{ fill: "#000000", fontWeight: 700, fontSize: 13 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Nationalities (real static gov. figures) */}
            <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-1 text-gray-100">Top Nationalities 2025</h3>
              <p className="text-xs text-gray-500 mb-4">Estimated share of {data.stats.tourists_2025.value} total tourists</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.stats.nationalities}
                    dataKey="percent"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    labelLine={false}
                  >
                    {data.stats.nationalities.map((_, idx) => (
                      <Cell key={idx} fill={NATIONALITY_COLORS[idx % NATIONALITY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0A0B1E", border: "1px solid #D4AF37", borderRadius: "12px" }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#ffffff" }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {data.stats.nationalities.map((n, idx) => (
                  <div key={n.name} className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NATIONALITY_COLORS[idx % NATIONALITY_COLORS.length] }} />
                    {n.name} ({n.percent}%)
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* LIVE WEATHER */}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            {/* Emergency Info (real gov. numbers) */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-4 text-gray-100 flex items-center gap-2">
                <Phone className="text-[#EF4444]" size={20} />
                Emergency Info
              </h3>
              <div className="space-y-3">
                {[
                  ["Tourist Police", data.stats.emergency.tourist_police],
                  ["Ambulance", data.stats.emergency.ambulance],
                  ["Fire", data.stats.emergency.fire],
                  ["Embassy Hotline", data.stats.emergency.embassy_hotline],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <span className="text-sm text-gray-400">{label}</span>
                    <span className="font-semibold text-[#D4AF37]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Currency Exchange (live) */}
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

            {/* Useful Apps */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#D4AF37]/20 transition-all">
              <h3 className="text-xl font-semibold mb-4 text-gray-100 flex items-center gap-2">
                <Sparkles className="text-[#D4AF37]" size={20} />
                Useful Apps for Tourists
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {data.stats.useful_apps.map((app) => (
                  <a
                    key={app.name}
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center text-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10 hover:border-[#D4AF37]/40 transition-all"
                  >
                    <span className="text-2xl">{app.emoji}</span>
                    <span className="text-xs text-gray-300">{app.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}