/**
 * Değişiklikler (v1.9 → v2.0):
 * Bağımlılıklar: router.js (AppState, showScreen, vibrate)
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

'use strict';

/** @const {string} — Vertex shader: UV passthrough */
const HOLO_VERT = /* glsl */`
    varying vec2 vUv;
    void main() {
        vUv          = uv;
        gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/**
 * @const {string} — Fragment shader
 * UV-scroll ile akan chevron deseni + kenar yumuşatma + nefes efekti.
 * uTime: saniye; uSpeed: akış hızı; uColor: RGB renk; uOpacity: global alpha.
 */
const HOLO_FRAG = /* glsl */`
    uniform float uTime;
    uniform vec3  uColor;
    uniform float uSpeed;
    uniform float uOpacity;
    varying vec2  vUv;

    /* Chevron mask: U ekseninde kayan ok deseni üretir */
    float chevronMask(vec2 uv, float freq, float t, float speed) {
        float u     = fract(uv.x * freq - t * speed);
        float vNorm = abs(uv.y - 0.5) * 2.0;           /* 0=merkez 1=kenar */
        float edge  = 1.0 - abs(u - (1.0 - vNorm) * 0.42 - 0.5) * 4.2;
        return clamp(edge, 0.0, 1.0);
    }

    void main() {
        /* Kenar yumuşatma — şerit kenarlarda solar */
        float edgeFade = 1.0 - pow(abs(vUv.y * 2.0 - 1.0), 1.8);

        /* Akan chevron (3 tekrar) */
        float arrow = chevronMask(vUv, 3.0, uTime, uSpeed);

        /* Hafif nefes efekti — monotonluğu kırar */
        float pulse = 0.88 + 0.12 * sin(uTime * 2.2);

        /* Taban opaklık + chevron katmanı */
        float alpha = (edgeFade * 0.38 + arrow * edgeFade * 0.62) * pulse * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

/* ════════════════════════════════════════════════════
   HOLOGRAPHIC PATH SYSTEM
   Three.js doğrudan erişim — AFRAME.registerComponent ile sarılır.
   Ribbon geometry + UV-scroll chevron + ayak izi mesh pool.
════════════════════════════════════════════════════ */

/* ── Ayak izi canvas texture (inline — harici PNG bağımlılığı yok) ── */
let _footstepTexture = null;

function _getFootstepTexture() {
    if (_footstepTexture) return _footstepTexture;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width  = size;
    canvas.height = size * 2; /* Uzun silüet */
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(255,255,255,0.96)';

    /* Topuk */
    ctx.beginPath();
    ctx.ellipse(64, 210, 28, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    /* Orta ayak (arch) */
    ctx.beginPath();
    ctx.ellipse(57, 158, 20, 32, 0.08, 0, Math.PI * 2);
    ctx.fill();

    /* Taban topu (ball) */
    ctx.beginPath();
    ctx.ellipse(62, 105, 26, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 5 parmak */
    const toes = [
        { x: 38, y: 70, rx: 11, ry: 13 },
        { x: 52, y: 59, rx: 10, ry: 12 },
        { x: 66, y: 57, rx:  9, ry: 11 },
        { x: 78, y: 63, rx:  8, ry: 10 },
        { x: 88, y: 72, rx:  7, ry:  9 },
    ];
    toes.forEach(({ x, y, rx, ry }) => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    });

    _footstepTexture = new THREE.CanvasTexture(canvas);
    _footstepTexture.needsUpdate = true;
    return _footstepTexture;
}

/* ── Holographic Ribbon Geometry Builder ── */

/**
 * Verilen path noktalarından şerit (ribbon) geometrisi üretir.
 * CatmullRom eğrisi ile noktalar yumuşatılır, ardından
 * perpendicular vektörlerle iki kenara genişletilir.
 *
 * @param {THREE.Vector3[]} points  — eğri noktaları
 * @param {number}          width   — şerit genişliği (metre)
 * @returns {THREE.BufferGeometry}
 */
function _buildRibbonGeo(points, width) {
    const geo     = new THREE.BufferGeometry();
    const verts   = [];
    const uvs     = [];
    const indices = [];
    const hw      = width / 2;
    const N       = points.length;

    for (let i = 0; i < N; i++) {
        const pt   = points[i];
        const next = points[Math.min(i + 1, N - 1)];

        /* Segment yönü */
        const dir = new THREE.Vector3().subVectors(next, pt);
        if (dir.length() < 1e-6) dir.set(0, 0, -1);
        dir.normalize();

        /* Dik (perp) vektör — yatay düzlemde */
        const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(hw);
        const t    = i / (N - 1);

        /* Sol ve sağ kenar vertex */
        verts.push(
            pt.x - perp.x, pt.y, pt.z - perp.z,  /* sol */
            pt.x + perp.x, pt.y, pt.z + perp.z   /* sağ */
        );
        uvs.push(t, 0, t, 1);

        if (i < N - 1) {
            const b = i * 2;
            indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

/* ── Footstep Mesh Pool ── */

const _footstepMeshPool = [];       /* Kullanılmayan meshler */
const _activeFootstepAnims = [];    /* { mesh, startTime, duration } */
let   _footstepSpawnTimers = [];    /* clearTimeout için */

/**
 * Havuzdan bir footstep mesh'i al (yoksa yeni oluştur).
 * @returns {THREE.Mesh}
 */
function _acquireFootstepMesh() {
    if (_footstepMeshPool.length > 0) {
        const m = _footstepMeshPool.pop();
        m.visible = true;
        return m;
    }
    const geo = new THREE.PlaneGeometry(0.18, 0.32);
    const mat = new THREE.MeshBasicMaterial({
        map:         _getFootstepTexture(),
        transparent: true,
        opacity:     0,
        depthWrite:  false,
        side:        THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
}

/**
 * Footstep mesh'ini havuza geri bırak.
 * @param {THREE.Mesh} mesh
 */
function _releaseFootstepMesh(mesh) {
    mesh.visible             = false;
    mesh.material.opacity    = 0;
    _footstepMeshPool.push(mesh);
}

/**
 * Aktif footstep animasyonlarını tick içinden güncelle.
 * Animasyon biten mesh'leri havuza geri bırakır.
 */
function _updateFootstepAnimations() {
    if (_activeFootstepAnims.length === 0) return;
    const now     = performance.now();
    const toRemove = [];

    for (const anim of _activeFootstepAnims) {
        const progress = Math.min((now - anim.startTime) / anim.duration, 1);

        let opacity;
        if      (progress < 0.15) opacity = progress / 0.15;
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

/**
 * Belirtilen 3D konumda bir ayak izi spawn et (fade-in → hold → fade-out).
 * @param {THREE.Object3D} parent   — parent Three.js nesnesi (ar-arrows.object3D)
 * @param {number}         x
 * @param {number}         z
 * @param {number}         angleDeg — ayak yönü (derece)
 * @param {number}         groundY  — zemin Y koordinatı
 * @param {number}         duration — animasyon süresi (ms)
 */
function _spawnFootstep(parent, x, z, angleDeg, groundY, duration) {
    const mesh = _acquireFootstepMesh();
    mesh.position.set(x, groundY + 0.03, z);
    mesh.rotation.set(-Math.PI / 2, 0, -THREE.MathUtils.degToRad(angleDeg));
    parent.add(mesh);

    _activeFootstepAnims.push({
        mesh,
        startTime: performance.now(),
        duration,
    });
}

/**
 * Path boyunca kademeli (staggered) ayak izi spawner.
 * Her adım alternating sol/sağ ofset ile konumlandırılır.
 *
 * @param {Array<{x:number,y:number,z:number}>} parsedPath
 * @param {THREE.Object3D}                       parent
 * @param {number}                               groundY
 */
function _scheduleFootsteps(parsedPath, parent, groundY) {
    const STEP_INTERVAL_M    = 0.45;  /* adımlar arası mesafe */
    const SIDE_OFFSET_M      = 0.17;  /* sol/sağ ofset */
    const DELAY_PER_STEP_MS  = 340;   /* kademeli görünme gecikmesi */
    const STEP_DURATION_MS   = 2600;  /* her adımın yaşam süresi */

    let delay  = 0;
    let isLeft = true;

    for (let i = 1; i < parsedPath.length; i++) {
        const a      = parsedPath[i - 1];
        const b      = parsedPath[i];
        const dx     = b.x - a.x;
        const dz     = b.z - a.z;
        const segLen = Math.hypot(dx, dz);
        if (segLen < 1e-6) continue;

        const angleDeg = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
        const ux = dx / segLen;
        const uz = dz / segLen;

        let dist = 0;
        while (dist < segLen) {
            const ratio  = dist / segLen;
            const px     = a.x + dx * ratio;
            const pz     = a.z + dz * ratio;
            const side   = isLeft ? -1 : 1;
            const perpX  = -uz * SIDE_OFFSET_M * side;
            const perpZ  =  ux * SIDE_OFFSET_M * side;

            /* Closure — setTimeout içinde doğru değerleri yakala */
            (function capture(sx, sz, ang, d) {
                const timerId = setTimeout(() => {
                    if (!AppState.arActive) return;
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

/** Bekleyen tüm ayak izi spawn timer'larını iptal et. */
function _cancelFootstepTimers() {
    _footstepSpawnTimers.forEach(id => clearTimeout(id));
    _footstepSpawnTimers = [];
}

/* ── Holographic Path State ── */

let _holoPathMesh    = null;    /* Ribbon Three.js Mesh */
let _holoUniforms    = null;    /* GLSL uniform referansı (tick'te güncellenir) */
let _holoFootstepObjs = [];     /* Three.js sahnesine eklenmiş footstep mesh'leri */

/**
 * Mevcut holographic path mesh'lerini yok et.
 * Object3D parent'tan çıkarır ve belleği serbest bırakır.
 * @param {THREE.Object3D} parent
 */
function _clearHolographicPath(parent) {
    _cancelFootstepTimers();

    /* Ribbon */
    if (_holoPathMesh && parent) {
        parent.remove(_holoPathMesh);
        _holoPathMesh.geometry.dispose();
        _holoPathMesh.material.dispose();
        _holoPathMesh = null;
    }
    _holoUniforms = null;

    /* Footstep meshler */
    _holoFootstepObjs.forEach(m => {
        if (parent) parent.remove(m);
        m.geometry.dispose();
        m.material.dispose();
    });
    _holoFootstepObjs = [];

    /* Havuzdaki aktif animasyonları da temizle */
    _activeFootstepAnims.length = 0;
}

/**
 * Leg path'inden holographic ribbon + footstep sistemi oluştur.
 * @param {object}         leg
 * @param {THREE.Object3D} parent
 * @param {number}         groundY
 */
function _drawHolographicPath(leg, parent, groundY) {
    _clearHolographicPath(parent);

    if (!leg?.path || leg.path.length < 2) return;

    const parsedPath = leg.path.map(_parsePos);

    /* ── CatmullRom eğrisi (pürüzsüz) ── */
    const pts    = parsedPath.map(p => new THREE.Vector3(p.x, groundY + 0.02, p.z));
    const curve  = new THREE.CatmullRomCurve3(pts);
    const detail = Math.max(40, parsedPath.length * 20);
    const curvePoints = curve.getPoints(detail);

    /* ── Ribbon geometry + GLSL material ── */
    const RIBBON_WIDTH = 1.0; /* metre */
    const geo = _buildRibbonGeo(curvePoints, RIBBON_WIDTH);

    _holoUniforms = {
        uTime:    { value: 0 },
        uColor:   { value: new THREE.Color(0x0A7AFF) },
        uSpeed:   { value: 0.70 },
        uOpacity: { value: 1.0 },
    };

    const mat = new THREE.ShaderMaterial({
        uniforms:       _holoUniforms,
        vertexShader:   HOLO_VERT,
        fragmentShader: HOLO_FRAG,
        transparent:    true,
        depthWrite:     false,
        side:           THREE.DoubleSide,
        blending:       THREE.NormalBlending,
    });

    _holoPathMesh = new THREE.Mesh(geo, mat);
    parent.add(_holoPathMesh);

    /* ── Staggered footstep spawner ── */
    _scheduleFootsteps(parsedPath, parent, groundY);
}

/* ════════════════════════════════════════════════════
   DOM REFERANSLARI (bir kez alınır)
════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════
   SABITLER
════════════════════════════════════════════════════ */
const ARRIVAL_THRESHOLD         = 0.5;    /* Otomatik varış eşiği (m) */
const GRACE_PERIOD_MS           = 3000;   /* [Fix-5] AR başlangıç grace süresi (ms) */
const NEXT_SECTION_UNLOCK_DIST  = 0.5;    /* Sonraki Bölüm butonu kilit açma (m) */

/* Turn warning — hysteresis eşikleri [Fix-2] */
const TURN_WARN_SHOW_DIST       = 2.5;    /* Uyarıyı göster (m) */
const TURN_WARN_HIDE_DIST       = 3.2;    /* Bu kadar uzaklaşınca gizle (m) */
const TURN_WARN_MIN_DIST        = 0.30;   /* Bu kadar yaklaşınca gizle (m) */
const TURN_CONFIRM_MS           = 400;    /* Uyarı debounce süresi (ms) */

const TURN_KEYWORDS_LEFT        = ['sola'];
const TURN_KEYWORDS_RIGHT       = ['sağa'];

/* Compass smoothing [Fix-3] */
const COMPASS_EMA_ALPHA         = 0.15;   /* 0=çok pürüzsüz 1=ham */

/* Tick */
const TARGET_FPS     = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

/* ════════════════════════════════════════════════════
   MESAFE HESAPLAMA
════════════════════════════════════════════════════ */

/**
 * Path'in toplam Öklid uzunluğunu hesapla (XZ düzlemi).
 * @param {object[]} path — pos string içeren waypoint nesneleri
 * @returns {number} metre
 */
function _calcLegDistance(path) {
    if (!path || path.length < 2) return 0;
    let dist = 0;
    for (let i = 1; i < path.length; i++) {
        const a = _parsePos(path[i - 1]);
        const b = _parsePos(path[i]);
        dist += Math.hypot(b.x - a.x, b.z - a.z);
    }
    return dist;
}

/* ════════════════════════════════════════════════════
   AR BAŞLATMA
════════════════════════════════════════════════════ */

async function startAR(route) {
    const hasSessionPerm = sessionStorage.getItem('ar_camera_granted');

    /* Tarayıcı izin API'si kontrolü */
    let permStatus = 'prompt';
    if (navigator.permissions?.query) {
        try {
            const status = await navigator.permissions.query({ name: 'camera' });
            permStatus = status.state;
        } catch (e) {
            console.warn('[AR] Permissions API error:', e);
        }
    }

    if (permStatus === 'denied') {
        showToast('Kamera izni reddedildi. Lütfen tarayıcı ayarlarından etkinleştirin.');
        return;
    }

    if (permStatus === 'granted' || hasSessionPerm === 'true') {
        _doStartAR(route);
        return;
    }

    /* Onboarding modal göster */
    const modal = document.getElementById('ar-onboarding');
    modal.style.display = 'flex';

    document.getElementById('btn-accept-ar').onclick = () => {
        modal.style.display = 'none';
        sessionStorage.setItem('ar_camera_granted', 'true');

        /* iOS kalibrasyon uyarısı */
        window.addEventListener('deviceorientation', function onFirstOrientation(e) {
            window.removeEventListener('deviceorientation', onFirstOrientation);
            if (e.webkitCompassAccuracy && e.webkitCompassAccuracy > 15) {
                showToast('Pusula kalibrasyonu düşük. Telefonu havada 8 çizerek sallayın.');
            }
        });

        _doStartAR(route);
    };

    document.getElementById('btn-cancel-ar').onclick = () => {
        modal.style.display = 'none';
    };
}

function _doStartAR(route) {
    /* Durumu sıfırla */
    AppState.activeRoute = route;
    AppState.arLegs      = route.legs || [];
    AppState.legIdx      = 0;
    AppState.arActive    = false;
    AppState.arStartTime = null;
    AppState.totalDist   = AppState.arLegs.reduce(
        (acc, l) => acc + _calcLegDistance(l.path), 0
    );

    _updateArrivedBtn();

    const firstLeg = AppState.arLegs[0];
    if (firstLeg?.type === 'info') {
        _showInfoScreen(firstLeg);
    } else {
        _enterAR();
    }
}

function _enterAR() {
    const scene = _dom.scene();
    scene.classList.add('ar-active');

    if (scene.play) scene.play();

    if (!navigator.xr) {
        showToast('Hata: WebXR desteklenmiyor veya bağlantı güvenli değil (HTTPS gerekli).');
        scene.classList.remove('ar-active');
        return;
    }

    try {
        const p = scene.enterAR();
        if (p?.catch) {
            p.catch(err => {
                console.error('[AR] enterAR error:', err);
                showToast('AR Başlatılamadı: Kameraya izin verilmedi veya desteklenmiyor.');
                scene.classList.remove('ar-active');
            });
        }
    } catch (e) {
        console.error('[AR] enterAR exception:', e);
        showToast('AR Başlatılamadı: A-Frame motoru hatası.');
        scene.classList.remove('ar-active');
    }
}

/* ════════════════════════════════════════════════════
   A-FRAME OLAYLARI
════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
    const scene = _dom.scene();

    scene.addEventListener('enter-vr', _onEnterAR);
    scene.addEventListener('exit-vr',  _onExitAR);

    /* Sayfa yüklendiğinde render döngüsünü durdur (GPU/pil tasarrufu) */
    scene.addEventListener('loaded', () => {
        if (scene.pause) scene.pause();
    });
});

/* Hit-test & reference space */
let _hitTestSource  = null;
let _xrRefSpace     = null;
let _xrViewerSpace  = null;
let _groundY        = -1.5; /* fallback */

function _onEnterAR() {
    AppState.arActive    = true;
    AppState.arStartTime = AppState.arStartTime || Date.now();
    document.body.style.background = 'transparent';

    /* Hit-test kaynak kur (local-floor reference space ile) */
    const scene = _dom.scene();
    if (scene.is('ar-mode') && scene.renderer.xr.getSession()) {
        const xrSession = scene.renderer.xr.getSession();
        xrSession.requestReferenceSpace('local-floor').then(rs => {
            _xrRefSpace = rs;
        }).catch(() => {
            /* local-floor yoksa local kullan */
            xrSession.requestReferenceSpace('local').then(rs => { _xrRefSpace = rs; });
        });
        xrSession.requestReferenceSpace('viewer').then(rs => {
            _xrViewerSpace = rs;
            xrSession.requestHitTestSource({ space: _xrViewerSpace }).then(source => {
                _hitTestSource = source;
            }).catch(err => console.log('[AR] Hit-test not supported:', err));
        });
    }

    /* HUD göster */
    _dom.infoScreen().classList.remove('visible');
    _dom.overlay().classList.add('ar-active');
    _dom.topHud().style.display     = 'flex';
    _dom.bottomPanel().style.display = 'flex';

    document.getElementById('ar-hud-arrow').style.display = 'block';

    _updateHUD();
    document.getElementById('ar-dest').textContent = AppState.activeRoute.name;
    _updateArrivedBtn();

    /* Holographic path — 1.5s bekle (kamera stabil olsun) */
    setTimeout(_drawCurrentLegPath, 1500);

    /* Tick başlat */
    _lastTickTime = 0;
    AppState.tickRafId = requestAnimationFrame(_tick);
}

function _onExitAR() {
    AppState.arActive = false;
    document.body.style.background = '';
    cancelAnimationFrame(AppState.tickRafId);

    if (_hitTestSource) {
        try { _hitTestSource.cancel(); } catch (_) {}
        _hitTestSource = null;
    }

    /* HUD gizle */
    _dom.topHud().style.display      = 'none';
    _dom.bottomPanel().style.display = 'none';
    _dom.turnOverlay().classList.remove('visible');
    document.getElementById('ar-hud-arrow').style.display = 'none';

    /* Holographic path temizle */
    const arrowsEl = _dom.arrows();
    if (arrowsEl?.object3D) {
        _clearHolographicPath(arrowsEl.object3D);
    }

    /* Turnstate sıfırla */
    _turnState          = 'hidden';
    _turnCandidateData  = null;
    _smoothedCompassDeg = null;

    /* Buton state sıfırla */
    const arrivedBtn = _dom.arrivedBtn();
    if (arrivedBtn) {
        arrivedBtn.disabled = false;
        arrivedBtn.classList.remove('btn-arrive-unlock');
    }

    _dom.scene().classList.remove('ar-active');
    _dom.overlay().classList.remove('ar-active');

    const scene = _dom.scene();
    if (scene.pause) scene.pause();
}

/* ════════════════════════════════════════════════════
   HUD GÜNCELLEME
════════════════════════════════════════════════════ */
function _updateHUD() {
    const nextLeg  = AppState.arLegs[AppState.legIdx + 1];
    const iconEl   = document.getElementById('ar-nc-icon');
    const labelEl  = document.getElementById('ar-nc-label');
    const actionEl = document.getElementById('ar-nc-action');

    if (nextLeg?.type === 'info') {
        iconEl.innerHTML     = `<i data-lucide="${nextLeg.icon || 'info'}"></i>`;
        labelEl.textContent  = 'Sonraki Adım';
        actionEl.textContent = nextLeg.title || 'Bilgi Ekranı';
    } else if (nextLeg?.instruction) {
        iconEl.innerHTML     = `<i data-lucide="corner-up-right"></i>`;
        labelEl.textContent  = 'Sonraki Dönüş';
        actionEl.textContent = nextLeg.instruction
            .replace(/[⬆️⬅️➡️↗↙↖↘]/g, '').trim().substring(0, 28);
    } else {
        iconEl.innerHTML     = `<i data-lucide="flag"></i>`;
        labelEl.textContent  = 'Son Düzlük';
        actionEl.textContent = 'Hedefe yaklaştınız';
    }
    if (window.lucide) lucide.createIcons({ root: iconEl });
}

function _updateArrivedBtn() {
    const btn = _dom.arrivedBtn();
    if (!btn) return;

    const isLast = AppState.legIdx === AppState.arLegs.length - 1;
    const label  = document.getElementById('ar-arrive-label');
    if (label) label.textContent = isLast ? 'Hedefe Vardım' : 'Sonraki Bölüm';
    btn.setAttribute('aria-label', isLast ? 'Hedefe vardım' : 'Sonraki bölüme geç');

    _setArrivedBtnLocked(true);
}

function _setArrivedBtnLocked(locked) {
    const btn = _dom.arrivedBtn();
    if (!btn) return;
    if (locked) {
        btn.disabled = true;
        btn.classList.remove('btn-arrive-unlock');
    } else if (btn.disabled) {
        btn.disabled = false;
        vibrate(50);
        btn.classList.add('btn-arrive-unlock');
        setTimeout(() => btn.classList.remove('btn-arrive-unlock'), 300);
    }
}

/* ════════════════════════════════════════════════════
   HOLOGRAPHIC PATH — ÇIZIM
════════════════════════════════════════════════════ */

/** Waypoint pos string'ini {x,y,z} nesnesine parse et. */
function _parsePos(pt) {
    if (!pt?.pos) return { x: 0, y: 0, z: 0 };
    const [x, y, z] = pt.pos.split(' ').map(Number);
    return { x: x || 0, y: y || 0, z: z || 0 };
}

/** Geçerli leg'in holographic path'ini çiz. */
function _drawCurrentLegPath() {
    const leg      = AppState.arLegs[AppState.legIdx];
    const arrowsEl = _dom.arrows();
    if (!arrowsEl?.object3D) return;

    _drawHolographicPath(leg, arrowsEl.object3D, _groundY);
    /* Tick zaten çalışıyor — ayrıca başlatmaya gerek yok */
}

/* ════════════════════════════════════════════════════
   KONUM TAKİBİ — PROGRESS HESABI
════════════════════════════════════════════════════ */

/**
 * Kameranın path üzerinde kat ettiği mesafeyi hesapla.
 * Her segment için closest-point projeksiyon kullanır.
 *
 * @param {THREE.Vector3}              camPos
 * @param {Array<{x,y,z}>}             pathPoints — parse edilmiş noktalar
 * @returns {number} kat edilen mesafe (metre)
 */
function _getProgress(camPos, pathPoints) {
    let closestDist = Infinity;
    let coveredUpTo = 0;
    let runningLen  = 0;

    for (let i = 1; i < pathPoints.length; i++) {
        const a      = pathPoints[i - 1];
        const b      = pathPoints[i];
        const segLen = Math.hypot(b.x - a.x, b.z - a.z);
        const segLen2 = segLen * segLen + 1e-10;

        const t = Math.max(0, Math.min(1,
            ((camPos.x - a.x) * (b.x - a.x) + (camPos.z - a.z) * (b.z - a.z)) / segLen2
        ));

        const cx = a.x + t * (b.x - a.x);
        const cz = a.z + t * (b.z - a.z);
        const d  = Math.hypot(camPos.x - cx, camPos.z - cz);

        if (d < closestDist) {
            closestDist = d;
            coveredUpTo = runningLen + t * segLen;
        }
        runningLen += segLen;
    }
    return coveredUpTo;
}

/* ════════════════════════════════════════════════════
   PUSULA (COMPASS) — FIX-3
   EMA smooth + quaternion heading + nearest-segment yönü
════════════════════════════════════════════════════ */

/* Smoothed compass state */
let _smoothedCompassDeg = null;

/**
 * Açılar için EMA (Exponential Moving Average).
 * 0/360 sınırı güvenli — shortest-path interpolar.
 *
 * @param {number|null} current — mevcut smooth değer
 * @param {number}      target  — yeni ham değer
 * @param {number}      alpha   — EMA faktörü [0,1]
 * @returns {number}
 */
function _lerpAngleDeg(current, target, alpha) {
    if (current === null) return (target + 360) % 360;
    /* Kısa yol delta: [-180, +180] aralığında */
    const delta = ((target - current) + 540) % 360 - 180;
    return (current + alpha * delta + 360) % 360;
}

/**
 * Kameranın mevcut konumuna en yakın path segmentinin
 * ilerleme yönünü derece cinsinden döndürür.
 * path[1]'e sabit bakma sorununu çözer.
 *
 * @param {{x,y,z}}            camPos
 * @param {Array<{x,y,z}>}     parsedPath
 * @returns {number} açı (derece, atan2(dx,dz) bazında)
 */
function _getNearestSegmentAngleDeg(camPos, parsedPath) {
    let bestDist  = Infinity;
    let bestAngle = 0;

    for (let i = 1; i < parsedPath.length; i++) {
        const a  = parsedPath[i - 1];
        const b  = parsedPath[i];
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        const d  = Math.hypot(camPos.x - mx, camPos.z - mz);

        if (d < bestDist) {
            bestDist  = d;
            bestAngle = THREE.MathUtils.radToDeg(Math.atan2(b.x - a.x, b.z - a.z));
        }
    }
    return bestAngle;
}

/**
 * Kameranın dünya-uzayı yaw açısını quaternion'dan hesapla.
 * Euler rotasyonu kullanmak gimbal lock'a yol açar — bu güvenli yol.
 *
 * @param {THREE.Object3D} cam
 * @returns {number} yaw (derece, 0–360)
 */
function _getCamHeadingDeg(cam) {
    const q      = cam.quaternion;
    const sinYaw = 2 * (q.w * q.y - q.z * q.x);
    const cosYaw = 1 - 2 * (q.x * q.x + q.y * q.y);
    let deg = THREE.MathUtils.radToDeg(Math.atan2(sinYaw, cosYaw));
    return (deg + 360) % 360;
}

/**
 * HUD pusula okunu güncelle.
 * EMA ile pürüzsüzleştirilen göreli yön kullanılır.
 *
 * @param {{x,y,z}}    camPos
 * @param {THREE.Object3D} cam
 * @param {object}     curLeg
 */
function _updateCompassArrow(camPos, cam, curLeg) {
    const arrowEl = document.getElementById('ar-hud-arrow');
    if (!arrowEl || !curLeg?.path || curLeg.path.length < 2) return;

    const parsedPath   = curLeg.path.map(_parsePos);
    const targetAngle  = _getNearestSegmentAngleDeg(camPos, parsedPath);
    const camHeading   = _getCamHeadingDeg(cam);
    const rawRelAngle  = (targetAngle - camHeading + 360) % 360;

    /* EMA uygula */
    _smoothedCompassDeg = _lerpAngleDeg(_smoothedCompassDeg, rawRelAngle, COMPASS_EMA_ALPHA);
    arrowEl.style.transform = `rotate(${_smoothedCompassDeg.toFixed(1)}deg)`;
}

/* ════════════════════════════════════════════════════
   TICK LOOP (30fps) — FIX-5
   Cached Vector3 · footstep anim · compass · HUD · turn
════════════════════════════════════════════════════ */
let _lastTickTime = 0;
const _camPosCache = new THREE.Vector3(); /* [Fix-5] Allocation-free reuse */

function _tick(time) {
    if (!AppState.arActive) return;

    if (time - _lastTickTime < FRAME_INTERVAL) {
        AppState.tickRafId = requestAnimationFrame(_tick);
        return;
    }
    _lastTickTime = time;

    const cam = _dom.cam().object3D;
    cam.getWorldPosition(_camPosCache); /* [Fix-5] cached — new Vector3() yok */

    /* ── Ground Y: Hit-test veya kamera fallback ── */
    const scene = _dom.scene();
    if (_hitTestSource && scene.frame && _xrRefSpace) {
        const hits = scene.frame.getHitTestResults(_hitTestSource);
        if (hits.length > 0) {
            const pose = hits[0].getPose(_xrRefSpace);
            if (pose) {
                const newGroundY = pose.transform.position.y;
                /* Sadece makul değişimde güncelle (büyük sıçramaları filtrele) */
                if (Math.abs(newGroundY - _groundY) < 0.5) {
                    _groundY = newGroundY;
                }
            }
        }
    } else if (_camPosCache.y !== 0) {
        _groundY = _camPosCache.y - 1.5;
    }

    /* ── GLSL uTime uniform güncelle (akan animasyon) ── */
    if (_holoUniforms) {
        _holoUniforms.uTime.value = time * 0.001;
    }

    /* ── Footstep animasyonları güncelle ── */
    _updateFootstepAnimations();

    const inGrace = AppState.arStartTime
        ? (Date.now() - AppState.arStartTime) < GRACE_PERIOD_MS
        : true;
    const curLeg = AppState.arLegs[AppState.legIdx];

    /* ── Compass arrow ── */
    if (curLeg?.path?.length > 1) {
        _updateCompassArrow(_camPosCache, cam, curLeg);
    }

    /* ── Hedefe kalan mesafe (leg sonu noktasına) ── */
    let distToTurn = Infinity;
    if (curLeg?.path?.length > 0) {
        const fp = _parsePos(curLeg.path[curLeg.path.length - 1]);
        distToTurn = Math.hypot(_camPosCache.x - fp.x, _camPosCache.z - fp.z);
    }

    /* ── Kalan yol mesafesi (progress-based) ── */
    let remain = 0;
    if (curLeg?.path) {
        const totalDist = _calcLegDistance(curLeg.path);
        const covered   = _getProgress(_camPosCache, curLeg.path.map(_parsePos));
        remain = Math.max(0, totalDist - covered);
    }

    /* ── HUD metrikleri ── */
    document.getElementById('ar-dist').textContent =
        remain < 1 ? '<1m' : `${Math.round(remain)}m`;
    document.getElementById('ar-nc-label').textContent = `${Math.round(remain)}m kaldı`;
    const estSec = Math.ceil(remain * 1.5);
    document.getElementById('ar-time').textContent =
        estSec >= 60 ? `${Math.ceil(estSec / 60)}dk` : `${estSec}sn`;

    /* ── Dönüş uyarısı (hysteresis) ── */
    _handleTurnWarning(distToTurn);

    /* ── Sonraki Bölüm butonu kilit açma ── */
    if (!inGrace) {
        _setArrivedBtnLocked(distToTurn > NEXT_SECTION_UNLOCK_DIST);
    }

    /* ── Otomatik varış (son bacak) ── */
    if (distToTurn < ARRIVAL_THRESHOLD && !inGrace &&
        AppState.legIdx === AppState.arLegs.length - 1) {
        cancelAnimationFrame(AppState.tickRafId);
        _dom.scene().exitVR();
        _showDone();
        return;
    }

    AppState.tickRafId = requestAnimationFrame(_tick);
}

/* ════════════════════════════════════════════════════
   DÖNÜŞ UYARISI — HYSTERESIS STATE MACHINE [Fix-2]
   Tek eşik yerine çift eşik + debounce — göz kırpma yok.
════════════════════════════════════════════════════ */

/**
 * @type {'hidden'|'candidate'|'visible'}
 * Uyarı durumu: gizli → aday (debounce) → görünür
 */
let _turnState          = 'hidden';
let _turnCandidateTime  = 0;
let _turnCandidateData  = null; /* {icon, text, dist} */

/**
 * Dönüş uyarısını hysteresis mantığıyla yönet.
 * [Fix-2] Titreyen göster/gizle döngüsünü önler.
 *
 * @param {number} distToEnd — leg bitiş noktasına mesafe (m)
 */
function _handleTurnWarning(distToEnd) {
    const nextLeg = AppState.arLegs[AppState.legIdx + 1];

    /* Uyarı gösterilmesi gereken koşul */
    const shouldShow = (
        nextLeg &&
        distToEnd <= TURN_WARN_SHOW_DIST &&
        distToEnd >  TURN_WARN_MIN_DIST
    );

    if (_turnState === 'visible') {
        /* Gizle: mesafe hysteresis üst bandını aştıysa VEYA çok yaklaşıldıysa */
        if (!shouldShow || distToEnd > TURN_WARN_HIDE_DIST) {
            _hideTurn();
            _turnState         = 'hidden';
            _turnCandidateData = null;
        } else {
            /* Görünür ve kararlı — sadece mesafe etiketini güncelle */
            const distEl = document.getElementById('ar-turn-dist');
            if (distEl) {
                distEl.textContent = distToEnd
                    ? `${Math.round(distToEnd)}m sonra`
                    : '';
            }
        }
        return;
    }

    if (!shouldShow) {
        if (_turnState !== 'hidden') {
            _turnState         = 'hidden';
            _turnCandidateData = null;
            _hideTurn();
        }
        return;
    }

    /* Hangi dönüş yönü? */
    const ins = (nextLeg.instruction || nextLeg.title || '').toLowerCase();
    let icon, text;
    if (TURN_KEYWORDS_LEFT.some(kw  => ins.includes(kw)))  { icon = 'corner-up-left';  text = 'Sola Dönün';  }
    else if (TURN_KEYWORDS_RIGHT.some(kw => ins.includes(kw))) { icon = 'corner-up-right'; text = 'Sağa Dönün'; }
    else { /* yön belirlenemedi */
        _turnState = 'hidden';
        _hideTurn();
        return;
    }

    const candidate = { icon, text, dist: distToEnd };

    if (_turnState !== 'candidate') {
        /* Yeni aday: timer başlat */
        _turnState         = 'candidate';
        _turnCandidateTime = Date.now();
        _turnCandidateData = candidate;
    } else if (Date.now() - _turnCandidateTime >= TURN_CONFIRM_MS) {
        /* Aday debounce süresini geçti → göster */
        _turnState = 'visible';
        _showTurn(candidate.icon, candidate.text, candidate.dist);
    }
    /* Aksi hâlde: aday devam ediyor, henüz gösterme */
}

function _showTurn(icon, text, dist) {
    const iconEl   = document.getElementById('ar-turn-icon');
    const textEl   = document.getElementById('ar-turn-text');
    const distEl   = document.getElementById('ar-turn-dist');
    const overlay  = _dom.turnOverlay();

    iconEl.innerHTML  = `<i data-lucide="${icon}" width="36" height="36" style="color:white;"></i>`;
    iconEl.style.animation =
        `${icon.includes('left') ? 'bounceL' : 'bounceR'} .6s ease-in-out infinite alternate`;
    textEl.textContent = text;
    distEl.textContent = dist ? `${Math.round(dist)}m sonra` : '';

    if (window.lucide) lucide.createIcons({ root: iconEl });

    if (!overlay.classList.contains('visible')) {
        overlay.classList.add('visible');
        vibrate(200);
    }
}

function _hideTurn() {
    _dom.turnOverlay().classList.remove('visible');
}

/* ════════════════════════════════════════════════════
   BİLGİ EKRANI (Asansör vb. ara adım)
════════════════════════════════════════════════════ */
function _showInfoScreen(leg) {
    const screen      = _dom.infoScreen();
    const iconWrapper = document.getElementById('ais-step-icon');
    iconWrapper.innerHTML = `<i data-lucide="${leg.icon || 'info'}" width="38" height="38"></i>`;
    if (window.lucide) lucide.createIcons({ root: iconWrapper });

    document.getElementById('ais-title').textContent = leg.title || 'Bilgi';

    const ul    = document.getElementById('ais-lines');
    ul.innerHTML = '';
    const lines = leg.lines?.length ? leg.lines : [leg.instruction || ''];
    lines.forEach((lineText, i) => {
        const li  = document.createElement('li');
        li.className = 'ais-line';
        const num = document.createElement('span');
        num.className   = 'ais-num';
        num.textContent = i + 1;
        const txt = document.createElement('span');
        txt.textContent = lineText;
        li.append(num, txt);
        ul.appendChild(li);
    });

    screen.classList.add('visible');
}

/* "Devam Et" butonu (HTML'den çağrılır) */
function onInfoContinue() {
    _dom.infoScreen().classList.remove('visible');
    AppState.legIdx++;

    if (AppState.legIdx >= AppState.arLegs.length) {
        _showDone();
        return;
    }

    const nextLeg = AppState.arLegs[AppState.legIdx];
    if (nextLeg.type === 'info') {
        setTimeout(() => _showInfoScreen(nextLeg), 200);
    } else {
        _enterAR();
    }
}

/* "Ulaştım" butonu (HTML'den çağrılır) */
function onArrived() {
    cancelAnimationFrame(AppState.tickRafId);
    _dom.scene().exitVR();
    _hideTurn();
    vibrate([100, 50, 100]);

    AppState.legIdx++;
    AppState.arStartTime = null;

    if (AppState.legIdx >= AppState.arLegs.length) {
        _showDone();
        return;
    }

    _updateArrivedBtn();
    const nextLeg = AppState.arLegs[AppState.legIdx];
    if (nextLeg.type === 'info') {
        setTimeout(() => _showInfoScreen(nextLeg), 300);
    } else {
        setTimeout(_enterAR, 200);
    }
}

/* ════════════════════════════════════════════════════
   TAMAMLANDI EKRANI
════════════════════════════════════════════════════ */
function _showDone() {
    const route = AppState.activeRoute;
    const legs  = AppState.arLegs;

    document.getElementById('done-head-sub').textContent =
        route.block
            ? `${route.block}${route.floor ? ', ' + route.floor : ''}`
            : 'Navigasyon tamamlandı';
    document.getElementById('done-route-name').textContent = route.name;
    document.getElementById('done-route-loc').textContent  = route.desc || '';

    /* Mesafe: path nokta sayısı değil, gerçek hesap */
    const totalDist = legs.reduce((acc, l) => acc + _calcLegDistance(l.path ?? []), 0);
    document.getElementById('done-dist').textContent =
        totalDist > 0 ? `${Math.round(totalDist)}m` : '—';

    if (AppState.arStartTime) {
        const elapsed = Math.round((Date.now() - AppState.arStartTime) / 1000);
        document.getElementById('done-time').textContent =
            elapsed >= 60 ? `${Math.ceil(elapsed / 60)} dk` : `${elapsed} sn`;
    } else {
        document.getElementById('done-time').textContent = '—';
    }

    const infoBox = document.getElementById('done-info-box');
    if (route.detail) {
        const sentences = route.detail.split('.').filter(s => s.trim());
        if (sentences.length > 0) {
            infoBox.style.display = 'block';
            document.getElementById('done-info-text').textContent =
                sentences.slice(0, 2).join('. ').trim() + '.';
        }
    } else {
        infoBox.style.display = 'none';
    }

    vibrate([150, 100, 150, 100, 300]);
    _dom.doneScreen().classList.add('visible');
}

/* ════════════════════════════════════════════════════
   NAVİGASYON — ANA MENÜ & ÇIKIŞ
════════════════════════════════════════════════════ */

/** Ana Menüye Dön (HTML'den çağrılır) */
function returnToRoutes() {
    _dom.doneScreen().classList.remove('visible');
    renderList();
    showScreen('s-routes');
}

/** AR'dan Çık (HTML Geri butonu — HTML'den çağrılır) */
function exitARToRoutes() {
    cancelAnimationFrame(AppState.tickRafId);
    _dom.scene().exitVR();
    _dom.infoScreen().classList.remove('visible');
    renderList();
    showScreen('s-routes');
}

/* ════════════════════════════════════════════════════
   DEBUG ARAÇLARI [Fix-4]
   Koordinat yakalayıcı — Ayarlar'dan açılır.
   Kameraya tıklayınca koordinatı kopyalar ve toast gösterir.
════════════════════════════════════════════════════ */

let _coordCaptureActive = false;
let _coordCaptureHandler = null;

/**
 * Debug koordinat yakalama modunu aç/kapat.
 * AR aktifken: kameraya dokunulduğunda kamera konumu loglanır.
 * settings.js tarafından çağrılır.
 */
function toggleCoordCapture() {
    if (_coordCaptureActive) {
        _stopCoordCapture();
    } else {
        _startCoordCapture();
    }
}

function _startCoordCapture() {
    _coordCaptureActive = true;
    showToast('📍 Koordinat modu AÇıK — Dokunarak kaydet');

    _coordCaptureHandler = () => {
        if (!AppState.arActive) return;
        const cam = _dom.cam()?.object3D;
        if (!cam) return;

        const pos = new THREE.Vector3();
        cam.getWorldPosition(pos);

        const coordStr = `{ pos: "${pos.x.toFixed(3)} 0 ${pos.z.toFixed(3)}" }`;
        console.info('[AR Coord]', coordStr);
        showToast(`📍 ${coordStr}`);

        /* Panoya kopyala (HTTPS gerekli) */
        navigator.clipboard?.writeText(coordStr).catch(() => {});
    };

    document.getElementById('ar-overlay')?.addEventListener('click', _coordCaptureHandler);
}

function _stopCoordCapture() {
    _coordCaptureActive = false;
    showToast('📍 Koordinat modu KAPALI');
    if (_coordCaptureHandler) {
        document.getElementById('ar-overlay')?.removeEventListener('click', _coordCaptureHandler);
        _coordCaptureHandler = null;
    }
}

/* Dışa açık — settings.js erişebilsin */
window.ARDebug = { toggleCoordCapture };
