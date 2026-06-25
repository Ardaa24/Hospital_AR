/**
 * js/ar-debug.js
 * AR Navigasyon Debug Araçları
 * Koordinat yakalama işlemi için tasarlandı.
 */

'use strict';

const ARDebug = (function() {
    let _coordCaptureActive = false;
    let _coordCaptureHandler = null;

    /**
     * Koordinat modunu başlatır.
     */
    function _startCapture(getCamFn) {
        _coordCaptureActive = true;
        if (window.showToast) {
            showToast('📍 Koordinat modu AÇIK — Ekrana dokunarak kaydet');
        }

        _coordCaptureHandler = (e) => {
            // AR aktif değilse yok say
            if (typeof AppState !== 'undefined' && !AppState.arActive) return;

            // HUD elementlerine tıklandıysa yok say
            const target = e.target;
            const isHudElement = target.closest('#ar-top-hud, #ar-bottom, #ar-turn, #settings-drawer');
            if (isHudElement) return;

            const cam = getCamFn();
            if (!cam) return;

            const pos = new THREE.Vector3();
            cam.getWorldPosition(pos);

            const coordStr = `{ pos: "${pos.x.toFixed(3)} 0 ${pos.z.toFixed(3)}" }`;
            console.info('[AR Coord]', coordStr);
            if (window.showToast) {
                showToast(`📍 ${coordStr}`);
            }

            // Panoya kopyala
            if (navigator.clipboard) {
                navigator.clipboard.writeText(coordStr).catch(() => {});
            }
        };

        // Fix #4 (v2.2): A-Frame click olaylarını engeller, bu yüzden capture phase'de pointerdown dinliyoruz.
        document.addEventListener('pointerdown', _coordCaptureHandler, true);
    }

    /**
     * Koordinat modunu durdurur.
     */
    function _stopCapture() {
        _coordCaptureActive = false;
        if (window.showToast) {
            showToast('📍 Koordinat modu KAPALI');
        }
        if (_coordCaptureHandler) {
            document.removeEventListener('pointerdown', _coordCaptureHandler, true);
            _coordCaptureHandler = null;
        }
    }

    /**
     * Durumu değiştirir (Toggle)
     * @param {Function} getCamFn - Kamera Three.js nesnesini döndüren fonksiyon
     */
    function toggle(getCamFn) {
        if (_coordCaptureActive) {
            _stopCapture();
        } else {
            _startCapture(getCamFn);
        }
    }

    return { toggle };
})();

// Dışarıya global ayarlar menüsünün bulabilmesi için expose ediyoruz
window.ARDebug = ARDebug;
