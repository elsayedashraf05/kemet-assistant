import { useEffect, useMemo, useState, useRef } from "react";
import type { CSSProperties } from "react";
import {
  Shuffle,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  X,
  BookOpenText,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_URL = `${API_BASE_URL}/api/periods`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=1400&q=80&auto=format&fit=crop";

const FACTS_API_URL = `${API_BASE_URL}/api/periods/facts`;

// The API images render blurry because they're served at a small fixed
// width (often a ~600px thumbnail) then stretched to fill much larger
// card/hero containers. When the source is an Unsplash URL we can just ask
// for a bigger, better-compressed version instead of upscaling a small one.
function sharpImg(url: string, width: number): string {
  if (!url) return url;
  try {
    const u = new URL(url, "https://images.unsplash.com");
    if (u.hostname.includes("unsplash.com")) {
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "80");
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      return u.toString();
    }
    // Wikimedia's Special:FilePath redirector also honors a `width` param
    // and returns a proportionally-scaled thumbnail instead of the (often
    // multi-megabyte) full-resolution original.
    if (u.hostname.includes("wikimedia.org") && u.pathname.includes("Special:FilePath")) {
      u.searchParams.set("width", String(width));
      return u.toString();
    }
    return url;
  } catch {
    return url;
  }
}

// Curated, high-resolution photos for each historical period, sourced from
// Wikimedia Commons (public domain / CC-licensed, high quality) instead of
// relying on whatever photo_url happens to be in the CSV export. Matched by
// keyword against the period's name rather than an exact string, so this
// still works even if the wording in the data changes slightly (e.g.
// "New Kingdom" vs "The New Kingdom Period").
//
// Order matters: more specific keywords (e.g. "second intermediate") are
// checked before shorter ones they contain (e.g. "intermediate").
const CURATED_PERIOD_IMAGES: { keywords: string[]; url: string }[] = [
  {
    keywords: ["predynastic"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Jar_Decorated_with_Boats_MET_DP237640.jpg",
  },
  {
    keywords: ["early dynastic"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Narmer_palette_(obverse).jpg",
  },
  {
    keywords: ["old kingdom"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/All_Gizah_Pyramids.jpg",
  },
  {
    keywords: ["first intermediate"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Statue_of_Nebhepetre_Mentuhotep_II_in_the_Jubilee_Garment_MET_DP302395.jpg",
  },
  {
    keywords: ["second intermediate", "hyksos"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Kamose_Siegesstele_Luxor_Museum_01.jpg",
  },
  {
    keywords: ["middle kingdom"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Beni_Hassan_tomb_15_wrestling_detail.jpg",
  },
  {
    keywords: ["new kingdom"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Karnak_Temples.jpg",
  },
  {
    keywords: ["third intermediate"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Golden_Mask_of_Psusennes_I.jpg",
  },
  {
    keywords: ["late period"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Statue_of_Tasherenese,_mother_of_king_Amasis_II,_570-526_BCE,_from_Egypt,_currently_housed_in_the_British_Museum.jpg",
  },
  {
    keywords: ["ptolemaic"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Temple_of_Horus_-_Edfu,_Egypt_-_Hieroglyphics.jpg",
  },
  {
    keywords: ["roman"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Mummy_portrait_of_a_woman,_AD_120-150,_Roman_Egypt,_wax_encaustic_painting_on_sycamore_wood,_Liebieghaus,_Frankfurt_am_Main_(23365366636).jpg",
  },
  {
    keywords: ["islamic"],
    url: "https://commons.wikimedia.org/wiki/Special:FilePath/Mosque_of_Ibn_Tulun_00.jpg",
  },
];

function curatedImg(period: PeriodRecord): string | null {
  const name = period.name?.toLowerCase() ?? "";
  for (const entry of CURATED_PERIOD_IMAGES) {
    if (entry.keywords.some((k) => name.includes(k))) return entry.url;
  }
  return null;
}

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
  onOpenStory,
}: {
  period: PeriodRecord;
  color: string;
  onOpenStory?: () => void;
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
            src={sharpImg(curatedImg(period) ?? period.img, 700)}
            alt={period.name}
            loading="lazy"
            decoding="async"
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
            src={sharpImg(curatedImg(period) ?? period.img, 900)}
            alt={period.name}
            loading="lazy"
            decoding="async"
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

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color }}>
            {expanded ? "Show less" : "Read more"}
          </span>
          {onOpenStory && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenStory();
              }}
              className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors hover:brightness-110 shrink-0"
              style={{ background: `${color}22`, color }}
            >
              View in Story Mode →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// One-time stylesheet for the Story Mode entrance animations. Injected once
// (not per-slide) so re-renders don't restart it or duplicate the tag.
const STORY_KEYFRAMES = `
@keyframes storyImgFromLeft {
  0% { opacity: 0; transform: scale(0.55) translateX(-60px); }
  100% { opacity: 1; transform: scale(1) translateX(0); }
}
@keyframes storyImgFromRight {
  0% { opacity: 0; transform: scale(0.55) translateX(60px); }
  100% { opacity: 1; transform: scale(1) translateX(0); }
}
@keyframes storyTextFromRight {
  0% { opacity: 0; transform: translateX(48px); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes storyTextFromLeft {
  0% { opacity: 0; transform: translateX(-48px); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes storyBadgeIn {
  0% { opacity: 0; transform: translateY(-6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes storyGlowPulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 0.7; }
}
@keyframes storyDotPop {
  0% { transform: scale(1); }
  40% { transform: scale(1.5); }
  100% { transform: scale(1); }
}
.story-fade-bg { animation: storyFadeIn 0.25s ease-out; }
@keyframes storyFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Slim custom scrollbar for the description text, replacing the bulky
   default browser scrollbar with a thin rounded accent-colored thread. */
.story-desc-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--story-accent, #D4AF37) transparent;
}
.story-desc-scroll::-webkit-scrollbar {
  width: 4px;
}
.story-desc-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.story-desc-scroll::-webkit-scrollbar-thumb {
  background: var(--story-accent, #D4AF37);
  border-radius: 9999px;
}
.story-desc-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--story-accent, #D4AF37);
  opacity: 0.8;
}
`;

// Full-screen, one-period-at-a-time presentation. Image and text swap sides
// per period (mirroring the timeline's alternating layout) and animate in
// from opposite directions — the image "grows" into place, the text slides
// in from the other side — so advancing feels like the timeline card itself
// expanding out into a full page.
function PeriodStoryView({
  periods,
  startIndex,
  colorFor,
  onClose,
}: {
  periods: PeriodRecord[];
  startIndex: number;
  colorFor: (i: number) => string;
  onClose: (index: number) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const total = periods.length;
  const period = periods[index];
  const color = colorFor(index);
  const isLeft = index % 2 === 0;

  const go = (delta: number) => {
    setIndex((i) => (i + delta + total) % total);
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Keep the escape/arrow-key handlers reading the latest index without
  // having to re-bind the listener on every navigation.
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(indexRef.current);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  if (!period) return null;

  return (
    <div
      className="fixed inset-0 z-50 story-fade-bg overflow-hidden cursor-pointer"
      onClick={() => onClose(index)}
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 50% 0%, rgba(212,175,55,0.14) 0%, rgba(10,11,30,0) 65%), #0A0B1E",
      }}
    >
      <style>{STORY_KEYFRAMES}</style>

      {/* Ambient glow tied to this period's color */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at ${isLeft ? "20%" : "80%"} 45%, ${color}22 0%, transparent 60%)`,
          animation: "storyGlowPulse 4s ease-in-out infinite",
        }}
      />

      {/* Top bar: progress + close */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 md:px-8 py-5 z-20 cursor-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          key={`badge-${index}`}
          className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase"
          style={{ color, animation: "storyBadgeIn 0.4s ease-out" }}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span className="text-white/30">/</span>
          <span className="text-white/40">{String(total).padStart(2, "0")}</span>
        </div>
        <button
          onClick={() => onClose(index)}
          className="rounded-full p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close story mode"
        >
          <X size={20} />
        </button>
      </div>

      {/* Slide content — the padded wrapper itself counts as "outside" so
          clicks in the empty space around the image/text still close the
          view; only the tight image+text row below stops propagation. */}
      <div className="h-full w-full flex items-center justify-center px-5 md:px-16 pt-16 pb-28">
        <div
          key={period.name}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-5xl flex flex-col cursor-auto ${
            isLeft ? "md:flex-row" : "md:flex-row-reverse"
          } items-center gap-8 md:gap-14`}
        >
          <div
            className="w-full md:w-1/2 shrink-0"
            style={{
              animation: `${isLeft ? "storyImgFromLeft" : "storyImgFromRight"} 0.55s cubic-bezier(0.16,1,0.3,1) both`,
            }}
          >
            <div
              className="rounded-3xl overflow-hidden border"
              style={{
                borderColor: `${color}55`,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -20px ${color}55`,
              }}
            >
              <img
                src={sharpImg(curatedImg(period) ?? period.img, 1400)}
                alt={period.name}
                loading="eager"
                decoding="async"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                }}
                className="w-full h-64 md:h-[26rem] object-cover"
              />
            </div>
          </div>

          <div
            className="w-full md:w-1/2"
            style={{
              animation: `${isLeft ? "storyTextFromRight" : "storyTextFromLeft"} 0.55s cubic-bezier(0.16,1,0.3,1) both`,
              animationDelay: "0.08s",
            }}
          >
            {period.from_to && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full mb-3 inline-flex items-center gap-1.5"
                style={{ background: `${color}22`, color }}
              >
                <Calendar className="w-3 h-3" />
                {period.from_to}
              </span>
            )}
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {period.name}
            </h2>
            <p
              className="story-desc-scroll text-white/70 text-sm md:text-base leading-relaxed whitespace-pre-line max-h-[40vh] overflow-y-auto pr-3"
              style={{ "--story-accent": color } as CSSProperties}
            >
              {period.desc}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom-center navigation */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 cursor-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-5">
          <button
            onClick={() => go(-1)}
            className="rounded-full p-3 text-white/70 hover:text-white transition-all hover:scale-110"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
            aria-label="Previous period"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-1.5">
            {periods.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  background: i === index ? color : "rgba(255,255,255,0.2)",
                  animation: i === index ? "storyDotPop 0.35s ease-out" : undefined,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => go(1)}
            className="rounded-full p-3 text-white transition-all hover:scale-110"
            style={{
              background: color,
              boxShadow: `0 4px 20px -4px ${color}aa`,
            }}
            aria-label="Next period"
          >
            <ChevronDown size={20} className="animate-bounce" />
          </button>
        </div>
        <span className="text-white/35 text-xs tracking-wide">Next period</span>
      </div>
    </div>
  );
}

export function HistoricalPeriods() {
  const [data, setData] = useState<PeriodsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [storyOpen, setStoryOpen] = useState(false);
  const [storyStartIndex, setStoryStartIndex] = useState(0);

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

        <div className="mb-7 max-w-2xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
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

          <button
            onClick={() => {
              setStoryStartIndex(0);
              setStoryOpen(true);
            }}
            disabled={!data || filtered.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100 shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.08))",
              border: "1px solid rgba(212,175,55,0.4)",
              color: "#D4AF37",
            }}
          >
            <BookOpenText size={16} />
            Story Mode
          </button>
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
                  <div
                    key={period.name}
                    id={`period-row-${i}`}
                    className="relative flex items-start gap-0 md:gap-6 scroll-mt-24"
                  >
                    {/* Left side */}
                    <div className={`hidden md:flex flex-1 ${isLeft ? "justify-end pr-8" : "justify-end pr-8 invisible"}`}>
                      {isLeft && (
                        <PeriodCard
                          period={period}
                          color={color}
                          onOpenStory={() => {
                            setStoryStartIndex(i);
                            setStoryOpen(true);
                          }}
                        />
                      )}
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
                      {!isLeft && (
                        <PeriodCard
                          period={period}
                          color={color}
                          onOpenStory={() => {
                            setStoryStartIndex(i);
                            setStoryOpen(true);
                          }}
                        />
                      )}
                    </div>

                    {/* Mobile: full width */}
                    <div className="flex md:hidden w-full">
                      <PeriodCard
                        period={period}
                        color={color}
                        onOpenStory={() => {
                          setStoryStartIndex(i);
                          setStoryOpen(true);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {storyOpen && filtered.length > 0 && (
        <PeriodStoryView
          periods={filtered}
          startIndex={storyStartIndex}
          colorFor={(i) => COLOR_PALETTE[i % COLOR_PALETTE.length]}
          onClose={(closedAtIndex) => {
            setStoryOpen(false);
            const row = document.getElementById(`period-row-${closedAtIndex}`);
            row?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}
    </div>
  );
}