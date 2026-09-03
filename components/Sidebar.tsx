"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Settings,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PricingModal, AccountSettingsModal, ProfileCriteriaModal } from "@/components/EnterpriseModals";
import { cn } from "@/lib/utils";

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

const DOMAIN_LABELS: Record<string, string> = {
  infrastructura: "Infrastructură & Transporturi",
  sanatate: "Sănătate",
  energie: "Energie",
  aparare: "Apărare",
  digitalizare: "Digitalizare",
};

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

export function pageTitleForPath(pathname: string | null): string {
  if (!pathname) return "RO-INTEL";
  const link = NAV_LINKS.find((l) => (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)));
  return link?.label ?? "RO-INTEL";
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-2">
        <span className="neu-flat-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-editorial font-display text-sm font-extrabold text-white">
          R
        </span>
        <span className="font-display text-[15px] font-bold tracking-tight text-ink">RO-INTEL</span>
      </div>

      {/* Who you are. This was a desk switcher — a dropdown over saved
          company profiles, each carrying the tenant id to send with every
          request. With one profile per user there is nothing to switch
          between, so it states rather than selects. */}
      <div className="pb-2 pt-1">
        <button
          onClick={() => setCriteriaOpen(true)}
          className="neu-flat-sm flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-paper px-3.5 py-2 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-glow hover:-translate-y-0.5 active:neu-pressed-sm active:scale-[0.98]"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">
              {profile?.display_name || user?.full_name || "Profil neconfigurat"}
            </span>
            <span className="label-eyebrow block truncate text-stock-500">
              {profile?.domain ? domainLabel(profile.domain) : "Fără criterii"}
            </span>
          </span>
          <SlidersHorizontal size={15} className="shrink-0 text-stock-500" />
        </button>
      </div>

      {/* Nav */}
      <nav aria-label="Navigare principală" className="flex-1 overflow-y-auto py-2">
        {SECTIONS.map((section) => (
          <div key={section} className="mb-4">
            <div className="label-eyebrow px-3 py-1.5 text-stock-500">{section}</div>
            <div className="flex flex-col gap-1.5">
              {NAV_LINKS.filter((l) => l.section === section).map((link) => {
                const active = isActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/nav relative flex min-h-[44px] items-center gap-2.5 overflow-hidden rounded-2xl px-3 py-2 text-sm",
                      "transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] active:scale-[0.97]",
                      active
                        ? "neu-pressed bg-paper font-semibold text-editorial"
                        : "bg-transparent text-stock-600 hover:bg-[rgba(255,255,255,0.5)] hover:text-ink"
                    )}
                  >
                    {/* Accent rail that wipes down the left edge on hover.
                        scaleY rather than height so it animates on the
                        compositor and never reflows the row. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-editorial transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)]",
                        active ? "scale-y-100" : "scale-y-0 group-hover/nav:scale-y-100"
                      )}
                    />
                    <Icon
                      size={17}
                      strokeWidth={2}
                      className={cn(
                        "shrink-0 transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)]",
                        active ? "translate-x-0.5" : "group-hover/nav:translate-x-0.5"
                      )}
                    />
                    <span className="truncate transition-transform duration-[var(--duration-base)] ease-[var(--ease-glide)] group-hover/nav:translate-x-0.5">
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Account */}
      <div className="shrink-0 pt-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="group/acct neu-flat-sm flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-paper px-3 py-2 text-left transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-glow hover:-translate-y-0.5 active:neu-pressed-sm active:scale-[0.98]"
        >
          <span className="neu-flat-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-editorial font-mono text-sm font-semibold text-white transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover/acct:scale-110">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{user?.full_name || "Vizitator"}</span>
            <span className="label-eyebrow block truncate normal-case text-stock-500">
              {user?.email || "Neautentificat"}
            </span>
          </span>
          <Settings size={16} className="shrink-0 text-stock-500" />
        </button>

        <div className="mt-2 flex flex-col gap-1.5">
          <button
            onClick={() => setPricingOpen(true)}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-stock-600 transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:bg-[rgba(255,255,255,0.5)] hover:text-ink active:scale-[0.97]"
          >
            Abonament / Proformă
          </button>
          {user ? (
            <button
              onClick={signOut}
              className="group/out flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-negative transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:bg-[rgba(224,89,107,0.09)] active:neu-pressed-sm active:scale-[0.97]"
            >
              <LogOut
                size={15}
                className="transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover/out:translate-x-0.5"
              />{" "}
              Deconectare
            </button>
          ) : (
            <Link
              href="/login"
              className="neu-flat-sm flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-editorial px-2.5 py-2 text-sm font-semibold text-white transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-glow hover:-translate-y-0.5 active:scale-95"
            >
              Autentificare
            </Link>
          )}
        </div>
      </div>

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} />
      <AccountSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ProfileCriteriaModal isOpen={criteriaOpen} onClose={() => setCriteriaOpen(false)} />
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
      {/* Desktop persistent, floating sidebar panel */}
      <aside className="hidden w-[280px] shrink-0 p-4 lg:block">
        <div className="neu-flat sticky top-4 flex h-[calc(100svh-2rem)] flex-col rounded-[32px] bg-paper">
          <SidebarBody />
        </div>
      </aside>

      {/* Mobile floating header bar */}
      <header className="sticky top-0 z-40 p-4 lg:hidden">
        <div className="neu-flat flex h-14 shrink-0 items-center gap-3 rounded-2xl bg-paper px-4">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Deschide meniul"
            aria-expanded={mobileOpen}
            className="neu-flat-sm -ml-1 flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-ink transition-all duration-300 active:neu-pressed-sm"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="neu-flat-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-editorial font-display text-xs font-extrabold text-white">
              R
            </span>
            <span className="font-display text-sm font-bold tracking-tight text-ink">RO-INTEL</span>
          </Link>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-[fade-in_var(--duration-base)_var(--ease-glide)_both] absolute inset-0 bg-[#3D4852]/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="animate-[slide-in-left_var(--duration-base)_var(--ease-glide)_both] neu-flat absolute inset-y-3 left-3 flex w-[280px] max-w-[85vw] flex-col rounded-[32px] bg-paper">
            <div className="flex h-14 shrink-0 items-center justify-end px-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Închide meniul"
                className="neu-pressed-sm flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-ink transition-all duration-300"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-0 pb-3">
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
