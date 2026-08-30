"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronsUpDown,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PricingModal, AccountSettingsModal, WorkspaceDeskModal } from "@/components/EnterpriseModals";

const NAV_LINKS = [
  { href: "/", label: "Prima pagină", section: "Ediția", icon: LayoutDashboard },
  { href: "/newsletter", label: "Registrul zilnic", section: "Ediția", icon: Newspaper },
  { href: "/analysis", label: "Analiza de piață", section: "Ediția", icon: BarChart3 },
  { href: "/eligibility", label: "Eligibilitate finanțări", section: "Instrumente", icon: ShieldCheck },
  { href: "/drafting", label: "Redactare documente", section: "Instrumente", icon: FileText },
  { href: "/analytics", label: "Strategie & Copilot", section: "Instrumente", icon: Sparkles },
  { href: "/pipeline", label: "Pipeline ofertare", section: "Instrumente", icon: Kanban },
];

const SECTIONS = ["Ediția", "Instrumente"] as const;

export function pageTitleForPath(pathname: string | null): string {
  if (!pathname) return "RO-INTEL";
  const link = NAV_LINKS.find((l) => (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)));
  return link?.label ?? "RO-INTEL";
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, desks, activeDesk, switchDesk, signOut } = useAuth();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deskManagerOpen, setDeskManagerOpen] = useState(false);
  const [deskMenuOpen, setDeskMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-editorial font-display text-sm font-bold text-white">
          R
        </span>
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink">RO-INTEL</span>
      </div>

      {/* Desk switcher */}
      <div className="relative px-3 pb-2">
        <button
          onClick={() => setDeskMenuOpen((v) => !v)}
          aria-expanded={deskMenuOpen}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-divider bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">
              {activeDesk?.name || "Desk neconfigurat"}
            </span>
            <span className="label-eyebrow block truncate text-stock-500">Companie activă</span>
          </span>
          <ChevronsUpDown size={15} className="shrink-0 text-stock-500" />
        </button>

        {deskMenuOpen && (
          <div className="absolute left-3 right-3 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-divider bg-surface-2 p-1 shadow-2xl">
            {desks.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  switchDesk(d.id);
                  setDeskMenuOpen(false);
                }}
                className={
                  "flex min-h-[38px] w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors " +
                  (activeDesk?.id === d.id ? "bg-editorial-soft text-editorial" : "text-stock-600 hover:bg-surface")
                }
              >
                <span className="truncate">{d.name}</span>
                {activeDesk?.id === d.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-editorial" />}
              </button>
            ))}
            <button
              onClick={() => {
                setDeskMenuOpen(false);
                setDeskManagerOpen(true);
              }}
              className="mt-0.5 min-h-[38px] w-full rounded-md px-2.5 py-2 text-left text-sm font-medium text-editorial hover:bg-surface"
            >
              + Administrare companii
            </button>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav aria-label="Navigare principală" className="flex-1 overflow-y-auto px-3 py-2">
        {SECTIONS.map((section) => (
          <div key={section} className="mb-4">
            <div className="label-eyebrow px-2.5 py-1.5 text-stock-500">{section}</div>
            <div className="flex flex-col gap-0.5">
              {NAV_LINKS.filter((l) => l.section === section).map((link) => {
                const active = isActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    className={
                      "flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors " +
                      (active ? "bg-editorial-soft font-medium text-editorial" : "text-stock-600 hover:bg-surface hover:text-ink")
                    }
                  >
                    <Icon size={17} strokeWidth={1.75} className="shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="shrink-0 border-t border-divider p-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-editorial font-mono text-sm font-semibold text-white">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user?.full_name || "Vizitator"}</span>
            <span className="label-eyebrow block truncate normal-case text-stock-500">
              {user?.email || "Neautentificat"}
            </span>
          </span>
          <Settings size={16} className="shrink-0 text-stock-500" />
        </button>

        <div className="mt-1 flex flex-col gap-0.5">
          <button
            onClick={() => setPricingOpen(true)}
            className="flex min-h-[38px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-stock-600 transition-colors hover:bg-surface hover:text-ink"
          >
            Abonament / Proformă
          </button>
          {user ? (
            <button
              onClick={signOut}
              className="flex min-h-[38px] w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-negative transition-colors hover:bg-negative/10"
            >
              <LogOut size={15} /> Deconectare
            </button>
          ) : (
            <Link
              href="/login"
              className="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg bg-editorial px-2.5 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
            >
              Autentificare
            </Link>
          )}
        </div>
      </div>

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} tenantId={activeDesk?.tenant_id || ""} />
      <AccountSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WorkspaceDeskModal isOpen={deskManagerOpen} onClose={() => setDeskManagerOpen(false)} />
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (pathname === "/login") return null;

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden w-[260px] shrink-0 border-r border-divider bg-surface lg:block">
        <div className="sticky top-0 h-svh">
          <SidebarBody />
        </div>
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-divider bg-surface px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Deschide meniul"
          aria-expanded={mobileOpen}
          className="-ml-1.5 flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-2"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-editorial font-display text-xs font-bold text-white">
            R
          </span>
          <span className="font-display text-sm font-semibold tracking-tight text-ink">RO-INTEL</span>
        </Link>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-divider bg-surface">
            <div className="flex h-14 shrink-0 items-center justify-end border-b border-divider px-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Închide meniul"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-2"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
