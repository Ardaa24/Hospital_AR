/**
 * pwa.js — Progressive Web App Katmanı
 *
 * Sorumluluklar:
 *   - Service Worker kaydı ve güncelleme akışı
 *   - beforeinstallprompt yakalama → "Uygulamayı Yükle" kartı
 *   - iOS Safari için "Ana Ekrana Ekle" yönergesi (iOS'ta beforeinstallprompt yoktur)
 *   - AR oturumu sırasında yükleme kartını gizleme
 *
 * Bağımlılıklar:
 *   - router.js → showToast, vibrate
 *
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

(function () {
    'use strict';

    /* ── Sabitler ── */
    const SW_URL              = 'sw.js';
    const DISMISS_KEY         = 'pwa_install_dismissed_at';
    const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün sessize alma
    const UPDATE_CHECK_MS     = 30 * 60 * 1000;          // Açık uygulamada yeni sürüm yoklama aralığı

    /* ── Durum ── */
    let deferredPrompt     = null;   // beforeinstallprompt event nesnesi
    let bannerEl           = null;
    let iosSheetEl         = null;
    let waitingReg         = null;   // Bekleyen yeni sürümün kaydı
    let updatePending      = false;  // AR sürerken gelen güncelleme, çıkışta gösterilecek
    let userAcceptedUpdate = false;  // Sayfa yalnızca kullanıcı "Güncelle"ye basınca yenilenir

    /* ════════════════════════════════════════════════════
       ORTAM TESPİTİ
    ════════════════════════════════════════════════════ */

    /** Uygulama zaten yüklü mü? (standalone pencerede mi açıldı?) */
    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.navigator.standalone === true;
    }

    /** iOS Safari — beforeinstallprompt desteklemez, manuel yönerge gerekir */
    function isIOS() {
        const ua = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(ua) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function isDismissedRecently() {
        const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
        return ts > 0 && (Date.now() - ts) < DISMISS_COOLDOWN_MS;
    }

    /* ════════════════════════════════════════════════════
       1) SERVICE WORKER KAYDI
    ════════════════════════════════════════════════════ */
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;

        // Service Worker yalnızca HTTPS veya localhost üzerinde çalışır
        const secure = location.protocol === 'https:' ||
                       ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
        if (!secure) {
            console.warn('[PWA] Service Worker atlandı — HTTPS veya localhost gerekli.');
            return;
        }

        navigator.serviceWorker.register(SW_URL)
            .then((reg) => {
                // Sayfa açıldığında zaten bekleyen bir sürüm olabilir (önceki ziyarette indirildi)
                if (reg.waiting && navigator.serviceWorker.controller) {
                    promptUpdate(reg);
                }

                // Yeni sürüm bulundu → kurulum bitince kullanıcıya bildir
                reg.addEventListener('updatefound', () => {
                    const sw = reg.installing;
                    if (!sw) return;
                    sw.addEventListener('statechange', () => {
                        // controller varsa bu ilk kurulum değil, gerçek bir güncellemedir
                        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                            promptUpdate(reg);
                        }
                    });
                });

                scheduleUpdateChecks(reg);
            })
            .catch((err) => console.error('[PWA] Service Worker kaydı başarısız:', err));

        // Yeni SW devreye girdiğinde sayfayı bir kez tazele — yalnızca kullanıcı
        // "Güncelle"ye bastıysa. Başka sekmeden gelen geçiş AR oturumunu kesmesin.
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing || !userAcceptedUpdate) return;
            refreshing = true;
            window.location.reload();
        });
    }

    /**
     * Uygulama açık kaldığı sürece yeni sürümü kendiliğinden yoklar:
     * sekme/uygulama tekrar öne geldiğinde ve UPDATE_CHECK_MS aralıklarla.
     * (Tarayıcı varsayılanı yalnızca sayfa gezinmesinde kontrol eder; PWA
     * tam ekranda günlerce açık kalabilir.)
     */
    function scheduleUpdateChecks(reg) {
        const check = () => {
            if (!navigator.onLine || isArActive()) return;
            reg.update().catch(() => { /* çevrimdışı vb. — sessizce geç */ });
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
        });
        setInterval(check, UPDATE_CHECK_MS);
    }

    function isArActive() {
        // AppState router.js'te `const` ile tanımlı: window üzerinde değil, global kapsamda
        return typeof AppState !== 'undefined' && !!AppState.arActive;
    }

    /** Güncelleme mevcut — "Güncelle" butonlu bildirim çubuğunu göster */
    function promptUpdate(reg) {
        waitingReg = reg;
        // AR navigasyonu sürerken gösterme: tıklanınca sayfa yenilenir, rota yarıda kalır.
        // AR'dan çıkınca (exit-vr) gösterilir.
        if (isArActive()) { updatePending = true; return; }
        showUpdateBar();
    }

    function showUpdateBar() {
        const el = document.getElementById('pwa-update-bar');
        if (!el || !waitingReg) return;
        updatePending = false;
        if (window.lucide) lucide.createIcons({ root: el });
        el.classList.add('visible');

        const btn = el.querySelector('#pwa-update-btn');
        btn.disabled = false;
        btn.textContent = 'Güncelle';
        btn.onclick = () => {
            const waiting = waitingReg && waitingReg.waiting;
            if (!waiting) { window.location.reload(); return; }
            userAcceptedUpdate = true;
            btn.disabled = true;
            btn.textContent = 'Güncelleniyor…';
            waiting.postMessage({ type: 'SKIP_WAITING' });
        };

        el.querySelector('#pwa-update-later').onclick = () => {
            // Daha sonra: bu oturumda gizle. Bekleyen sürüm, uygulama
            // tamamen kapatılıp açıldığında zaten kendiliğinden devreye girer.
            el.classList.remove('visible');
        };
    }

    function hideUpdateBar() {
        const el = document.getElementById('pwa-update-bar');
        if (el && el.classList.contains('visible')) {
            el.classList.remove('visible');
            updatePending = true; // AR bitince yeniden göster
        }
    }

    /* ════════════════════════════════════════════════════
       2) YÜKLEME KARTI (beforeinstallprompt)
    ════════════════════════════════════════════════════ */

    function showBanner() {
        if (!bannerEl || isStandalone() || isDismissedRecently()) return;
        bannerEl.classList.add('visible');
        document.body.classList.add('pwa-banner-open');
    }

    function hideBanner() {
        if (bannerEl) bannerEl.classList.remove('visible');
        document.body.classList.remove('pwa-banner-open');
    }

    /** Yükle butonuna basıldığında yerel tarayıcı diyaloğunu tetikler */
    async function triggerInstall() {
        // iOS: yerel diyalog yok, manuel yönerge göster
        if (!deferredPrompt) {
            if (isIOS()) { openIosSheet(); return; }
            if (window.showToast) {
                showToast('Yükleme menüsü hazır değil. Tarayıcı menüsünden "Uygulamayı yükle" seçeneğini kullanın.');
            }
            return;
        }

        hideBanner();
        deferredPrompt.prompt();

        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null; // prompt() yalnızca bir kez çağrılabilir

        if (outcome === 'accepted') {
            if (window.vibrate) vibrate(60);
        } else {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        }
    }

    function dismissBanner() {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        hideBanner();
    }

    /* ── iOS "Ana Ekrana Ekle" yönergesi ── */
    function openIosSheet() {
        if (!iosSheetEl) return;
        iosSheetEl.classList.add('visible');
        if (window.lucide) lucide.createIcons({ root: iosSheetEl });
    }

    function closeIosSheet() {
        if (iosSheetEl) iosSheetEl.classList.remove('visible');
    }

    /* ════════════════════════════════════════════════════
       3) AR OTURUMU SIRASINDA GİZLE
    ════════════════════════════════════════════════════ */
    function bindArVisibility() {
        const scene = document.getElementById('ar-scene');
        if (!scene) return;
        scene.addEventListener('enter-vr', () => {
            hideBanner();
            hideUpdateBar();
        });
        scene.addEventListener('exit-vr', () => {
            if (deferredPrompt || isIOS()) showBanner();
            if (updatePending) setTimeout(showUpdateBar, 600); // Ekran geçişi otursun
        });
    }

    /* ════════════════════════════════════════════════════
       BAŞLATMA
    ════════════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', () => {
        bannerEl   = document.getElementById('pwa-install-banner');
        iosSheetEl = document.getElementById('pwa-ios-sheet');

        registerServiceWorker();
        bindArVisibility();

        const installBtn  = document.getElementById('pwa-install-btn');
        const dismissBtn  = document.getElementById('pwa-install-dismiss');
        const iosCloseBtn = document.getElementById('pwa-ios-close');

        if (installBtn)  installBtn.addEventListener('click', triggerInstall);
        if (dismissBtn)  dismissBtn.addEventListener('click', dismissBanner);
        if (iosCloseBtn) iosCloseBtn.addEventListener('click', closeIosSheet);
        if (iosSheetEl)  iosSheetEl.addEventListener('click', (e) => {
            if (e.target === iosSheetEl) closeIosSheet();
        });

        // iOS'ta beforeinstallprompt hiç tetiklenmez → kartı doğrudan göster
        if (isIOS() && !isStandalone()) {
            setTimeout(showBanner, 2500);
        }
    });

    /* Chrome / Edge / Samsung Internet: yükleme kriterleri sağlandığında tetiklenir */
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();          // Tarayıcının kendi mini-infobar'ını bastır
        deferredPrompt = e;          // Kullanıcı butona basana kadar sakla
        showBanner();
    });

    /* Yükleme tamamlandı */
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideBanner();
        localStorage.removeItem(DISMISS_KEY);
        if (window.showToast) showToast('✓ Uygulama ana ekranınıza eklendi');
    });
})();
