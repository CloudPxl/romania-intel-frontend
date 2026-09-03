"use client";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { pageTitleForPath } from "@/components/Sidebar";

export default function Topbar() {
  const pathname = usePathname();
  const { user, profile } = useAuth();

  if (pathname === "/login") return null;

  const page = pageTitleForPath(pathname);

  return (
    <div className="sticky top-0 z-30 hidden px-4 pb-2 pt-4 lg:block">
      {/* Frosted rather than opaque: content scrolling beneath stays faintly
          legible, which is what makes a sticky bar read as floating above the
          page instead of as a lid clamped over it. */}
      <div className="neu-flat glass flex h-14 shrink-0 items-center justify-between rounded-2xl px-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stock-500 transition-colors duration-[var(--duration-base)]">
            {profile?.display_name || "RO-INTEL"}
          </span>
          <span className="text-stock-400">/</span>
          <span key={page} className="rise font-semibold text-ink">
            {page}
          </span>
        </div>
        <span className="neu-flat-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-editorial font-mono text-xs font-semibold text-white transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] hover:scale-110">
          {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "?"}
        </span>
      </div>
    </div>
  );
}
