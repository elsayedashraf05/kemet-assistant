import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Star,
  MapPin,
  ExternalLink,
  Loader2,
  Waves,
  ChevronDown,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const API_BASE = `${API_BASE_URL}/api/beaches`;

interface Beach {
  id: string;
  name: string;
  government: string;
  rating: number;
  photo_url: string;
  maps_url: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          fill={s <= Math.round(rating) ? "#D4AF37" : "none"}
          style={{ color: "#D4AF37" }}
        />
      ))}
      <span className="ml-1 text-xs text-white/50">{rating.toFixed(1)}</span>
    </div>
  );
}

function GovernmentDropdown({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="relative w-full sm:w-56" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 pl-3.5 pr-3 py-2.5 rounded-xl text-sm text-white outline-none border transition-colors"
        style={{
          background: "rgba(255,255,255,0.05)",
          borderColor: open ? "rgba(212,175,55,0.5)" : "rgba(255,255,255,0.1)",
        }}
      >
        <span className="flex items-center gap-2 truncate">
          <MapPin size={14} className="text-white/30 shrink-0" />
          <span className={value === "All" ? "text-white/50" : ""}>{value}</span>
        </span>
        <ChevronDown
          size={15}
          className="text-white/30 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute z-20 mt-1.5 w-full rounded-xl border overflow-hidden max-h-64 overflow-y-auto"
          style={{
            background: "#12132a",
            borderColor: "rgba(255,255,255,0.1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 text-sm transition-colors"
              style={
                value === opt
                  ? { background: "rgba(212,175,55,0.15)", color: "#D4AF37" }
                  : { color: "rgba(255,255,255,0.7)" }
              }
              onMouseEnter={(e) => {
                if (value !== opt) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                if (value !== opt) e.currentTarget.style.background = "transparent";
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BeachCard({ beach }: { beach: Beach }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden group hover:border-yellow-500/30 transition-colors"
      style={{
        background: "rgba(255,255,255,0.06)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={beach.photo_url}
          alt={beach.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(10,11,30,0.75) 0%, transparent 55%)" }}
        />
        {beach.government && (
          <div className="absolute bottom-3 left-3">
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(6,182,212,0.8)", color: "white" }}
            >
              <MapPin size={11} />
              {beach.government}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-bold text-white text-base leading-tight">{beach.name}</h3>
          <Stars rating={beach.rating} />
        </div>

        <a
          href={beach.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
          style={{
            background: "rgba(212,175,55,0.15)",
            color: "#D4AF37",
            border: "1px solid rgba(212,175,55,0.3)",
          }}
        >
          View on Maps
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

export function Beaches() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeGovernment, setActiveGovernment] = useState("All");
  const [governments, setGovernments] = useState<string[]>(["All"]);
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // debounce the search box so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // load the government list once, for the filter chips
  useEffect(() => {
    fetch(`${API_BASE}/governments`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.success) setGovernments(json.data);
      })
      .catch((err) => {
        // filter chips just fall back to ["All"], but log why for debugging
        console.warn("Could not load governments:", err);
      });
  }, []);

  // load beaches whenever search or filter changes
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (activeGovernment !== "All") params.set("government", activeGovernment);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`${API_BASE}?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${res.url}`);
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          setBeaches(json.data);
        } else {
          setError(json.error || "Could not load beaches.");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Beaches fetch failed:", err);
          setError(
            `Could not reach the beaches service (${err.message}). ` +
              `Check that the Flask backend is running and that VITE_API_BASE_URL / the dev proxy points to it.`
          );
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [activeGovernment, debouncedSearch]);

  const filterTags = useMemo(() => governments, [governments]);

  return (
    <div className="min-h-screen" style={{ background: "#0A0B1E" }}>
      {/* Hero — faded edge so the photo dissolves into the page instead of cutting off */}
      <div className="relative h-80 md:h-96 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600"
          alt="Egypt beach"
          className="w-full h-full object-cover animate-[fadeIn_1.2s_ease-out]"
          style={{
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,11,30,0.35) 0%, rgba(10,11,30,0.6) 55%, #0A0B1E 100%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <Waves className="mb-3 opacity-80" size={36} style={{ color: "#D4AF37" }} />
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-3">
            Egypt's Paradise Beaches
          </h1>
          <p className="text-lg text-blue-100/70 max-w-xl">
            World-class diving in the Red Sea, turquoise Mediterranean shores, and the legendary Gulf
            of Aqaba — Egypt's coastline is a paradise.
          </p>
        </div>
      </div>

      {/* Search + Filters + Grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:border-yellow-500/50 border transition-colors"
              style={{
                background: "rgba(255,255,255,0.05)",
                borderColor: "rgba(255,255,255,0.1)",
              }}
              placeholder="Search beaches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <GovernmentDropdown
            options={filterTags}
            value={activeGovernment}
            onChange={setActiveGovernment}
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-white/40">
            <Loader2 size={18} className="animate-spin" />
            Loading beaches...
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16 text-red-400/80">{error}</div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {beaches.map((beach) => (
              <BeachCard key={beach.id} beach={beach} />
            ))}
            {beaches.length === 0 && (
              <div className="col-span-full text-center py-16 text-white/40">
                No beaches match your search.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
