import { useState, useEffect, useRef } from "react";
import {
  Star,
  Heart,
  Search,
  MapPin,
  Loader2,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

// عنوان الـ Flask backend. في الإنتاج يتحط في .env كـ VITE_API_URL
const API_BASE = API_BASE_URL;

// الشكل اللي بيرجع من app/routes/hotels.py -> GET /api/hotels
interface ApiHotel {
  id: string;
  name: string;
  city: string;
  img: string;
  link: string;
  rating: number;         // من 10
  rating_label: string;   // Superb / Excellent / Good / Pleasant / Rated
  reviews: number;        // integer
  price_egp: number;
  price_usd: number;
}

// النوع اللي بيستخدمه الـ UI (بديل الـ HOTELS mock array القديم)
interface Hotel {
  id: string;
  name: string;
  location: string;
  ratingScore: number;
  ratingLabel: string;
  priceEgp: number;
  priceUsd: number;
  image: string;
  link: string;
  reviews: number;
}

function mapApiHotelToHotel(h: ApiHotel): Hotel {
  return {
    id: h.id,
    name: h.name,
    location: h.city || "Egypt",
    ratingScore: h.rating,
    ratingLabel: h.rating_label,
    priceEgp: h.price_egp,
    priceUsd: h.price_usd,
    image: h.img,
    link: h.link,
    reviews: Math.round(h.reviews),
  };
}

async function fetchHotels(params: {
  city?: string;
  search?: string;
  minRating?: number;
  maxPrice?: number;
}): Promise<Hotel[]> {
  const qs = new URLSearchParams();
  if (params.city && params.city !== "All Cities") qs.set("city", params.city);
  if (params.search) qs.set("search", params.search);
  if (params.minRating) qs.set("min_rating", String(params.minRating));
  if (params.maxPrice) qs.set("max_price", String(params.maxPrice));

  const res = await fetch(`${API_BASE}/api/hotels?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch hotels");
  const data = await res.json();
  return (data.results as ApiHotel[]).map(mapApiHotelToHotel);
}

async function fetchCities(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/hotels/cities`);
  if (!res.ok) throw new Error("Failed to fetch cities");
  const data = await res.json();
  return data.cities as string[];
}

// بديل StarRating: الداتا الحقيقية بترجع rating من 10 مش نجوم من 5،
// فبنعرضه كـ badge رقمي + label بدل النجوم الخماسية.
function RatingBadge({ score, label }: { score: number; label: string }) {
  if (!score) return null;
  return (
    <div className="flex items-center gap-1.5 bg-black/70 rounded-full px-2.5 py-1">
      <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
      <span className="text-white text-xs font-semibold">{score.toFixed(1)}</span>
      <span className="text-white/60 text-[10px]">{label}</span>
    </div>
  );
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  const [saved, setSaved] = useState(false);

  return (
    <a
      href={hotel.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl overflow-hidden bg-[#12142c] border border-white/10 group hover:border-[#D4AF37]/40 transition-all duration-300 hover:-translate-y-1"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={hotel.image}
          alt={hotel.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B1E]/80 via-transparent to-transparent" />
        <button
          onClick={(e) => {
            e.preventDefault();
            setSaved((s) => !s);
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center border border-white/10 hover:border-[#D4AF37]/60 transition-all"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${saved ? "fill-[#D4AF37] text-[#D4AF37]" : "text-white/70"}`}
          />
        </button>
        <div className="absolute bottom-3 left-3">
          <RatingBadge score={hotel.ratingScore} label={hotel.ratingLabel} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-white font-semibold text-sm leading-snug mb-1 line-clamp-2">
          {hotel.name}
        </h3>
        <div className="flex items-center gap-1 text-white/50 text-xs mb-3">
          <MapPin className="w-3 h-3" />
          <span>{hotel.location}, Egypt</span>
        </div>
        {hotel.reviews > 0 && (
          <p className="text-white/40 text-[11px] mb-3">
            💬 {hotel.reviews.toLocaleString()} reviews
          </p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/40 uppercase tracking-wide">Per night</span>
            {hotel.priceEgp > 0 ? (
              <div className="text-[#D4AF37] font-bold text-lg leading-tight">
                EGP {hotel.priceEgp.toLocaleString()}
                <span className="text-white/40 text-xs font-normal block">
                  ≈ ${hotel.priceUsd.toFixed(0)}
                </span>
              </div>
            ) : (
              <div className="text-[#D4AF37] font-bold text-lg leading-tight">Price N/A</div>
            )}
          </div>
          <span className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0A0B1E] transition-all group-hover:opacity-90" style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}>
            View Hotel →
          </span>
        </div>
      </div>
    </a>
  );
}

export function Hotels() {
  const [city, setCity] = useState("All Cities");
  const [cities, setCities] = useState<string[]>(["All Cities"]);
  const [searchInput, setSearchInput] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  // تحميل قائمة المدن مرة واحدة عند فتح الصفحة (زي cities_list في hotels.py)
  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => setCities(["All Cities"]));
  }, []);

  // إعادة تحميل الفنادق كلما اتغيّر أي فلتر (نفس فكرة renderCards() في الكود الأصلي،
  // بس دلوقتي الفلترة بتحصل في الـ backend مش في الفرونت).
  // مهم: لما بنعمل refetch بسبب فلتر جديد، بنسيب النتائج القديمة ظاهرة على الشاشة
  // (بدل ما نشيلها ونحط Loader مكانها) عشان ارتفاع الصفحة مايتغيّرش فجأة ويعمل
  // قفزة/تقطيع (lag) في الـ scroll أثناء الكتابة في مربع البحث.
  useEffect(() => {
    setError(null);
    if (hasLoadedOnce.current) {
      setRefreshing(true);
    }

    const timeout = setTimeout(() => {
      fetchHotels({ city, search: searchInput, minRating, maxPrice })
        .then((results) => {
          setHotels(results);
          hasLoadedOnce.current = true;
        })
        .catch(() => setError("تعذر تحميل بيانات الفنادق، حاول مرة أخرى."))
        .finally(() => {
          setInitialLoading(false);
          setRefreshing(false);
        });
    }, 300); // debounce بسيط لحقل البحث

    return () => clearTimeout(timeout);
  }, [city, searchInput, minRating, maxPrice]);

  return (
    <div className="min-h-screen" style={{ background: "#0A0B1E" }}>
      {/* Hero */}
      <div className="relative h-[480px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600"
          alt="Egypt luxury hotel"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(10,11,30,0.5) 0%, rgba(10,11,30,0.85) 70%, #0A0B1E 100%)" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="inline-flex items-center gap-2 text-[#D4AF37] text-sm font-medium mb-4 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            <Star className="w-3.5 h-3.5 fill-[#D4AF37]" />
            {hotels.length > 0 ? `${hotels.length} Curated Properties` : "Curated Properties"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 max-w-2xl leading-tight">
            Find Your Perfect Stay in Egypt
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-xl">
            From Nile-view palaces to Red Sea beach resorts — discover luxury at every price.
          </p>
          {/* Search bar - بس الحقول اللي فعلاً متوصلة بالـ backend */}
          <div className="w-full max-w-3xl bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col md:flex-row gap-2">
            <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by city or hotel name..."
                className="bg-transparent text-white text-sm w-full outline-none placeholder:text-white/40"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-transparent text-white text-sm w-full outline-none"
              >
                {cities.map((c) => (
                  <option key={c} value={c} style={{ background: "#12152B" }}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* فلاتر التقييم والسعر - مربوطة فعلياً بالـ backend */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <span className="text-white/50">⭐ Min Rating</span>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="bg-transparent outline-none text-white text-sm"
            >
              <option style={{ background: "#12152B" }} value={0}>All Ratings</option>
              <option style={{ background: "#12152B" }} value={9}>9+ Superb</option>
              <option style={{ background: "#12152B" }} value={8}>8+ Excellent</option>
              <option style={{ background: "#12152B" }} value={7}>7+ Good</option>
              <option style={{ background: "#12152B" }} value={6}>6+ Pleasant</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
            <span className="text-white/50">💰 Max Price</span>
            <select
              value={maxPrice ?? ""}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-transparent outline-none text-white text-sm"
            >
              <option style={{ background: "#12152B" }} value="">All Prices</option>
              <option style={{ background: "#12152B" }} value={2000}>Under 2,000 EGP</option>
              <option style={{ background: "#12152B" }} value={5000}>Under 5,000 EGP</option>
              <option style={{ background: "#12152B" }} value={10000}>Under 10,000 EGP</option>
              <option style={{ background: "#12152B" }} value={20000}>Under 20,000 EGP</option>
            </select>
          </div>
        </div>

        <p className="text-white/40 text-sm mb-6 flex items-center gap-2">
          {initialLoading
            ? "Loading hotels..."
            : `${hotels.length} properties found`}
          {refreshing && !initialLoading && (
            <Loader2 className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />
          )}
        </p>

        {/* حالات: تحميل أولي / خطأ / فارغ / عرض النتائج
            ملحوظة: بعد أول تحميل، أي refetch (فلتر جديد) بيسيب الكروت القديمة
            ظاهرة (مع خفة شفافية بسيطة) بدل ما يشيلها ويحط Loader مكانها،
            عشان كده الصفحة مابقتش "تقفز" أو تعمل lag في الـ scroll وانت بتفلتر. */}
        {initialLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          </div>
        )}

        {!initialLoading && error && hotels.length === 0 && (
          <div className="text-center py-24 text-white/50">{error}</div>
        )}

        {!initialLoading && !error && hotels.length === 0 && (
          <div className="text-center py-24 text-white/50">
            No hotels found matching your criteria.
          </div>
        )}

        {!initialLoading && hotels.length > 0 && (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-200 ${refreshing ? "opacity-60" : "opacity-100"}`}
          >
            {hotels.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
