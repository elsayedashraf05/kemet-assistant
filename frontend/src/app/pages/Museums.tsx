import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Clock,
  Ticket,
  ChevronRight,
  Award,
  Search,
  Landmark,
  ExternalLink,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_URL = `${API_BASE_URL}/api/museums`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1600577916048-804c9191e36c?w=600";

// Tracks how many columns the "All Museums" grid should have, matching the
// md/lg Tailwind breakpoints. We need this in JS (rather than pure CSS
// columns) so each column can be its own independent flex container —
// expanding one card then only pushes cards below it in the SAME column,
// instead of triggering a masonry rebalance that shuffles neighboring cards.
function useColumnCount() {
  const getCount = () => {
    if (typeof window === "undefined") return 3;
    const w = window.innerWidth;
    if (w < 768) return 1;
    if (w < 1024) return 2;
    return 3;
  };

  const [count, setCount] = useState(getCount);

  useEffect(() => {
    const onResize = () => setCount(getCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return count;
}

interface MuseumRecord {
  name: string;
  location: string;
  desc: string;
  img: string;
  hours: string;
  maps_url: string | null;
}

interface FeaturedMuseum {
  name: string;
  subtitle: string;
  location: string;
  images: string[];
  description: string;
  hours: string;
  booking_note: string;
  prices: { label: string; value: string }[];
  booking_url: string;
  maps_url: string;
  price_note: string;
}

interface MuseumsResponse {
  featured: FeaturedMuseum;
  locations: string[];
  museums: MuseumRecord[];
}

function FeaturedCarousel({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);

  return (
    <div className="lg:w-5/12 h-72 lg:h-[560px] relative bg-black flex-shrink-0">
      <img
        src={images[idx] || FALLBACK_IMG}
        alt={name}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
        }}
        className="w-full h-full object-cover transition-opacity"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{
              background: "rgba(15,17,32,0.65)",
              color: "#D4AF37",
              border: "1px solid rgba(212,175,55,0.4)",
            }}
          >
            ‹
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-lg"
            style={{
              background: "rgba(15,17,32,0.65)",
              color: "#D4AF37",
              border: "1px solid rgba(212,175,55,0.4)",
            }}
          >
            ›
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => setIdx(i)}
                className="w-1.5 h-1.5 rounded-full transition-transform"
                style={{
                  background: i === idx ? "#D4AF37" : "rgba(255,255,255,0.4)",
                  transform: i === idx ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// A single museum card. Clicking the card expands the description in
// place to show the full text (and collapses again on a second click).
function MuseumCard({ museum }: { museum: MuseumRecord }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
      }}
      className="rounded-2xl overflow-hidden transition-transform hover:-translate-y-1 cursor-pointer"
      style={{
        background: "#14172b",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="relative h-48">
        <img
          src={museum.img}
          alt={museum.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
          style={{ background: "rgba(18,20,28,0.85)", color: "#fff" }}
        >
          <MapPin className="w-3 h-3" />
          {museum.location}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-2">{museum.name}</h3>
        <p
          className={`text-gray-400 text-sm leading-relaxed mb-4 whitespace-pre-line ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
          {museum.desc}
        </p>

        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <Clock className="w-3 h-3" />
          {museum.hours}
        </div>

        {museum.maps_url && (
          <a
            href={museum.maps_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #D4AF37, #C9A84C)",
              color: "#0A0B1E",
            }}
          >
            <MapPin className="w-4 h-4" />
            Directions
          </a>
        )}
      </div>
    </div>
  );
}

export function Museums() {
  const [data, setData] = useState<MuseumsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState("All Locations");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMuseums() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const json: MuseumsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load museums.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMuseums();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.museums.filter((m) => {
      const matchLoc = location === "All Locations" || m.location === location;
      const matchName = m.name.toLowerCase().includes(q);
      return matchLoc && matchName;
    });
  }, [data, location, search]);

  const columnCount = useColumnCount();

  // Round-robin the filtered museums into N independent columns. Each
  // column is rendered as its own vertical stack, so expanding a card only
  // grows ITS column (pushing down cards below it there) — it can never
  // move a card sideways into another column or resize unrelated columns.
  const columns = useMemo(() => {
    const cols: MuseumRecord[][] = Array.from({ length: columnCount }, () => []);
    filtered.forEach((museum, i) => {
      cols[i % columnCount].push(museum);
    });
    return cols;
  }, [filtered, columnCount]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0B1E" }}>
      {/* Hero */}
      <div className="relative h-[440px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1560969184-10fe8719e047?w=1600"
          alt="Egypt Museums"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,11,30,0.25) 0%, rgba(10,11,30,0.7) 65%, #0A0B1E 100%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div
            className="flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: "rgba(212,175,55,0.18)", color: "#D4AF37" }}
          >
            <Landmark className="w-4 h-4" />
            Cultural Heritage
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 max-w-2xl leading-tight">
            Egypt's World-Class Museums
          </h1>
          <p className="text-gray-300 max-w-xl text-lg">
            Explore institutions safeguarding five millennia of human civilisation
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-14">
        {/* Error state */}
        {error && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "rgba(212,64,55,0.08)",
              border: "1px solid rgba(212,64,55,0.3)",
              color: "#f0a8a2",
            }}
          >
            Couldn't load museums right now — {error}
          </div>
        )}

        {/* Featured Museum — GEM (static content, comes from the API's `featured` block) */}
        {data && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Award className="w-5 h-5" style={{ color: "#D4AF37" }} />
              <h2 className="text-2xl font-bold text-white">Featured Museum</h2>
            </div>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="lg:flex lg:items-stretch">
                <FeaturedCarousel images={data.featured.images} name={data.featured.name} />
                <div className="lg:w-7/12 p-8 lg:h-[560px] lg:overflow-y-auto">
                  <div
                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
                    style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37" }}
                  >
                    Must-Visit
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-1">
                    {data.featured.name}{" "}
                    <span className="text-gray-400 text-lg font-semibold">
                      ({data.featured.subtitle})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{data.featured.location}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed mb-6">
                    {data.featured.description}
                  </p>

                  <div className="flex flex-col gap-2 mb-6 text-sm text-gray-400">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{data.featured.hours}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Ticket className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{data.featured.booking_note}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {data.featured.prices.map((p) => (
                      <div
                        key={p.label}
                        className="rounded-xl p-3 text-center"
                        style={{
                          background: "rgba(212,175,55,0.08)",
                          border: "1px solid rgba(212,175,55,0.2)",
                        }}
                      >
                        <div className="text-xs text-gray-400 mb-1">{p.label}</div>
                        <div className="text-sm font-bold" style={{ color: "#D4AF37" }}>
                          {p.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    <a
                      href={data.featured.booking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold transition-opacity hover:opacity-90"
                      style={{
                        background: "linear-gradient(135deg, #D4AF37, #C9A84C)",
                        color: "#0A0B1E",
                      }}
                    >
                      Official Booking Site
                      <ChevronRight className="w-4 h-4" />
                    </a>
                    <a
                      href={data.featured.maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold transition-opacity hover:opacity-90"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                      }}
                    >
                      View on Google Maps
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {data.featured.price_note}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All museums */}
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-2xl font-bold text-white">All Museums</h2>

            <div className="flex gap-3 flex-wrap">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={!data}
                className="px-4 py-2 rounded-xl text-sm text-white focus:outline-none"
                style={{ background: "#1a1e30", border: "1px solid #2c3248" }}
              >
                {(data?.locations || ["All Locations"]).map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search museum by name..."
                  disabled={!data}
                  className="pl-9 pr-4 py-2 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
                  style={{ background: "#1a1e30", border: "1px solid #2c3248" }}
                />
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex gap-6 items-start">
              {Array.from({ length: columnCount }, (_, colIdx) => (
                <div key={colIdx} className="flex-1 flex flex-col gap-6">
                  {[72, 88, 64, 96, 76, 84]
                    .filter((_, i) => i % columnCount === colIdx)
                    .map((h, i) => (
                      <div
                        key={i}
                        className="rounded-2xl animate-pulse"
                        style={{ background: "rgba(255,255,255,0.04)", height: `${h * 4}px` }}
                      />
                    ))}
                </div>
              ))}
            </div>
          )}

          {!loading && data && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-500">No museums found.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex gap-6 items-start">
              {columns.map((col, colIdx) => (
                <div key={colIdx} className="flex-1 flex flex-col gap-6">
                  {col.map((museum) => (
                    <MuseumCard key={museum.name} museum={museum} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
