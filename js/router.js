/**
 * router.js — Ekran Yönetimi & Global Uygulama Durumu
 *
 * Sorumluluk: Tek sorumluluk ilkesi (SRP) gereği yalnızca
 *   - Ekranlar arası geçiş
 *   - Toast bildirimleri
 *   - Paylaşılan uygulama durumu
 *
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

/* ── Uygulama Durumu (Global State) ── */
const AppState = {
    activeRoute:    null,   // Seçili rota objesi
    arLegs:         [],     // Aktif AR bacakları
    legIdx:         0,      // Mevcut bacak indeksi
    arActive:       false,  // AR kamerası açık mı?
    tickRafId:      null,   // requestAnimationFrame ID
    arStartTime:    null,   // AR başlangıç zamanı
    totalDist:      0,      // Toplam rota mesafesi (metre)
};

/* ── Ekran Geçişi ── */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        target.scrollTop = 0;
    }
    window.scrollTo(0, 0);
}

/* ── Toast Bildirimi ── */
let _toastTimer = null;

function showToast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ── Haptic Geri Bildirim ── */
function vibrate(pattern) {
    if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

/* ── Başlangıçta dönüş parametresini işle (ar.html uyumu için) ── */
function handleReturnParam() {
    const params = new URLSearchParams(location.search);
    const doneId = params.get('done');
    if (!doneId) return false;

    history.replaceState(null, '', 'index.html');
    renderList();
    showScreen('s-routes');

    const doneRoute = NAV_ROUTES.find(r => r.id === doneId);
    if (doneRoute) {
        setTimeout(() => showToast(`✓ ${doneRoute.shortName || doneRoute.name} tamamlandı`), 350);
    }
    return true;
}
