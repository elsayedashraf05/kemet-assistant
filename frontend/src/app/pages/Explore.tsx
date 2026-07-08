import { Search, MapPin, Clock, DollarSign, Star } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";

const monuments = [
  {
    name: "Pyramids of Giza",
    location: "Giza, Cairo",
    image: "https://images.unsplash.com/photo-1582729704907-f07a96126069?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxweXJhbWlkcyUyMGdpemElMjBlZ3lwdCUyMHNwaGlueHxlbnwxfHx8fDE3NzYzNDczMTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "Monument",
    price: { egp: 240, foreign: 540 },
    hours: "8:00 AM - 5:00 PM",
    rating: 4.9,
    description: "The last remaining wonder of the ancient world",
  },
  {
    name: "Luxor Temple",
    location: "Luxor",
    image: "https://images.unsplash.com/photo-1762530162773-c99f38d4d5d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXhvciUyMHRlbXBsZSUyMGVneXB0JTIwY29sdW1uc3xlbnwxfHx8fDE3NzYzNDczMTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "Temple",
    price: { egp: 160, foreign: 260 },
    hours: "6:00 AM - 9:00 PM",
    rating: 4.8,
    description: "Ancient temple dedicated to the Theban Triad",
  },
  {
    name: "Egyptian Museum",
    location: "Tahrir Square, Cairo",
    image: "https://images.unsplash.com/photo-1734266364930-27fc5f91819c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlZ3lwdGlhbiUyMG11c2V1bSUyMGNhaXJvJTIwYXJ0aWZhY3RzfGVufDF8fHx8MTc3NjM0NzMxMnww&ixlib=rb-4.1.0&q=80&w=1080",
    category: "Museum",
    price: { egp: 200, foreign: 450 },
    hours: "9:00 AM - 7:00 PM",
    rating: 4.7,
    description: "Home to the world's largest collection of pharaonic antiquities",
  },
  {
    name: "Abu Simbel Temples",
    location: "Aswan",
    image: "https://images.unsplash.com/photo-1710803622349-0a17829918c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnUlMjBzaW1iZWwlMjB0ZW1wbGVzJTIwZWd5cHR8ZW58MXx8fHwxNzc2MzQ3MzEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "Temple",
    price: { egp: 240, foreign: 380 },
    hours: "5:00 AM - 6:00 PM",
    rating: 4.9,
    description: "Massive rock temples built by Ramesses II",
  },
  {
    name: "Karnak Temple",
    location: "Luxor",
    image: "https://images.unsplash.com/photo-1662552445716-bb5cb3331239?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrYXJuYWslMjB0ZW1wbGUlMjBlZ3lwdCUyMGhpZXJvZ2x5cGhzfGVufDF8fHx8MTc3NjM0NzMxMnww&ixlib=rb-4.1.0&q=80&w=1080",
    category: "Temple",
    price: { egp: 220, foreign: 320 },
    hours: "6:00 AM - 5:30 PM",
    rating: 4.8,
    description: "The largest ancient religious site in the world",
  },
  {
    name: "Bibliotheca Alexandrina",
    location: "Alexandria",
    image: "https://images.unsplash.com/photo-1760973566831-4d029dc31c3e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGV4YW5kcmlhJTIwZWd5cHQlMjBtZWRpdGVycmFuZWFuJTIwY29hc3R8ZW58MXx8fHwxNzc2MjQ3NTEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "Museum",
    price: { egp: 30, foreign: 70 },
    hours: "10:00 AM - 7:00 PM",
    rating: 4.6,
    description: "Modern revival of the ancient Library of Alexandria",
  },
];

export function Explore() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Explore <span className="text-[#C9A84C]">Egypt</span>
        </h1>
        <p className="text-sm md:text-base text-gray-400">
          Discover 125+ monuments, 35 archaeological sites, and 25 museums across Egypt
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 md:p-6 border border-white/10">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search monuments, museums, or cities..."
              className="w-full pl-10 pr-4 py-2.5 md:py-3 text-sm md:text-base bg-white/10 border border-white/10 rounded-lg focus:outline-none focus:border-[#C9A84C] transition-colors"
            />
          </div>
          <select className="px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base bg-white/10 border border-white/10 rounded-lg focus:outline-none focus:border-[#C9A84C] transition-colors">
            <option>All Categories</option>
            <option>Monuments</option>
            <option>Museums</option>
            <option>Temples</option>
            <option>Archaeological Sites</option>
          </select>
          <select className="px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base bg-white/10 border border-white/10 rounded-lg focus:outline-none focus:border-[#C9A84C] transition-colors">
            <option>All Cities</option>
            <option>Cairo</option>
            <option>Luxor</option>
            <option>Aswan</option>
            <option>Alexandria</option>
          </select>
        </div>
      </div>

      {/* Monuments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {monuments.map((monument, index) => (
          <div
            key={index}
            className="bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10 hover:border-[#C9A84C]/50 transition-all group"
          >
            <div className="relative h-48 overflow-hidden">
              <ImageWithFallback
                src={monument.image}
                alt={monument.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
              <div className="absolute top-3 right-3 px-3 py-1 bg-[#C9A84C]/90 backdrop-blur-sm rounded-full text-xs md:text-sm font-medium text-[#1A1A2E]">
                {monument.category}
              </div>
            </div>

            <div className="p-4 md:p-5">
              <h3 className="text-lg md:text-xl font-semibold mb-2 group-hover:text-[#C9A84C] transition-colors">
                {monument.name}
              </h3>
              <p className="text-gray-400 text-sm mb-4">{monument.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <MapPin size={16} className="text-[#C9A84C]" />
                  {monument.location}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Clock size={16} className="text-[#C9A84C]" />
                  {monument.hours}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <DollarSign size={16} className="text-[#C9A84C]" />
                  EGP {monument.price.egp} / ${monument.price.foreign}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-[#F59E0B] fill-[#F59E0B]" />
                  <span className="font-semibold text-sm md:text-base">{monument.rating}</span>
                  <span className="text-xs md:text-sm text-gray-400">/5.0</span>
                </div>
                <button className="px-3 md:px-4 py-1.5 md:py-2 bg-[#C9A84C] hover:bg-[#B8984A] text-[#1A1A2E] rounded-lg transition-colors text-xs md:text-sm font-medium">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="text-center">
        <button className="px-5 md:px-6 py-2.5 md:py-3 text-sm md:text-base bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#C9A84C]/50 rounded-lg transition-all">
          Load More Destinations
        </button>
      </div>
    </div>
  );
}