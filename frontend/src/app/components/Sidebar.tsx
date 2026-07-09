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
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";

const navGroups = [
  {
    label: "Main",
    items: [
      { icon: LayoutDashboard,
        label: "Home",
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
      { icon: Ticket, label: "Tickets", path: "/tickets" },
      { icon: MoonStar, label: "Muslim Guide", path: "/muslim" },
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
  collapsed = false,
  onToggleCollapse,
}: {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  const toggleGroup = (label: string) =>
    setCollapsedGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));

  return (
    <>
      {/* Custom slim, themed scrollbar for the sidebar nav */}
      <style>{`
        .kemet-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(201, 168, 76, 0.35) transparent;
        }
        .kemet-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .kemet-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .kemet-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(201, 168, 76, 0.35);
          border-radius: 9999px;
        }
        .kemet-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(201, 168, 76, 0.6);
        }
      `}</style>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-[73px] h-[calc(100vh-73px)] bg-[#0A0B1E] border-r border-[#C9A84C]/20 overflow-visible z-40 transition-[transform,width] duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "w-64 lg:w-20" : "w-64"}`}
      >
        {/* Mobile close */}
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-white z-50"
        >
          <X size={20} />
        </button>

        {/* Desktop collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 -right-3 items-center justify-center w-6 h-6 rounded-full bg-[#0A0B1E] border border-[#C9A84C]/30 text-[#C9A84C]/70 hover:text-[#C9A84C] hover:border-[#C9A84C]/60 hover:bg-[#0A0B1E] shadow-md transition-all duration-200 z-50"
          >
            <ChevronLeft
              size={13}
              className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        )}

        {/* Scrollable content area — scrolling lives here, not on the
            aside itself, so the collapse toggle floating on the border
            is never covered by the scrollbar. */}
        <div className="kemet-scrollbar h-full overflow-y-auto overflow-x-hidden p-4">
          <nav className="space-y-1 pb-32">
            {navGroups.map((group) => {
              const isGroupCollapsed = collapsedGroups[group.label];
              return (
                <div key={group.label} className="mb-1">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group ${
                      collapsed ? "lg:justify-center lg:px-0" : ""
                    }`}
                  >
                    <span
                      className={`text-[10px] font-semibold tracking-widest uppercase text-[#C9A84C]/60 group-hover:text-[#C9A84C] transition-colors ${
                        collapsed ? "lg:hidden" : ""
                      }`}
                    >
                      {group.label}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`text-[#C9A84C]/40 transition-transform duration-200 ${
                        isGroupCollapsed ? "-rotate-90" : ""
                      } ${collapsed ? "lg:hidden" : ""}`}
                    />
                  </button>

                  {/* Group items */}
                  {!isGroupCollapsed && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === "/"}
                            onClick={onClose}
                            title={collapsed ? item.label : undefined}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm ${
                                collapsed ? "lg:justify-center lg:px-0" : ""
                              } ${
                                isActive
                                  ? "bg-[#C9A84C]/15 text-[#C9A84C] border-l-2 border-[#C9A84C] pl-[10px]"
                                  : "text-gray-400 hover:bg-white/5 hover:text-white"
                              } ${collapsed ? "lg:border-l-0 lg:pl-0" : ""}`
                            }
                          >
                            <Icon size={17} className="shrink-0" />
                            <span className={collapsed ? "lg:hidden" : ""}>
                              {item.label}
                            </span>
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
        </div>
      </aside>
    </>
  );
}