/**
 * js/ar-renderer.js
 */

'use strict';

const ARRenderer = (function() {
    // -------------------------------------------------------------------------
    // 1. STATE & CONFIGURATION
    // -------------------------------------------------------------------------
    const _state = {
        chevrons: [],
        materials: {},
        geometries: {},
        groundY: 0
    };

    const CONFIG = {
        SPACING: 1.2,        // Her 1.2 metrede bir ok
        SIZE: 1.2,           // Ok boyutu (Plane genişliği)
        FLOAT_SPEED: 0.003,  // Havada süzülme hızı
        FLOAT_HEIGHT: 0.05,  // Havada süzülme genişliği
        WAVE_SPEED: 0.005,   // İleri doğru akan dalga animasyon hızı
        COLOR_BORDER: 'rgba(255, 255, 255, 1.0)',
        COLOR_FILL: 'rgba(26, 115, 232, 0.95)'
    };

    // -------------------------------------------------------------------------
    //  TEXTURE & MATERIAL GENERATION 
    // -------------------------------------------------------------------------
    function _getChevronTexture() {
        if (_state.materials.chevronTex) return _state.materials.chevronTex;

        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size; 
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, size, size);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        // Ok yönü: Üst (Three.js'de Plane X'de -90 derece dönünce -Z eksenine bakar)
        ctx.moveTo(size * 0.15, size * 0.85); // Sol alt
        ctx.lineTo(size * 0.50, size * 0.15); // Uç noktası
        ctx.lineTo(size * 0.85, size * 0.85); // Sağ alt
        ctx.lineTo(size * 0.50, size * 0.55); // İç girinti
        ctx.closePath();

        // Dış Beyaz Çerçeve
        ctx.lineWidth = 16;
        ctx.strokeStyle = CONFIG.COLOR_BORDER;
        ctx.stroke();

        // İç Mavi Dolgu
        ctx.fillStyle = CONFIG.COLOR_FILL;
        ctx.fill();

        const tex = new THREE.CanvasTexture(canvas);
        tex.anisotropy = 4; // Eğik açılarda netlik için
        _state.materials.chevronTex = tex;
        return tex;
    }

    function _getSharedMaterial() {
        if (_state.materials.chevron) return _state.materials.chevron;
        _state.materials.chevron = new THREE.MeshBasicMaterial({
            map: _getChevronTexture(),
            transparent: true,
            opacity: 0.9,
            depthTest: true,
            depthWrite: false, // Saydam objelerde arka plan çizim hatasını (Z-fighting) önler
            side: THREE.DoubleSide
        });
        return _state.materials.chevron;
    }

    function _getSharedGeometry() {
        if (_state.geometries.plane) return _state.geometries.plane;
        _state.geometries.plane = new THREE.PlaneGeometry(CONFIG.SIZE, CONFIG.SIZE);
        // Geometriyi yere paralel hale getir (-90 derece)
        _state.geometries.plane.rotateX(-Math.PI / 2);
        return _state.geometries.plane;
    }

    // -------------------------------------------------------------------------
    // RENDER LOGIC (LOCALIZATION & INSTANTIATION)
    // -------------------------------------------------------------------------
    function clearPath(parent) {
        if (!parent) return;
        _state.chevrons.forEach(ch => {
            if (ch.mesh.parent) {
                ch.mesh.parent.remove(ch.mesh);
            }
            if (ch.material && ch.material !== _state.materials.chevron) {
                ch.material.dispose(); // Klonlanmış materyalleri bellekten sil
            }
        });
        _state.chevrons = [];
    }

    function drawPath(leg, parent, groundY, originOffset = { x: 0, z: 0 }) {
        clearPath(parent);
        if (!leg?.path || leg.path.length < 2) return;

        _state.groundY = groundY;

        //  Koordinatları Ayrıştır
        const rawPoints = leg.path.map(pt => {
            const [px, py, pz] = (pt.pos || '').split(' ').map(Number);
            return new THREE.Vector3(px || 0, 0, pz || 0);
        });

        // LOKALİZASYON (OFFSET FIX)
        // İkinci bacağın haritada uzağa çizilmesini engeller.
        // Rotanın haritadaki başlangıç noktasını, kameranın AR ortamındaki merkezine (0,0) çeker.
        const mapOrigin = rawPoints[0].clone();
        const localPoints = rawPoints.map(p => {
            return new THREE.Vector3(
                p.x - mapOrigin.x,
                0,
                p.z - mapOrigin.z
            );
        });

        //  Yumuşak Eğri (CatmullRomCurve3)
        const curve = new THREE.CatmullRomCurve3(localPoints);
        const curveLength = curve.getLength();
        if (curveLength < 0.1) return;

        // Eğri boyunca ayrık Chevron objelerini diz
        const count = Math.max(1, Math.floor(curveLength / CONFIG.SPACING));
        const geo = _getSharedGeometry();
        const baseMat = _getSharedMaterial();

        for (let i = 1; i <= count; i++) {
            const t = i / count;
            const pos = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();

            // Her ok için bağımsız materyal 
            const mat = baseMat.clone();
            const mesh = new THREE.Mesh(geo, mat);

            // Zemin üzerine hafifçe kaldırarak (Y=0.02) fiziksel zeminle çakışmayı engelle
            mesh.position.set(pos.x, groundY + 0.02, pos.z);

            // Okun ucu rotanın bir sonraki noktasına baksın
            mesh.rotation.y = Math.atan2(tangent.x, tangent.z);

            parent.add(mesh);

            _state.chevrons.push({
                mesh: mesh,
                material: mat,
                baseY: groundY + 0.02,
                index: i
            });
        }
    }

    // -------------------------------------------------------------------------
    // 4. ANIMATION & UPDATES
    // -------------------------------------------------------------------------
    function updateGroundY(newGroundY) {
        _state.groundY = newGroundY;
        const targetBaseY = newGroundY + 0.02;
        
        _state.chevrons.forEach(ch => {
            ch.baseY = targetBaseY;
        });
    }

    function updateAnimations() {
        const now = performance.now();
        
        _state.chevrons.forEach(ch => {
            const mesh = ch.mesh;
            
            // Dalga (Pulse Wave) efekti (Arkadan öne doğru akar)
            const wavePhase = (now * CONFIG.WAVE_SPEED) - (ch.index * 0.6);
            const wave = Math.sin(wavePhase);

            // Opaklık (Oklar ardışık parlar)
            ch.material.opacity = 0.55 + (wave * 0.35); // 0.20 - 0.90 arası

            // Süzülme (Hover) (Oklar yavaşça aşağı yukarı süzülür)
            mesh.position.y = ch.baseY + (wave * CONFIG.FLOAT_HEIGHT);
        });
    }

    function updateUniforms(time) {
        // Eski ribbon altyapısından kalan fonksiyon, geriye dönük uyumluluk için boş
    }

    return {
        clearPath,
        drawPath,
        updateAnimations,
        updateUniforms,
        updateGroundY
    };
})();
