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
    //  local-floor zemin koordinatı Y=0'dır.
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
        // Fix #1 (v2.2): local-floor zemin koordinatı her zaman 0'dır.
        // Kamera veya hit-test dalgalanmalarının oku havaya kaldırmasını önlemek için sabitliyoruz.
        _groundY = 0;
    }

    function getGroundY() {
        return 0; // Her zaman 0 döndür
    }

    function getDOM() {
        return _dom;
    }

    return {
        init,
        updateGroundY,
        getGroundY,
        getDOM
    };
})();
