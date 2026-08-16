const CACHE = "dog-day-shell-v2";
const APP_SHELL = ["/", "/signin", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Authenticated API responses are never cached.
  if (new URL(request.url).pathname.startsWith("/api")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }
  if (request.destination === "image" || request.destination === "font" || request.destination === "style") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});

// Web Push: small JSON payload { title, body, url }. No secrets.
self.addEventListener("push", (event) => {
  let data = { title: "MyPuppy", body: "Your dog has something to say.", url: "/pet" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url ?? "/pet" },
    }),
  );
});

// Open/focus Pet Home on notification click, reusing an existing window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/pet", self.location.origin).toString();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url && new URL(client.url).pathname === new URL(target).pathname) {
            return client.focus();
          }
        }
      }
      const anyClient = clientList.find((client) => "focus" in client && "navigate" in client);
      if (anyClient) return anyClient.navigate(target).then((navigated) => navigated.focus());
      const existing = clientList.find((client) => "focus" in client);
      return existing ? existing.focus() : self.clients.openWindow(target);
    }),
  );
});

// Background subscription refresh support (progressive enhancement).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "DOGDAY_SUBSCRIBE" && self.registration.pushManager) {
    event.waitUntil(
      self.registration.pushManager
        .subscribe({ userVisibleOnly: true, applicationServerKey: data.publicKey })
        .then((subscription) => {
          self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
              client.postMessage({ type: "DOGDAY_SUBSCRIBED", subscription: subscription.toJSON() });
            }
          });
          return subscription;
        })
        .catch(() => undefined),
    );
  }
});
