import { NavLink } from "react-router";
import {
  LayoutDashboard,
  MessageSquare,
  Hotel,
  Ticket,
  Compass,
  UtensilsCrossed,
  Landmark,
  Library,
  Columns,
  BookOpen,
  Waves,
  MoonStar,
  ScrollText,
  Users,
  UserCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

const navGroups = [
  {
    label: "Main",
    items: [
      { icon: LayoutDashboard,
        label: "Dashboard",
        path: "/"
      },
      {
        icon: Compass,
        label: "Trip Planner",
        path: "/trip-planner"
      },
    ],
  },
  {
    label: "Travel",
    items: [
      { icon: Hotel, label: "Hotels", path: "/hotels" },
      {
        icon: UtensilsCrossed,
        label: "Restaurants",
        path: "/restaurants",
      },
    ],
  },
  {
    label: "Explore Egypt",
    items: [
      {
        icon: Landmark,
        label: "Ancient Sites",
        path: "/ancient-sites",
      },
      { icon: Library, label: "Museums", path: "/museums" },
      { icon: Columns, label: "Monuments", path: "/monuments" },
      {
        icon: ScrollText,
        label: "Historical Periods",
        path: "/historical-periods",
      },
      { icon: Waves, label: "Beaches", path: "/beaches" },
      { icon: Ticket, label: "Tickets", path: "/tickets" },
      { icon: MoonStar, label: "Muslim", path: "/muslim" },
    ],
  },
  {
    label: "Community",
    items: [
      { icon: Users, label: "Community", path: "/community" },
    ],
  },
  {
    label: "Account",
    items: [
      {
        icon: UserCircle,
        label: "My Account",
        path: "/account",
      },
    ],
  },
];

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState<
    Record<string, boolean>
  >({});

  const toggleGroup = (label: string) =>
    setCollapsed((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-[73px] w-64 h-[calc(100vh-73px)] bg-[#0A0B1E] border-r border-[#C9A84C]/20 p-4 overflow-y-auto z-40 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <nav className="space-y-1 pb-32">
          {navGroups.map((group) => {
            const isCollapsed = collapsed[group.label];
            return (
              <div key={group.label} className="mb-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
                >
                  <span className="text-[10px] font-semibold tracking-widest uppercase text-[#C9A84C]/60 group-hover:text-[#C9A84C] transition-colors">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-[#C9A84C]/40 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end={item.path === "/"}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
                              isActive
                                ? "bg-[#C9A84C]/15 text-[#C9A84C] border-l-2 border-[#C9A84C] pl-[10px]"
                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                            }`
                          }
                        >
                          <Icon size={17} />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom AI promo */}
      </aside>
    </>
  );
}