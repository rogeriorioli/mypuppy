"use client";

/**
 * Client-side Web Push helpers. Never stores or inspects the VAPID private
 * key. Gracefully degrades when Push or Service Workers are unavailable.
 */

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

export interface SubscriptionResult {
  ok: boolean;
  reason?: "unsupported" | "denied" | "failed";
}

export async function enablePushNotifications(): Promise<SubscriptionResult> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  try {
    const registration = await ensureServiceWorker();
    if (!registration) return { ok: false, reason: "failed" };

    const vapidResponse = await fetch("/api/push/vapid-key").then((response) => response.json());
    if (!vapidResponse.supported || !vapidResponse.publicKey) return { ok: false, reason: "unsupported" };

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidResponse.publicKey),
      });
    }

    const saveResponse = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!saveResponse.ok) return { ok: false, reason: "failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function disablePushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await ensureServiceWorker();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    return true;
  } catch {
    return false;
  }
}
