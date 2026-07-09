import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, ExternalLink, Search, ChevronDown, ChevronUp, Ticket } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_URL = `${API_BASE_URL}/api/tickets`;
const RATES_API_URL = `${API_BASE_URL}/api/tickets/exchange-rates`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600";

type Currency = "EGP" | "USD" | "EUR";
type VisitorType = "foreigner" | "egyptian";

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EGP: "EGP",
  USD: "$",
  EUR: "€",
};

interface TicketRecord {
  id: string;
  name: string;
  location: string;
  photo: string;
  foreignerAdult: number | null;
  foreignerStudent: number | null;
  egyptianAdult: number | null;
  egyptianStudent: number | null;
  hours: string;
  bookingLink: string | null;
  mapsLink: string | null;
  freePolicy: string;
}

interface TicketsResponse {
  tickets: TicketRecord[];
  locations: string[];
}

interface RatesResponse {
  rates: Record<Currency, number>;
  base: string;
  live: boolean;
}

// All ticket prices from the backend are raw EGP — this just applies
// whatever conversion rate is currently loaded (live, or the fallback
// the backend used if the rate API was unreachable).
function formatPrice(egpAmount: number | null, currency: Currency, rates: Record<Currency, number>): string {
  if (egpAmount === null) return "N/A";
  const rate = rates[currency] ?? 1;
  const converted = egpAmount * rate;
  const symbol = CURRENCY_SYMBOLS[currency];
  if (currency === "EGP") return `${symbol} ${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `${symbol}${converted.toFixed(2)}`;
}

function TicketCard({
  ticket,
  currency,
  visitorType,
  rates,
}: {
  ticket: TicketRecord;
  currency: Currency;
  visitorType: VisitorType;
  rates: Record<Currency, number>;
}) {
  const [expanded, setExpanded] = useState(false);

  const adultPrice = visitorType === "foreigner" ? ticket.foreignerAdult : ticket.egyptianAdult;
  const studentPrice = visitorType === "foreigner" ? ticket.foreignerStudent : ticket.egyptianStudent;

  return (
    <div className="rounded-2xl overflow-hidden bg-[#171a2e] border border-white/10 flex flex-col">
      {/* Card photo */}
      <div className="relative h-40 overflow-hidden">
        <img
          src={ticket.photo}
          alt={ticket.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B1E]/80 via-[#0A0B1E]/10 to-[#0A0B1E]/50" />
        {/* Hours - top left */}
        <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/40 border border-white/20 text-white/90">
          <Clock size={12} className="shrink-0" />
          {ticket.hours}
        </span>
        {/* Location badge - top right */}
        <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#D4AF37]">
          {ticket.location}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        <h3 className="text-white font-semibold text-base leading-tight">{ticket.name}</h3>

        {/* Pricing */}
        <div className="space-y-0.5">
          <p
            className={`text-xl font-bold ${
              visitorType === "egyptian" ? "text-[#93C5FD]" : "text-[#D4AF37]"
            }`}
          >
            Adult: {formatPrice(adultPrice, currency, rates)}
          </p>
          <p
            className={`text-sm ${
              visitorType === "egyptian" ? "text-[#BFDBFE]/90" : "text-[#C9A84C]/80"
            }`}
          >
            Student: {formatPrice(studentPrice, currency, rates)}
          </p>
        </div>

        {/* Free policy */}
        <div className="text-white/50 text-xs leading-relaxed">
          <p className={expanded ? "" : "line-clamp-2"}>{ticket.freePolicy}</p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 mt-1 text-[#C9A84C] hover:text-[#D4AF37] transition-colors"
          >
            {expanded ? (
              <>
                Show less <ChevronUp size={12} />
              </>
            ) : (
              <>
                Show more <ChevronDown size={12} />
              </>
            )}
          </button>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          {ticket.bookingLink && (
            <a
              href={ticket.bookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#C9A84C] text-[#0A0B1E] font-semibold text-sm transition-colors"
            >
              <ExternalLink size={14} />
              Book Now
            </a>
          )}
          {ticket.mapsLink && (
            <a
              href={ticket.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/20 hover:border-[#D4AF37]/60 text-white/80 hover:text-[#D4AF37] font-semibold text-sm transition-colors"
            >
              <MapPin size={14} />
              Directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function Tickets() {
  const [data, setData] = useState<TicketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Live rates: {EGP: 1, USD: ..., EUR: ...}. `live` tells us whether the
  // backend actually reached the exchange-rate API or fell back to a
  // stale hardcoded rate.
  const [rates, setRates] = useState<Record<Currency, number>>({ EGP: 1, USD: 0.0204, EUR: 0.0188 });
  const [ratesLive, setRatesLive] = useState(false);

  const [currency, setCurrency] = useState<Currency>("EGP");
  const [visitorType, setVisitorType] = useState<VisitorType>("foreigner");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("All");

  useEffect(() => {
    let cancelled = false;

    async function loadTickets() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const json: TicketsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tickets.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTickets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRates() {
      try {
        const res = await fetch(RATES_API_URL);
        if (!res.ok) return;
        const json: RatesResponse = await res.json();
        if (!cancelled && json.rates) {
          setRates(json.rates);
          setRatesLive(json.live);
        }
      } catch {
        // Keep the fallback rates already in state — the toggle still works.
      }
    }

    loadRates();
    // Refresh hourly so a long-open tab doesn't drift too far from live rates.
    const interval = setInterval(loadRates, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.tickets.filter((t) => {
      const matchesCity = city === "All" || t.location === city;
      const matchesSearch =
        search.trim() === "" ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.location.toLowerCase().includes(search.toLowerCase());
      return matchesCity && matchesSearch;
    });
  }, [data, city, search]);

  const cities = data?.locations || ["All"];

  return (
    <div className="min-h-screen bg-[#0A0B1E] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://egymonuments.com/storage/events/July2025/QZGh9Yi02klQ6Pb9chmh.webp)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0B1E]/90 via-[#0A0B1E]/70 to-[#0A0B1E]" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-20 text-center">
          {/* Gold badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37] text-sm font-medium mb-6">
            <Ticket size={14} />
            Official Ticket Prices
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Book Egypt's{" "}
            <span className="text-[#D4AF37]">Heritage Sites</span>
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-6">
            Compare prices, check hours, and book tickets directly from the official monuments
            authority
          </p>
          {/* Source pill */}
          <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-xs">
            Powered by egymonuments.gov.eg
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-6 space-y-4">
        {/* Currency + visitor type toggles */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Currency toggle */}
          <div className="flex flex-col gap-1.5">
            {currency !== "EGP" && (
              <span className="flex items-center gap-1 text-[11px] text-white/50 pl-1">
                <span className={ratesLive ? "text-emerald-400" : "text-white/40"}>
                  {ratesLive ? "● Live rate" : "○ Approximate rate"}
                </span>
                <span className="text-white/20">·</span>
                <span>
                  1 EGP {"\u2248"} {rates[currency].toFixed(4)} {currency}
                </span>
              </span>
            )}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {(["EGP", "USD", "EUR"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    currency === c
                      ? "bg-[#D4AF37] text-[#0A0B1E]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Visitor type toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {(["foreigner", "egyptian"] as VisitorType[]).map((v) => (
              <button
                key={v}
                onClick={() => setVisitorType(v)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  visitorType === v
                    ? "bg-[#D4AF37] text-[#0A0B1E]"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {v === "foreigner" ? "Foreigner" : "Egyptian"}
              </button>
            ))}
          </div>
        </div>

        {/* Search + city filter */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              placeholder="Search sites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!data}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37]/50 transition-colors"
            />
          </div>

          {/* Governorate dropdown */}
          <div className="relative min-w-[180px]">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!data}
              className="w-full appearance-none pl-4 pr-9 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-[#D4AF37] focus:outline-none focus:border-[#D4AF37]/50 transition-colors cursor-pointer"
            >
              {cities.map((c) => (
                <option key={c} value={c} className="bg-[#171a2e] text-white">
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-12">
        {error && (
          <div className="rounded-2xl p-6 mb-8 text-center bg-red-500/10 border border-red-500/30 text-red-200">
            Couldn't load tickets right now — {error}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="rounded-2xl h-72 bg-white/5 border border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && data && filtered.length === 0 && (
          <div className="text-center py-20 text-white/40">
            No sites match your search.
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {filtered.map((ticket) => (
              <TicketCard
                key={ticket.id || ticket.name}
                ticket={ticket}
                currency={currency}
                visitorType={visitorType}
                rates={rates}
              />
            ))}
          </div>
        )}

        {/* Info banner */}
        <div className="mt-10 rounded-2xl border border-[#D4AF37]/30 bg-[#171a2e] p-6">
          <div className="flex items-start gap-3">
            <Ticket size={20} className="text-[#D4AF37] shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-white/70">
              <p>
                <span className="text-[#D4AF37] font-semibold">Official rates</span> — All prices
                are official Egyptian Ministry of Tourism &amp; Antiquities rates, shown in EGP and
                converted live to your selected currency.
              </p>
              <p>
                Photography policy varies by site — always confirm at the entrance before shooting.
              </p>
              <p className="text-white/40 text-xs">
                Source:{" "}
                <a
                  href="https://egymonuments.gov.eg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[#D4AF37] transition-colors"
                >
                  egymonuments.gov.eg
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
