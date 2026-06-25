/**
 * js/ar-debug.js
 * AR Navigasyon Debug Araçları
 * Koordinat yakalama ve saha ölçümü için tasarlanmıştır.
 */

'use strict';

const ARDebug = (function() {
    let _coordCaptureHandler = null;

    /**
     * sessionStorage üzerinden debug durumunu sorgular.
     */
    function isCaptureActive() {
        return sessionStorage.getItem('coord_capture_enabled') === 'true';
    }

    /**
     * Ayarlar çekmecesindeki düğmenin görsel durumunu günceller.
     */
    function updateSettingsUI() {
        const btn = document.getElementById('btn-toggle-debug');
        if (!btn) return;

        const active = isCaptureActive();
        if (active) {
            btn.style.cssText = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1.5px solid rgba(16, 185, 129, 0.35);';
            btn.innerHTML = '<i data-lucide="map-pin" width="18" height="18"></i> Koordinat Yakalayıcı (AÇIK)';
        } else {
            btn.style.cssText = 'background: rgba(88, 28, 135, 0.12); color: #6d28d9; border: 1.5px solid rgba(109, 40, 217, 0.25);';
            btn.innerHTML = '<i data-lucide="map-pin" width="18" height="18"></i> Koordinat Yakalayıcı';
        }

        if (window.lucide) {
            lucide.createIcons({ root: btn });
        }
    }

    /**
     * Koordinat yakalama modunu açar/kapatır.
     */
    function toggleCoordCapture() {
        const active = !isCaptureActive();
        sessionStorage.setItem('coord_capture_enabled', active ? 'true' : 'false');
        
        updateSettingsUI();

        if (window.showToast) {
            showToast(active ? '📍 Koordinat modu AÇIK — Ekrana dokunarak koordinat kopyalayabilirsiniz' : '📍 Koordinat modu KAPALI');
        }

        // Eğer AR aktifse, dokunma dinleyicisini dinamik olarak yönet
        if (typeof AppState !== 'undefined' && AppState.arActive) {
            if (active) {
                _bindTouchCapture();
            } else {
                _unbindTouchCapture();
            }
        }
    }

    /**
     * O anki kamera dünya pozisyonunu yakalar ve kopyalar.
     */
    function captureCurrentPose() {
        if (typeof AppState === 'undefined' || !AppState.arActive) {
            return;
        }

        if (typeof ARCore === 'undefined') return;
        const dom = ARCore.getDOM();
        const camEl = dom.cam();
        const cam = camEl ? camEl.object3D : null;
        if (!cam) {
            if (window.showToast) showToast('Kamera nesnesi bulunamadı!');
            return;
        }

        const pos = new THREE.Vector3();
        cam.getWorldPosition(pos);

        const coordStr = `{ pos: "${pos.x.toFixed(3)} 0 ${pos.z.toFixed(3)}" }`;
        console.info('[AR Debug Coord]', coordStr);

        if (window.showToast) {
            showToast(`📍 Kopyalandı: ${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}`);
        }

        // Panoya kopyalama
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(coordStr).catch(err => {
                console.error('[AR Debug] Clipboard write error:', err);
            });
        }

        // Dokunsal geri bildirim
        if (typeof vibrate === 'function') {
            vibrate(80);
        }
    }

    /**
     * Sahneye dokunulduğunda koordinat yakalamak için listener bağlar.
     */
    function _bindTouchCapture() {
        if (_coordCaptureHandler) return;

        _coordCaptureHandler = (e) => {
            if (typeof AppState !== 'undefined' && !AppState.arActive) return;

            // HUD elementlerine dokunulursa kopyalama yapma
            const target = e.target;
            const isHudElement = target.closest('#ar-top-hud, #ar-bottom, #ar-turn, #settings-drawer');
            if (isHudElement) return;

            captureCurrentPose();
        };

        // A-Frame touch/click olaylarını yutabildiği için capture phase'de pointerdown dinliyoruz.
        document.addEventListener('pointerdown', _coordCaptureHandler, true);
    }

    /**
     * Sahne dokunma dinleyicisini kaldırır.
     */
    function _unbindTouchCapture() {
        if (_coordCaptureHandler) {
            document.removeEventListener('pointerdown', _coordCaptureHandler, true);
            _coordCaptureHandler = null;
        }
    }

    /**
     * AR oturumu başladığında çağrılır.
     */
    function initAR() {
        if (isCaptureActive()) {
            _bindTouchCapture();
        }
    }

    /**
     * AR oturumu kapandığında çağrılır.
     */
    function cleanupAR() {
        _unbindTouchCapture();
    }

    return {
        isCaptureActive,
        updateSettingsUI,
        toggleCoordCapture,
        captureCurrentPose,
        initAR,
        cleanupAR
    };
})();

// Küresel erişim
window.ARDebug = ARDebug;
