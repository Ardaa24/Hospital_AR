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

    let _hitTestSource = null;
    let _xrRefSpace = null;
    let _xrViewerSpace = null;
    //  local-floor zemin koordinatı Y=0
    let _groundY = 0; 

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
        const scene = _dom.scene();

        // XR Reference Space and Hit Test Source setup
        if (scene.is('ar-mode') && scene.renderer.xr.getSession()) {
            const xrSession = scene.renderer.xr.getSession();
            xrSession.requestReferenceSpace('local-floor').then(rs => {
                _xrRefSpace = rs;
            }).catch(() => {
                // Fallback to local
                xrSession.requestReferenceSpace('local').then(rs => { _xrRefSpace = rs; });
            });
            xrSession.requestReferenceSpace('viewer').then(rs => {
                _xrViewerSpace = rs;
                xrSession.requestHitTestSource({ space: _xrViewerSpace }).then(source => {
                    _hitTestSource = source;
                }).catch(err => console.log('[AR] Hit-test not supported:', err));
            });
        }

        if (_onEnterCallback) _onEnterCallback();
    }

    function _handleExitAR() {
        if (_hitTestSource) {
            try { _hitTestSource.cancel(); } catch (_) {}
            _hitTestSource = null;
        }
        
        if (_onExitCallback) _onExitCallback();
    }

    function updateGroundY(scene, camY) {
        // local-floor: zemin Y=0. Kamera Y'si kullanıcı boyu (~1.6m).
        // Ribbon ve ayak izleri için zemin her zaman 0.
        _groundY = 0;
    }

    function getGroundY() {
        return _groundY;
    }

    // Kamera stabilizasyon kontrolü (Bug 3 + Bug 2 Fix)
    // local-floor + A-Frame: enter-vr sonrası kamera önce (0, ~0, 0) veya (0, 1.6, 0)
    // A-Frame default pozisyonunda bekliyor. XR tracking devralınca kamera Y
    // gerçek kullanıcı boyuna yükseliç (>0.3m). 
    // Fix: XR tracking aktif olduktan sonra 3 frame oku, ortalamasını al.
    // Kullanıcı hareket ediyor olabilir (ikinci ayağın başında yürüyor),
    // bu yüzden XZ stabilite BEKLEME — sadece tracking var mı kontrol et.
    async function waitForStableCamera(timeoutMs = 4000) {
        return new Promise((resolve) => {
            const MIN_CAMERA_Y = 0.3; // XR tracking aktif eşiği
            const SAMPLE_FRAMES = 3;  // Tracking aktifken kaç frame topla
            const startTime = performance.now();
            const samples = [];

            let rafId;
            const check = () => {
                const cam = _dom.cam().object3D;
                const pos = new THREE.Vector3();
                cam.getWorldPosition(pos);

                if (pos.y >= MIN_CAMERA_Y) {
                    // XR tracking aktif — bu frame'i say
                    samples.push({ x: pos.x, y: pos.y, z: pos.z });
                    if (samples.length >= SAMPLE_FRAMES) {
                        // SAMPLE_FRAMES frame'in ortalamasını al
                        const avgX = samples.reduce((s, r) => s + r.x, 0) / samples.length;
                        const avgZ = samples.reduce((s, r) => s + r.z, 0) / samples.length;
                        const avgY = samples.reduce((s, r) => s + r.y, 0) / samples.length;
                        resolve(new THREE.Vector3(avgX, avgY, avgZ));
                        return;
                    }
                }

                if (performance.now() - startTime > timeoutMs) {
                    // Timeout: kameradan anlık pozisyon oku (samples boş olsa bile)
                    const cam2 = _dom.cam().object3D;
                    const fallback = new THREE.Vector3();
                    cam2.getWorldPosition(fallback);
                    resolve(fallback);
                    return;
                }

                rafId = requestAnimationFrame(check);
            };
            rafId = requestAnimationFrame(check);
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
        waitForStableCamera
    };
})();
