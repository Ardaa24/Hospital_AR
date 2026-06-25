/**
 * js/ar-compass.js
 * AR Navigasyon Pusula ve Açı Hesaplamaları
 */

'use strict';

const ARCompass = (function() {
    const COMPASS_EMA_ALPHA = 0.15; // 0=çok pürüzsüz, 1=ham (gecikmesiz)
    let _smoothedCompassDeg = null;

    /**
     * EMA (Exponential Moving Average) ile pürüzsüzleştirme.
     * @param {number|null} current 
     * @param {number} target 
     * @param {number} alpha 
     */
    function _lerpAngleDeg(current, target, alpha) {
        if (current === null) return (target + 360) % 360;
        // Kısa yol delta: [-180, +180] aralığında
        const delta = ((target - current) + 540) % 360 - 180;
        return (current + alpha * delta + 360) % 360;
    }

    /**
     * En yakın path segmentinin birim yön vektörünü hesaplar.
     * @param {THREE.Vector3} camPos 
     * @param {Array<{x,y,z}>} parsedPath 
     * @returns {THREE.Vector3} birim vektör
     */
    function _getNearestSegmentDirection(camPos, parsedPath) {
        let bestDist = Infinity;
        let bestDir  = new THREE.Vector3(0, 0, -1);

        for (let i = 1; i < parsedPath.length; i++) {
            const a  = parsedPath[i - 1];
            const b  = parsedPath[i];
            const mx = (a.x + b.x) / 2;
            const mz = (a.z + b.z) / 2;
            const d  = Math.hypot(camPos.x - mx, camPos.z - mz);

            if (d < bestDist) {
                bestDist = d;
                bestDir  = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
            }
        }
        return bestDir;
    }

    /**
     * Kamera ile hedef yol arasındaki göreli açıyı hesaplar.
     * A-Frame kamera ileri yönü -Z'dir.
     * @param {THREE.Vector3} camPos 
     * @param {THREE.Object3D} cam 
     * @param {Array<{x,y,z}>} parsedPath 
     * @returns {number} 0°=ileri, 90°=sağ, -90°=sol
     */
    function computePathBearingDeg(camPos, cam, parsedPath) {
        //  Kameranın dünya uzayındaki ileri vektörü
        const forward = new THREE.Vector3(0, 0, -1); // A-Frame default
        forward.applyQuaternion(cam.quaternion);
        forward.y = 0; // Sadece XZ düzlemi
        forward.normalize();

        // En yakın waypoint'e yön vektörü
        const target = _getNearestSegmentDirection(camPos, parsedPath);

        // İşaretli açı (dot ve cross product kullanarak)
        const dot   = forward.x * target.x + forward.z * target.z;
        const cross = forward.x * target.z - forward.z * target.x; 

        // Fix #3 (v2.2): Sağ el kuralı CSS rotasyonunda tersine işlediği için (-cross) formülü 
        // sağa/sola dönüşlerde kameranın tersini gösteriyordu. 
        // Artık cross direkt kullanılarak doğru CW/CCW dönüş elde ediliyor.
        const angleRad = Math.atan2(cross, dot); 
        return THREE.MathUtils.radToDeg(angleRad);
    }

    /**
     * HUD pusula okunu günceller ve pürüzsüzleştirir.
     * @param {HTMLElement} arrowEl 
     * @param {THREE.Vector3} camPos 
     * @param {THREE.Object3D} cam 
     * @param {Object} curLeg 
     */
    function updateHUD(arrowEl, camPos, cam, curLeg) {
        if (!arrowEl || !curLeg?.path || curLeg.path.length < 2) return;

        const parsedPath = curLeg.path.map(pt => {
            const [x, y, z] = pt.pos.split(' ').map(Number);
            return { x: x || 0, y: y || 0, z: z || 0 };
        });

        const rawRelAngle = computePathBearingDeg(camPos, cam, parsedPath);
        
        // Pürüzsüzleştirme uygula
        _smoothedCompassDeg = _lerpAngleDeg(_smoothedCompassDeg, rawRelAngle, COMPASS_EMA_ALPHA);
        arrowEl.style.transform = `rotate(${_smoothedCompassDeg.toFixed(1)}deg)`;
    }

    /** Reset state */
    function reset() {
        _smoothedCompassDeg = null;
    }

    return {
        updateHUD,
        reset
    };
})();
