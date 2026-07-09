import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock, Search, Landmark } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_URL = `${API_BASE_URL}/api/monuments`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600";

// Tracks how many columns the grid should have, matching the md/lg
// Tailwind breakpoints. We need this in JS (rather than pure CSS columns)
// so each column can be its own independent flex container — expanding
// one card then only pushes cards below it in the SAME column, instead of
// triggering a masonry rebalance that shuffles neighboring cards.
function useColumnCount() {
  const getCount = () => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w < 560) return 1;
    if (w < 900) return 2;
    if (w < 1300) return 3;
    return 4;
  };

  const [count, setCount] = useState(getCount);

  useEffect(() => {
    const onResize = () => setCount(getCount());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return count;
}

interface MonumentRecord {
  name: string;
  location: string;
  img: string;
  hours: string;
  desc: string;
  maps_url: string | null;
}

interface MonumentsResponse {
  locations: string[];
  monuments: MonumentRecord[];
}

// A single monument card. The description box has its own independent
// expand/collapse toggle, capped at 5 lines when collapsed — same
// interaction the price box used to have before the data source dropped
// ticket pricing in favor of a descriptive text field.
function MonumentCard({ monument }: { monument: MonumentRecord }) {
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden transition-transform hover:-translate-y-1"
      style={{
        background: "#161929",
        border: "1px solid #2c3248",
      }}
    >
      <div className="relative h-48">
        <img
          src={monument.img}
          alt={monument.name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
          className="w-full h-full object-cover"
        />
        {monument.hours !== "Not Available" && (
          <div
            className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
            style={{ background: "rgba(18,20,28,0.9)", color: "#fff" }}
          >
            <Clock className="w-3 h-3" />
            {monument.hours}
          </div>
        )}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
          style={{ background: "rgba(18,20,28,0.9)", color: "#dfb257" }}
        >
          <MapPin className="w-3 h-3" />
          {monument.location}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-3">{monument.name}</h3>

        {monument.desc && (
          <div className="mb-4">
            <div
              onClick={() => setDescExpanded((v) => !v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setDescExpanded((v) => !v);
              }}
              className={`rounded-xl p-3 text-xs leading-relaxed whitespace-pre-line cursor-pointer text-gray-300 ${
                descExpanded ? "" : "line-clamp-5"
              }`}
              style={{ background: "#1a1e30", border: "1px solid #2c3248" }}
            >
              {monument.desc}
            </div>
          </div>
        )}

        {monument.maps_url && (
          <a
            href={monument.maps_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #dfb257, #c9974a)",
              color: "#0f1120",
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

export function Monuments() {
  const [data, setData] = useState<MonumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState("All Locations");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMonuments() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const json: MonumentsResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load monuments.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMonuments();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.monuments.filter((m) => {
      const matchLoc = location === "All Locations" || m.location === location;
      const matchSearch = q === "" || m.location.toLowerCase().includes(q);
      return matchLoc && matchSearch;
    });
  }, [data, location, search]);

  const columnCount = useColumnCount();

  // Round-robin the filtered monuments into N independent columns. Each
  // column is rendered as its own vertical stack, so expanding a card only
  // grows ITS column (pushing down cards below it there) — it can never
  // move a card sideways into another column or resize unrelated columns.
  const columns = useMemo(() => {
    const cols: MonumentRecord[][] = Array.from({ length: columnCount }, () => []);
    filtered.forEach((monument, i) => {
      cols[i % columnCount].push(monument);
    });
    return cols;
  }, [filtered, columnCount]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0f1120" }}>
      {/* Hero */}
      <div className="relative h-[280px] overflow-hidden">
        <img
          src="https://commons.wikimedia.org/wiki/Special:FilePath/Giza%20pyramid%20complex%20from%20air%20(2928).jpg?width=1600"
          alt="Giza Pyramid Complex, Egypt"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
          }}
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(15,17,32,0.35) 0%, #0f1120 90%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div
            className="flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: "rgba(223,178,87,0.18)", color: "#dfb257" }}
          >
            <Landmark className="w-4 h-4" />
            Egypt's Monuments
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 max-w-2xl leading-tight">
            125+ Ancient Monuments &amp; Historical Sites
          </h1>
          <p className="text-gray-400 max-w-lg">
            Explore temples, tombs, and ruins across Egypt's governorates
          </p>
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-8 py-10">
        {/* Error state */}
        {error && (
          <div
            className="rounded-2xl p-6 mb-8 text-center"
            style={{
              background: "rgba(212,64,55,0.08)",
              border: "1px solid rgba(212,64,55,0.3)",
              color: "#f0a8a2",
            }}
          >
            Couldn't load monuments right now — {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 flex-wrap mb-7">
          <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
            <label className="text-white text-xs font-semibold">Search by Location</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a location name..."
                disabled={!data}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none"
                style={{ background: "#1a1e30", border: "1px solid #2c3248" }}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
            <label className="text-white text-xs font-semibold">Filter by Location</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!data}
              className="px-4 py-2.5 rounded-xl text-sm text-white focus:outline-none"
              style={{ background: "#1a1e30", border: "1px solid #2c3248" }}
            >
              {(data?.locations || ["All Locations"]).map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!loading && data && (
          <p className="text-gray-400 text-sm mb-5">
            Showing <span style={{ color: "#dfb257", fontWeight: 700 }}>{filtered.length}</span> monument
            {filtered.length !== 1 ? "s" : ""}
          </p>
        )}

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
                      style={{ background: "#161929", height: `${h * 4}px` }}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}

        {!loading && data && filtered.length === 0 && (
          <div className="text-center py-16 text-gray-500">No monuments found matching your criteria.</div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex gap-6 items-start">
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="flex-1 flex flex-col gap-6">
                {col.map((monument) => (
                  <MonumentCard key={monument.name} monument={monument} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
