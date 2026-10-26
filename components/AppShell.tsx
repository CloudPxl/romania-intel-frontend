"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { AccountSettingsModal, PricingModal, ProfileCriteriaModal } from "@/components/EnterpriseModals";
import FreshnessLine, { FreshnessPill } from "@/components/FreshnessLine";
import { fetchEntitlements } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * The frame around every page, in the public page's own design: a 64px
 * sticky header on blurred paper (brand, sections, data freshness, the
 * account), the content in a 1200px column, a slim footer.
 *
 *  - /login and /auth/*: no frame.
 *  - "/" for a visitor: the landing page, which brings its own header.
 *  - everything else: the workspace header below.
 */
export const NAV = [
  { href: "/", label: "Prima pagină" },
  { href: "/cautare-avansata", label: "Licitații" },
  { href: "/analysis", label: "Analiza pieței" },
  { href: "/analytics", label: "Strategie" },
  { href: "/drafting", label: "Redactare" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/eligibility", label: "Eligibilitate" },
] as const;

export function isActivePath(pathname: string | null, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || !!pathname?.startsWith(href + "/");
}

const PLAN_SHORT: Record<string, string> = { free: "Gratuit", plan_acces_complet: "Strategie", plan_founder_vip: "Pro" };

function cuiLabel(cui?: string | null) {
  const digits = (cui || "").replace(/\D/g, "");
  return digits ? `RO${digits}` : "";
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** The account menu: who you are, which firm documents are written for
 *  (multi-CUI on Pro), and the account's settings. */
function AccountMenu({ onSettings, onCriteria, onPricing }: { onSettings: () => void; onCriteria: () => void; onPricing: () => void }) {
  const { user, profile, signOut } = useAuth();
  const { profile: company, library, libraryMax, activate } = useCompanyProfile();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  useEffect(() => {
    if (!user) return;
    fetchEntitlements()
      .then((e) => setPlan(e.plan))
      .catch(() => {});
  }, [user]);

  if (!user) return null;
  const initial = (user.full_name || user.email || "?").charAt(0).toUpperCase();
  const activeDigits = (company?.cui || "").replace(/\D/g, "");
  const item = "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[14px] text-ink hover:bg-surface-2";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-lg border border-transparent pl-1 pr-2 hover:border-divider hover:bg-paper"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-canvas">{initial}</span>
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-[150px] truncate text-[13px] font-medium leading-4 text-ink">{company?.company_name || profile?.display_name || user.full_name || "Contul meu"}</span>
          {plan && <span className="block text-[12px] leading-4 text-stock-400">{PLAN_SHORT[plan] || plan}</span>}
        </span>
        <ChevronDown size={14} className="text-stock-400" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-xl border border-divider bg-paper p-2 shadow-float">
          <div className="px-3 pb-2 pt-1">
            <p className="truncate text-[14px] font-semibold text-ink">{user.full_name || "Cont"}</p>
            <p className="truncate text-[13px] text-stock-400">{user.email}</p>
          </div>
          <div className="border-t border-divider pt-2">
            <p className="px-3 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-stock-400">Firma ofertantă</p>
            {library.length === 0 && (
              <p className="px-3 py-1.5 text-[13px] text-stock-500">{company?.company_name ? `${company.company_name} · ${cuiLabel(company.cui)}` : "Nicio firmă salvată încă."}</p>
            )}
            {library.map((p) => {
              const digits = (p.cui || "").replace(/\D/g, "");
              const active = digits === activeDigits;
              return (
                <button
                  key={digits}
                  role="menuitemradio"
                  aria-checked={active}
                  className={item}
                  onClick={async () => {
                    if (active) return close();
                    const { error: err } = await activate(digits);
                    setError(err);
                    if (!err) close();
                  }}
                >
                  <span className="flex w-4 justify-center text-accent">{active && <Check size={15} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.company_name || cuiLabel(p.cui)}</span>
                    <span className="tabular block text-[12px] text-stock-400">{cuiLabel(p.cui)}</span>
                  </span>
                </button>
              );
            })}
            {error && <p className="px-3 py-1 text-[13px] text-negative">{error}</p>}
            <button
              role="menuitem"
              className={cn(item, "text-stock-500")}
              onClick={() => {
                close();
                onSettings();
              }}
            >
              {libraryMax > 1 ? `Adaugă sau editează firme (${library.length}/${libraryMax})` : "Editează datele firmei"}
            </button>
            {libraryMax <= 1 && <p className="px-3 pb-1 text-[12px] leading-snug text-stock-400">Mai multe firme (multi-CUI): Ofertant Complet Pro.</p>}
          </div>
          <div className="mt-1 border-t border-divider pt-2">
            <button role="menuitem" className={item} onClick={() => { close(); onCriteria(); }}>
              Criterii de monitorizare
            </button>
            <button role="menuitem" className={item} onClick={() => { close(); onPricing(); }}>
              Abonament și plată
            </button>
            <button role="menuitem" className={item} onClick={() => { close(); onSettings(); }}>
              Setări cont
            </button>
            <Link role="menuitem" href="/suport" className={item} onClick={close}>
              Suport
            </Link>
            <button role="menuitem" className={cn(item, "text-negative")} onClick={() => { close(); signOut(); }}>
              Deconectare
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AppHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [criteria, setCriteria] = useState(false);
  const [pricing, setPricing] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setMenu(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  const link = (href: string, label: string, mobile = false) => {
    const active = isActivePath(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          mobile
            ? "flex min-h-12 items-center border-b border-divider text-[17px]"
            : "relative inline-flex h-16 items-center px-2.5 text-[15px] after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full",
          active ? "font-semibold text-ink after:bg-editorial" : "font-medium text-stock-500 hover:text-ink"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <header className={cn("glass sticky top-0 z-40 border-b transition-colors duration-[var(--duration-base)]", scrolled ? "border-divider" : "border-transparent")}>
        <div className="mx-auto flex h-16 max-w-[1264px] items-center gap-4 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[16px] font-semibold tracking-[-0.01em] text-ink" aria-label="RO-INTEL, prima pagină">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-ink text-[13px] font-bold text-canvas">R</span>
            RO-INTEL
          </Link>
          <nav aria-label="Secțiuni" className="ml-4 hidden items-center xl:flex">
            {NAV.map((n) => link(n.href, n.label))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <FreshnessPill className="hidden md:inline-flex" />
            {user ? (
              <AccountMenu onSettings={() => setSettings(true)} onCriteria={() => setCriteria(true)} onPricing={() => setPricing(true)} />
            ) : (
              <>
                <Link href="/login" className="hidden px-1.5 py-2 text-[15px] font-medium text-stock-500 hover:text-ink sm:inline">
                  Autentificare
                </Link>
                <Link href="/login" className="inline-flex h-10 items-center rounded-lg bg-editorial px-3.5 text-[14px] font-semibold text-white hover:bg-editorial-light">
                  Cont gratuit
                </Link>
              </>
            )}
            <button
              onClick={() => setMenu(true)}
              aria-label="Deschide meniul"
              aria-expanded={menu}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-surface-2 xl:hidden"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Meniu">
          <div className="absolute inset-0 animate-[fade-in_var(--duration-base)_both] bg-overlay" onClick={() => setMenu(false)} aria-hidden />
          <div className="absolute inset-y-0 right-0 flex w-[320px] max-w-[88vw] animate-[slide-over-right_var(--duration-base)_both] flex-col bg-canvas px-5 pb-6">
            <div className="flex h-16 items-center justify-between">
              <span className="text-[16px] font-semibold">Meniu</span>
              <button onClick={() => setMenu(false)} aria-label="Închide meniul" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-2">
                <X size={20} />
              </button>
            </div>
            <nav aria-label="Secțiuni" className="flex flex-col">
              {NAV.map((n) => link(n.href, n.label, true))}
              {link("/suport", "Suport", true)}
            </nav>
            <FreshnessLine className="mt-6" />
          </div>
        </div>
      )}

      <PricingModal isOpen={pricing} onClose={() => setPricing(false)} />
      <AccountSettingsModal isOpen={settings} onClose={() => setSettings(false)} />
      <ProfileCriteriaModal isOpen={criteria} onClose={() => setCriteria(false)} />
    </>
  );
}

function AppFooter() {
  return (
    <footer className="mt-auto border-t border-divider">
      {/* pb/pr: room for the floating Copilot button, which must never cover a link. */}
      <div className="mx-auto flex max-w-[1264px] flex-wrap items-center gap-x-6 gap-y-3 px-5 pb-24 pt-6 sm:px-8 lg:pb-6 lg:pr-40">
        <FreshnessLine />
        <nav aria-label="Legal și contact" className="flex flex-wrap gap-1 sm:ml-auto">
          {[
            ["/terms", "Termeni"],
            ["/privacy", "Confidențialitate"],
            ["/suport", "Suport"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-1.5 py-2 text-[14px] font-medium text-stock-500 hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // layout.tsx hides the landing page while a stored session may still turn
  // into a signed-in user; once auth answers "no user" (an expired or
  // revoked session) it is shown.
  useEffect(() => {
    if (!loading && !user) document.documentElement.removeAttribute("data-session");
  }, [loading, user]);

  const bare = pathname === "/login" || pathname?.startsWith("/auth/");
  const landing = pathname === "/" && !user;
  if (bare || landing) return <>{children}</>;

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <div id="main" className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>
      <AppFooter />
    </div>
  );
}
