import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Clock } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_URL = `${API_BASE_URL}/api/sites`;

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=600";

// Tracks how many columns the "All Sites" grid should have, matching the
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

// NOTE: the backend's data source no longer has any ticket-price column at
// all (see sites_service.py), so SiteRecord has no price/prices field
// anymore — there's simply nothing to show.
interface SiteRecord {
  name: string;
  location: string;
  desc: string;
  full_desc: string;
  img: string;
  hours: string;
  maps_url: string | null;
}

interface SitesResponse {
  locations: string[];
  sites: SiteRecord[];
}

// A single site card in the "All Sites" masonry grid. Description shows
// 2 lines by default; clicking the card expands it in place to show the
// full description (and collapses again on a second click).
function SiteCard({ site }: { site: SiteRecord }) {
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
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="relative h-48">
        <img
          src={site.img}
          alt={site.name}
          loading="lazy"
          decoding="async"
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
          {site.location}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-2">{site.name}</h3>
        <p
          className={`text-gray-400 text-sm leading-relaxed mb-4 whitespace-pre-line ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
          {site.full_desc || site.desc}
        </p>

        <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
          <Clock className="w-3 h-3" />
          {site.hours}
        </div>

        {site.maps_url && (
          <a
            href={site.maps_url}
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

export function AncientSites() {
  const [data, setData] = useState<SitesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState("All Locations");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSites() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(API_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const json: SitesResponse = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load sites.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSites();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    return data.sites.filter((s) => {
      const matchLoc = location === "All Locations" || s.location === location;
      const matchName = s.name.toLowerCase().includes(q);
      return matchLoc && matchName;
    });
  }, [data, location, search]);

  const columnCount = useColumnCount();

  // Round-robin the filtered sites into N independent columns. Each column
  // is rendered as its own vertical stack, so expanding a card only grows
  // ITS column (pushing down cards below it there) — it can never move a
  // card sideways into another column or resize unrelated columns.
  const columns = useMemo(() => {
    const cols: SiteRecord[][] = Array.from({ length: columnCount }, () => []);
    filtered.forEach((site, i) => {
      cols[i % columnCount].push(site);
    });
    return cols;
  }, [filtered, columnCount]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A0B1E" }}>
      {/* Hero */}
      <div className="relative h-[480px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=1600"
          alt="Ancient Egypt"
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
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#D4AF37" }}>
            Discover
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 max-w-2xl leading-tight">
            Explore Ancient Egypt's Sacred Sites
          </h1>
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search sites, locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!data}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-gray-400 outline-none"
              style={{
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            />
          </div>
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
            Couldn't load sites right now — {error}
          </div>
        )}

        {/* All sites */}
        <div>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-2xl font-bold text-white">
              All Sites
              {data && (
                <span className="text-base font-normal text-gray-400 ml-3">
                  ({filtered.length} results)
                </span>
              )}
            </h2>

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
            <div className="text-center py-16 text-gray-500">No sites found.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex gap-6 items-start">
              {columns.map((col, colIdx) => (
                <div key={colIdx} className="flex-1 flex flex-col gap-6">
                  {col.map((site) => (
                    <SiteCard key={site.name} site={site} />
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
