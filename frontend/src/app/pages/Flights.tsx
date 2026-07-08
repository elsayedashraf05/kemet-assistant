import { useState } from "react";
import {
  Plane,
  ArrowLeftRight,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const TRIP_TYPES = ["One Way", "Round Trip", "Multi-City"] as const;
const CABIN_CLASSES = ["Economy", "Premium Economy", "Business", "First Class"] as const;

const POPULAR_ROUTES = [
  { flag: "🇬🇧", city: "London", code: "LHR", duration: "5h 10m", price: 389 },
  { flag: "🇺🇸", city: "New York", code: "JFK", duration: "11h 30m", price: 720 },
  { flag: "🇦🇪", city: "Dubai", code: "DXB", duration: "3h 20m", price: 210 },
  { flag: "🇫🇷", city: "Paris", code: "CDG", duration: "5h 45m", price: 415 },
  { flag: "🇩🇪", city: "Frankfurt", code: "FRA", duration: "5h 20m", price: 398 },
  { flag: "🇨🇦", city: "Toronto", code: "YYZ", duration: "12h 05m", price: 780 },
  { flag: "🇦🇺", city: "Sydney", code: "SYD", duration: "17h 40m", price: 1190 },
  { flag: "🇯🇵", city: "Tokyo", code: "NRT", duration: "13h 55m", price: 990 },
  { flag: "🇳🇱", city: "Amsterdam", code: "AMS", duration: "5h 30m", price: 401 },
];

const FEATURED_DEALS = [
  {
    airline: "EgyptAir",
    logo: "✈️",
    from: "LHR",
    to: "CAI",
    dep: "08:30",
    arr: "15:40",
    duration: "5h 10m",
    stops: "Direct",
    price: 389,
  },
  {
    airline: "Emirates",
    logo: "🛫",
    from: "JFK",
    to: "CAI",
    dep: "22:15",
    arr: "18:45+1",
    duration: "11h 30m",
    stops: "1 Stop",
    price: 720,
  },
  {
    airline: "Lufthansa",
    logo: "🛩️",
    from: "FRA",
    to: "CAI",
    dep: "10:55",
    arr: "16:15",
    duration: "5h 20m",
    stops: "Direct",
    price: 398,
  },
  {
    airline: "British Airways",
    logo: "✈️",
    from: "LHR",
    to: "CAI",
    dep: "14:10",
    arr: "21:05",
    duration: "5h 55m",
    stops: "Direct",
    price: 432,
  },
];

const PRICE_CALENDAR = [
  { day: "Mon Jul 7", price: 389 },
  { day: "Tue Jul 8", price: 312 },
  { day: "Wed Jul 9", price: 275 },
  { day: "Thu Jul 10", price: 420 },
  { day: "Fri Jul 11", price: 510 },
  { day: "Sat Jul 12", price: 468 },
  { day: "Sun Jul 13", price: 299 },
];

const WHY_FLY = [
  { icon: <Plane className="w-6 h-6" />, stat: "50+", label: "Airlines fly to Egypt", desc: "Major carriers from every continent" },
  { icon: <Building2 className="w-6 h-6" />, stat: "6", label: "International airports", desc: "Cairo, Hurghada, Sharm, Luxor, Aswan & more" },
  { icon: <Clock className="w-6 h-6" />, stat: "~4hr", label: "Average from Europe", desc: "Short flights from major European hubs" },
];

function PassengerCounter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/60 text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full border border-white/20 text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all flex items-center justify-center text-lg leading-none"
        >
          −
        </button>
        <span className="text-white font-semibold w-4 text-center">{value}</span>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-full border border-white/20 text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all flex items-center justify-center text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#12152B] border border-white/10 rounded-xl px-3 py-2 text-xs">
        <p className="text-white/50 mb-1">{label}</p>
        <p className="text-[#D4AF37] font-bold">${payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export function Flights() {
  const [tripType, setTripType] = useState<(typeof TRIP_TYPES)[number]>("Round Trip");
  const [cabinClass, setCabinClass] = useState<(typeof CABIN_CLASSES)[number]>("Economy");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [showPassengers, setShowPassengers] = useState(false);
  const [fromCity, setFromCity] = useState("London (LHR)");
  const [toCity, setToCity] = useState("Cairo (CAI)");
  const lowestDay = PRICE_CALENDAR.reduce((a, b) => (a.price < b.price ? a : b));

  const swapCities = () => {
    setFromCity(toCity);
    setToCity(fromCity);
  };

  return (
    <div className="min-h-screen" style={{ background: "#0A0B1E" }}>
      {/* Hero */}
      <div className="relative overflow-hidden pt-16 pb-8 px-4 text-center">
        {/* Decorative flight path SVG */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
          <svg width="800" height="300" viewBox="0 0 800 300" fill="none">
            <path
              d="M 50 200 Q 400 20 750 200"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeDasharray="8 6"
              fill="none"
            />
            {/* Dotted trail dots */}
            {Array.from({ length: 18 }).map((_, i) => {
              const t = i / 17;
              const x = 50 + t * 700;
              const y = 200 - Math.sin(Math.PI * t) * 180 + 20;
              return <circle key={i} cx={x} cy={y} r="3" fill="#D4AF37" />;
            })}
            <circle cx="50" cy="200" r="8" fill="#D4AF37" />
            <circle cx="750" cy="200" r="8" fill="#D4AF37" />
            <text x="30" y="230" fill="#D4AF37" fontSize="14">✈</text>
          </svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#D4AF37] text-sm font-medium mb-4 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            <Globe className="w-3.5 h-3.5" />
            Best Flight Deals to Egypt
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 leading-tight">
            Discover Egypt from the Skies
          </h1>
          <p className="text-white/50 text-lg mb-2">
            Compare hundreds of airlines and find unbeatable fares to the land of the Pharaohs.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* Main search card */}
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6 mb-10">
          {/* Trip type tabs */}
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-5 w-fit">
            {TRIP_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTripType(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tripType === t
                    ? "text-[#0A0B1E] font-semibold"
                    : "text-white/50 hover:text-white"
                }`}
                style={tripType === t ? { background: "linear-gradient(135deg, #D4AF37, #C9A84C)" } : {}}
              >
                {t}
              </button>
            ))}
          </div>

          {/* From / To */}
          <div className="flex flex-col md:flex-row gap-3 mb-4 items-stretch">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <label className="text-white/40 text-xs uppercase tracking-wide block mb-1">From</label>
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <input
                  value={fromCity}
                  onChange={(e) => setFromCity(e.target.value)}
                  className="bg-transparent text-white text-sm w-full outline-none placeholder-white/30"
                />
              </div>
            </div>

            {/* Swap button */}
            <button
              onClick={swapCities}
              className="self-center w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center hover:border-[#D4AF37]/60 hover:text-[#D4AF37] text-white/50 transition-all shrink-0"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <label className="text-white/40 text-xs uppercase tracking-wide block mb-1">To</label>
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-[#D4AF37] rotate-90 shrink-0" />
                <input
                  value={toCity}
                  onChange={(e) => setToCity(e.target.value)}
                  className="bg-transparent text-white text-sm w-full outline-none placeholder-white/30"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <label className="text-white/40 text-xs uppercase tracking-wide block mb-1">Departure</label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <input type="date" defaultValue="2025-07-15" className="bg-transparent text-white text-sm w-full outline-none" />
              </div>
            </div>
            {tripType !== "One Way" && (
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <label className="text-white/40 text-xs uppercase tracking-wide block mb-1">Return</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <input type="date" defaultValue="2025-07-25" className="bg-transparent text-white text-sm w-full outline-none" />
                </div>
              </div>
            )}
          </div>

          {/* Passengers + Cabin */}
          <div className="flex flex-col md:flex-row gap-3 mb-5">
            {/* Passengers dropdown */}
            <div className="flex-1 relative">
              <button
                onClick={() => setShowPassengers((v) => !v)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between hover:border-white/20 transition-all"
              >
                <div>
                  <span className="text-white/40 text-xs uppercase tracking-wide block text-left mb-1">Passengers</span>
                  <div className="flex items-center gap-2 text-white text-sm">
                    <Users className="w-4 h-4 text-[#D4AF37]" />
                    <span>{adults + children + infants} Passenger{adults + children + infants !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {showPassengers ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
              </button>
              {showPassengers && (
                <div className="absolute top-full left-0 right-0 z-20 mt-2 bg-[#12152B] border border-white/10 rounded-xl p-4 space-y-3 shadow-xl">
                  <PassengerCounter label="Adults (12+)" value={adults} onChange={setAdults} />
                  <PassengerCounter label="Children (2–11)" value={children} onChange={setChildren} />
                  <PassengerCounter label="Infants (<2)" value={infants} onChange={setInfants} />
                </div>
              )}
            </div>

            {/* Cabin class */}
            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <label className="text-white/40 text-xs uppercase tracking-wide block mb-1">Cabin Class</label>
              <div className="flex items-center gap-2">
                <ChevronDown className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <select
                  value={cabinClass}
                  onChange={(e) => setCabinClass(e.target.value as typeof cabinClass)}
                  className="bg-transparent text-white text-sm w-full outline-none"
                >
                  {CABIN_CLASSES.map((c) => (
                    <option key={c} value={c} style={{ background: "#12152B" }}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Search button */}
          <button className="w-full py-3.5 rounded-xl font-bold text-[#0A0B1E] text-base flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all" style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}>
            <Plane className="w-5 h-5" />
            Search Flights
          </button>
        </div>

        {/* Popular Routes */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-1">Popular Routes to Egypt</h2>
          <p className="text-white/40 text-sm mb-4">Direct and connecting flights from major cities</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POPULAR_ROUTES.map((route) => (
              <div
                key={route.city}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-[#D4AF37]/30 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{route.flag}</span>
                    <div>
                      <p className="text-white font-semibold text-sm">{route.city}</p>
                      <p className="text-white/40 text-xs">{route.code}</p>
                    </div>
                  </div>
                  <span className="text-white/30 text-lg">→</span>
                  <div className="text-right">
                    <p className="text-white font-semibold text-sm">Cairo</p>
                    <p className="text-white/40 text-xs">CAI</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-white/40 text-xs">
                    <Clock className="w-3 h-3" />
                    {route.duration}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#D4AF37] font-bold text-sm">from ${route.price}</span>
                    <button className="text-[10px] px-2 py-1 rounded-lg font-medium text-[#0A0B1E]" style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}>
                      Book
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured Deals */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-1">Featured Deals</h2>
          <p className="text-white/40 text-sm mb-4">Handpicked fares updated daily</p>
          <div className="space-y-3">
            {FEATURED_DEALS.map((deal, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-[#D4AF37]/30 transition-all"
              >
                {/* Airline */}
                <div className="flex items-center gap-3 w-36 shrink-0">
                  <span className="text-2xl">{deal.logo}</span>
                  <div>
                    <p className="text-white text-sm font-medium leading-tight">{deal.airline}</p>
                    <p className="text-white/40 text-xs">{deal.stops}</p>
                  </div>
                </div>
                {/* Times */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{deal.dep}</p>
                    <p className="text-white/40 text-xs">{deal.from}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-white/30 text-xs">{deal.duration}</p>
                    <div className="w-full flex items-center gap-1">
                      <div className="flex-1 h-px bg-white/10" />
                      <Plane className="w-3 h-3 text-[#D4AF37]" />
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                    <p className="text-white/40 text-xs">{deal.stops}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-lg">{deal.arr}</p>
                    <p className="text-white/40 text-xs">{deal.to}</p>
                  </div>
                </div>
                {/* Price */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-white/40 text-xs">from</p>
                    <p className="text-[#D4AF37] font-bold text-xl">${deal.price}</p>
                  </div>
                  <button className="px-4 py-2 rounded-xl font-semibold text-sm text-[#0A0B1E] hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}>
                    View Deal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Price Calendar */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-1">Best Prices in July 2025</h2>
          <p className="text-white/40 text-sm mb-4">
            Cheapest day:{" "}
            <span className="text-[#D4AF37] font-semibold">
              {lowestDay.day} — ${lowestDay.price}
            </span>
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={PRICE_CALENDAR} barCategoryGap="30%">
                <XAxis
                  dataKey="day"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.split(" ").slice(0, 2).join(" ")}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="price" radius={[6, 6, 0, 0]}>
                  {PRICE_CALENDAR.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.price === lowestDay.price ? "#D4AF37" : "rgba(212,175,55,0.35)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Why Fly to Egypt */}
        <section>
          <h2 className="text-xl font-bold text-white mb-1">Why Fly to Egypt?</h2>
          <p className="text-white/40 text-sm mb-4">World-class connectivity to an ancient destination</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WHY_FLY.map((item, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center hover:border-[#D4AF37]/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37] mx-auto mb-3">
                  {item.icon}
                </div>
                <p className="text-3xl font-bold text-[#D4AF37] mb-1">{item.stat}</p>
                <p className="text-white font-semibold text-sm mb-1">{item.label}</p>
                <p className="text-white/40 text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
