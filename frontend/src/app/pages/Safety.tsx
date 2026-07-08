import { Shield, AlertTriangle, CheckCircle, Phone } from "lucide-react";

const cities = [
  { name: "Cairo", safety: 75, status: "Safe", incidents: 12, trend: "improving" },
  { name: "Alexandria", safety: 82, status: "Very Safe", incidents: 5, trend: "stable" },
  { name: "Luxor", safety: 88, status: "Very Safe", incidents: 3, trend: "stable" },
  { name: "Aswan", safety: 90, status: "Very Safe", incidents: 2, trend: "improving" },
  { name: "Hurghada", safety: 85, status: "Very Safe", incidents: 4, trend: "stable" },
  { name: "Sharm El-Sheikh", safety: 87, status: "Very Safe", incidents: 3, trend: "improving" },
];

const emergencyContacts = [
  { service: "Police", number: "122", icon: Shield },
  { service: "Ambulance", number: "123", icon: AlertTriangle },
  { service: "Tourist Police", number: "126", icon: CheckCircle },
  { service: "Fire Department", number: "180", icon: AlertTriangle },
];

const safetyTips = [
  "Always carry a copy of your passport",
  "Use official taxis or ride-hailing apps",
  "Dress modestly when visiting religious sites",
  "Stay hydrated, especially during summer months",
  "Keep valuables in hotel safe",
  "Learn basic Arabic phrases",
  "Avoid political demonstrations",
  "Use the tourist police for assistance",
];

export function Safety() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Safety <span className="text-[#C9A84C]">Dashboard</span>
        </h1>
        <p className="text-sm md:text-base text-gray-400">Real-time safety information and emergency contacts for tourists</p>
      </div>

      {/* Emergency Contacts */}
      <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl p-4 md:p-6 border border-red-500/30">
        <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2">
          <Phone className="text-red-400 w-5 h-5 md:w-6 md:h-6" />
          Emergency Contacts
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {emergencyContacts.map((contact, index) => {
            const Icon = contact.icon;
            return (
              <div
                key={index}
                className="bg-[#1A1A2E]/50 backdrop-blur-sm rounded-lg p-4 text-center border border-white/10"
              >
                <Icon size={32} className="mx-auto mb-2 text-[#C9A84C]" />
                <p className="text-sm text-gray-400 mb-1">{contact.service}</p>
                <p className="text-2xl font-bold text-white">{contact.number}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Scores by City */}
      <div>
        <h2 className="text-xl md:text-2xl font-semibold mb-4">Safety Ratings by City</h2>
        <div className="grid gap-3 md:gap-4">
          {cities.map((city, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-[#C9A84C]/50 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">{city.name}</h3>
                  <p className="text-sm text-gray-400">
                    {city.incidents} incidents reported this month
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-3xl font-bold text-[#C9A84C]">{city.safety}</span>
                    <span className="text-gray-400">/100</span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      city.safety >= 85
                        ? "bg-green-500/20 text-green-400"
                        : city.safety >= 70
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {city.status}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                    city.safety >= 85
                      ? "bg-gradient-to-r from-green-500 to-green-400"
                      : city.safety >= 70
                      ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                      : "bg-gradient-to-r from-red-500 to-red-400"
                  }`}
                  style={{ width: `${city.safety}%` }}
                ></div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span
                  className={`flex items-center gap-1 ${
                    city.trend === "improving" ? "text-green-400" : "text-gray-400"
                  }`}
                >
                  {city.trend === "improving" ? "↗" : "→"} {city.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Tips */}
      <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="text-[#C9A84C]" />
          Essential Safety Tips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {safetyTips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle size={14} className="text-[#C9A84C]" />
              </div>
              <p className="text-gray-300">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Important Apps */}
      <div className="bg-gradient-to-br from-[#C9A84C]/10 to-[#8B7355]/10 rounded-xl p-6 border border-[#C9A84C]/30">
        <h2 className="text-2xl font-semibold mb-4">Useful Apps for Tourists</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Uber/Careem", "Talabat", "Vezeeta", "Google Maps"].map((app, i) => (
            <div
              key={i}
              className="bg-white/5 rounded-lg p-4 text-center border border-white/10 hover:border-[#C9A84C]/50 transition-all"
            >
              <div className="w-12 h-12 bg-[#C9A84C]/20 rounded-lg mx-auto mb-2 flex items-center justify-center">
                <Phone size={24} className="text-[#C9A84C]" />
              </div>
              <p className="font-semibold">{app}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}