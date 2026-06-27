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
    let _groundY = -1.5; 

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

        if (scene.is('ar-mode') && scene.renderer.xr.getSession()) {
            const xrSession = scene.renderer.xr.getSession();
            xrSession.requestReferenceSpace('local-floor').then(rs => {
                _xrRefSpace = rs;
            }).catch(() => {
                xrSession.requestReferenceSpace('local').then(rs => _xrRefSpace = rs);
            });
            xrSession.requestReferenceSpace('viewer').then(rs => {
                _xrViewerSpace = rs;
                xrSession.requestHitTestSource({ space: _xrViewerSpace }).then(source => {
                    _hitTestSource = source;
                }).catch(err => console.log('[AR] Hit-test error:', err));
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
        if (scene.is('ar-mode') && _hitTestSource) {
            const frame = scene.frame;
            if (frame) {
                const results = frame.getHitTestResults(_hitTestSource);
                if (results.length > 0) {
                    const pose = results[0].getPose(_xrRefSpace);
                    if (pose) {
                        _groundY = pose.transform.position.y;
                        try { _hitTestSource.cancel(); } catch (_) {}
                        _hitTestSource = null;
                    }
                }
            }
        } else if (camY !== 0) {
            _groundY = camY - 1.5;
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
        waitForStableCamera
    };
})();
