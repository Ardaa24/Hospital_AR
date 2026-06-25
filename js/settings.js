/**
 * settings.js — Sistem Ayarları & Bottom Sheet Drawer Yönetimi v2.0
 * Bağımlılıklar: router.js (showToast), ar.js (window.ARDebug)
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */


function initSettings() {
    const btnToggle = document.getElementById('btn-settings');
    const btnClose = document.getElementById('btn-settings-close');
    const backdrop = document.getElementById('settings-backdrop');
    const drawer = document.getElementById('settings-drawer');
    const handle = document.getElementById('settings-handle');
    const header = document.querySelector('.settings-header');

    if (!btnToggle || !btnClose || !backdrop || !drawer) return;

    // Aç
    btnToggle.addEventListener('click', openSettingsDrawer);
    // Kapat
    btnClose.addEventListener('click', closeSettingsDrawer);
    backdrop.addEventListener('click', closeSettingsDrawer);

    // Swipe down to close gesture
    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const onTouchStart = (e) => {
        startY = e.touches[0].clientY;
        currentY = startY;
        isDragging = true;
        drawer.style.transition = 'none';
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            drawer.style.transform = `translateY(${diff}px)`;
            if (e.cancelable) e.preventDefault();
        }
    };

    const onTouchEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        drawer.style.transition = 'transform 0.3s cubic-bezier(0.32, 1, 0.6, 1)';
        const diff = currentY - startY;
        if (diff > 80) {
            closeSettingsDrawer();
        } else {
            drawer.style.transform = 'translateY(0)';
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
    const backdrop = document.getElementById('settings-backdrop');
    const drawer = document.getElementById('settings-drawer');
    
    drawer.style.transition = 'transform 0.3s cubic-bezier(0.32, 1, 0.6, 1)';
    backdrop.style.display = 'block';
    setTimeout(() => {
        backdrop.classList.add('visible');
        drawer.style.transform = 'translateY(0)';
    }, 10);

    updatePermissionBadges();

    // Rerender Lucide icons inside settings drawer
    if (window.lucide) {
        lucide.createIcons({ root: drawer });
    }
}

function closeSettingsDrawer() {
    const backdrop = document.getElementById('settings-backdrop');
    const drawer = document.getElementById('settings-drawer');
    
    drawer.style.transition = 'transform 0.3s cubic-bezier(0.32, 1, 0.6, 1)';
    drawer.style.transform = 'translateY(100%)';
    backdrop.classList.remove('visible');
    
    setTimeout(() => {
        backdrop.style.display = 'none';
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
    updatePermissionBadges();
    showToast("Tüm oturum verileri ve geçici izinler sıfırlandı.");
}
