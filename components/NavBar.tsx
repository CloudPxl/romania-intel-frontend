"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatDateline } from "@/lib/format";
import { PricingModal, AccountSettingsModal, WorkspaceDeskModal } from "@/components/EnterpriseModals";

const NAV_LINKS = [
  { href: "/", label: "Prima pagină", section: "Ediția" },
  { href: "/newsletter", label: "Registrul zilnic", section: "Ediția" },
  { href: "/analysis", label: "Analiza de piață", section: "Ediția" },
  { href: "/eligibility", label: "Eligibilitate finanțări", section: "Instrumente" },
  { href: "/drafting", label: "Redactare documente", section: "Instrumente" },
  { href: "/analytics", label: "Strategie & Copilot", section: "Instrumente" },
  { href: "/pipeline", label: "Pipeline ofertare", section: "Instrumente" },
];

const SECTIONS = ["Ediția", "Instrumente"] as const;

export default function NavBar() {
  const pathname = usePathname();
  const { user, desks, activeDesk, switchDesk, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deskManagerOpen, setDeskManagerOpen] = useState(false);
  const [dateline, setDateline] = useState("");

  // Rendered client-side only: formatting the date during SSR bakes the
  // server's day into the HTML and hydration then mismatches for any
  // reader in a different timezone.
  useEffect(() => setDateline(formatDateline()), []);

  // A drawer that leaves the page scrollable behind it lets a phone user
  // scroll the article while the menu is open, which reads as a bug.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (pathname === "/login") return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      <header className="sticky top-0 z-40 border-b-4 border-ink bg-paper">
        <div className="mx-auto flex h-14 w-full max-w-screen-xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Deschide meniul"
              aria-expanded={menuOpen}
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center border border-transparent text-ink transition-colors hover:border-ink"
            >
              <Menu size={22} strokeWidth={1.5} />
            </button>
            <Link href="/" className="font-display text-xl font-black tracking-tighter sm:text-2xl">
              RO<span className="text-editorial">·</span>INTEL
            </Link>
            <span className="label-eyebrow hidden truncate border-l border-divider pl-3 text-stock-500 lg:block">
              {dateline || " "}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setPricingOpen(true)}
              className="hidden min-h-[36px] items-center border border-ink bg-ink px-3 font-sans text-[10px] font-semibold uppercase tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink sm:inline-flex"
            >
              Abonament / Proformă
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Cont și companii"
              className="flex h-10 w-10 items-center justify-center border border-ink font-mono text-sm font-bold transition-colors hover:bg-ink hover:text-paper"
            >
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "?"}
            </button>
          </div>
        </div>

        <div className="border-t border-divider bg-paper">
          <div className="mx-auto flex w-full max-w-screen-xl items-center justify-between gap-4 px-4 py-1.5">
            <span className="label-eyebrow truncate text-stock-500">
              {activeDesk?.name || "Desk neconfigurat"}
            </span>
            <span className="label-eyebrow hidden shrink-0 text-stock-400 sm:block">
              Vol. 2 · Ediție națională
            </span>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            aria-label="Navigare principală"
            className="absolute inset-y-0 left-0 flex w-[320px] max-w-[88vw] flex-col overflow-y-auto border-r-4 border-ink bg-paper"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b-4 border-ink px-4">
              <span className="font-display text-xl font-black tracking-tighter">
                RO<span className="text-editorial">·</span>INTEL
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Închide meniul"
                className="-mr-2 flex h-11 w-11 items-center justify-center border border-transparent transition-colors hover:border-ink"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {SECTIONS.map((section) => (
              <div key={section}>
                <div className="border-b border-divider bg-stock-100 px-4 py-2">
                  <span className="label-eyebrow text-stock-500">{section}</span>
                </div>
                {NAV_LINKS.filter((l) => l.section === section).map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={
                        "flex min-h-[48px] items-center justify-between gap-2 border-b border-divider px-4 py-3 font-body text-[15px] transition-colors " +
                        (active ? "bg-ink text-paper" : "text-ink hover:bg-stock-100")
                      }
                    >
                      {link.label}
                      {active && <span className="h-1.5 w-1.5 shrink-0 bg-editorial" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            ))}

            <div className="border-b border-divider bg-stock-100 px-4 py-2">
              <span className="label-eyebrow text-stock-500">Companii</span>
            </div>
            {desks.map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  switchDesk(d.id);
                  setMenuOpen(false);
                }}
                className={
                  "flex min-h-[48px] w-full items-center justify-between gap-2 border-b border-divider px-4 py-3 text-left font-body text-sm transition-colors " +
                  (activeDesk?.id === d.id ? "font-semibold" : "text-stock-600 hover:bg-stock-100")
                }
              >
                <span className="truncate">{d.name}</span>
                {activeDesk?.id === d.id && (
                  <span className="h-2 w-2 shrink-0 bg-editorial" aria-hidden="true" />
                )}
              </button>
            ))}
            <button
              onClick={() => {
                setMenuOpen(false);
                setDeskManagerOpen(true);
              }}
              className="min-h-[48px] border-b border-divider px-4 py-3 text-left font-sans text-[11px] font-semibold uppercase tracking-widest text-editorial transition-colors hover:bg-stock-100"
            >
              + Administrare companii
            </button>

            <div className="mt-auto space-y-3 border-t-4 border-ink p-4">
              <div>
                <p className="font-body truncate text-sm font-semibold">{user?.full_name || "Vizitator"}</p>
                <p className="font-mono truncate text-[11px] text-stock-500">
                  {user?.email || "Neautentificat — acces public"}
                </p>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setPricingOpen(true);
                }}
                className="min-h-[44px] w-full border border-ink px-3 font-sans text-[11px] font-semibold uppercase tracking-widest transition-colors hover:bg-ink hover:text-paper sm:hidden"
              >
                Abonament / Proformă
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="min-h-[44px] w-full border border-ink px-3 font-sans text-[11px] font-semibold uppercase tracking-widest transition-colors hover:bg-ink hover:text-paper"
              >
                Setări cont & alerte
              </button>
              {user ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="min-h-[44px] w-full border border-editorial px-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-editorial transition-colors hover:bg-editorial hover:text-paper"
                >
                  Deconectare
                </button>
              ) : (
                <Link
                  href="/login"
                  className="flex min-h-[44px] w-full items-center justify-center border border-ink bg-ink px-3 font-sans text-[11px] font-semibold uppercase tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink"
                >
                  Autentificare
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}

      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
        tenantId={activeDesk?.tenant_id || ""}
      />
      <AccountSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WorkspaceDeskModal isOpen={deskManagerOpen} onClose={() => setDeskManagerOpen(false)} />
    </>
  );
}
