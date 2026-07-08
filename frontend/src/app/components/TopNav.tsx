import { User, Menu } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../AuthContext";

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0F0F1E] border-b border-[#C9A84C]/20 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-300 hover:text-[#C9A84C] transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#C9A84C] to-[#8B7355] rounded-lg flex items-center justify-center">
              <span className="text-lg md:text-xl">𓂀</span>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">
                <span className="text-[#C9A84C]">KEMET</span>
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">AI Egypt Tourism Assistant</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <Link
            to="/account"
            className="flex items-center gap-2 px-2 md:px-3 py-2 rounded-lg bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors"
          >
            {user?.profile_pic_url ? (
              <img src={user.profile_pic_url} alt={user.username} className="w-4 h-4 md:w-[18px] md:h-[18px] rounded-full object-cover" />
            ) : (
              <User size={16} className="md:w-[18px] md:h-[18px] text-[#C9A84C]" />
            )}
            <span className="text-sm hidden sm:inline">
              {loading ? "…" : user?.username || "Guest"}
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
