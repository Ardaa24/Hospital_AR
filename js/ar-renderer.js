/**
 * js/ar-renderer.js
 * AR Navigasyon Three.js Renderer (Gerçek 3D Hacimli Chevron Sistemi )
 */

'use strict';

const ARRenderer = (function() {
    // -------------------------------------------------------------------------
    // 1. STATE & CONFIGURATION
    // -------------------------------------------------------------------------
    const _state = {
        chevrons: [],
        materials: null,
        geometry: null,
        groundY: 0
    };

    const CONFIG = {
        SPACING: 1.5,        // Her 1.5 metrede bir ok (Karmaşayı azaltır, premium his verir)
        FLOAT_HEIGHT: 0.03,  // Süzülme genliği (Zeminin içine girmeyi engellemek için daraltıldı)
        WAVE_SPEED: 0.004,   // Dalga hızı
        COLOR_FACE: 0x1A73E8, //  Mavi (Üst ve alt yüzey)
        COLOR_SIDE: 0xFFFFFF  // Beyaz (Kenarlar ve pah kısımları)
    };

    // -------------------------------------------------------------------------
    // 2. GEOMETRY & MATERIAL (TRUE 3D VOLUME)
    // -------------------------------------------------------------------------
    function _initGeomAndMats() {
        if (_state.geometry) return;

        // 2A. 3 Boyutlu Chevron (Ok) Şeklini Çiz
        const width = 0.85;   // Genişlik
        const length = 1.0;   // Uzunluk
        const armW = 0.28;    // Kol kalınlığı

        const shape = new THREE.Shape();
        // Yukarıyı (Plane Y ekseni) gösteren mükemmel "V" çizimi
        shape.moveTo(0, length / 2);                       // En Uç Nokta (Tepe)
        shape.lineTo(width / 2, -length / 2);              // Sağ Dış Alt
        shape.lineTo(width / 2 - armW, -length / 2);       // Sağ İç Alt
        shape.lineTo(0, length / 2 - armW * 1.5);          // İç Tepe Noktası (V oyuğu)
        shape.lineTo(-width / 2 + armW, -length / 2);      // Sol İç Alt
        shape.lineTo(-width / 2, -length / 2);             // Sol Dış Alt
        shape.lineTo(0, length / 2);                       // Tekrar En Uç

        // 2B. Şekli 3 Boyutlu Hacme Dönüştür (Extrude)
        const extrudeSettings = {
            depth: 0.025,       // 2.5 cm kalınlık (Zemine gömülü, sağlam his)
            bevelEnabled: true, // Kenar yumuşatma (Enterprise UI detayı)
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.015,
            bevelThickness: 0.015
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Geometrinin merkezini ayarla ki dönüşler tam ortadan yapılsın
        geo.center(); 
        
        // Zeminle hizalamak için X ekseninde -90 derece yatır.
        // Bu işlem sonucunda ok şeklinin ucu (Tepe) otomatik olarak Three.js'in ileri yönü olan -Z'ye bakar.
        geo.rotateX(-Math.PI / 2); 
        
        _state.geometry = geo;

        // 2C. Materyaller (Işık gerektirmeyen MeshBasicMaterial ile maksimum canlılık)
        const faceMat = new THREE.MeshBasicMaterial({
            color: CONFIG.COLOR_FACE,
            transparent: true,
            opacity: 0.85,
            depthTest: true,
            depthWrite: true, // 3D objelerin kendi içinde doğru görünmesi için GEREKLİ
            side: THREE.DoubleSide
        });

        const sideMat = new THREE.MeshBasicMaterial({
            color: CONFIG.COLOR_SIDE,
            transparent: true,
            opacity: 0.95,
            depthTest: true,
            depthWrite: true,
            side: THREE.DoubleSide
        });

        // ExtrudeGeometry, [0] indisini ön/arka yüzler, [1] indisini yan/pah yüzleri için kullanır.
        _state.materials = [faceMat, sideMat];
    }

    // -------------------------------------------------------------------------
    // 3. RENDER LOGIC (OFFSET FIX & TRUE ROTATION)
    // -------------------------------------------------------------------------
    function clearPath(parent) {
        if (!parent) return;
        _state.chevrons.forEach(ch => {
            if (ch.mesh.parent) {
                ch.mesh.parent.remove(ch.mesh);
            }
            if (ch.materials) {
                ch.materials.forEach(m => m.dispose()); // Klonlanmış materyalleri serbest bırak
            }
        });
        _state.chevrons = [];
    }

    function drawPath(leg, parent, groundY, originOffset = { x: 0, z: 0 }) {
        clearPath(parent);
        if (!leg?.path || leg.path.length < 2) return;

        _initGeomAndMats();
        _state.groundY = groundY;

        // 1. Koordinatları Ayrıştır
        const rawPoints = leg.path.map(pt => {
            const [px, py, pz] = (pt.pos || '').split(' ').map(Number);
            return new THREE.Vector3(px || 0, 0, pz || 0);
        });

        // 2. LOKALİZASYON (İkinci Bacak İleriye Çizilme Hatasının Kesin Çözümü)
        // Rotanın ilk noktasını orijin (0,0,0) kabul ederek diğer tüm noktaları ona göre hizala.
        const mapOrigin = rawPoints[0].clone();
        const localPoints = rawPoints.map(p => {
            return new THREE.Vector3(
                p.x - mapOrigin.x,
                0,
                p.z - mapOrigin.z
            );
        });

        // 3. Eğri (CatmullRomCurve3)
        const curve = new THREE.CatmullRomCurve3(localPoints);
        const curveLength = curve.getLength();
        if (curveLength < 0.1) return;

        // 4. Chevron Objelerini Diz
        const count = Math.max(1, Math.floor(curveLength / CONFIG.SPACING));

        for (let i = 1; i <= count; i++) {
            const t = i / count;
            const pos = curve.getPointAt(t);
            const tangent = curve.getTangentAt(t).normalize();

            // Animasyonlarda bağımsız parlama için materyalleri klonla
            const mats = [
                _state.materials[0].clone(), 
                _state.materials[1].clone()
            ];

            const mesh = new THREE.Mesh(_state.geometry, mats);

            // Yükseklik: Zemin Y + kalınlığın yarısı (içeri batmasın diye)
            const baseY = groundY + 0.02; 
            mesh.position.set(pos.x, baseY, pos.z);

            // YÖN DÜZELTMESİ (TERS V HATASININ ÇÖZÜMÜ)
            // Ok objemizin sivri ucu -Z yönünde modellendi. 
            // Tanjant (yolun gidiş yönü) hedefine doğru bakmasını sağla:
            const targetPos = pos.clone().add(tangent);
            mesh.lookAt(targetPos);

            parent.add(mesh);

            _state.chevrons.push({
                mesh: mesh,
                materials: mats,
                baseY: baseY,
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
            // Dalga (Pulse Wave) efekti
            const wavePhase = (now * CONFIG.WAVE_SPEED) - (ch.index * 0.8);
            const wave = Math.sin(wavePhase); // -1 to 1

            // Opaklık (0.35 ile 0.95 arası organik parlama)
            const baseOp = 0.65 + (wave * 0.30); 
            ch.materials[0].opacity = baseOp;
            ch.materials[1].opacity = Math.min(1.0, baseOp + 0.15); // Kenar çizgileri biraz daha parlak

            // Süzülme (Hover) efekti (Alt limit BaseModel baseY)
            // Sadece yukarı doğru hafifçe süzülüp tekrar yerine oturur
            const floatOffset = Math.max(0, wave * CONFIG.FLOAT_HEIGHT);
            ch.mesh.position.y = ch.baseY + floatOffset;
        });
    }

    function updateUniforms(time) {
        // Uyumluluk için boş
    }

    return {
        clearPath,
        drawPath,
        updateAnimations,
        updateUniforms,
        updateGroundY
    };
})();
