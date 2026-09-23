/*
 * Service Worker — bewusst minimal gehalten.
 *
 * Er hat genau zwei Aufgaben:
 *   1. Die App installierbar machen ("Zum Startbildschirm hinzufügen").
 *      Dafür verlangen die Browser einen registrierten Service Worker.
 *   2. Bei Funkloch eine ordentliche Offline-Seite zeigen statt des
 *      Dinosauriers.
 *
 * WAS ER ABSICHTLICH NICHT TUT: Seiten mit Nutzerdaten zwischenspeichern.
 * Angebote, Preise und Kundendaten sind personenbezogen — die haben im
 * Cache-Storage nichts verloren, erst recht nicht auf einem Gerät, das auf der
 * Baustelle herumliegt. Gecacht wird nur, was für jeden gleich ist: Icons,
 * Offline-Seite und die unveränderlichen Build-Dateien von Next.
 */

const CACHE = "baustift-v1";
const SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      // Sofort aktiv werden, statt auf das Schliessen aller Tabs zu warten.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namen) =>
        Promise.all(
          namen.filter((n) => n !== CACHE).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nur GET. POST (Formulare, Server Actions) darf nie aus dem Cache kommen.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Fremde Hosts (Supabase, Stripe, Google) unangetastet lassen.
  if (url.origin !== self.location.origin) return;

  // Auth- und API-Routen immer frisch aus dem Netz.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) {
    return;
  }

  // Build-Artefakte von Next tragen einen Hash im Namen und ändern sich nie:
  // Cache-First ist hier sicher und macht den zweiten Start spürbar schneller.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      caches.match(request).then(
        (treffer) =>
          treffer ??
          fetch(request).then((antwort) => {
            const kopie = antwort.clone();
            caches.open(CACHE).then((c) => c.put(request, kopie));
            return antwort;
          }),
      ),
    );
    return;
  }

  // Seitenaufrufe: Netz zuerst, bei Fehler die Offline-Seite.
  // Kein Zwischenspeichern der Antwort — sie enthält Nutzerdaten.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
  }
});
