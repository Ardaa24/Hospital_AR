/**
 * js/ar-renderer.js
 * AR Navigasyon Three.js Renderer (Ribbon ve Footstep Görselleri)
 * v2.3 — Bug #1: Ground Y fix | Bug #2: Google Maps tarzı solid arrow texture
 */

'use strict';

const ARRenderer = (function() {

    /* ════════════════════════════════════════════════════
       STATE VE HAVUZLAR
    ════════════════════════════════════════════════════ */
    let _footstepTexture   = null;
    let _arrowTexture      = null;       // Bug #2: Canvas arrow texture
    const _footstepMeshPool    = [];
    const _activeFootstepAnims = [];
    let _footstepSpawnTimers   = [];

    let _holoPathMesh    = null;
    let _holoMaterial    = null;
    let _holoFootstepObjs = [];

    /* ════════════════════════════════════════════════════
       BUG #2 — CANVAS ARROW TEXTURE
       Google Maps tarzı: solid üçgen uç + dikdörtgen gövde
       Her "tile" 1 ok birimi (üçgen + gövde).
       Animasyon: texture.offset.x ile UV scroll.
    ════════════════════════════════════════════════════ */

    /**
     * 256×512 px canvas'a Google Maps benzeri ok tile çizer.
     * Tile yapısı (Y ekseni yukarı, UV space):
     *   [0.0 – 0.35] : ok ucu (solid izokeles üçgen)
     *   [0.35 – 0.80]: ok gövdesi (dikdörtgen)
     *   [0.80 – 1.0] : boşluk (oklar arası)
     * X ekseni: ribbon genişliği boyunca 0→1
     */
    function _buildArrowTexture() {
        if (_arrowTexture) return _arrowTexture;

        const W  = 256;   // Genişlik (ribbon X)
        const H  = 512;   // Yükseklik (ribbon Z / UV scroll yönü)

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Arka plan — tamamen saydam
        ctx.clearRect(0, 0, W, H);

        // ── Renk Paleti ──
        const ARROW_COLOR  = 'rgba(255, 255, 255, 0.92)';  // Solid beyaz ok
        const BODY_COLOR   = 'rgba(0, 122, 255, 0.55)';    // Mavi şeffaf gövde

        // ── Geometri Sabitleri ──
        const TIP_H   = Math.round(H * 0.28);   // Üçgen yüksekliği (tile'ın %28'i)
        const BODY_H  = Math.round(H * 0.42);   // Gövde yüksekliği
        const GAP_H   = H - TIP_H - BODY_H;     // Oklar arası boşluk

        const MARGIN  = Math.round(W * 0.10);   // Yanlarda boşluk (px)
        const BODY_W  = W - MARGIN * 2;

        // ── Gövde (dikdörtgen) ──
        // UV Y=0 → canvas alt, Y=1 → canvas üst (Three.js UV convention)
        // Ama biz canvas'a yukarıdan aşağıya çiziyoruz:
        //   - İlk GAP_H px: boşluk
        //   - Sonra TIP_H px: üçgen
        //   - Sonra BODY_H px: gövde

        const tipTop    = GAP_H;               // Üçgenin canvas üst kenarı (px)
        const bodyTop   = GAP_H + TIP_H;       // Gövdenin canvas üst kenarı (px)

        // Gövde — mavi dikdörtgen
        ctx.fillStyle = BODY_COLOR;
        ctx.fillRect(MARGIN, bodyTop, BODY_W, BODY_H);

        // Üçgen — solid beyaz (tam izokeles)
        ctx.fillStyle = ARROW_COLOR;
        ctx.beginPath();
        ctx.moveTo(W / 2, tipTop);                   // Tepe nokta (orta üst)
        ctx.lineTo(MARGIN, bodyTop);                  // Sol alt
        ctx.lineTo(W - MARGIN, bodyTop);              // Sağ alt
        ctx.closePath();
        ctx.fill();

        // Üçgen üzerine gövde rengini hafifçe bindirme (görsel bütünlük)
        // (isteğe bağlı — atlıyoruz, solid üçgen yeterli)

        _arrowTexture = new THREE.CanvasTexture(canvas);
        _arrowTexture.wrapS = THREE.RepeatWrapping;
        _arrowTexture.wrapT = THREE.RepeatWrapping;
        // Tek bir tile, yatayda 1 tekrar, uzunlukta dinamik tekrar
        _arrowTexture.repeat.set(1, 1);
        _arrowTexture.needsUpdate = true;
        return _arrowTexture;
    }

    /* ════════════════════════════════════════════════════
       AYAK İZİ (FOOTSTEP)
    ════════════════════════════════════════════════════ */

    function _getFootstepTexture() {
        if (_footstepTexture) return _footstepTexture;

        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width  = size;
        canvas.height = size * 2;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(15, 15, 15, 0.95)';

        // Topuk
        ctx.beginPath(); ctx.ellipse(64, 210, 28, 38, 0, 0, Math.PI * 2); ctx.fill();
        // Arch
        ctx.beginPath(); ctx.ellipse(57, 158, 20, 32, 0.08, 0, Math.PI * 2); ctx.fill();
        // Ball
        ctx.beginPath(); ctx.ellipse(62, 105, 26, 26, 0, 0, Math.PI * 2); ctx.fill();
        // Toes
        const toes = [
            { x: 38, y: 70, rx: 11, ry: 13 },
            { x: 52, y: 59, rx: 10, ry: 12 },
            { x: 66, y: 57, rx: 9,  ry: 11 },
            { x: 78, y: 63, rx: 8,  ry: 10 },
            { x: 88, y: 72, rx: 7,  ry: 9  },
        ];
        toes.forEach(t => {
            ctx.beginPath(); ctx.ellipse(t.x, t.y, t.rx, t.ry, 0, 0, Math.PI * 2); ctx.fill();
        });

        _footstepTexture = new THREE.CanvasTexture(canvas);
        _footstepTexture.needsUpdate = true;
        return _footstepTexture;
    }

    function _acquireFootstepMesh() {
        if (_footstepMeshPool.length > 0) {
            const m = _footstepMeshPool.pop();
            m.visible = true;
            return m;
        }
        const geo = new THREE.PlaneGeometry(0.18, 0.32);
        const mat = new THREE.MeshBasicMaterial({
            map:        _getFootstepTexture(),
            transparent: true,
            opacity:     0,
            depthWrite:  false,
            depthTest:   false,   // Bug #1: z-fighting önle
            side:        THREE.DoubleSide,
        });
        return new THREE.Mesh(geo, mat);
    }

    function _releaseFootstepMesh(mesh) {
        mesh.visible = false;
        mesh.material.opacity = 0;
        _footstepMeshPool.push(mesh);
    }

    function updateAnimations() {
        if (_activeFootstepAnims.length === 0) return;
        const now = performance.now();
        const toRemove = [];

        for (const anim of _activeFootstepAnims) {
            const progress = Math.min((now - anim.startTime) / anim.duration, 1);

            let opacity;
            if (progress < 0.15)      opacity = progress / 0.15;
            else if (progress < 0.70) opacity = 1.0;
            else                      opacity = 1.0 - (progress - 0.70) / 0.30;

            anim.mesh.material.opacity = Math.max(0, opacity);

            if (progress >= 1) toRemove.push(anim);
        }

        for (const anim of toRemove) {
            const idx = _activeFootstepAnims.indexOf(anim);
            if (idx > -1) _activeFootstepAnims.splice(idx, 1);
            _releaseFootstepMesh(anim.mesh);
        }
    }

    function _spawnFootstep(parent, x, z, angleDeg, groundY, duration) {
        const mesh = _acquireFootstepMesh();
        // Bug #1: groundY (=0) + 0.02m — zeminde, 1cm yerine 2cm kalkık (z-fighting önlemek için yeterli)
        mesh.position.set(x, groundY + 0.02, z);

        // A-Frame / Three.js: parmak ucunun ileriyi göstermesi için
        mesh.rotation.set(-Math.PI / 2, 0, Math.PI - THREE.MathUtils.degToRad(angleDeg));

        parent.add(mesh);
        _holoFootstepObjs.push(mesh);

        _activeFootstepAnims.push({
            mesh,
            startTime: performance.now(),
            duration,
        });
    }

    function _scheduleFootsteps(parsedPath, parent, groundY, originOffset) {
        const STEP_INTERVAL_M  = 0.45;
        const SIDE_OFFSET_M    = 0.17;
        const DELAY_PER_STEP_MS = 340;
        const STEP_DURATION_MS  = 2600;

        let delay  = 0;
        let isLeft = true;

        for (let i = 1; i < parsedPath.length; i++) {
            const a = parsedPath[i - 1];
            const b = parsedPath[i];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const segLen = Math.hypot(dx, dz);
            if (segLen < 1e-6) continue;

            const angleDeg = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
            const ux = dx / segLen;
            const uz = dz / segLen;

            let dist = 0;
            while (dist < segLen) {
                const ratio = dist / segLen;
                const px = (a.x + dx * ratio) + originOffset.x;
                const pz = (a.z + dz * ratio) + originOffset.z;

                const side  = isLeft ? -1 : 1;
                const perpX = -uz * SIDE_OFFSET_M * side;
                const perpZ =  ux * SIDE_OFFSET_M * side;

                (function capture(sx, sz, ang, d) {
                    const timerId = setTimeout(() => {
                        if (typeof AppState !== 'undefined' && !AppState.arActive) return;
                        _spawnFootstep(parent, sx, sz, ang, groundY, STEP_DURATION_MS);
                    }, d);
                    _footstepSpawnTimers.push(timerId);
                })(px + perpX, pz + perpZ, angleDeg, delay);

                dist  += STEP_INTERVAL_M;
                delay += DELAY_PER_STEP_MS;
                isLeft = !isLeft;
            }
        }
    }

    function _cancelFootstepTimers() {
        _footstepSpawnTimers.forEach(id => clearTimeout(id));
        _footstepSpawnTimers = [];
    }

    /* ════════════════════════════════════════════════════
       RIBBON (ŞERİT) GEOMETRİSİ
    ════════════════════════════════════════════════════ */

    function _buildRibbonGeo(points, width) {
        const geo  = new THREE.BufferGeometry();
        const verts   = [];
        const uvs     = [];
        const indices = [];
        const hw = width / 2;
        const N  = points.length;

        // Arc-length bazlı UV'ler (animasyon hızını uzunluktan bağımsız tutar)
        let runLen = 0;
        const arcLens = [0];
        for (let i = 1; i < N; i++) {
            runLen += points[i].distanceTo(points[i - 1]);
            arcLens.push(runLen);
        }
        const totalLen = runLen > 0 ? runLen : 1;

        // Bug #2: Her ok tile'ı ~0.6m uzunluk kaplayacak şekilde tekrar sayısı ayarla
        const TILE_LEN = 0.6;  // Metre cinsinden tek ok tile yüksekliği
        const uvRepeat = totalLen / TILE_LEN;

        for (let i = 0; i < N; i++) {
            const pt   = points[i];
            const next = points[Math.min(i + 1, N - 1)];

            const dir = new THREE.Vector3().subVectors(next, pt);
            if (dir.length() < 1e-6) dir.set(0, 0, -1);
            dir.normalize();

            const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(hw);

            // UV: X = genişlik (0=sol, 1=sağ), Y = uzunluk boyunca tekrar
            const t = (arcLens[i] / totalLen) * uvRepeat;

            verts.push(
                pt.x - perp.x, pt.y, pt.z - perp.z,  // sol kenar
                pt.x + perp.x, pt.y, pt.z + perp.z   // sağ kenar
            );
            // Sol vertex: uv(0, t), Sağ vertex: uv(1, t)
            uvs.push(0, t,  1, t);

            if (i < N - 1) {
                const b = i * 2;
                indices.push(b, b + 1, b + 2,  b + 1, b + 3, b + 2);
            }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    /* ════════════════════════════════════════════════════
       PUBLIC API
    ════════════════════════════════════════════════════ */

    function clearPath(parent) {
        _cancelFootstepTimers();

        if (_holoPathMesh && parent) {
            parent.remove(_holoPathMesh);
            _holoPathMesh.geometry.dispose();
            if (_holoMaterial) {
                _holoMaterial.dispose();
                _holoMaterial = null;
            }
            _holoPathMesh = null;
        }

        _holoFootstepObjs.forEach(m => {
            if (parent) parent.remove(m);
        });
        _holoFootstepObjs = [];

        _activeFootstepAnims.forEach(anim => _releaseFootstepMesh(anim.mesh));
        _activeFootstepAnims.length = 0;
    }

    function drawPath(leg, parent, groundY, originOffset = { x: 0, z: 0 }) {
        clearPath(parent);

        if (!leg?.path || leg.path.length < 2) return;

        const parsedPath = leg.path.map(pt => {
            const [x, y, z] = (pt.pos || '').split(' ').map(Number);
            return { x: x || 0, y: y || 0, z: z || 0 };
        });

        // Rota başlangıcına yumuşak giriş: kameraya çok yakın bir başlangıç noktası ekle
        if (parsedPath.length > 0) {
            const first = parsedPath[0];
            if (Math.hypot(first.x, first.z) > 0.5) {
                parsedPath.unshift({ x: 0, y: 0, z: -0.2 });
            }
        }

        // Bug #1: groundY her zaman 0 (local-floor). Y = 0.01m (1cm) üstte — z-fighting'i önler
        const RIBBON_Y = groundY + 0.01;

        const pts = parsedPath.map(p => new THREE.Vector3(
            p.x + originOffset.x,
            RIBBON_Y,
            p.z + originOffset.z
        ));

        const curve       = new THREE.CatmullRomCurve3(pts);
        const detail      = Math.max(40, parsedPath.length * 20);
        const curvePoints = curve.getPoints(detail);

        // Geometri
        const RIBBON_WIDTH = 1.2;
        const geo = _buildRibbonGeo(curvePoints, RIBBON_WIDTH);

        // Bug #2: Canvas arrow texture ile MeshBasicMaterial
        const tex = _buildArrowTexture();

        // Her ok tile'ı başlangıçta 0 offset — updateUniforms ile kaydırılacak
        tex.offset.set(0, 0);

        _holoMaterial = new THREE.MeshBasicMaterial({
            map:         tex,
            transparent: true,
            opacity:     0.90,
            depthWrite:  false,
            depthTest:   false,   // Bug #1: z-fighting sıfırla
            side:        THREE.DoubleSide,
            blending:    THREE.NormalBlending,
        });

        _holoPathMesh = new THREE.Mesh(geo, _holoMaterial);
        parent.add(_holoPathMesh);

        _scheduleFootsteps(parsedPath, parent, groundY, originOffset);
    }

    /**
     * updateUniforms: Her frame'de ok texture'ını kaydırır (akan ok animasyonu).
     * Artık shader uniform yerine texture offset kullanıyoruz.
     * @param {number} time — performance.now() değeri (ms)
     */
    function updateUniforms(time) {
        if (_holoMaterial?.map) {
            // Saniyede ~0.35 tile kaydır (ok akış hızı)
            const SCROLL_SPEED = 0.35;
            _holoMaterial.map.offset.y = -(time * 0.001 * SCROLL_SPEED) % 1.0;
            _holoMaterial.map.needsUpdate = false; // CanvasTexture dışında gereksiz
        }
    }

    return {
        clearPath,
        drawPath,
        updateAnimations,
        updateUniforms
    };
})();
