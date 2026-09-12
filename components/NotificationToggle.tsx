"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Check, Smartphone } from "lucide-react";
import { ApiError, sendTestPush, updatePushPreferences } from "@/lib/api";
import { disablePush, enablePush, getPushState, type PushStatus } from "@/lib/push";
import { Badge, Button, Notice } from "@/components/newsprint";

/**
 * The one-click notification opt-in, shared by Account Settings and
 * onboarding.
 *
 * Most of this component is state reporting rather than the toggle itself,
 * because "notifications are on" is not one condition: the browser may not
 * support push, iOS may need the app installed first, the user may have
 * blocked the permission at browser level (which the site cannot undo), or
 * the server may have no VAPID keys. Each of those needs a different
 * sentence and a different next step — collapsing them into a disabled
 * switch is what makes push feel broken.
 */
export default function NotificationToggle({
  radarEnabled,
  onRadarChange,
  compact = false,
}: {
  /** The "high-yield radar" preference (tenders scoring >= 9 outside the
   *  user's own filters). Omitted during onboarding, where the profile
   *  does not exist yet. */
  radarEnabled?: boolean;
  onRadarChange?: (enabled: boolean) => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<PushStatus | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus((await getPushState()).status);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The service worker asks the page to re-register when a push service
  // rotates the subscription; without this the device goes quiet silently.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "ro-intel:push-resubscribe") void enablePush().then(refresh).catch(() => {});
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    setTested(null);
    try {
      const next = status === "enabled" ? await disablePush() : await enablePush();
      setStatus(next.status);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : e instanceof Error ? e.message : "Acțiunea a eșuat.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    setError(null);
    setTested(null);
    try {
      const result = await sendTestPush();
      setTested(
        result.delivered > 0
          ? `Notificare trimisă către ${result.delivered} dispozitiv(e).`
          : "Nicio notificare nu a putut fi livrată. Verificați setările sistemului de operare."
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Testul a eșuat.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return <p className="font-body text-sm text-stock-500">Se verifică notificările…</p>;
  }

  if (status === "unsupported") {
    return (
      <Notice tone="neutral" title="Notificări indisponibile">
        Acest browser nu acceptă notificări push. Alertele pe email și Telegram funcționează normal.
      </Notice>
    );
  }

  if (status === "ios-needs-pwa") {
    return (
      <Notice tone="warning" title="Un pas suplimentar pe iPhone">
        Pe iOS, notificările funcționează doar din aplicația instalată. Apăsați{" "}
        <strong>Partajare</strong> în Safari, apoi <strong>Adaugă pe ecranul principal</strong>, și
        deschideți RO-INTEL din pictograma nou creată.
      </Notice>
    );
  }

  if (status === "unconfigured") {
    return (
      <Notice tone="neutral" title="Notificări în curs de activare">
        Notificările push nu sunt încă activate pe server. Alertele pe email rămân active.
      </Notice>
    );
  }

  if (status === "denied") {
    return (
      <Notice tone="alert" title="Notificări blocate">
        Ați blocat notificările pentru acest site. Reactivați-le din setările browserului
        (pictograma din bara de adrese → Notificări → Permite), apoi reîncărcați pagina.
      </Notice>
    );
  }

  const enabled = status === "enabled";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={enabled ? "outline" : "primary"}
          onClick={toggle}
          disabled={busy}
          className="min-h-[44px]"
        >
          {enabled ? <BellOff size={16} /> : <Bell size={16} />}
          {enabled ? "Dezactivează notificările" : "Activează notificările"}
        </Button>
        {enabled && (
          <>
            <Badge tone="positive">
              <Check size={12} /> Activ pe acest dispozitiv
            </Badge>
            <Button variant="ghost" onClick={runTest} disabled={busy} className="min-h-[44px]">
              Trimite un test
            </Button>
          </>
        )}
      </div>

      {!compact && (
        <p className="font-body text-[13px] leading-relaxed text-stock-500">
          Notificările se activează per dispozitiv. Repetați pasul pe telefon pentru a le primi și acolo.
        </p>
      )}

      {enabled && onRadarChange && (
        <label className="neu-pressed flex min-h-[44px] cursor-pointer items-start gap-3 rounded-2xl bg-paper px-3.5 py-3">
          <input
            type="checkbox"
            checked={radarEnabled ?? true}
            onChange={async (e) => {
              const next = e.target.checked;
              onRadarChange(next);
              try {
                await updatePushPreferences({ push_radar_enabled: next });
              } catch {
                onRadarChange(!next);
                setError("Preferința nu a putut fi salvată.");
              }
            }}
            className="neu-flat-sm mt-0.5 h-5 w-5 shrink-0 appearance-none rounded-md bg-paper transition-all duration-300 checked:[background:var(--color-editorial)]"
          />
          <span className="min-w-0">
            <span className="block font-sans text-sm font-semibold text-ink">Radar de piață</span>
            <span className="font-body block text-[13px] leading-relaxed text-stock-500">
              Anunțați-mă și despre licitațiile cu scor foarte mare (peste 9/10) care nu se
              încadrează în criteriile mele.
            </span>
          </span>
        </label>
      )}

      {tested && <Notice tone="neutral">{tested}</Notice>}
      {error && <Notice tone="alert">{error}</Notice>}

      {!compact && (
        <p className="font-body flex items-start gap-2 text-[12px] leading-relaxed text-stock-500">
          <Smartphone size={14} className="mt-0.5 shrink-0" />
          Pe iPhone, adăugați mai întâi aplicația pe ecranul principal — Apple permite notificări
          doar din aplicația instalată.
        </p>
      )}
    </div>
  );
}
