const CACHE_NAME = "leaflet-student-v1";

const FILES_TO_CACHE = [
  "./",
  "./manifest.json",

  "./student-html/splash.html",
  "./student-html/onboarding.html",
  "./student-html/home.html",

  "./student-css/splash.css",
  "./student-css/onboarding.css",

  "./student-js/onboarding.js",

  "./assets/images/LOGO.png",
  "./assets/images/onboarding-1.png",
  "./assets/images/onboarding-2.png",
  "./assets/images/onboarding-3.png",

  "./student-html/flashcards.html",
  "./student-css/flashcards.css",
  "./student-js/flashcards.js",
  "./student-components/mobile-nav.html",
  "./student-components/mobile-nav.css",
  "./student-components/mobile-nav.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedFile) => {
      return cachedFile || fetch(event.request);
    })
  );
});