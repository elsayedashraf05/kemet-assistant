import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  MapPin,
  Star,
  Phone,
  Search,
  Loader2,
  Heart,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

// عنوان الـ Flask backend
const API_BASE = API_BASE_URL;

// -- الشكل اللي بيرجع من الـ backend (app/services/restaurants_service.py) --
interface ApiRestaurant {
  name: string;
  category: string | null;
  cuisine: string | null;
  rating: number | null; // من 5
  phone: string | null;
  governorate: string | null;
  photo_url: string;
  maps_url: string | null;
}

interface Restaurant {
  id: string;
  name: string;
  category: string | null;
  cuisine: string | null;
  rating: number | null;
  ratingLabel: string | null;
  phone: string | null;
  governorate: string | null;
  photo: string;
  mapsUrl: string | null;
}

// الداتا مفيهاش rating_label جاي من الباك، فبنحسبها هنا بناءً على مقياس من 5
// (لو الباك اند رجّع rating_label جاهزة في المستقبل، سيبها تستخدمها بدل الحساب ده)
function computeRatingLabel(rating: number | null): string | null {
  if (rating === null) return null;
  if (rating >= 4.5) return "Exceptional";
  if (rating >= 4.0) return "Excellent";
  if (rating >= 3.5) return "Very Good";
  if (rating >= 3.0) return "Good";
  return "Rated";
}

function mapApiRestaurantToRestaurant(r: ApiRestaurant, index: number): Restaurant {
  return {
    id: `${r.name}-${index}`,
    name: r.name,
    category: r.category,
    cuisine: r.cuisine,
    rating: r.rating,
    ratingLabel: computeRatingLabel(r.rating),
    phone: r.phone,
    governorate: r.governorate,
    photo: r.photo_url,
    mapsUrl: r.maps_url,
  };
}

async function fetchRestaurants(params: {
  governorate?: string;
  cuisine?: string;
  search?: string;
  minRating?: number;
}): Promise<Restaurant[]> {
  const qs = new URLSearchParams();
  if (params.governorate && params.governorate !== "All Governorates") qs.set("governorate", params.governorate);
  if (params.cuisine && params.cuisine !== "All Cuisines") qs.set("cuisine", params.cuisine);
  if (params.search) qs.set("search", params.search);
  if (params.minRating) qs.set("min_rating", String(params.minRating));

  const res = await fetch(`${API_BASE}/api/restaurants?${qs.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch restaurants.");
  const data = await res.json();
  return (data.results as ApiRestaurant[]).map(mapApiRestaurantToRestaurant);
}

async function fetchGovernorates(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/restaurants/governorates`);
  if (!res.ok) return ["All Governorates"];
  const data = await res.json();
  return data.governorates as string[];
}

async function fetchCuisines(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/restaurants/cuisines`);
  if (!res.ok) return ["All Cuisines"];
  const data = await res.json();
  return data.cuisines as string[];
}

// بديل RatingBadge بتاع الفنادق، بنفس الشكل بالظبط
// ملحوظة: backdrop-blur اتشالت من هنا (وبقية عناصر الكارت) لأنها كانت بتتكرر
// على كل مطعم في الليستة، وده اللي كان بيعمل lag في الـ scroll.
function RatingBadge({ score, label }: { score: number; label: string | null }) {
  if (!score) return null;
  return (
    <div className="flex items-center gap-1.5 bg-black/70 rounded-full px-2.5 py-1">
      <Star className="w-3.5 h-3.5 fill-[#D4AF37] text-[#D4AF37]" />
      <span className="text-white text-xs font-semibold">{score.toFixed(1)}</span>
      {label && <span className="text-white/60 text-[10px]">{label}</span>}
    </div>
  );
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  const [saved, setSaved] = useState(false);
  const primaryHref = restaurant.mapsUrl || (restaurant.phone ? `tel:${restaurant.phone.replace(/\s+/g, "")}` : undefined);

  const CardInner = (
    <>
      <div className="relative h-52 overflow-hidden">
        <img
          src={restaurant.photo}
          alt={restaurant.name}
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

        {restaurant.cuisine && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-black/70 rounded-full text-white text-xs font-medium border border-white/10">
            {restaurant.cuisine}
          </div>
        )}

        {restaurant.rating !== null && (
          <div className="absolute bottom-3 left-3">
            <RatingBadge score={restaurant.rating} label={restaurant.ratingLabel} />
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-white font-semibold text-sm leading-snug mb-1 line-clamp-2">
          {restaurant.name}
        </h3>

        <div className="flex items-center gap-2 text-white/50 text-xs mb-3">
          {restaurant.category && <span className="line-clamp-1">{restaurant.category}</span>}
          {restaurant.governorate && (
            <span className="flex items-center gap-1 shrink-0">
              <MapPin className="w-3 h-3" />
              {restaurant.governorate}
            </span>
          )}
        </div>

        {restaurant.phone && (
          <div className="flex items-center gap-1 text-white/40 text-[11px] mb-3">
            <Phone className="w-3 h-3 flex-shrink-0" />
            {restaurant.phone}
          </div>
        )}

        {(restaurant.mapsUrl || restaurant.phone) && (
          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            {restaurant.mapsUrl && (
              <a
                href={restaurant.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#0A0B1E] transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #D4AF37, #C9A84C)" }}
              >
                <MapPin className="w-3.5 h-3.5" />
                Directions
              </a>
            )}
            {restaurant.phone && (
              <a
                href={`tel:${restaurant.phone.replace(/\s+/g, "")}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-xs font-semibold text-white/80"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            )}
          </div>
        )}
      </div>
    </>
  );

  // زي الفنادق: الكارت كله clickable لو فيه رابط أساسي (خرايط أو تليفون)
  if (primaryHref) {
    return (
      <a
        href={primaryHref}
        target={restaurant.mapsUrl ? "_blank" : undefined}
        rel={restaurant.mapsUrl ? "noopener noreferrer" : undefined}
        className="block rounded-2xl overflow-hidden bg-[#12142c] border border-white/10 group hover:border-[#D4AF37]/40 transition-all duration-300 hover:-translate-y-1"
      >
        {CardInner}
      </a>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-[#12142c] border border-white/10 group">
      {CardInner}
    </div>
  );
}

type SortOption = "popularity" | "rating_desc" | "rating_asc" | "name";

export function Restaurants() {
  const [governorates, setGovernorates] = useState<string[]>(["All Governorates"]);
  const [cuisines, setCuisines] = useState<string[]>(["All Cuisines"]);
  const [governorate, setGovernorate] = useState("All Governorates");
  const [cuisine, setCuisine] = useState("All Cuisines");
  const [search, setSearch] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState<SortOption>("popularity");

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    fetchGovernorates().then(setGovernorates).catch(() => setGovernorates(["All Governorates"]));
    fetchCuisines().then(setCuisines).catch(() => setCuisines(["All Cuisines"]));
  }, []);

  // زي الفنادق بالظبط: بعد أول تحميل، أي refetch بسبب فلتر جديد بيسيب
  // النتائج القديمة ظاهرة (مش بيشيلها ويحط Loader مكانها) عشان الصفحة
  // مايتغيّرش ارتفاعها فجأة ويعمل قفزة/lag في الـ scroll.
  useEffect(() => {
    setError(null);
    if (hasLoadedOnce) {
      setRefreshing(true);
    }
    const timeout = setTimeout(() => {
      fetchRestaurants({ governorate, cuisine, search, minRating })
        .then((results) => {
          setRestaurants(results);
          setHasLoadedOnce(true);
        })
        .catch(() => setError("Couldn't load restaurants. Please try again."))
        .finally(() => {
          setInitialLoading(false);
          setRefreshing(false);
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [governorate, cuisine, search, minRating]);

  // ترتيب على الفرونت بس (الباك اند مبيعملش sort حالياً)
  const sortedRestaurants = [...restaurants].sort((a, b) => {
    if (sort === "rating_desc") return (b.rating ?? -1) - (a.rating ?? -1);
    if (sort === "rating_asc") return (a.rating ?? 99) - (b.rating ?? 99);
    if (sort === "name") return a.name.localeCompare(b.name);
    return 0; // popularity = ترتيب الباك اند الأصلي
  });

  return (
    <div className="min-h-screen" style={{ background: "#0A0B1E" }}>
      {/* Hero — نفس ستايل الفنادق بالظبط */}
      <div className="relative h-[480px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600"
          alt="Fine dining in Egypt"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(10,11,30,0.5) 0%, rgba(10,11,30,0.85) 70%, #0A0B1E 100%)",
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <div className="inline-flex items-center gap-2 text-[#D4AF37] text-sm font-medium mb-4 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-full px-4 py-1.5">
            <Star className="w-3.5 h-3.5 fill-[#D4AF37]" />
            {restaurants.length > 0 ? `${restaurants.length} Certified Venues` : "Certified Venues"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 max-w-2xl leading-tight">
            Egypt's Finest Dining Experiences
          </h1>
          <p className="text-white/60 text-lg mb-8 max-w-xl">
            Discover top-rated restaurants across Egypt — from iconic street food to luxury hotel dining.
          </p>

          {/* Search bar - العنصر الوحيد المسموح فيه backdrop-blur لأنه مش بيتكرر */}
          <div className="w-full max-w-3xl bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 flex flex-col md:flex-row gap-2">
            <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by restaurant name..."
                className="bg-transparent text-white text-sm w-full outline-none placeholder:text-white/40"
              />
            </div>
            <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <select
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                className="bg-transparent text-white text-sm w-full outline-none"
              >
                {governorates.map((g) => (
                  <option key={g} value={g} style={{ background: "#12152B" }}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <UtensilsCrossed className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <select
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="bg-transparent text-white text-sm w-full outline-none"
              >
                {cuisines.map((c) => (
                  <option key={c} value={c} style={{ background: "#12152B" }}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* فلاتر التقييم والترتيب - بنفس شكل الفنادق */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm">
              <span className="text-white/50">⭐ Min Rating</span>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="bg-transparent outline-none text-white text-sm"
              >
                <option style={{ background: "#12152B" }} value={0}>All Ratings</option>
                <option style={{ background: "#12152B" }} value={4.5}>4.5+ Exceptional</option>
                <option style={{ background: "#12152B" }} value={4}>4+ Excellent</option>
                <option style={{ background: "#12152B" }} value={3.5}>3.5+ Very Good</option>
                <option style={{ background: "#12152B" }} value={3}>3+ Good</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60">
              <ArrowUpDown className="w-4 h-4" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="bg-transparent outline-none text-white/60 text-sm"
              >
                <option style={{ background: "#12152B" }} value="popularity">Sort: Popularity</option>
                <option style={{ background: "#12152B" }} value="rating_desc">Rating: High–Low</option>
                <option style={{ background: "#12152B" }} value="rating_asc">Rating: Low–High</option>
                <option style={{ background: "#12152B" }} value="name">Name: A–Z</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        <p className="text-white/40 text-sm mb-6 flex items-center gap-2">
          {initialLoading
            ? "Loading restaurants..."
            : `${sortedRestaurants.length} restaurants found`}
          {refreshing && !initialLoading && (
            <Loader2 className="w-3.5 h-3.5 text-[#D4AF37] animate-spin" />
          )}
        </p>

        {initialLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
          </div>
        )}

        {!initialLoading && error && restaurants.length === 0 && (
          <div className="text-center py-24 text-white/50">{error}</div>
        )}

        {!initialLoading && !error && sortedRestaurants.length === 0 && (
          <div className="text-center py-24 text-white/50">
            No restaurants found matching your criteria.
          </div>
        )}

        {!initialLoading && sortedRestaurants.length > 0 && (
          <div
            className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-200 ${refreshing ? "opacity-60" : "opacity-100"}`}
          >
            {sortedRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
