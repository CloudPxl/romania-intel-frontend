"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, Newspaper, CheckCircle2, FileText, LineChart, BarChart3, ListChecks } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { PricingModal, AccountSettingsModal, WorkspaceDeskModal } from "./EnterpriseModals";

const NAV_LINKS = [
  { href: "/", label: "Acasa", icon: Home },
  { href: "/newsletter", label: "Newsletter", icon: Newspaper },
  { href: "/eligibility", label: "Eligibilitate Finantari", icon: CheckCircle2 },
  { href: "/drafting", label: "Generare Documente", icon: FileText },
  { href: "/analytics", label: "Analiza & Strategie", icon: LineChart },
  { href: "/analysis", label: "Analiza de Piata", icon: BarChart3 },
  { href: "/pipeline", label: "Pipeline", icon: ListChecks },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, desks, activeDesk, switchDesk } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deskManagerOpen, setDeskManagerOpen] = useState(false);

  if (pathname === "/login") return null;

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      <header className="h-14 bg-white px-4 flex items-center justify-between sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.16)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Deschide meniul"
            className="flex items-center justify-center h-9 w-9 rounded-lg text-[#242a88] hover:bg-[#eef0fb] transition"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-[15px] tracking-wide text-[#111]">
            RO-<span className="text-[#242a88]">INTEL</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPricingOpen(true)}
            className="rounded-lg bg-[#242a88] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1d226d] transition"
          >
            Factura Proforma / OP
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-[#eef0fb] text-xs font-bold text-[#242a88] border border-[#dde1f5]"
          >
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] bg-white shadow-xl flex flex-col overflow-y-auto">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#eaeaea] shrink-0">
              <span className="font-bold text-[15px] tracking-wide text-[#111]">
                RO-<span className="text-[#242a88]">INTEL</span>
              </span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Inchide meniul"
                className="flex items-center justify-center h-9 w-9 rounded-lg text-[#2b2b2b] hover:bg-[#f7f7f7] transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="py-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={
                      "flex items-center gap-3 px-4 py-3.5 border-b border-[#eaeaea] text-[14px] transition " +
                      (active ? "text-[#242a88] font-semibold bg-[#eef0fb]" : "text-[#2b2b2b] font-medium hover:bg-[#f7f7f7]")
                    }
                  >
                    <Icon size={18} className={active ? "text-[#242a88]" : "text-[#8f98da]"} />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="px-4 pt-4 pb-2">
              <span className="text-[10px] uppercase font-bold text-[#8f98da] tracking-wide">Companii &amp; Desk-uri</span>
            </div>
            <div className="pb-2">
              {desks.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    switchDesk(d.id);
                    setMenuOpen(false);
                  }}
                  className={
                    "w-full text-left flex items-center justify-between gap-2 px-4 py-2.5 text-[13px] transition " +
                    (activeDesk?.id === d.id ? "text-[#242a88] font-bold bg-[#eef0fb]" : "text-[#2b2b2b] hover:bg-[#f7f7f7]")
                  }
                >
                  <span className="truncate">{d.name}</span>
                  {activeDesk?.id === d.id && <span className="h-2 w-2 rounded-full bg-[#242a88] shrink-0" />}
                </button>
              ))}
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setDeskManagerOpen(true);
                }}
                className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#242a88] hover:bg-[#eef0fb] transition"
              >
                + Administrare &amp; Adaugare Companii
              </button>
            </div>

            <div className="mt-auto border-t border-[#eaeaea] p-4 space-y-2">
              <div>
                <p className="text-[13px] font-bold text-[#111] truncate">{user?.full_name || "Utilizator Nelogat"}</p>
                <p className="text-[11px] text-[#2b2b2b] opacity-60 truncate">{user?.email || "Acces limitat demo"}</p>
                <span className="inline-block mt-1 rounded bg-[#f7f7f7] px-2 py-0.5 text-[10px] font-semibold text-[#2b2b2b]">
                  {user?.role || "Neautentificat"}
                </span>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
                className="w-full rounded-lg bg-[#f7f7f7] py-2 text-center text-[13px] text-[#2b2b2b] hover:bg-[#eaeaea] transition font-medium"
              >
                Setari Cont & Alerte
              </button>
              {!user ? (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full rounded-lg bg-[#242a88] py-2 text-center text-white hover:bg-[#1d226d] transition font-bold text-[13px]"
                >
                  Autentificare / Log in
                </button>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="w-full rounded-lg bg-rose-50 py-2 text-center text-rose-700 hover:bg-rose-100 transition font-medium text-[13px] border border-rose-200"
                >
                  Deconectare
                </button>
              )}
            </div>
          </nav>
        </div>
      )}

      <PricingModal isOpen={pricingOpen} onClose={() => setPricingOpen(false)} tenantId={activeDesk?.id || "desk_default"} />
      <AccountSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <WorkspaceDeskModal isOpen={deskManagerOpen} onClose={() => setDeskManagerOpen(false)} />
    </>
  );
}
