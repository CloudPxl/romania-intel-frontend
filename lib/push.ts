"use client";

import { fetchPushPublicKey, subscribeToPush, unsubscribeFromPush } from "@/lib/api";

/**
 * Browser-side Web Push plumbing: capability detection, service-worker
 * registration, and the permission/subscription handshake.
 *
 * Kept out of the components so the several places that offer the toggle
 * (Account Settings, onboarding) share one implementation of a flow with a
 * lot of ways to fail quietly.
 */

export type PushStatus =
  | "unsupported"      // the browser has no Push API at all
  | "ios-needs-pwa"    // iOS Safari: Web Push only works from the Home Screen
  | "unconfigured"     // no VAPID key on the server
  | "denied"           // the user blocked notifications at browser level
  | "enabled"
  | "disabled";        // supported and permitted, just not subscribed here

export interface PushState {
  status: PushStatus;
  endpoint: string | null;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports itself as a Mac; the touch-point check is the
  // standard way to tell a real Mac from an iPad pretending to be one.
  return (
    /iphone|ipod|ipad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // Safari's own non-standard flag, still the only reliable signal on iOS.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * VAPID keys travel as base64url; PushManager.subscribe wants raw bytes.
 * Getting this wrong fails at subscribe() time with an opaque
 * "InvalidAccessError", which is why it is a named function and not an
 * inline expression.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** What the UI should show, without prompting for anything. */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) {
    // On iOS the Push API genuinely does not exist in a normal Safari tab —
    // it appears only once the site is installed to the Home Screen. That
    // is a fixable state with a specific instruction, not "unsupported".
    if (isIos() && !isStandalone()) return { status: "ios-needs-pwa", endpoint: null };
    return { status: "unsupported", endpoint: null };
  }
  if (Notification.permission === "denied") return { status: "denied", endpoint: null };

  const registration = await navigator.serviceWorker.getRegistration();
  const existing = await registration?.pushManager.getSubscription();
  return existing
    ? { status: "enabled", endpoint: existing.endpoint }
    : { status: "disabled", endpoint: null };
}

/**
 * Full opt-in: permission -> service worker -> browser subscription ->
 * server registration. Returns the resulting state, or throws with a
 * Romanian message the caller can show directly.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) {
    throw new Error(
      isIos() && !isStandalone()
        ? "Pe iPhone, notificările funcționează doar după ce adăugați aplicația pe ecranul principal."
        : "Acest browser nu acceptă notificări push."
    );
  }

  const { configured, public_key: publicKey } = await fetchPushPublicKey();
  if (!configured || !publicKey) {
    throw new Error("Notificările push nu sunt încă activate pe server.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Notificările au fost blocate. Le puteți reactiva din setările browserului pentru acest site."
    );
  }

  const registration = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  if (!registration) throw new Error("Service worker-ul nu a putut fi înregistrat.");
  // register() resolves before the worker is actually controlling the page;
  // subscribing against a not-yet-active worker fails intermittently.
  await navigator.serviceWorker.ready;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Required by every browser: a push that the user cannot see is not
      // permitted, and Chrome rejects the subscription outright without it.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Abonamentul de notificări este incomplet. Reîncercați.");
  }
  await subscribeToPush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });

  return { status: "enabled", endpoint: json.endpoint };
}

/** Unregisters this device both in the browser and on the server. */
export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    // Server first: if the browser-side unsubscribe succeeds and the
    // server call then fails, the row is orphaned and the backend keeps
    // pushing to a dead endpoint until the push service 410s it.
    try {
      await unsubscribeFromPush(endpoint);
    } finally {
      await subscription.unsubscribe();
    }
  }
  return { status: "disabled", endpoint: null };
}
