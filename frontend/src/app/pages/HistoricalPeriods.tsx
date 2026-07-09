import { useEffect, useMemo, useState } from "react";
import { Shuffle, Calendar, Search, ChevronDown, ChevronUp } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_URL = `${API_BASE_URL}/api/periods`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600";

const FACTS_API_URL = `${API_BASE_URL}/api/periods/facts`;

const HIEROGLYPHS = ["𓂀", "𓆣", "𓇋", "𓅓", "𓊪", "𓏏", "𓋴"];

// Cycled per-period accent color, since the API doesn't return one.
// Order/values match the palette used across the other Egypt pages.
const COLOR_PALETTE = [
  "#D97706",
  "#B45309",
  "#D4AF37",
  "#6B7280",
  "#059669",
  "#7C3AED",
  "#DC2626",
  "#4B5563",
  "#BE185D",
  "#0284C7",
  "#B91C1C",
  "#065F46",
];

interface PeriodRecord {
  name: string;
  from_to: string;
  desc: string;
  img: string;
}

interface PeriodsResponse {
  periods: PeriodRecord[];
}

// A single period card, positioned along the timeline. Clicking the card
// expands it in place to show the full description and a larger image
// (and collapses again on a second click).
function PeriodCard({
  period,
  color,
}: {
  period: PeriodRecord;
  color: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
      }}
      className="w-full rounded-2xl border-l-4 border overflow-hidden transition-all duration-300 cursor-pointer hover:border-white/20"
      style={{
        borderLeftColor: color,
        borderColor: "rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(8px)",
      }}
    >
      {!expanded && (
        <div className="relative h-40">
          <img
            src={period.img}
            alt={period.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
            }}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            {period.from_to && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full mb-2 inline-flex items-center gap-1"
                style={{ background: `${color}22`, color }}
              >
                <Calendar className="w-3 h-3" />
                {period.from_to}
              </span>
            )}
            <h3 className="text-lg font-bold text-white">{period.name}</h3>
          </div>
          <div className="mt-1 text-white/40 shrink-0">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {expanded && (
          <img
            src={period.img}
            alt={period.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
            }}
            className="rounded-lg h-40 w-full object-cover mb-3"
          />
        )}

        <p
          className={`text-white/70 text-sm leading-relaxed whitespace-pre-line ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {period.desc}
        </p>

        <div className="mt-3 text-xs" style={{ color }}>
          {expanded ? "Show less" : "Read more"}
        </div>
      </div>
    </div>
  );
}

export function HistoricalPeriods() {
  const [data, setData] = useState<PeriodsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [facts, setFacts] = useState<string[]>([]);
  const [factIndex, setFactIndex] = useState(0);
  const [factAnimating, setFactAnimating] = useState(false);

  const cycleFact = () => {
    if (facts.length < 2) return;
    setFactAnimating(true);
    setTimeout(() => {
      setFactIndex((i) => (i + 1) % facts.length);
      setFactAnimating(false);
    }, 300);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadFacts() {
      try {
        const res = await fetch(FACTS_API_URL);
        if (!res.ok) return;
        const json: { facts: string[] } = await res.json();
        if (!cancelled && Array.isArray(json.facts) && json.facts.length > 0) {
          setFacts(json.facts);
        }
      } catch {
        // Silently keep the box empty if facts can't be fetched — it's
        // a nice-to-have, not worth surfacing an error state for.
      }
    }

    loadFacts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (facts.length < 2) return;
    const interval = setInterval(cycleFact, 6000);
    return () => clearInterval(interval);
  }, [facts]);

  useEffect(() => {
    let cancelled = false;

    async function loadPeriods() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const json: PeriodsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load periods.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPeriods();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase().trim();
    return data.periods.filter((p) => q === "" || p.name.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <div className="min-h-screen" style={{ background: "#0A0B1E" }}>
      {/* Hero */}
      <div
        className="relative overflow-hidden py-12 px-4 text-center"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.18) 0%, rgba(10,11,30,0) 70%), #0A0B1E",
        }}
      >
        {HIEROGLYPHS.map((glyph, i) => (
          <span
            key={i}
            className="absolute select-none opacity-10 text-yellow-400 font-serif pointer-events-none"
            style={{
              fontSize: `${2 + (i % 3)}rem`,
              top: `${10 + (i * 13) % 70}%`,
              left: i % 2 === 0 ? `${3 + i * 7}%` : undefined,
              right: i % 2 !== 0 ? `${3 + i * 6}%` : undefined,
              transform: `rotate(${(i % 5) * 15 - 30}deg)`,
            }}
          >
            {glyph}
          </span>
        ))}

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="flex justify-center gap-3 mb-3">
            {HIEROGLYPHS.slice(0, 5).map((g, i) => (
              <span key={i} className="text-xl opacity-60" style={{ color: "#D4AF37" }}>
                {g}
              </span>
            ))}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight" style={{ color: "#D4AF37" }}>
            Journey Through <span className="text-white">7,000 Years</span> of Egyptian History
          </h1>
          <p className="text-base text-blue-100/70 max-w-xl mx-auto">
            From the first villages along the Nile to the founding of modern Cairo — explore every
            chapter of the world's most enduring civilization.
          </p>
        </div>
      </div>

      {/* Did You Know box — fixed-height text area so the box doesn't
          grow/shrink as it cycles between facts of different lengths */}
      {facts.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 mb-8">
          <div
            className="rounded-2xl border p-5 flex items-start gap-4"
            style={{ background: "rgba(212,175,55,0.07)", borderColor: "rgba(212,175,55,0.3)" }}
          >
            <Shuffle
              className="mt-0.5 shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              size={20}
              style={{ color: "#D4AF37" }}
              onClick={cycleFact}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#D4AF37" }}>
                Did You Know?
              </p>
              <div className="h-[42px] overflow-hidden">
                <p
                  className={`text-white/80 text-sm leading-[21px] line-clamp-2 transition-opacity duration-300 ${factAnimating ? "opacity-0" : "opacity-100"}`}
                >
                  {facts[factIndex]}
                </p>
              </div>
            </div>
            <button
              className="text-xs text-white/40 hover:text-white/70 transition-colors shrink-0 mt-0.5"
              onClick={cycleFact}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Periods timeline — real data from /api/periods */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        {error && (
          <div
            className="rounded-2xl p-6 mb-8 text-center"
            style={{
              background: "rgba(212,64,55,0.08)",
              border: "1px solid rgba(212,64,55,0.3)",
              color: "#f0a8a2",
            }}
          >
            Couldn't load periods right now — {error}
          </div>
        )}

        <div className="mb-7 max-w-md mx-auto">
          <label className="text-white text-xs font-semibold mb-1.5 block">🔍 Search Period</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a period name..."
              disabled={!data}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
              style={{ background: "#1a1e30", border: "1px solid #2c3248" }}
            />
          </div>
        </div>

        {!loading && data && (
          <p className="text-gray-400 text-sm mb-5 text-center">
            Showing <span style={{ color: "#dfb257", fontWeight: 700 }}>{filtered.length}</span> period
            {filtered.length !== 1 ? "s" : ""}
          </p>
        )}

        {loading && (
          <div className="space-y-10 relative">
            <div
              className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block"
              style={{ background: "linear-gradient(to bottom, rgba(212,175,55,0.6), rgba(212,175,55,0.1))" }}
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="relative flex items-start gap-0 md:gap-6">
                <div className={`hidden md:flex flex-1 ${i % 2 === 0 ? "justify-end pr-8" : "justify-end pr-8 invisible"}`}>
                  {i % 2 === 0 && (
                    <div className="rounded-2xl animate-pulse w-full" style={{ background: "#161929", height: "180px" }} />
                  )}
                </div>
                <div className="hidden md:flex flex-col items-center z-10">
                  <div
                    className="w-5 h-5 rounded-full border-2 mt-4"
                    style={{ borderColor: "#2c3248", background: "#0A0B1E" }}
                  />
                </div>
                <div className={`hidden md:flex flex-1 ${i % 2 !== 0 ? "pl-8" : "pl-8 invisible"}`}>
                  {i % 2 !== 0 && (
                    <div className="rounded-2xl animate-pulse w-full" style={{ background: "#161929", height: "180px" }} />
                  )}
                </div>
                <div className="flex md:hidden w-full">
                  <div className="rounded-2xl animate-pulse w-full" style={{ background: "#161929", height: "180px" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && data && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-500">No periods found.</div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="relative">
            {/* Center line */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden md:block"
              style={{ background: "linear-gradient(to bottom, rgba(212,175,55,0.6), rgba(212,175,55,0.1))" }}
            />

            <div className="space-y-10">
              {filtered.map((period, i) => {
                const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
                const isLeft = i % 2 === 0;

                return (
                  <div key={period.name} className="relative flex items-start gap-0 md:gap-6">
                    {/* Left side */}
                    <div className={`hidden md:flex flex-1 ${isLeft ? "justify-end pr-8" : "justify-end pr-8 invisible"}`}>
                      {isLeft && <PeriodCard period={period} color={color} />}
                    </div>

                    {/* Center dot */}
                    <div className="hidden md:flex flex-col items-center z-10">
                      <div
                        className="w-5 h-5 rounded-full border-2 mt-4 shadow-lg"
                        style={{
                          borderColor: color,
                          background: "#0A0B1E",
                          boxShadow: `0 0 12px ${color}80`,
                        }}
                      />
                    </div>

                    {/* Right side */}
                    <div className={`hidden md:flex flex-1 ${!isLeft ? "pl-8" : "pl-8 invisible"}`}>
                      {!isLeft && <PeriodCard period={period} color={color} />}
                    </div>

                    {/* Mobile: full width */}
                    <div className="flex md:hidden w-full">
                      <PeriodCard period={period} color={color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
