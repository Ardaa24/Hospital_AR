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
const ARROW_SPACING_M    = 0.4;   // Ok arası mesafe (metre) - Daha sıkıştırıldı
const ARRIVAL_THRESHOLD  = 0.5;   // Otomatik varış eşiği (metre) - 0.5m yapılarak son oka kadar gitme sağlandı
const TURN_WARN_DISTANCE = 3.5;   // Dönüş uyarısı başlama mesafesi (metre) - Sabitlendi
const GRACE_PERIOD_MS    = 2000;  // AR açıldıktan sonra varış sayılmaz
const TURN_KEYWORDS_LEFT  = ['sola'];
const TURN_KEYWORDS_RIGHT = ['sağa'];

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

function startAR(route) {
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
    scene.enterAR();
}

/* ════════════════════════════════════════════════════
   A-FRAME OLAYLARI
════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
    const scene = _dom.scene();

    scene.addEventListener('enter-vr', _onEnterAR);
    scene.addEventListener('exit-vr',  _onExitAR);
});

function _onEnterAR() {
    AppState.arActive    = true;
    AppState.arStartTime = AppState.arStartTime || Date.now();
    document.body.style.background = 'transparent';

    /* Overlay + HUD göster */
    _dom.infoScreen().classList.remove('visible');
    _dom.overlay().classList.add('ar-active');
    _dom.topHud().style.display    = 'flex';
    _dom.bottomPanel().style.display = 'flex';

    _updateHUD();
    document.getElementById('ar-dest').textContent = AppState.activeRoute.name;
    _updateArrivedBtn();

    setTimeout(_drawArrows, 1500);
}

function _onExitAR() {
    AppState.arActive = false;
    document.body.style.background = '';
    cancelAnimationFrame(AppState.tickRafId);

    _dom.topHud().style.display    = 'none';
    _dom.bottomPanel().style.display = 'none';
    _dom.turnOverlay().classList.remove('visible');
    _dom.arrows().innerHTML = '';
    _dom.scene().classList.remove('ar-active');
    _dom.overlay().classList.remove('ar-active');
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
        iconEl.textContent   = nextLeg.icon || 'ℹ️';
        labelEl.textContent  = 'Sonraki Adım';
        actionEl.textContent = nextLeg.title || 'Bilgi Ekranı';
    } else if (nextLeg && nextLeg.instruction) {
        iconEl.textContent   = '↗';
        labelEl.textContent  = 'Sonraki Dönüş';
        actionEl.textContent = nextLeg.instruction
            .replace(/[⬆️⬅️➡️↗↙↖↘]/g, '').trim().substring(0, 28);
    } else {
        iconEl.textContent   = '🏁';
        labelEl.textContent  = 'Son Düzlük';
        actionEl.textContent = 'Hedefe yaklaştınız';
    }
}

function _updateArrivedBtn() {
    const btn = _dom.arrivedBtn();
    if (!btn) return;
    const isLast = AppState.legIdx === AppState.arLegs.length - 1;
    btn.textContent = isLast ? '🎉 Hedefe Vardım' : '✅ Sonraki Bölüm';
    btn.setAttribute('aria-label', isLast ? 'Hedefe vardım' : 'Sonraki bölüme geç');
}

/* ════════════════════════════════════════════════════
   OK ÇİZİMİ
════════════════════════════════════════════════════ */
function _parsePos(pt) {
    if (!pt || !pt.pos) return { x: 0, y: 0, z: 0 };
    const [x, y, z] = pt.pos.split(' ').map(Number);
    return { x: x||0, y: y||0, z: z||0 };
}

let _activeArrows = []; // Animasyon ve culling için ok listesi

function _createChevron(px, pz, angleDeg, indexOffset) {
    const el = document.createElement('a-entity');
    el.setAttribute('position', `${px} 0.05 ${pz}`);
    // A-Frame kamerası -Z yönüne bakar, bu yüzden oku ileri (+Z) bakıyorsa çevirmek için +180 ekliyoruz
    el.setAttribute('rotation', `0 ${angleDeg + 180} 0`);
    
    // Sol kanat (daha uzun ve keskin açı)
    const left = document.createElement('a-box');
    left.setAttribute('position', '-0.12 0 0.15');
    left.setAttribute('rotation', '0 35 0');
    left.setAttribute('width', '0.45');
    left.setAttribute('height', '0.015');
    left.setAttribute('depth', '0.05');
    left.setAttribute('material', 'shader: flat; color: #0A7AFF; transparent: true; opacity: 0.9');
    
    // Sağ kanat
    const right = document.createElement('a-box');
    right.setAttribute('position', '0.12 0 0.15');
    right.setAttribute('rotation', '0 -35 0');
    right.setAttribute('width', '0.45');
    right.setAttribute('height', '0.015');
    right.setAttribute('depth', '0.05');
    right.setAttribute('material', 'shader: flat; color: #0A7AFF; transparent: true; opacity: 0.9');
    
    el.appendChild(left);
    el.appendChild(right);
    
    return { el, baseY: 0.05, index: indexOffset };
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
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);
        const steps    = Math.max(1, Math.round(segLen / ARROW_SPACING_M));

        // Noktaları tam hedefe oturtmak için t=1'e kadar gidiyoruz. i>1 ise j=1'den başla ki üst üste binmesin.
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

function _tick() {
    if (!AppState.arActive) return;

    const cam = _dom.cam().object3D;
    const camPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);

    /* Three.js Optimizasyonu: Wave (Dalga) animasyonları */
    const time = Date.now();
    for (let i = 0; i < _activeArrows.length; i++) {
        const arrow = _activeArrows[i];
        if (arrow.el.object3D) {
            // Dalga efekti: ardışık oklar sırayla parlar ve süzülür
            const wave = Math.sin((time * 0.005) - (arrow.index * 0.4)); 
            
            // Opaklık (0.3 ile 0.9 arası gidip gelir)
            const op = 0.6 + (wave * 0.3);
            if (arrow.el.object3D.children) {
                arrow.el.object3D.children.forEach(c => {
                    if (c.material) c.material.opacity = op;
                });
            }

            // Yukarı aşağı hafif zıplama
            arrow.el.object3D.position.y = arrow.baseY + (wave * 0.04);
            
            // Frustum Culling
            const dist = Math.hypot(camPos.x - arrow.el.object3D.position.x, camPos.z - arrow.el.object3D.position.z);
            arrow.el.object3D.visible = (dist < 10);
        }
    }

    const inGrace = AppState.arStartTime ? (Date.now() - AppState.arStartTime) < GRACE_PERIOD_MS : true;
    const curLeg = AppState.arLegs[AppState.legIdx];

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
        _showTurn('⬅️', 'SOLA DÖN', distToEnd);
    } else if (TURN_KEYWORDS_RIGHT.some(kw => ins.includes(kw))) {
        _showTurn('➡️', 'SAĞA DÖN', distToEnd);
    } else {
        _hideTurn();
    }
}

function _showTurn(icon, text, dist) {
    const iconEl  = document.getElementById('ar-turn-icon');
    const textEl  = document.getElementById('ar-turn-text');
    const distEl  = document.getElementById('ar-turn-dist');
    const overlay = _dom.turnOverlay();

    iconEl.textContent = icon;
    iconEl.style.animation = `${icon.includes('⬅') ? 'bounceL' : 'bounceR'} .6s ease-in-out infinite alternate`;
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
    document.getElementById('ais-step-icon').textContent = leg.icon || 'ℹ️';
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
