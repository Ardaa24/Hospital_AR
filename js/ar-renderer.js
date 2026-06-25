/**
 * js/ar-renderer.js
 * AR Navigasyon Three.js Renderer (Ribbon ve Footstep Görselleri)
 */

'use strict';

const ARRenderer = (function() {
    /* ════════════════════════════════════════════════════
       GLSL SHADER KAYNAK KODLARI
    ════════════════════════════════════════════════════ */

    const HOLO_VERT = /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    const HOLO_FRAG = /* glsl */`
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uSpeed;
        uniform float uOpacity;
        varying vec2  vUv;

        float chevronMask(vec2 uv, float freq, float t, float speed) {
            float u = fract(uv.x * freq - t * speed);
            float vNorm = (uv.y - 0.5) * 2.0;
            
            // Okun tepe ve taban sınırları (tam üçgen)
            float uFront = 0.80 - abs(vNorm) * 0.55;
            float uBack = 0.35;
            
            float frontMask = smoothstep(uFront + 0.015, uFront - 0.015, u);
            float backMask = smoothstep(uBack - 0.015, uBack + 0.015, u);
            
            // Yol kenarlarında boşluk bırakmak için yan sınır maskesi
            float sideMask = smoothstep(0.76, 0.74, abs(vNorm));
            
            return frontMask * backMask * sideMask;
        }
 
        void main() {
            float edgeFade = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 1.8);
            float arrow = chevronMask(vUv, 3.0, uTime, uSpeed);
            float pulse = 0.88 + 0.12 * sin(uTime * 2.2);
            
            // Mavi yol rengi ile solid beyaz üçgen renginin karıştırılması
            vec3 finalColor = mix(uColor, vec3(1.0, 1.0, 1.0), arrow);
            
            // Üçgen kısımları daha opak, yol tabanı daha saydam
            float alpha = (edgeFade * 0.35 + arrow * 0.65) * pulse * uOpacity;
            
            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    /* ════════════════════════════════════════════════════
       STATE VE HAVUZLAR
    ════════════════════════════════════════════════════ */
    let _footstepTexture = null;
    const _footstepMeshPool = [];
    const _activeFootstepAnims = [];
    let _footstepSpawnTimers = [];

    let _holoPathMesh = null;
    let _holoUniforms = null;
    let _holoFootstepObjs = [];

    /* ════════════════════════════════════════════════════
       AYAK İZİ (FOOTSTEP)
    ════════════════════════════════════════════════════ */

    function _getFootstepTexture() {
        if (_footstepTexture) return _footstepTexture;

        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
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
            { x: 66, y: 57, rx: 9, ry: 11 },
            { x: 78, y: 63, rx: 8, ry: 10 },
            { x: 88, y: 72, rx: 7, ry: 9 },
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
            map: _getFootstepTexture(),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
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
            if (progress < 0.15) opacity = progress / 0.15;
            else if (progress < 0.70) opacity = 1.0;
            else opacity = 1.0 - (progress - 0.70) / 0.30;

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
        mesh.position.set(x, groundY + 0.03, z);
        
        // A-Frame ve Three.js rotasyon kuralına göre parmak ucunun ileriyi göstermesi için:
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
        const STEP_INTERVAL_M = 0.45;
        const SIDE_OFFSET_M = 0.17;
        const DELAY_PER_STEP_MS = 340;
        const STEP_DURATION_MS = 2600;

        let delay = 0;
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
                // Fix #1: Apply originOffset
                const px = (a.x + dx * ratio) + originOffset.x;
                const pz = (a.z + dz * ratio) + originOffset.z;
                
                const side = isLeft ? -1 : 1;
                const perpX = -uz * SIDE_OFFSET_M * side;
                const perpZ = ux * SIDE_OFFSET_M * side;

                (function capture(sx, sz, ang, d) {
                    const timerId = setTimeout(() => {
                        if (typeof AppState !== 'undefined' && !AppState.arActive) return;
                        _spawnFootstep(parent, sx, sz, ang, groundY, STEP_DURATION_MS);
                    }, d);
                    _footstepSpawnTimers.push(timerId);
                })(px + perpX, pz + perpZ, angleDeg, delay);

                dist += STEP_INTERVAL_M;
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
        const geo = new THREE.BufferGeometry();
        const verts = [];
        const uvs = [];
        const indices = [];
        const hw = width / 2;
        const N = points.length;

        // Fix #2: Arc-length bazlı UV'ler
        let runLen = 0;
        const arcLens = [0];
        for (let i = 1; i < N; i++) {
            runLen += points[i].distanceTo(points[i - 1]);
            arcLens.push(runLen);
        }
        const totalLen = runLen > 0 ? runLen : 1;

        for (let i = 0; i < N; i++) {
            const pt = points[i];
            const next = points[Math.min(i + 1, N - 1)];

            const dir = new THREE.Vector3().subVectors(next, pt);
            if (dir.length() < 1e-6) dir.set(0, 0, -1);
            dir.normalize();

            const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(hw);
            
            const t = arcLens[i] / totalLen;
            const uvScale = totalLen; // Uzunluğa göre tekrar sayısını ayarla

            verts.push(
                pt.x - perp.x, pt.y, pt.z - perp.z,  /* sol */
                pt.x + perp.x, pt.y, pt.z + perp.z   /* sağ */
            );
            
            // X ekseni boyunca uzunluk, Y ekseni boyunca en 0-1
            uvs.push(t * uvScale, 0, t * uvScale, 1);

            if (i < N - 1) {
                const b = i * 2;
                indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
            }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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
            _holoPathMesh.material.dispose();
            _holoPathMesh = null;
        }
        _holoUniforms = null;

        _holoFootstepObjs.forEach(m => {
            if (parent) parent.remove(m);
            // Havuzdaki mesh'leri yok etmiyoruz, release ediyoruz ama scene'den çıkardığımız için dispose gerekebilir.
            // Pool mekanizması kullanıyorum, sadece active olanları durduracağım.
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

        // Feature (v2.2): Rota çizmeye biraz ileriden başladığı için, 
        // başlangıcı kameraya (kullanıcıya) çok yakın bir noktadan (-0.2m) başlatıyoruz.
        if (parsedPath.length > 0) {
            const first = parsedPath[0];
            // Eğer ilk nokta 0.5 metreden uzaktaysa, önüne yumuşak bir başlangıç ekle
            if (Math.hypot(first.x, first.z) > 0.5) {
                parsedPath.unshift({ x: 0, y: 0, z: -0.2 });
            }
        }

        const pts = parsedPath.map(p => new THREE.Vector3(
            p.x + originOffset.x, 
            groundY + 0.02, 
            p.z + originOffset.z
        ));
        const curve = new THREE.CatmullRomCurve3(pts);
        const detail = Math.max(40, parsedPath.length * 20);
        const curvePoints = curve.getPoints(detail);

        // Geometri
        const RIBBON_WIDTH = 1.2;
        const geo = _buildRibbonGeo(curvePoints, RIBBON_WIDTH);

        _holoUniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x0A7AFF) },
            uSpeed: { value: 0.70 },
            uOpacity: { value: 0.72 }, // Fix #2: Daha katı zemin (0.38 -> 0.72)
        };

        const mat = new THREE.ShaderMaterial({
            uniforms: _holoUniforms,
            vertexShader: HOLO_VERT,
            fragmentShader: HOLO_FRAG,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.NormalBlending,
        });

        _holoPathMesh = new THREE.Mesh(geo, mat);
        parent.add(_holoPathMesh);

        _scheduleFootsteps(parsedPath, parent, groundY, originOffset);
    }

    function updateUniforms(time) {
        if (_holoUniforms) {
            _holoUniforms.uTime.value = time * 0.001;
        }
    }

    return {
        clearPath,
        drawPath,
        updateAnimations,
        updateUniforms
    };
})();
