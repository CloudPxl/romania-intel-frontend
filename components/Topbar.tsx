"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { pageTitleForPath } from "@/components/Sidebar";

export default function Topbar() {
  const pathname = usePathname();
  const { user, activeDesk } = useAuth();

  if (pathname === "/login") return null;

  const page = pageTitleForPath(pathname);

  return (
    <div className="sticky top-0 z-30 hidden h-14 shrink-0 items-center justify-between border-b border-divider bg-paper/80 px-6 backdrop-blur lg:flex">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-stock-500">{activeDesk?.name || "RO-INTEL"}</span>
        <span className="text-stock-400">/</span>
        <span className="font-medium text-ink">{page}</span>
      </div>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-editorial font-mono text-xs font-semibold text-white">
        {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "?"}
      </span>
    </div>
  );
}
