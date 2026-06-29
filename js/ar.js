/**
 * ar.js — AR Motoru (A-Frame + HUD + Navigasyon Mantığı)
 * Bağımlılıklar: router.js (AppState, showScreen, vibrate)
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
const ARROW_SPACING_M          = 0.8;  
const ARRIVAL_THRESHOLD        = 0.5;   // Otomatik varış eşiği (metre)
const TURN_WARN_DISTANCE       = 2.5;   // Dönüş uyarısı başlama mesafesi (metre)
const GRACE_PERIOD_MS          = 2000;  // AR açıldıktan sonra varış sayılmaz
const NEXT_SECTION_UNLOCK_DIST = 0.5;   // Sonraki Bölüm butonu kilit açma mesafesi
const TURN_KEYWORDS_LEFT       = ['sola'];
const TURN_KEYWORDS_RIGHT      = ['sağa'];

/* ── Pusula Sarmal Çözücü (Anti-Spinning) ── */
let _lastCompassDeg = 0;
function _unwrapAngle(newAngle, lastAngle) {
    let diff = newAngle - (lastAngle % 360);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return lastAngle + diff;
}

AFRAME.registerComponent('google-chevron', {
    init: function () {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0.4);
        shape.lineTo(0.35, -0.4);
        shape.lineTo(0.15, -0.4);
        shape.lineTo(0, 0.0);
        shape.lineTo(-0.15, -0.4);
        shape.lineTo(-0.35, -0.4);
        shape.lineTo(0, 0.4);

        const extrudeSettings = {
            depth: 0.02,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.015,
            bevelThickness: 0.015
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.computeBoundingBox();
        const yOffset = -0.5 * (geometry.boundingBox.max.y - geometry.boundingBox.min.y);
        geometry.translate(0, yOffset, 0);

        const material = new THREE.MeshStandardMaterial({
            color: 0x1a73e8, // Google Mavisi
            roughness: 0.2,
            metalness: 0.1,
            transparent: true,
            opacity: 0.95
        });

        const mesh = new THREE.Mesh(geometry, material);
        // XY düzleminden XZ (zemin) düzlemine yatır
        mesh.rotation.x = -Math.PI / 2;

        this.el.setObject3D('mesh', mesh);
    }
});


/* ── Mesafe Hesaplama Yardımcısı ── */
function _parsePos(pt) {
    if (!pt || !pt.pos) return { x: 0, y: 0, z: 0 };
    const [x, y, z] = pt.pos.split(' ').map(Number);
    return { x: x||0, y: y||0, z: z||0 };
}

let _activeArrows = []; // Animasyon ve culling için ok listesi

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
        
        // Önce local-floor (zemin çıpası) iste, Drift'i devasa oranda azaltır
        xrSession.requestReferenceSpace('local-floor').then((refSpace) => { 
            _xrRefSpace = refSpace; 
        }).catch(() => {
            // Desteklemiyorsa fallback local
            xrSession.requestReferenceSpace('local').then((refSpace) => { _xrRefSpace = refSpace; });
        });
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

    setTimeout(_drawArrows, 1500);
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
   OK ÇİZİMİ
════════════════════════════════════════════════════ */
function _createChevron(px, pz, angleDeg, indexOffset) {
    const el = document.createElement('a-entity');
    const yPos = _groundY + 0.02; // Z-fighting önlemek ve hafif havada zarif durması için
    
    el.setAttribute('position', `${px} ${yPos} ${pz}`);
    // Bileşenimiz native A-Frame transformasyon sistemini kullanır, bu yüzden yere TAM oturur.
    el.setAttribute('rotation', `0 ${angleDeg} 0`);
    
    // Özel 3D Extruded Geometry Bileşeni
    el.setAttribute('google-chevron', '');

    return { el, baseY: yPos, index: indexOffset };
}

function _drawArrows() {
    const arrowsEl = _dom.arrows();
    arrowsEl.innerHTML = '';
    _activeArrows = [];

    const leg = AppState.arLegs[AppState.legIdx];
    if (!leg || !leg.path || leg.path.length < 2) {
        AppState.tickRafId = requestAnimationFrame(_tick);
        return;
    }

    const path = leg.path;
    let arrowIndex = 0;

    for (let i = 1; i < path.length; i++) {
        const prev = _parsePos(path[i - 1]);
        const curr = _parsePos(path[i]);
        const dx = curr.x - prev.x, dz = curr.z - prev.z;
        const segLen = Math.hypot(dx, dz);
        if (segLen < 0.001) continue;

        const angleRad = Math.atan2(dx, dz);
        const angleDeg = THREE.MathUtils.radToDeg(angleRad) + 180;
        const steps    = Math.max(1, Math.round(segLen / ARROW_SPACING_M));

        const startJ = (i === 1) ? 0 : 1;
        for (let j = startJ; j <= steps; j++) {
            const t = j / steps;
            const px = prev.x + dx * t;
            const pz = prev.z + dz * t;

            const chevron = _createChevron(px, pz, angleDeg, arrowIndex);
            arrowsEl.appendChild(chevron.el);
            _activeArrows.push(chevron);
            arrowIndex++;
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
    
    // 1. Sürekli WebXR Hit Test (Drift Düzeltmesi)
    const scene = _dom.scene();
    if (_hitTestSource && scene.frame && _xrRefSpace) {
        const hitTestResults = scene.frame.getHitTestResults(_hitTestSource);
        if (hitTestResults.length > 0) {
            const pose = hitTestResults[0].getPose(_xrRefSpace);
            // Duvara kitlenmesini önlemek için kameradan biraz aşağıda olmasını teyit et
            if (pose && pose.transform.position.y < camPos.y - 0.4) {
                const targetY = pose.transform.position.y;
                if (_groundY === -1.5) {
                    _groundY = targetY; // İlk vuruşta anında otur
                } else if (Date.now() - AppState.arStartTime < 3000) {
                    // TİTREMEYİ ÖNLEMEK İÇİN: Sadece ilk 3 saniye yeri kalibre et, sonra ZEMİNİ KİLİTLE
                    _groundY += (targetY - _groundY) * 0.1;
                }
            }
        }
    } else if (camPos.y !== 0 && _groundY === -1.5) {
        // Fallback: camera Y - 1.5m
        _groundY = camPos.y - 1.5;
    }
    

    /* Three.js Optimizasyonu: Zemin Takibi ve Wave (Dalga) animasyonları */
    const now = Date.now();
    for (let i = 0; i < _activeArrows.length; i++) {
        const arrow = _activeArrows[i];
        if (arrow.el.object3D) {
            // SADECE Nefes Alma (Opacity) dalgası, Zıplama İptal
            const wave = Math.sin((now * 0.005) - (arrow.index * 0.4));
            const op = 0.6 + (wave * 0.4);
            
            if (arrow.el.object3D.children && arrow.el.object3D.children[0]) {
                const planeMat = arrow.el.object3D.children[0].material;
                if (planeMat) planeMat.opacity = op;
            }
            
            // Jitter'ı engellemek için okları dümdüz _groundY'ye çak
            arrow.el.object3D.position.y = _groundY + 0.01;

            // Frustum Culling
            const dist = Math.hypot(camPos.x - arrow.el.object3D.position.x, camPos.z - arrow.el.object3D.position.z);
            arrow.el.object3D.visible = (dist < 10);
        }
    }

    const inGrace = AppState.arStartTime ? (Date.now() - AppState.arStartTime) < GRACE_PERIOD_MS : true;
    const curLeg = AppState.arLegs[AppState.legIdx];

    /* HUD Compass Arrow Update */
    if (curLeg && curLeg.path && curLeg.path.length > 1) {
        const nextPt = _parsePos(curLeg.path[Math.min(1, curLeg.path.length - 1)]);
        const dx = nextPt.x - camPos.x;
        const dz = nextPt.z - camPos.z;
        
        // Pusula Yön Matematiği
        const targetAngleRad = Math.atan2(dx, -dz);
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const camRotY = Math.atan2(dir.x, -dir.z); 

        const relativeAngle = targetAngleRad - camRotY;
        const rawDeg = THREE.MathUtils.radToDeg(relativeAngle);
        
        // Pusula tam tersini gösterdiği için 180 derece (135 = 180 - 45) ekleyerek tersine çevirdik.
        const targetDeg = rawDeg + 135;
        
        // Unwrap algoritması ile 360 derece fırıldak dönmesini (Spinning) engelliyoruz
        _lastCompassDeg = _unwrapAngle(targetDeg, _lastCompassDeg);
        
        const arrowEl = document.getElementById('ar-hud-arrow');
        if (arrowEl) arrowEl.style.transform = `rotate(${_lastCompassDeg}deg)`; 
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
