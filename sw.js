/**
 * sw.js — Service Worker
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 *
 * Strateji özeti:
 *   - Navigasyon (HTML)      → Network-First  (çevrimdışıysa önbellekten)
 *   - Çekirdek CSS/JS        → Stale-While-Revalidate (anında aç, arkada güncelle)
 *   - 3D model & doku & görsel → Cache-First (ilk indirmeden sonra ağa çıkmaz)
 *   - Harici CDN (A-Frame, Lucide, Fonts) → Stale-While-Revalidate
 *
 * SÜRÜM YÜKSELTME: Dosyalarda değişiklik yaptığınızda CACHE_VERSION'ı artırın.
 * activate aşamasında eski sürüme ait tüm önbellekler silinir.
 */

const CACHE_VERSION = 'v1.0.0';

const CORE_CACHE    = `hastane-ar-core-${CACHE_VERSION}`;   // install'da yüklenen çekirdek
const RUNTIME_CACHE = `hastane-ar-runtime-${CACHE_VERSION}`; // CSS/JS/CDN — SWR
const ASSET_CACHE   = `hastane-ar-assets-${CACHE_VERSION}`;  // 3D model, doku, görsel — Cache-First

const CURRENT_CACHES = [CORE_CACHE, RUNTIME_CACHE, ASSET_CACHE];

/** Çevrimdışı iken navigasyon isteklerine verilecek yedek sayfa */
const OFFLINE_FALLBACK = './index.html';

/**
 * İlk kurulumda önbelleğe alınacak çekirdek kabuk (app shell).
 * NOT: index.html içindeki ?v=... sürüm etiketleriyle birebir aynı olmalıdır.
 * Eşleşmezse dosya yine de çalışır, sadece ilk açılışta ağdan indirilir.
 */
const PRECACHE_URLS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './config.js?v=1.0.2',
    './css/base.css?v=1.3.0',
    './css/screens.css?v=1.2.0',
    './css/ar.css?v=1.2.0',
    './js/router.js?v=2.1.0',
    './js/settings.js?v=2.2.0',
    './js/list.js?v=2.1.0',
    './js/detail.js?v=2.1.0',
    './js/pwa.js?v=1.0.0',
    './Assets/logo.png',
    './Assets/favicon.ico',
    './Assets/icons/icon-192.png',
    './Assets/icons/icon-512.png',
    './Assets/icons/apple-touch-icon.png'
];

/**
 * Cache-First uygulanacak ağır varlıklar.
 * AR projelerinde 3D model ve dokular büyüktür; bir kez indirilir, tekrar ağa çıkılmaz.
 */
const HEAVY_ASSET_RE = /\.(?:glb|gltf|bin|ktx2|basis|hdr|drc|fbx|obj|mtl|png|jpe?g|webp|avif|svg|ico|mp3|ogg|wav)$/i;

/** Harici (cross-origin) izin verilen kaynaklar — sadece bunlar önbelleklenir */
const ALLOWED_CDN_HOSTS = [
    'aframe.io',
    'unpkg.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

/** Runtime önbelleklerinin üst sınırı (girdi sayısı) */
const MAX_ASSET_ENTRIES   = 120;
const MAX_RUNTIME_ENTRIES = 60;


/* ════════════════════════════════════════════════════
   INSTALL — Çekirdek kabuğu önbelleğe al
════════════════════════════════════════════════════ */
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CORE_CACHE);
        // addAll "hepsi ya da hiçbiri"dir; tek bir 404 kurulumu düşürür.
        // Bu yüzden tek tek ekliyoruz: eksik dosya kurulumu engellemez.
        await Promise.allSettled(
            PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
        );
    })());
});


/* ════════════════════════════════════════════════════
   ACTIVATE — Eski sürüm önbelleklerini temizle
════════════════════════════════════════════════════ */
self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter((key) => key.startsWith('hastane-ar-') && !CURRENT_CACHES.includes(key))
                .map((key) => caches.delete(key))
        );

        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }

        await self.clients.claim();
    })());
});


/* ════════════════════════════════════════════════════
   FETCH — Strateji yönlendirici
════════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;
    // Range isteklerini (video/ses seek) önbelleğe alma — 200 yanıtı player'ı bozar
    if (request.headers.has('range')) return;

    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    const sameOrigin = url.origin === self.location.origin;

    // 1) HTML navigasyonu → Network-First
    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(event));
        return;
    }

    // 2) Harici CDN (A-Frame, Lucide, Google Fonts) → Stale-While-Revalidate
    if (!sameOrigin) {
        if (ALLOWED_CDN_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host))) {
            event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, MAX_RUNTIME_ENTRIES));
        }
        return;
    }

    // 3) 3D model / doku / görsel / ses → Cache-First (talep anında yazılır)
    if (HEAVY_ASSET_RE.test(url.pathname)) {
        event.respondWith(cacheFirst(request, ASSET_CACHE, MAX_ASSET_ENTRIES));
        return;
    }

    // 4) Çekirdek CSS / JS / manifest → Stale-While-Revalidate
    //    CORE_CACHE'e yazılır: precache ile aynı kova, böylece dosyalar çiftlenmez.
    event.respondWith(staleWhileRevalidate(request, CORE_CACHE, 0));
});


/* ════════════════════════════════════════════════════
   STRATEJİLER
════════════════════════════════════════════════════ */

/** Network-First: ağ öncelikli, başarısızsa önbellek, o da yoksa offline fallback */
async function networkFirst(event) {
    const request = event.request;
    try {
        const preload = await event.preloadResponse;
        const response = preload || await fetch(request);
        if (isCacheable(response)) {
            const cache = await caches.open(CORE_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;

        const fallback = await caches.match(OFFLINE_FALLBACK, { ignoreSearch: true });
        if (fallback) return fallback;

        return new Response(
            '<!doctype html><meta charset="utf-8"><title>Çevrimdışı</title>' +
            '<body style="font-family:sans-serif;background:#000;color:#fff;display:grid;place-items:center;height:100vh;margin:0">' +
            '<p>Çevrimdışısınız. Bağlantı kurulduğunda tekrar deneyin.</p></body>',
            { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }
}

/** Cache-First: bir kez indir, sonra hep önbellekten ver (ağır 3D varlıklar) */
async function cacheFirst(request, cacheName, maxEntries) {
    const cache = await caches.open(cacheName);

    const cached = await cache.match(request) || await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (isCacheable(response)) {
            await cache.put(request, response.clone());
            trimCache(cacheName, maxEntries);
        }
        return response;
    } catch (err) {
        return Response.error();
    }
}

/** Stale-While-Revalidate: önbellekten anında ver, arkada sessizce güncelle */
async function staleWhileRevalidate(request, cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request) || await caches.match(request, { ignoreSearch: true });

    const networkPromise = fetch(request)
        .then((response) => {
            if (isCacheable(response)) {
                cache.put(request, response.clone()).then(() => trimCache(cacheName, maxEntries));
            }
            return response;
        })
        .catch(() => null);

    if (cached) return cached;

    const network = await networkPromise;
    return network || Response.error();
}


/* ════════════════════════════════════════════════════
   YARDIMCILAR
════════════════════════════════════════════════════ */

/**
 * Sadece geçerli yanıtlar önbelleğe yazılır.
 * type === 'opaque' → CORS başlığı olmayan cross-origin yanıt; boyutu bilinmez
 * ve durum kodu okunamaz, bu yüzden kabul ediyoruz ama sadece CDN listesinden gelir.
 */
function isCacheable(response) {
    if (!response) return false;
    if (response.type === 'opaque') return true;
    return response.ok && response.status === 200;
}

/** Basit FIFO budama — önbellek sınırsız büyümesin. maxEntries = 0 → budama yok */
async function trimCache(cacheName, maxEntries) {
    if (!maxEntries) return;
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxEntries) return;
    for (let i = 0; i < keys.length - maxEntries; i++) {
        await cache.delete(keys[i]);
    }
}


/* ════════════════════════════════════════════════════
   İSTEMCİ MESAJLARI
════════════════════════════════════════════════════ */
self.addEventListener('message', (event) => {
    const data = event.data;
    if (!data) return;

    // "Güncelle" butonundan gelir: bekleyen SW'yi hemen devreye al
    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // Ayarlar → "Oturum Verilerini Temizle" akışından çağrılabilir
    if (data.type === 'CLEAR_CACHES') {
        event.waitUntil(
            caches.keys().then((keys) =>
                Promise.all(keys.filter((k) => k.startsWith('hastane-ar-')).map((k) => caches.delete(k)))
            )
        );
    }
});
