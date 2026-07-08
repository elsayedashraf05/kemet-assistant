import { useState } from "react";
import { Outlet } from "react-router";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { ChatBubble } from "./ChatBubble";

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#1A1A2E] text-white">
      <TopNav onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex pt-[73px]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 md:p-6 lg:ml-64 min-h-[calc(100vh-73px)]">
          <Outlet />
        </main>
      </div>
      {/* Fixed, always-on-top AI assistant bubble - lives here (not inside a
          route) so it stays mounted and keeps its conversation state as the
          user navigates between pages. */}
      <ChatBubble />
    </div>
  );
}
