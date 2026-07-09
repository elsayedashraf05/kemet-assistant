import { useEffect, useMemo, useState } from "react";
import {
  Moon,
  Sunrise,
  Sun,
  CloudSun,
  Sunset,
  MoonStar,
  Compass,
  MapPin,
  RefreshCw,
  ExternalLink,
  Landmark,
  ChevronDown,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const BASE_URL = API_BASE_URL;
const PRAYER_TIMES_URL = `${BASE_URL}/api/muslim/prayer-times`;
const PRAYER_TIMES_REFRESH_URL = `${BASE_URL}/api/muslim/prayer-times/refresh`;
const MOSQUES_URL = `${BASE_URL}/api/muslim/mosques`;
const PHRASES_URL = `${BASE_URL}/api/muslim/phrases`;

const FALLBACK_MOSQUE_IMG =
  "https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800";

const HERO_IMG =
  "https://commons.wikimedia.org/wiki/Special:FilePath/Cairo%20-%20Islamic%20district%20-%20Al%20Azhar%20Mosque%20and%20University%20front.JPG?width=1200";

type PrayerName = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
const PRAYER_ORDER: PrayerName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const PRAYER_ICONS: Record<PrayerName, React.ComponentType<{ size?: number; className?: string }>> = {
  Fajr: Moon,
  Sunrise: Sunrise,
  Dhuhr: Sun,
  Asr: CloudSun,
  Maghrib: Sunset,
  Isha: MoonStar,
};

interface PrayerTimesResponse {
  times: Record<string, Record<PrayerName, string>>;
  updatedAt: string;
}

interface Mosque {
  name: string;
  city: string;
  year: string;
  builder: string;
  style: string;
  desc: string;
  img: string;
  mapsLink: string;
}

interface Phrase {
  arabic: string;
  transliteration: string;
  meaning: string;
  occasion: string;
}

export function Muslim() {
  const [prayerData, setPrayerData] = useState<PrayerTimesResponse | null>(null);
  const [prayerError, setPrayerError] = useState<string | null>(null);
  const [prayerLoading, setPrayerLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [mosques, setMosques] = useState<Mosque[] | null>(null);
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);

  const [city, setCity] = useState("Alexandria");

  useEffect(() => {
    let cancelled = false;

    async function loadPrayerTimes() {
      setPrayerLoading(true);
      setPrayerError(null);
      try {
        const res = await fetch(PRAYER_TIMES_URL);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Request failed (${res.status})`);
        }
        const json: PrayerTimesResponse = await res.json();
        if (!cancelled) {
          setPrayerData(json);
          const cities = Object.keys(json.times);
          if (cities.length && !cities.includes(city)) setCity(cities[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setPrayerError(err instanceof Error ? err.message : "Failed to load prayer times.");
        }
      } finally {
        if (!cancelled) setPrayerLoading(false);
      }
    }

    loadPrayerTimes();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadReferenceData() {
      try {
        const [mosquesRes, phrasesRes] = await Promise.all([fetch(MOSQUES_URL), fetch(PHRASES_URL)]);
        if (mosquesRes.ok) {
          const json = await mosquesRes.json();
          if (!cancelled) setMosques(json.mosques);
        }
        if (phrasesRes.ok) {
          const json = await phrasesRes.json();
          if (!cancelled) setPhrases(json.phrases);
        }
      } catch {
        // Static reference data — a failed fetch just leaves those sections empty.
      }
    }

    loadReferenceData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setPrayerError(null);
    try {
      const res = await fetch(PRAYER_TIMES_REFRESH_URL, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const json: PrayerTimesResponse = await res.json();
      setPrayerData(json);
    } catch (err) {
      setPrayerError(err instanceof Error ? err.message : "Failed to refresh prayer times.");
    } finally {
      setRefreshing(false);
    }
  }

  const cities = useMemo(() => (prayerData ? Object.keys(prayerData.times) : []), [prayerData]);
  const selectedTimes = prayerData?.times[city];

  const updatedAtLabel = useMemo(() => {
    if (!prayerData?.updatedAt) return "";
    try {
      return new Date(prayerData.updatedAt).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      });
    } catch {
      return prayerData.updatedAt;
    }
  }, [prayerData]);

  return (
    <div className="min-h-screen bg-[#0A0B1E] text-white">
      {/* Hero */}
      <div className="relative overflow-hidden min-h-[280px] sm:min-h-[360px] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0B1E]/90 via-[#0A0B1E]/70 to-[#0A0B1E]" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 sm:py-20 text-center w-full">
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#D4AF37] text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            <MoonStar size={14} />
            Muslim Traveler's Guide
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            Islamic <span className="text-[#D4AF37]">Egypt</span>
          </h1>
          <p className="text-white/70 text-sm sm:text-lg max-w-2xl mx-auto">
            Prayer times, Qibla direction, historic mosques, and everyday Islamic phrases —
            everything a Muslim traveler needs in one place
          </p>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10 sm:space-y-12">
        {/* Qibla + Mosques near me */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          <a
            href="https://www.google.com/maps/search/mosque+near+me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 sm:gap-5 p-4 sm:p-6 rounded-2xl border border-[#D4AF37]/50 bg-gradient-to-br from-[#2a1a00] to-[#3d2800] hover:from-[#3d2800] hover:to-[#5a3c00] transition-all hover:-translate-y-0.5"
          >
            <div className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
              <MapPin size={22} className="text-[#D4AF37] sm:w-7 sm:h-7" />
            </div>
            <div>
              <p className="text-[#D4AF37] font-bold text-base sm:text-lg">Mosques Near Me</p>
              <p className="text-white/50 text-xs sm:text-sm">Opens Google Maps at your current location</p>
            </div>
          </a>
          <a
            href="https://qiblafinder.withgoogle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 sm:gap-5 p-4 sm:p-6 rounded-2xl border border-[#D4AF37]/50 bg-gradient-to-br from-[#2a1a00] to-[#3d2800] hover:from-[#3d2800] hover:to-[#5a3c00] transition-all hover:-translate-y-0.5"
          >
            <div className="shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center">
              <Compass size={22} className="text-[#D4AF37] sm:w-7 sm:h-7" />
            </div>
            <div>
              <p className="text-[#D4AF37] font-bold text-base sm:text-lg">Qibla Direction</p>
              <p className="text-white/50 text-xs sm:text-sm">Find the prayer direction from wherever you are</p>
            </div>
          </a>
        </div>

        {/* Prayer times */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Prayer <span className="text-[#D4AF37]">Times</span>
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {updatedAtLabel ? (
                  <>
                    Last updated: <span className="text-[#D4AF37]">{updatedAtLabel}</span> · Refreshes daily
                  </>
                ) : (
                  "Refreshes daily"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* City dropdown */}
              <div className="relative flex-1 sm:flex-none sm:min-w-[180px]">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!cities.length}
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
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:border-[#D4AF37]/50 text-white/70 hover:text-[#D4AF37] text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden xs:inline sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {prayerError && (
            <div className="rounded-2xl p-6 mb-5 text-center bg-red-500/10 border border-red-500/30 text-red-200">
              Couldn't load prayer times — {prayerError}
            </div>
          )}

          {prayerLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
              {PRAYER_ORDER.map((name) => {
                const Icon = PRAYER_ICONS[name];
                return (
                  <div
                    key={name}
                    className="rounded-2xl bg-[#171a2e] border border-white/10 p-4 text-center"
                  >
                    <Icon size={24} className="text-[#C9A84C] mx-auto mb-2" />
                    <p className="text-white/50 text-[11px] font-semibold tracking-widest uppercase mb-1">
                      {name}
                    </p>
                    <p className="text-[#D4AF37] text-base font-bold">
                      {selectedTimes?.[name] || "--:--"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* All-cities table */}
          {!prayerLoading && prayerData && (
            <div className="rounded-2xl bg-[#171a2e] border border-white/10 p-5 overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left text-white/50 text-[11px] font-semibold tracking-widest uppercase pb-3 pr-4">
                      City
                    </th>
                    {PRAYER_ORDER.map((name) => (
                      <th
                        key={name}
                        className="text-center text-white/50 text-[11px] font-semibold tracking-widest uppercase pb-3 px-3"
                      >
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(prayerData.times).map(([c, times]) => (
                    <tr key={c} className="border-t border-white/5 hover:bg-white/[0.03]">
                      <td className="py-3 pr-4 text-white font-medium text-sm">{c}</td>
                      {PRAYER_ORDER.map((name) => (
                        <td key={name} className="py-3 px-3 text-center text-[#D4AF37] text-sm font-semibold">
                          {times[name] || "--"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mosques of Egypt */}
        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-bold">
              Mosques of <span className="text-[#D4AF37]">Egypt</span>
            </h2>
            <p className="text-white/50 text-sm mt-1">
              Iconic mosques across Egypt — history, architecture, and where to find them
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {(mosques ?? Array.from({ length: 6 })).map((m, i) => (
              <div
                key={m ? (m as Mosque).name : i}
                className="rounded-2xl overflow-hidden bg-[#171a2e] border border-white/10 flex flex-col"
              >
                {!m ? (
                  <div className="h-44 bg-white/5 animate-pulse" />
                ) : (
                  <>
                    <div className="relative h-44">
                      <img
                        src={(m as Mosque).img}
                        alt={(m as Mosque).name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = FALLBACK_MOSQUE_IMG;
                        }}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B1E]/70 via-transparent to-transparent" />
                      <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/60 border border-white/20 text-white/90">
                        <MapPin size={12} />
                        {(m as Mosque).city}
                      </span>
                    </div>
                    <div className="flex flex-col flex-1 gap-2.5 p-5">
                      <h3 className="text-white font-bold text-lg leading-tight">{(m as Mosque).name}</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-[#D4AF37]">
                          {(m as Mosque).year}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-[#D4AF37]">
                          {(m as Mosque).style}
                        </span>
                      </div>
                      <p className="text-white/40 text-xs">{(m as Mosque).builder}</p>
                      <p className="text-white/50 text-xs leading-relaxed flex-1">{(m as Mosque).desc}</p>
                      <a
                        href={(m as Mosque).mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 mt-1 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] text-sm font-semibold hover:bg-[#D4AF37]/20 transition-colors"
                      >
                        <ExternalLink size={14} />
                        View on Google Maps
                      </a>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Islamic social phrases */}
        <div>
          <div className="flex items-center gap-2 mb-5">
            <Landmark size={20} className="text-[#D4AF37]" />
            <h2 className="text-2xl font-bold">Islamic Social Traditions</h2>
          </div>
          <div className="rounded-2xl bg-[#171a2e] border border-white/10 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(phrases ?? []).map((p) => (
                <div key={p.transliteration} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <p dir="rtl" className="text-[#D4AF37] text-lg font-bold text-right mb-1.5">
                    {p.arabic}
                  </p>
                  <p className="text-white text-sm font-semibold mb-1">{p.transliteration}</p>
                  <p className="text-white/50 text-xs">{p.meaning}</p>
                  <p className="text-emerald-400/80 text-[10px] font-bold tracking-widest uppercase mt-1.5">
                    {p.occasion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
