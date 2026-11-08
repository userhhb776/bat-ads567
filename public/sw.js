self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = { title: "Bat Gotham", body: "" };
  try { d = e.data.json(); } catch { try { d.body = e.data.text(); } catch {} }
  e.waitUntil(self.registration.showNotification(d.title || "Bat Gotham", {
    body: d.body, icon: "/icon-192.png", badge: "/icon-192.png", data: "/inteligencia",
    vibrate: [300, 120, 300, 120, 600], tag: "bat-gotham-" + Date.now(), renotify: true, requireInteraction: true,
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data || "/"));
});
