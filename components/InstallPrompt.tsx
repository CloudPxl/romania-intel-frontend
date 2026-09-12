"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { isIos, isStandalone } from "@/lib/push";

const DISMISS_KEY = "ro_intel_install_prompt_dismissed";

/**
 * A dismissible hint shown only to iOS visitors who have not installed the
 * app.
 *
 * It exists for a functional reason, not for install numbers: Apple only
 * permits Web Push from a site added to the Home Screen, so on iPhone this
 * banner is the sole path to notifications working at all. Everywhere else
 * it never renders.
 *
 * Deliberately not a modal, and dismissible for good — an install nag that
 * reappears every visit is the thing users hate about PWAs, and the
 * notification toggle in Settings explains the same requirement to anyone
 * who dismisses this and later goes looking.
 */
export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Runs in an effect, never during render: isIos/isStandalone read
    // navigator and window, so calling them while rendering would break
    // the server pass and produce a hydration mismatch on the client.
    if (!isIos() || isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* Safari private mode throws on localStorage; showing the prompt is
         the harmless side of that failure. */
    }
    // A beat after first paint, so it does not compete with the page
    // itself for attention on arrival.
    const timer = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="complementary"
      aria-label="Instalare pe ecranul principal"
      // Above the mobile header (z-40) but below the nav drawer (z-50), and
      // clear of the iOS home indicator via safe-area-inset.
      className="animate-[fade-in_var(--duration-base)_var(--ease-glide)_both] fixed inset-x-3 bottom-3 z-[45] lg:hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="neu-flat flex items-start gap-3 rounded-2xl bg-paper p-3.5">
        <span className="neu-flat-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-editorial-soft text-editorial">
          <Share size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold leading-snug text-ink">
            Adaugă pe ecranul principal pentru alerte instant
          </p>
          <p className="font-body mt-1 text-[13px] leading-relaxed text-stock-500">
            Apăsați <strong className="text-ink">Partajare</strong> în bara Safari, apoi{" "}
            <strong className="text-ink">Adaugă pe ecranul principal</strong>. Notificările push
            funcționează pe iPhone doar din aplicația instalată.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Închide"
          className="neu-flat-sm -m-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-paper text-stock-500 transition-all duration-300 active:neu-pressed-sm"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
