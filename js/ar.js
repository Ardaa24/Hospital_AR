/**
 * ar.js — AR Motoru (A-Frame + HUD + Navigasyon Mantığı)
 *
 * Sorumluluk: Yalnızca AR modu.
 *   - AR başlatma / durdurma
 *   - Ok (arrow) çizimi
 *   - Konum takibi (tick loop)
 *   - Dönüş uyarısı (3m eşiği) + haptic
 *   - Bilgi ekranı (asansör vb.)
 *   - Tamamlama ekranı
 *
 * Bağımlılıklar: router.js (AppState, showScreen, vibrate)
 * NOT: SOS kaldırıldı.
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

/* ── DOM Referansları (bir kez alınır) ── */
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

/* ── Sabitler ── */
const ARROW_SPACING_M          = 0.55;  // Holografik segment aralığı (metre)
const ARRIVAL_THRESHOLD        = 0.5;   // Otomatik varış eşiği (metre)
const TURN_WARN_DISTANCE       = 2.5;   // Dönüş uyardısı mesafesi (metre)
const GRACE_PERIOD_MS          = 2000;  // AR açıldıktan sonra varış sayılmaz
const NEXT_SECTION_UNLOCK_DIST = 0.5;   // Sonraki Bölüm butonu kilit açma mesafesi
const HOLO_DISK_RADIUS         = 0.16;  // Holografik disk yarıçapı (metre)
const HOLO_DISK_HEIGHT         = 0.018; // Disk kalınlığı
const HOLO_ARROW_INTERVAL      = 3;     // Kaç diskten birinde yön oku olsun
const HOLO_COLOR_PATH          = '#0A7AFF'; // Yol rengi (mavi)
const HOLO_COLOR_WARN          = '#FF6B2C'; // Uyardı rengi (tur. — dönüş)
const TURN_KEYWORDS_LEFT       = ['sola'];
const TURN_KEYWORDS_RIGHT      = ['sağa'];

/* ── Mesafe Hesaplama Yardımcısı ── */
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
    
    // Tarayıcı izin API'si kontrolü
    let permStatus = 'prompt';
    if (navigator.permissions && navigator.permissions.query) {
        try {
            const status = await navigator.permissions.query({ name: 'camera' });
            permStatus = status.state;
        } catch (e) {
            console.warn("Permissions API error:", e);
        }
    }

    if (permStatus === 'denied') {
        showToast("Kamera izni reddedildi. Lütfen tarayıcı ayarlarından etkinleştirin.");
        return;
    }

    if (permStatus === 'granted' || hasSessionPerm === 'true') {
        _doStartAR(route);
        return;
    }

    // Modal Gösterimi
    const modal = document.getElementById('ar-onboarding');
    modal.style.display = 'flex';
    
    document.getElementById('btn-accept-ar').onclick = () => {
        modal.style.display = 'none';
        sessionStorage.setItem('ar_camera_granted', 'true');
        
        // Kalibrasyon uyarısı
        window.addEventListener('deviceorientation', function(e) {
            if (e.webkitCompassAccuracy && e.webkitCompassAccuracy > 15) {
                showToast("Pusula kalibrasyonu düşük olabilir. Telefonunuzu havada 8 çizerek sallayın.");
            }
        }, {once: true});

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

    /* İlk bacak "info" ise bilgi ekranını önce göster */
    const firstLeg = AppState.arLegs[0];
    if (firstLeg && firstLeg.type === 'info') {
        _showInfoScreen(firstLeg);
    } else {
        _enterAR();
    }
}

function _enterAR() {
    const scene = _dom.scene();
    scene.classList.add('ar-active');
    
    // WebGL render döngüsünü aktifleştir
    if (scene.play) scene.play();
    
    // WebXR API kontrolü (HTTPS zorunluluğu)
    if (!navigator.xr) {
        showToast("Hata: WebXR desteklenmiyor veya bağlantı güvenli değil (HTTPS gerekli).");
        scene.classList.remove('ar-active');
        return;
    }

    try {
        const p = scene.enterAR();
        if (p && p.catch) {
            p.catch(err => {
                console.error("AR Start Error:", err);
                showToast("AR Başlatılamadı: Kameraya izin verilmedi veya desteklenmiyor.");
                scene.classList.remove('ar-active');
            });
        }
    } catch (e) {
        console.error("AR Start Exception:", e);
        showToast("AR Başlatılamadı: A-Frame motoru hatası.");
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
    
    // Sayfa ilk yüklendiğinde WebGL render döngüsünü durdurarak GPU ve pil tasarrufu sağla
    scene.addEventListener('loaded', () => {
        if (scene.pause) scene.pause();
    });
});

let _hitTestSource = null;
let _xrRefSpace = null;
let _xrViewerSpace = null;
let _groundY = -1.5; // fallback

function _onEnterAR() {
    AppState.arActive    = true;
    AppState.arStartTime = AppState.arStartTime || Date.now();
    document.body.style.background = 'transparent';

    const scene = _dom.scene();
    if (scene.is('ar-mode') && scene.renderer.xr.getSession()) {
        const xrSession = scene.renderer.xr.getSession();
        xrSession.requestReferenceSpace('local').then((refSpace) => { _xrRefSpace = refSpace; });
        xrSession.requestReferenceSpace('viewer').then((refSpace) => {
            _xrViewerSpace = refSpace;
            xrSession.requestHitTestSource({ space: _xrViewerSpace }).then((source) => {
                _hitTestSource = source;
            }).catch(err => console.log("Hit test not supported", err));
        });
    }

    /* Overlay + HUD göster */
    _dom.infoScreen().classList.remove('visible');
    _dom.overlay().classList.add('ar-active');
    _dom.topHud().style.display    = 'flex';
    _dom.bottomPanel().style.display = 'flex';
    
    // Show HUD arrow
    document.getElementById('ar-hud-arrow').style.display = 'block';

    _updateHUD();
    document.getElementById('ar-dest').textContent = AppState.activeRoute.name;
    _updateArrivedBtn();

    setTimeout(_drawHolographicPath, 1500);
}

function _onExitAR() {
    AppState.arActive = false;
    document.body.style.background = '';
    cancelAnimationFrame(AppState.tickRafId);
    
    if (_hitTestSource) {
        _hitTestSource.cancel();
        _hitTestSource = null;
    }

    _dom.topHud().style.display    = 'none';
    _dom.bottomPanel().style.display = 'none';
    _dom.turnOverlay().classList.remove('visible');
    document.getElementById('ar-hud-arrow').style.display = 'none';
    _dom.arrows().innerHTML = '';
    _dom.scene().classList.remove('ar-active');
    _dom.overlay().classList.remove('ar-active');
    
    // WebGL render döngüsünü durdurarak GPU yırtılmalarını önle ve pil tasarrufu sağla
    const scene = _dom.scene();
    if (scene.pause) scene.pause();
}

/* ════════════════════════════════════════════════════
   HUD GÜNCELLEME
════════════════════════════════════════════════════ */
function _updateHUD() {
    const nextLeg = AppState.arLegs[AppState.legIdx + 1];
    const iconEl   = document.getElementById('ar-nc-icon');
    const labelEl  = document.getElementById('ar-nc-label');
    const actionEl = document.getElementById('ar-nc-action');

    if (nextLeg && nextLeg.type === 'info') {
        iconEl.innerHTML     = `<i data-lucide="${nextLeg.icon || 'info'}"></i>`;
        labelEl.textContent  = 'Sonraki Adım';
        actionEl.textContent = nextLeg.title || 'Bilgi Ekranı';
    } else if (nextLeg && nextLeg.instruction) {
        iconEl.innerHTML     = `<i data-lucide="corner-up-right"></i>`;
        labelEl.textContent  = 'Sonraki Dönüş';
        actionEl.textContent = nextLeg.instruction
            .replace(/[⬆️⬅️➡️↗↙↖↘]/g, '').trim().substring(0, 28);
    } else {
        iconEl.innerHTML     = `<i data-lucide="flag"></i>`;
        labelEl.textContent  = 'Son Düzlük';
        actionEl.textContent = 'Hedefe yaklaştınız';
    }
    if (window.lucide) lucide.createIcons({root: iconEl});
}

function _updateArrivedBtn() {
    const btn = _dom.arrivedBtn();
    if (!btn) return;

    const isLast  = AppState.legIdx === AppState.arLegs.length - 1;
    const label   = document.getElementById('ar-arrive-label');
    if (label) label.textContent = isLast ? 'Hedefe Vardım' : 'Sonraki Bölüm';
    btn.setAttribute('aria-label', isLast ? 'Hedefe vardım' : 'Sonraki bölüme geç');

    // Her yeni bacakta kilit sıfırlanır (0.5m'de JS açacak)
    _setArrivedBtnLocked(true);
}

/* ════════════════════════════════════════════════════
   VARIL BUTONU KİLTİ YONETIMi
   Tek sorumluluk: disabled state toggle.
   Grace period dışında, distToTurn <= 0.5m olduğunda çağrılır.
════════════════════════════════════════════════════ */
function _setArrivedBtnLocked(locked) {
    const btn = _dom.arrivedBtn();
    if (!btn) return;
    if (locked) {
        btn.disabled = true;
    } else if (btn.disabled) {
        // Sadece durum değişiyorsa animasyonu tetikle (DOM thrashing önle)
        btn.disabled = false;
        vibrate(50); // Çok kısa, non-intrusive haptic
    }
}

/* ════════════════════════════════════════════════════
   HOLOGRAFiK YOL SİSTEMİ
   Stil 3: Yere projeksiyon, GPU-dostu flat shader.
   Her segment: ince disk (a-cylinder) + seyrek yön oku (a-cone)
════════════════════════════════════════════════════ */
function _parsePos(pt) {
    if (!pt || !pt.pos) return { x: 0, y: 0, z: 0 };
    const [x, y, z] = pt.pos.split(' ').map(Number);
    return { x: x||0, y: y||0, z: z||0 };
}

let _activeArrows = []; // Animasyon ve culling için ok listesi

/**
 * Tek bir holografik yol segmentı oluşturur.
 * @param {number} px   Dünya X koordinatı
 * @param {number} pz   Dünya Z koordinatı
 * @param {number} angleDeg Y-eksen rotasyonu (yön)
 * @param {number} idx  Zincirdeki sıra (faz hesabı için)
 * @returns {{ el: Element, baseY: number, index: number }}
 */
function _createHoloSegment(px, pz, angleDeg, idx) {
    const wrapper = document.createElement('a-entity');
    const yPos    = _groundY + (HOLO_DISK_HEIGHT / 2) + 0.005;
    wrapper.setAttribute('position', `${px} ${yPos} ${pz}`);
    wrapper.setAttribute('rotation', `0 ${angleDeg + 180} 0`);

    // ── Ana disk (ince puck, GPU-dostu flat shader) ──
    const disk = document.createElement('a-cylinder');
    disk.setAttribute('radius',          String(HOLO_DISK_RADIUS));
    disk.setAttribute('height',          String(HOLO_DISK_HEIGHT));
    disk.setAttribute('segments-radial', '12'); // Düşük polygon — performans
    disk.setAttribute('segments-height', '1');
    disk.setAttribute('material',
        `shader: flat; color: ${HOLO_COLOR_PATH}; transparent: true; opacity: 0.82; emissive: ${HOLO_COLOR_PATH}; emissiveIntensity: 0.25`);
    wrapper.appendChild(disk);

    // ── Kenar glow halkası (flat, alpha blend ile simüle) ──
    const glow = document.createElement('a-cylinder');
    glow.setAttribute('radius',          String(HOLO_DISK_RADIUS + 0.035));
    glow.setAttribute('height',          '0.003');
    glow.setAttribute('segments-radial', '12');
    glow.setAttribute('segments-height', '1');
    glow.setAttribute('position',        '0 -0.007 0');
    glow.setAttribute('material',
        `shader: flat; color: ${HOLO_COLOR_PATH}; transparent: true; opacity: 0.28`);
    wrapper.appendChild(glow);

    // ── Yön oku: her HOLO_ARROW_INTERVAL segmentten birinde ──
    if (idx % HOLO_ARROW_INTERVAL === 0) {
        const cone = document.createElement('a-cone');
        cone.setAttribute('radius-bottom', '0.055');
        cone.setAttribute('radius-top',    '0');
        cone.setAttribute('height',        '0.065');
        cone.setAttribute('segments-radial','8');  // Düşük polygon
        cone.setAttribute('position',      '0 0.022 -0.06');
        cone.setAttribute('rotation',      '-90 0 0');
        cone.setAttribute('material',
            'shader: flat; color: #FFFFFF; transparent: true; opacity: 0.92');
        wrapper.appendChild(cone);
    }

    return { el: wrapper, baseY: yPos, index: idx, disk, glow };
}

/**
 * Mevcut bacak için tüm holografik segmentleri çizer.
 * Frustum culling ve faz-dalgası animasyonu _tick() içinde yönetilir.
 */
function _drawHolographicPath() {
    const arrowsEl = _dom.arrows();
    arrowsEl.innerHTML = '';
    _activeArrows = [];

    const leg = AppState.arLegs[AppState.legIdx];
    if (!leg || !leg.path || leg.path.length < 2) {
        AppState.tickRafId = requestAnimationFrame(_tick);
        return;
    }

    const path = leg.path;
    let   segIdx = 0;

    for (let i = 1; i < path.length; i++) {
        const prev   = _parsePos(path[i - 1]);
        const curr   = _parsePos(path[i]);
        const dx     = curr.x - prev.x;
        const dz     = curr.z - prev.z;
        const segLen = Math.hypot(dx, dz);
        if (segLen < 0.001) continue;

        const angleRad = Math.atan2(dx, dz);
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);
        const steps    = Math.max(1, Math.round(segLen / ARROW_SPACING_M));
        const startJ   = (i === 1) ? 0 : 1;

        for (let j = startJ; j <= steps; j++) {
            const t  = j / steps;
            const px = prev.x + dx * t;
            const pz = prev.z + dz * t;

            const seg = _createHoloSegment(px, pz, angleDeg, segIdx);
            arrowsEl.appendChild(seg.el);
            _activeArrows.push(seg);
            segIdx++;
        }
    }

    AppState.tickRafId = requestAnimationFrame(_tick);
}

/* ════════════════════════════════════════════════════
   KONUm TAKİBİ (Tick Loop)
════════════════════════════════════════════════════ */
function _getProgress(camPos, pathPoints) {
    let closestDist = Infinity;
    let coveredUpTo = 0;
    let runningLen  = 0;

    for (let i = 1; i < pathPoints.length; i++) {
        const a = pathPoints[i - 1], b = pathPoints[i];
        const segLen = Math.hypot(b.x - a.x, b.z - a.z);
        const t = Math.max(0, Math.min(1,
            ((camPos.x - a.x) * (b.x - a.x) + (camPos.z - a.z) * (b.z - a.z))
            / (segLen * segLen + 1e-10)
        ));
        const d = Math.hypot(
            camPos.x - (a.x + t * (b.x - a.x)),
            camPos.z - (a.z + t * (b.z - a.z))
        );
        if (d < closestDist) { closestDist = d; coveredUpTo = runningLen + t * segLen; }
        runningLen += segLen;
    }
    return coveredUpTo;
}

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
let _lastTickTime = 0;

function _tick(time) {
    if (!AppState.arActive) return;
    
    if (time - _lastTickTime < FRAME_INTERVAL) {
        AppState.tickRafId = requestAnimationFrame(_tick);
        return;
    }
    _lastTickTime = time;

    const cam = _dom.cam().object3D;
    const camPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);
    
    // 1. WebXR Hit Test
    const scene = _dom.scene();
    if (_hitTestSource && scene.frame && _xrRefSpace) {
        const hitTestResults = scene.frame.getHitTestResults(_hitTestSource);
        if (hitTestResults.length > 0) {
            const pose = hitTestResults[0].getPose(_xrRefSpace);
            if (pose) {
                _groundY = pose.transform.position.y;
                _hitTestSource.cancel();
                _hitTestSource = null;
                // Holografik segmentlerin zeminini güncelle
                const newBaseY = _groundY + (HOLO_DISK_HEIGHT / 2) + 0.005;
                _activeArrows.forEach(arr => {
                    arr.baseY = newBaseY;
                    if (arr.el.object3D) arr.el.object3D.position.y = newBaseY;
                });
            }
        }
    } else if (camPos.y !== 0) {
        // Fallback: camera Y - 1.5m
        _groundY = camPos.y - 1.5;
    }
    

    /* Holografik Yol: Nabız (pulse) animasyonu — GPU-dostu, sadece opacity */
    const now        = Date.now();
    const isNearWarn = AppState.arLegs[AppState.legIdx + 1] !== undefined;
    for (let i = 0; i < _activeArrows.length; i++) {
        const seg = _activeArrows[i];
        if (!seg.el.object3D) continue;

        // Frustum culling: sadece 10m içindeki segmentler render edilir
        const dCam = Math.hypot(
            camPos.x - seg.el.object3D.position.x,
            camPos.z - seg.el.object3D.position.z
        );
        seg.el.object3D.visible = (dCam < 10);
        if (!seg.el.object3D.visible) continue;

        // Faz-kaydırmalı nabız: ardardına segmentler dalga gibi parlar
        const phase  = (now * 0.004) - (seg.index * 0.45);
        const pulse  = 0.5 + (Math.sin(phase) * 0.5); // 0..1 arası
        const opMain = 0.45 + pulse * 0.45;  // 0.45 → 0.90
        const opGlow = 0.12 + pulse * 0.22;  // 0.12 → 0.34

        // Ana disk opasitesi (Three.js material doğrudan)
        if (seg.disk?.object3D?.children?.[0]?.material) {
            seg.disk.object3D.children[0].material.opacity = opMain;
        }
        // Glow opasitesi
        if (seg.glow?.object3D?.children?.[0]?.material) {
            seg.glow.object3D.children[0].material.opacity = opGlow;
        }
    }

    const inGrace = AppState.arStartTime ? (Date.now() - AppState.arStartTime) < GRACE_PERIOD_MS : true;
    const curLeg = AppState.arLegs[AppState.legIdx];

    /* HUD Compass Arrow Update */
    if (curLeg && curLeg.path && curLeg.path.length > 1) {
        const nextPt = _parsePos(curLeg.path[Math.min(1, curLeg.path.length - 1)]);
        const dx = nextPt.x - camPos.x;
        const dz = nextPt.z - camPos.z;
        const targetAngleRad = Math.atan2(dx, dz);
        
        let camRotY = cam.rotation.y;
        // Kamera sağa/sola döndüğünde pusulanın ters dönme hatasını düzeltmek için işareti + yaptık.
        let relativeAngle = targetAngleRad + camRotY;
        let deg = THREE.MathUtils.radToDeg(relativeAngle);
        
        const arrowEl = document.getElementById('ar-hud-arrow');
        if (arrowEl) arrowEl.style.transform = `rotate(${deg + 180 - 45}deg)`; // +180 due to -Z forward, -45 for lucide default icon angle
    }

    /* Gerçek hedefe olan (bacak bitişi) uzaklık */
    let distToTurn = Infinity;
    if (curLeg && curLeg.path && curLeg.path.length > 0) {
        const finalPt = _parsePos(curLeg.path[curLeg.path.length - 1]);
        distToTurn = Math.hypot(camPos.x - finalPt.x, camPos.z - finalPt.z);
    }

    /* Kalan mesafe hesabı (SADECE o anki bacağın (leg) mesafesi) */
    let curLegTotalDist = 0;
    if (curLeg && curLeg.path) {
        curLegTotalDist = _calcLegDistance(curLeg.path);
    }

    let covered = 0;
    if (curLeg?.path) {
        covered = _getProgress(camPos, curLeg.path.map(_parsePos));
    }
    const remain = Math.max(0, curLegTotalDist - covered);

    /* HUD metrik güncelle */
    document.getElementById('ar-dist').textContent = remain < 1 ? '<1m' : `${Math.round(remain)}m`;
    document.getElementById('ar-nc-label').textContent = `${Math.round(remain)}m kaldı`;
    const estSec = Math.ceil(remain * 1.5);
    document.getElementById('ar-time').textContent = estSec >= 60 ? `${Math.ceil(estSec / 60)}dk` : `${estSec}sn`;

    /* Dönüş uyarısı (Dalgalanmayı önleyen sabit hedef hesabı ile) */
    _handleTurnWarning(distToTurn);

    /* Sonraki Bölüm butonu kilit açma (grace period dışında, 0.5m eşiğinde) */
    if (!inGrace) {
        _setArrivedBtnLocked(distToTurn > NEXT_SECTION_UNLOCK_DIST);
    }

    /* Otomatik varış (son bacak) */
    if (distToTurn < ARRIVAL_THRESHOLD && !inGrace && AppState.legIdx === AppState.arLegs.length - 1) {
        cancelAnimationFrame(AppState.tickRafId);
        _dom.scene().exitVR();
        _showDone();
        return;
    }

    AppState.tickRafId = requestAnimationFrame(_tick);
}

/* ── Dönüş Uyarısı ── */
function _handleTurnWarning(distToEnd) {
    const nextLeg = AppState.arLegs[AppState.legIdx + 1];
    if (!nextLeg || distToEnd > TURN_WARN_DISTANCE || distToEnd <= 0.4) {
        _hideTurn();
        return;
    }
    const ins = (nextLeg.instruction || nextLeg.title || '').toLowerCase();
    if (TURN_KEYWORDS_LEFT.some(kw => ins.includes(kw))) {
        _showTurn('corner-up-left', 'Sola Dönün', distToEnd);
    } else if (TURN_KEYWORDS_RIGHT.some(kw => ins.includes(kw))) {
        _showTurn('corner-up-right', 'Sağa Dönün', distToEnd);
    } else {
        _hideTurn();
    }
}

function _showTurn(icon, text, dist) {
    const iconEl  = document.getElementById('ar-turn-icon');
    const textEl  = document.getElementById('ar-turn-text');
    const distEl  = document.getElementById('ar-turn-dist');
    const overlay = _dom.turnOverlay();

    iconEl.innerHTML = `<i data-lucide="${icon}" width="36" height="36" style="color:white;"></i>`;
    
    iconEl.style.animation = `${icon.includes('left') ? 'bounceL' : 'bounceR'} .6s ease-in-out infinite alternate`;
    textEl.textContent = text;
    distEl.textContent = dist ? `${Math.round(dist)}m sonra` : '';

    if (!overlay.classList.contains('visible')) {
        overlay.classList.add('visible');
        /* Haptic: dönüş uyarısı */
        vibrate(200);
    }
}
function _hideTurn() { _dom.turnOverlay().classList.remove('visible'); }

/* ════════════════════════════════════════════════════
   BİLGİ EKRANI (Asansör vb.)
════════════════════════════════════════════════════ */
function _showInfoScreen(leg) {
    const screen = _dom.infoScreen();
    const iconWrapper = document.getElementById('ais-step-icon');
    iconWrapper.innerHTML = `<i data-lucide="${leg.icon || 'info'}" width="38" height="38"></i>`;
    if (window.lucide) lucide.createIcons({root: iconWrapper});
    document.getElementById('ais-title').textContent     = leg.title || 'Bilgi';

    const ul = document.getElementById('ais-lines');
    ul.innerHTML = '';
    const lines = leg.lines?.length ? leg.lines : [leg.instruction || ''];
    lines.forEach((text, i) => {
        const li  = document.createElement('li');
        li.className = 'ais-line';
        const num = document.createElement('span');
        num.className = 'ais-num';
        num.textContent = i + 1;
        const txt = document.createElement('span');
        txt.textContent = text;
        li.append(num, txt);
        ul.appendChild(li);
    });

    screen.classList.add('visible');
}

/* "Devam Et" butonu tıklaması (HTML'den çağrılır) */
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

/* "Ulaştım" butonu tıklaması (HTML'den çağrılır) */
function onArrived() {
    cancelAnimationFrame(AppState.tickRafId);
    _dom.scene().exitVR();
    _hideTurn();

    /* Haptic: varış onayı */
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

    /* Başlık */
    document.getElementById('done-head-sub').textContent =
        route.block ? `${route.block}${route.floor ? ', ' + route.floor : ''}` : 'Navigasyon tamamlandı';
    document.getElementById('done-route-name').textContent = route.name;
    document.getElementById('done-route-loc').textContent  = route.desc || '';

    /* İstatistikler */
    const totalDist = legs.reduce((acc, l) => acc + (l.path ? l.path.length : 0), 0);
    document.getElementById('done-dist').textContent = `${totalDist}m`;

    if (AppState.arStartTime) {
        const elapsed = Math.round((Date.now() - AppState.arStartTime) / 1000);
        document.getElementById('done-time').textContent =
            elapsed >= 60 ? `${Math.ceil(elapsed / 60)} dk` : `${elapsed} sn`;
    } else {
        document.getElementById('done-time').textContent = '—';
    }

    /* Varış bilgisi */
    const infoBox = document.getElementById('done-info-box');
    if (route.detail) {
        const sentences = route.detail.split('.').filter(s => s.trim().length > 0);
        if (sentences.length > 0) {
            infoBox.style.display = 'block';
            document.getElementById('done-info-text').textContent =
                sentences.slice(0, 2).join('. ').trim() + '.';
        }
    } else {
        infoBox.style.display = 'none';
    }

    /* Haptic: başarı */
    vibrate([150, 100, 150, 100, 300]);

    _dom.doneScreen().classList.add('visible');
}

/* ── Ana Menüye Dön (HTML'den çağrılır) ── */
function returnToRoutes() {
    _dom.doneScreen().classList.remove('visible');
    renderList();
    showScreen('s-routes');
}

/* ── AR'dan çık (Geri butonu, HTML'den çağrılır) ── */
function exitARToRoutes() {
    cancelAnimationFrame(AppState.tickRafId);
    _dom.scene().exitVR();
    _dom.infoScreen().classList.remove('visible');
    renderList();
    showScreen('s-routes');
}
