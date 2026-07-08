import { Hotel, Plane, TrendingDown, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const priceHistory = [
  { date: "Mon", price: 420 },
  { date: "Tue", price: 385 },
  { date: "Wed", price: 450 },
  { date: "Thu", price: 395 },
  { date: "Fri", price: 520 },
  { date: "Sat", price: 480 },
  { date: "Sun", price: 410 },
];

const hotels = [
  {
    name: "Four Seasons Nile Plaza",
    location: "Cairo",
    rating: 4.8,
    price: 250,
    image: "https://images.unsplash.com/photo-1719601398909-9da7a2dc5d20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob3RlbCUyMGVneXB0JTIwbmlsZSUyMHZpZXd8ZW58MXx8fHwxNzc2MzQ3MzUyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["Pool", "Spa", "Nile View"],
  },
  {
    name: "Sofitel Luxor",
    location: "Luxor",
    rating: 4.7,
    price: 180,
    image: "https://images.unsplash.com/photo-1719601398909-9da7a2dc5d20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob3RlbCUyMGVneXB0JTIwbmlsZSUyMHZpZXd8ZW58MXx8fHwxNzc2MzQ3MzUyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["Pool", "Restaurant", "WiFi"],
  },
  {
    name: "Steigenberger Cecil",
    location: "Alexandria",
    rating: 4.5,
    price: 120,
    image: "https://images.unsplash.com/photo-1719601398909-9da7a2dc5d20?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob3RlbCUyMGVneXB0JTIwbmlsZSUyMHZpZXd8ZW58MXx8fHwxNzc2MzQ3MzUyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    amenities: ["Sea View", "Gym", "Parking"],
  },
];

const flights = [
  { from: "London", to: "Cairo", airline: "EgyptAir", price: 420, change: -8 },
  { from: "Paris", to: "Cairo", airline: "Air France", price: 385, change: 5 },
  { from: "Dubai", to: "Luxor", airline: "Emirates", price: 295, change: -12 },
  { from: "New York", to: "Cairo", airline: "Turkish Airlines", price: 650, change: 3 },
];

export function HotelsFlights() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Hotels & <span className="text-[#C9A84C]">Flights</span>
        </h1>
        <p className="text-sm md:text-base text-gray-400">Real-time prices and best deals for your Egypt trip</p>
      </div>

      {/* Price Trends */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg md:text-xl font-semibold">Flight Price Trends (USD)</h3>
          <div className="flex gap-2">
            <button className="px-3 md:px-4 py-1.5 md:py-2 bg-[#C9A84C]/20 text-[#C9A84C] rounded-lg text-xs md:text-sm font-medium">
              7 Days
            </button>
            <button className="px-3 md:px-4 py-1.5 md:py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs md:text-sm transition-colors">
              30 Days
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200} className="md:h-[250px]">
          <LineChart data={priceHistory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis dataKey="date" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0F0F1E",
                border: "1px solid #C9A84C40",
                borderRadius: "8px",
              }}
            />
            <Line type="monotone" dataKey="price" stroke="#C9A84C" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Flights */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <Plane className="text-[#C9A84C] w-5 h-5 md:w-6 md:h-6" />
            <span className="hidden sm:inline">Latest Flight Deals</span>
            <span className="sm:hidden">Flights</span>
          </h2>
          <button className="text-[#C9A84C] hover:underline text-xs md:text-sm">View All →</button>
        </div>

        <div className="grid gap-3 md:gap-4">
          {flights.map((flight, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-white/10 hover:border-[#C9A84C]/50 transition-all"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-6 flex-wrap">
                  <div className="text-center">
                    <p className="text-lg md:text-2xl font-bold">{flight.from}</p>
                    <p className="text-xs md:text-sm text-gray-400">Departure</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <Plane size={20} className="md:w-6 md:h-6 text-[#C9A84C] mb-1" />
                    <div className="w-16 md:w-24 h-0.5 bg-gradient-to-r from-[#C9A84C] to-transparent"></div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg md:text-2xl font-bold">{flight.to}</p>
                    <p className="text-xs md:text-sm text-gray-400">Arrival</p>
                  </div>
                  <div className="ml-0 sm:ml-8">
                    <p className="text-xs md:text-sm text-gray-400">Airline</p>
                    <p className="text-sm md:text-base font-semibold">{flight.airline}</p>
                  </div>
                </div>

                <div className="text-left sm:text-right w-full sm:w-auto">
                  <p className="text-2xl md:text-3xl font-bold text-[#C9A84C]">${flight.price}</p>
                  <div
                    className={`flex items-center gap-1 text-xs md:text-sm ${
                      flight.change < 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {flight.change < 0 ? (
                      <TrendingDown size={14} className="md:w-4 md:h-4" />
                    ) : (
                      <TrendingUp size={14} className="md:w-4 md:h-4" />
                    )}
                    {Math.abs(flight.change)}% this week
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hotels */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-2">
            <Hotel className="text-[#C9A84C] w-5 h-5 md:w-6 md:h-6" />
            <span className="hidden sm:inline">Recommended Hotels</span>
            <span className="sm:hidden">Hotels</span>
          </h2>
          <button className="text-[#C9A84C] hover:underline text-xs md:text-sm">View All →</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {hotels.map((hotel, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 hover:border-[#C9A84C]/50 transition-all group"
            >
              <div className="relative h-48 overflow-hidden">
                <ImageWithFallback
                  src={hotel.image}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute top-3 right-3 px-3 py-1 bg-[#C9A84C]/90 backdrop-blur-sm rounded-full text-sm font-medium text-[#1A1A2E]">
                  ⭐ {hotel.rating}
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-xl font-semibold mb-1 group-hover:text-[#C9A84C] transition-colors">
                  {hotel.name}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{hotel.location}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {hotel.amenities.map((amenity, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div>
                    <p className="text-sm text-gray-400">Per Night</p>
                    <p className="text-2xl font-bold text-[#C9A84C]">${hotel.price}</p>
                  </div>
                  <button className="px-4 py-2 bg-[#C9A84C] hover:bg-[#B8984A] text-[#1A1A2E] rounded-lg transition-colors text-sm font-medium">
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}