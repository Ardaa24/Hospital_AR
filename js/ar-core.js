/**
 * js/ar-core.js
 * AR Motoru Core (Oturum, A-Frame Yaşam Döngüsü ve Hit-Test)
 */

'use strict';

const ARCore = (function() {
    const _dom = {
        scene:       () => document.getElementById('ar-scene'),
        overlay:     () => document.getElementById('ar-overlay'),
        infoScreen:  () => document.getElementById('ar-info-screen'),
        doneScreen:  () => document.getElementById('ar-done'),
        arrows:      () => document.getElementById('ar-arrows'),
        cam:         () => document.getElementById('ar-cam'),
        arrivedBtn:  () => document.getElementById('ar-arrived-btn'),
        turnOverlay: () => document.getElementById('ar-turn'),
        topHud:      () => document.getElementById('ar-top-hud'),
        bottomPanel: () => document.getElementById('ar-bottom'),
    };

    // Göz hizasından zemine olan mesafe varsayımı (metre)
    // Kullanıcı uygulamayı ayaktayken başlatınca bu değer doğru zemin yüksekliğini verir.
    const EYE_HEIGHT_M = 1.6;

    let _groundY = -EYE_HEIGHT_M; // Baslangic fallback: kamera rige gore 1.6m asagisi
    let _groundLocked = false;    // Bir kez olculunce true olur, bir daha degismez

    // Callback event listeners (ar.js tarafından set edilecek)
    let _onEnterCallback = null;
    let _onExitCallback = null;

    function init(onEnter, onExit) {
        _onEnterCallback = onEnter;
        _onExitCallback = onExit;

        window.addEventListener('DOMContentLoaded', () => {
            const scene = _dom.scene();
            if (scene) {
                scene.addEventListener('enter-vr', _handleEnterAR);
                scene.addEventListener('exit-vr', _handleExitAR);

                // Start paused to save battery
                scene.addEventListener('loaded', () => {
                    if (scene.pause) scene.pause();
                });
            }
        });
    }

    function _handleEnterAR() {
        // Her yeni oturumda kilidi AÇIK birak ki ilk frame'de taze olcum yapilsin.
        // Fakat _groundLocked = false YAPMA — bu ikinci bacaklarin da dogru zemini korumasini saglar.
        // Sadece sayfanin ilk yuklenisinde (doStartAR sonrasi) lock sifirlanir.
        if (_onEnterCallback) _onEnterCallback();
    }

    function _handleExitAR() {
        if (_onExitCallback) _onExitCallback();
    }

    /**
     * Her tick'te cagrilan zemin yuksekligi guncelleyici.
     * camY: A-Frame dunyasindaki kameranin Y koordinati (getWorldPosition'dan).
     *
     * Mantik:
     *   - Ilk gecerli camY geldiginde groundY = camY - EYE_HEIGHT_M hesapla ve kilitle.
     *   - Sonraki tum cagrida (ikinci bacak dahil) ayni deger kullanilir, degismez.
     *   - Kullanicinin oturup kalkmasi ya da telefonu sallamasi groundY'yi etkilemez.
     */
    function updateGroundY(scene, camY) {
        if (_groundLocked) return; // Kilitliyse hic dokunma

        // camY != 0 kontrolu: kamera rig'i henuz XR tracking'i almamis olabilir
        if (camY !== 0 && Math.abs(camY) > 0.01) {
            _groundY = camY - EYE_HEIGHT_M;
            _groundLocked = true;
            console.log('[ARCore] Zemin kilitleni:', _groundY.toFixed(3), 'camY:', camY.toFixed(3));
        }
    }

    function getGroundY() {
        return _groundY;
    }

    
    async function waitForStableCamera(timeoutMs = 1500) {
        return new Promise((resolve) => {
            const SAMPLE_FRAMES = 3;  
            const startTime = performance.now();
            const samples = [];
            
            // Wait 500ms for tracking to kick in, then take 3 frames
            setTimeout(() => {
                let rafId;
                const check = () => {
                    const cam = _dom.cam().object3D;
                    const pos = new THREE.Vector3();
                    cam.getWorldPosition(pos);

                    samples.push({ x: pos.x, y: pos.y, z: pos.z });
                    if (samples.length >= SAMPLE_FRAMES) {
                        const avgX = samples.reduce((s, r) => s + r.x, 0) / samples.length;
                        const avgZ = samples.reduce((s, r) => s + r.z, 0) / samples.length;
                        const avgY = samples.reduce((s, r) => s + r.y, 0) / samples.length;
                        resolve(new THREE.Vector3(avgX, avgY, avgZ));
                        return;
                    }

                    if (performance.now() - startTime > timeoutMs) {
                        resolve(pos);
                        return;
                    }
                    rafId = requestAnimationFrame(check);
                };
                rafId = requestAnimationFrame(check);
            }, 500);
        });
    }

    function getDOM() {
        return _dom;
    }

    return {
        init,
        updateGroundY,
        getGroundY,
        getDOM,
        waitForStableCamera,
        // Yeni oturum baslarken (doStartAR) groundLock'u sifirla ki taze olcum yapilsin
        resetGroundLock: () => { _groundLocked = false; _groundY = -EYE_HEIGHT_M; },
        isGroundLocked: () => _groundLocked
    };
})();
