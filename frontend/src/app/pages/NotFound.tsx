import { Link } from "react-router";
import { Home } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-[#C9A84C] mb-4">404</h1>
        <h2 className="text-3xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#C9A84C] hover:bg-[#B8984A] text-[#1A1A2E] rounded-lg transition-colors font-medium"
        >
          <Home size={20} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
