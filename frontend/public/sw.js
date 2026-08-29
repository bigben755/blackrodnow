/* Blackrod Now service worker — push notifications + PWA install. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { body: event.data ? event.data.text() : "" };
    }
    const title = data.title || "Blackrod Now";
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || "",
            icon: data.icon || "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            data: { url: data.url || "/" },
            tag: data.tag || undefined,
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
            for (const w of wins) {
                if ("focus" in w) {
                    w.navigate(url);
                    return w.focus();
                }
            }
            return self.clients.openWindow(url);
        })
    );
});
