/**
 * settings.js — Ayarlar Çekmecesi ve Uygulama Tercihleri
 *
 * Sorumluluklar:
 *   - Ayarlar çekmecesini açma/kapama
 *   - İzin rozetlerini güncelleme
 *   - AR Ok Stili tercihi (localStorage'a kaydedilir)
 *
 * Bağımlılıklar: router.js (showToast)
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

/* ════════════════════════════════════════════════════
   AR OK STİLİ YÖNETİMİ
════════════════════════════════════════════════════ */
const ARROW_STYLE_KEY     = 'ar_arrow_style';
const ARROW_STYLE_DEFAULT = 'chevron';
const VALID_ARROW_STYLES  = ['chevron', 'strip', 'particles'];

/** Kayıtlı ok stilini döndürür. Kayıt yoksa varsayılanı döndürür. */
function getArrowStyle() {
    const saved = localStorage.getItem(ARROW_STYLE_KEY);
    return VALID_ARROW_STYLES.includes(saved) ? saved : ARROW_STYLE_DEFAULT;
}

/** Ok stilini kaydeder ve ayarlar UI'ini günceller. */
function setArrowStyle(style) {
    if (!VALID_ARROW_STYLES.includes(style)) return;
    localStorage.setItem(ARROW_STYLE_KEY, style);
    _updateArrowStyleUI();
    showToast(`Ok stili değiştirildi: ${_arrowStyleLabel(style)}`);
}

/** İnsan okunabilir stil etiketi */
function _arrowStyleLabel(style) {
    const labels = { chevron: 'Google Chevron', strip: 'Zemin Şeridi', particles: 'Akan Parçacıklar' };
    return labels[style] || style;
}

/** Ayarlar çekmecesindeki seçili stil butonunu günceller */
function _updateArrowStyleUI() {
    const current = getArrowStyle();
    VALID_ARROW_STYLES.forEach(style => {
        const btn = document.getElementById(`arrow-style-${style}`);
        if (btn) {
            btn.classList.toggle('active', style === current);
            btn.setAttribute('aria-pressed', style === current ? 'true' : 'false');
        }
    });
}

let _settingsBackdrop, _settingsDrawer;

function initSettings() {
    const btnToggle = document.getElementById('btn-settings');
    const btnClose = document.getElementById('btn-settings-close');
    _settingsBackdrop = document.getElementById('settings-backdrop');
    _settingsDrawer = document.getElementById('settings-drawer');
    const handle = document.getElementById('settings-handle');
    const header = document.querySelector('.settings-header');

    if (!btnToggle || !btnClose || !_settingsBackdrop || !_settingsDrawer) return;

    // Aç
    btnToggle.addEventListener('click', openSettingsDrawer);
    // Kapat
    btnClose.addEventListener('click', closeSettingsDrawer);
    _settingsBackdrop.addEventListener('click', closeSettingsDrawer);

    // Swipe down to close gesture
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const onTouchStart = (e) => {
        startY = e.touches[0].clientY;
        currentY = startY;
        isDragging = true;
        _settingsDrawer.style.transition = 'none';
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            _settingsDrawer.style.transform = `translateY(${diff}px)`;
            if (e.cancelable) e.preventDefault();
        }
    };

    const onTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        _settingsDrawer.style.transition = 'transform 0.3s cubic-bezier(0.32, 1, 0.6, 1)';
        const diff = currentY - startY;
        if (diff > 80) {
            closeSettingsDrawer();
        } else {
            _settingsDrawer.style.transform = 'translateY(0)';
        }
        startY = 0;
        currentY = 0;
    };

    // Attach to handle
    if (handle) {
        handle.addEventListener('touchstart', onTouchStart, { passive: true });
        handle.addEventListener('touchmove', onTouchMove, { passive: false });
        handle.addEventListener('touchend', onTouchEnd, { passive: true });
    }

    // Attach to header as well for better target area
    if (header) {
        header.addEventListener('touchstart', onTouchStart, { passive: true });
        header.addEventListener('touchmove', onTouchMove, { passive: false });
        header.addEventListener('touchend', onTouchEnd, { passive: true });
    }
}

function openSettingsDrawer() {
    _settingsDrawer.style.transition = 'transform 0.3s cubic-bezier(0.32, 1, 0.6, 1)';
    _settingsBackdrop.style.display = 'block';
    setTimeout(() => {
        _settingsBackdrop.classList.add('visible');
        _settingsDrawer.style.transform = 'translateY(0)';
    }, 10);

    updatePermissionBadges();
    _updateArrowStyleUI();

    // Rerender Lucide icons inside settings drawer
    if (window.lucide) {
        lucide.createIcons({ root: _settingsDrawer });
    }
}

function closeSettingsDrawer() {
    _settingsDrawer.style.transition = 'transform 0.3s cubic-bezier(0.32, 1, 0.6, 1)';
    _settingsDrawer.style.transform = 'translateY(100%)';
    _settingsBackdrop.classList.remove('visible');
    
    setTimeout(() => {
        _settingsBackdrop.style.display = 'none';
    }, 300);
}

async function updatePermissionBadges() {
    const cameraBadge = document.getElementById('perm-camera-badge');
    if (!cameraBadge) return;

    const hasSessionPerm = sessionStorage.getItem('ar_camera_granted') === 'true';

    // Query browser permission
    let status = 'prompt';
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const res = await navigator.permissions.query({ name: 'camera' });
            status = res.state; // 'granted', 'denied', or 'prompt'
        } catch (e) {
            console.warn("Camera status query error:", e);
            status = hasSessionPerm ? 'granted' : 'prompt';
        }
    } else {
        status = hasSessionPerm ? 'granted' : 'prompt';
    }

    cameraBadge.className = 'perm-badge';
    if (status === 'granted') {
        cameraBadge.classList.add('status-granted');
        cameraBadge.textContent = 'İzin Verildi';
    } else if (status === 'denied') {
        cameraBadge.classList.add('status-denied');
        cameraBadge.textContent = 'Reddedildi';
    } else {
        cameraBadge.classList.add('status-prompt');
        cameraBadge.textContent = 'Sorulacak';
    }
}

function resetCameraPermission() {
    sessionStorage.removeItem('ar_camera_granted');
    updatePermissionBadges();
    showToast("Kamera izni sıfırlandı. İlk açılışta tekrar sorulacaktır.");
}

function clearSessionData() {
    sessionStorage.clear();

    // PWA önbelleğini de boşalt — bozuk/eski önbellek AR'ı kilitleyebilir
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHES' });
    }

    updatePermissionBadges();
    showToast("Tüm oturum verileri ve geçici izinler sıfırlandı.");
}
