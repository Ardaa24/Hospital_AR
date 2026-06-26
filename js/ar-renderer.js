/**
 * js/ar-renderer.js
 * AR Navigasyon Three.js Renderer (Ribbon + Chevron + Footstep)
 * v2.4 — Google Maps AR tarzı mavi şerit + beyaz ∧ chevron
 */

'use strict';

const ARRenderer = (function() {

    /* ════════════════════════════════════════════════════
       STATE VE HAVUZLAR
    ════════════════════════════════════════════════════ */
    let _footstepTexture    = null;
    let _arrowTexture       = null;
    const _footstepMeshPool     = [];
    const _activeFootstepAnims  = [];
    let _footstepSpawnTimers    = [];

    let _holoPathMesh    = null;
    let _holoMaterial    = null;
    let _holoFootstepObjs = [];

    /* ════════════════════════════════════════════════════
       CANVAS ARROW TEXTURE — Google Maps AR Tarzı
       Tile Yapısı (Three.js flipY=true nedeniyle):
         Canvas üstü (Y=0) → UV V=1 → dünyada İLERİ yön (hedef)
         Canvas altı (Y=H) → UV V=0 → dünyada GERİ yön (kullanıcı)
       Chevron ucu (∧) canvas üstüne bakmalı → hedef yönünü gösterir.
    ════════════════════════════════════════════════════ */

    function _buildArrowTexture() {
        if (_arrowTexture) return _arrowTexture;

        const W = 256;   // UV.x = ribbon genişliği boyutu
        const H = 256;   // UV.y = her tile için şerit uzunluğu

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // 1. Mavi solid arka plan — Google Maps AR ribbon rengi
        ctx.fillStyle = 'rgba(10, 118, 255, 0.78)';
        ctx.fillRect(0, 0, W, H);

        // 2. Beyaz ∧ chevron — kalın V şekli
        //    Referans görsel: büyük, ribbon genişliğine yakın V şekli
        const MX     = Math.round(W * 0.055);   // Yatay kenar boşluğu (~5.5%)
        const TIP_Y  = Math.round(H * 0.16);    // Uç noktası — canvas üstüne yakın
        const BASE_Y = Math.round(H * 0.82);    // Kolların alt bitiş noktası
        const ARM_W  = Math.round(W * 0.125);   // Kol kalınlığı (~12.5% of width)

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.97)';
        ctx.lineWidth   = ARM_W;
        ctx.lineCap     = 'butt';      // Düz uç (sharp)
        ctx.lineJoin    = 'miter';     // Sivri birleşim noktası
        ctx.miterLimit  = 25;          // Yüksek miter limit = keskin uç

        ctx.beginPath();
        ctx.moveTo(MX,       BASE_Y);  // Sol alt kol başı
        ctx.lineTo(W / 2,    TIP_Y);   // Orta üst — uç nokta (hedef yönü)
        ctx.lineTo(W - MX,   BASE_Y);  // Sağ alt kol başı
        ctx.stroke();
        ctx.restore();

        _arrowTexture = new THREE.CanvasTexture(canvas);
        _arrowTexture.wrapS = THREE.RepeatWrapping;
        _arrowTexture.wrapT = THREE.RepeatWrapping;
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
            // Bug 4 Fix: Yeniden kullanırken eski parent'tan detach et
            if (m.parent) m.parent.remove(m);
            m.visible = true;
            m.material.opacity = 0;
            return m;
        }
        const geo = new THREE.PlaneGeometry(0.18, 0.32);
        const mat = new THREE.MeshBasicMaterial({
            map:         _getFootstepTexture(),
            transparent: true,
            opacity:     0,
            depthWrite:  false,
            depthTest:   false,
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
        // Mesh oluştur (Zemin hizasında)
        const mesh = _acquireFootstepMesh();
        mesh.position.set(x, groundY + 0.015, z);
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
        const STEP_INTERVAL_M   = 0.45;
        const SIDE_OFFSET_M     = 0.17;
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
       UV.x: 0 = sol kenar, 1 = sağ kenar
       UV.y: arc-length bazlı, TILE_LEN metre başına 1 tam döngü
    ════════════════════════════════════════════════════ */

    function _buildRibbonGeo(points, width) {
        const geo     = new THREE.BufferGeometry();
        const verts   = [];
        const uvs     = [];
        const indices = [];
        const hw = width / 2;
        const N  = points.length;

        // Arc-length hesapla
        let runLen = 0;
        const arcLens = [0];
        for (let i = 1; i < N; i++) {
            runLen += points[i].distanceTo(points[i - 1]);
            arcLens.push(runLen);
        }
        const totalLen = runLen > 0 ? runLen : 1;

        // 1.0m başına 1 chevron tile (Google Maps tarzı aralık)
        const TILE_LEN = 1.0;

        for (let i = 0; i < N; i++) {
            const pt   = points[i];
            const next = points[Math.min(i + 1, N - 1)];

            const dir = new THREE.Vector3().subVectors(next, pt);
            if (dir.length() < 1e-6) dir.set(0, 0, -1);
            dir.normalize();

            const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(hw);

            // UV.y: arcLen / TILE_LEN → her 1m'de 1 tam chevron tekrarı
            const t = arcLens[i] / TILE_LEN;

            verts.push(
                pt.x - perp.x, pt.y, pt.z - perp.z,  // sol kenar
                pt.x + perp.x, pt.y, pt.z + perp.z   // sağ kenar
            );
            // Sol: UV(0, t), Sağ: UV(1, t)
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

        // Bug 4 Fix: Mesh'leri parent'tan temizle
        _holoFootstepObjs.forEach(m => {
            if (m.parent) m.parent.remove(m);
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

        // Başlangıca kameraya yumuşak giriş noktası ekle
        if (parsedPath.length > 0) {
            const first = parsedPath[0];
            if (Math.hypot(first.x, first.z) > 0.5) {
                parsedPath.unshift({ x: 0, y: 0, z: -0.2 });
            }
        }

        const pts = parsedPath.map(p => new THREE.Vector3(
            p.x + originOffset.x,
            0, // Yükseklik mesh position.y ile kontrol edilecek
            p.z + originOffset.z
        ));

        const curve       = new THREE.CatmullRomCurve3(pts);
        const detail      = Math.max(40, parsedPath.length * 20);
        const curvePoints = curve.getPoints(detail);

        const RIBBON_WIDTH = 1.2;  // metre
        const geo = _buildRibbonGeo(curvePoints, RIBBON_WIDTH);

        const tex = _buildArrowTexture();
        tex.offset.set(0, 0);

        _holoMaterial = new THREE.MeshBasicMaterial({
            map:         tex,
            transparent: true,
            opacity:     0.92,
            depthWrite:  false,
            depthTest:   false,
            side:        THREE.DoubleSide,
            blending:    THREE.NormalBlending,
        });

        _holoPathMesh = new THREE.Mesh(geo, _holoMaterial);
        _holoPathMesh.position.y = groundY + 0.01;
        parent.add(_holoPathMesh);

        _scheduleFootsteps(parsedPath, parent, groundY, originOffset);
    }

    /**
     * Her frame'de çağrılır.
     * Chevron texture'ı UV.y- yönünde kaydırır → ok hedef yönünde akar.
     * @param {number} time — performance.now() (ms)
     */
    function updateUniforms(time) {
        if (_holoMaterial?.map) {
            // 0.45 tile/sn = 0.45 m/sn görsel akış hızı
            const SCROLL_SPEED = 0.45;
            _holoMaterial.map.offset.y = -(time * 0.001 * SCROLL_SPEED) % 1.0;
        }
    }

    function updateGroundY(newGroundY) {
        if (_holoPathMesh) {
            _holoPathMesh.position.y = newGroundY + 0.01;
        }
        _holoFootstepObjs.forEach(m => {
            m.position.y = newGroundY + 0.015;
        });
    }

    return {
        clearPath,
        drawPath,
        updateAnimations,
        updateUniforms,
        updateGroundY
    };
})();
