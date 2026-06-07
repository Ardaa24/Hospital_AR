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
const ARROW_SPACING_M    = 0.7;   // Ok arası mesafe (metre)
const ARRIVAL_THRESHOLD  = 1.5;   // Otomatik varış eşiği (metre)
const TURN_WARN_DISTANCE = 3.0;   // Dönüş uyarısı başlama mesafesi (metre)
const GRACE_PERIOD_MS    = 2000;  // AR açıldıktan sonra varış sayılmaz
const TURN_KEYWORDS_LEFT  = ['sola'];
const TURN_KEYWORDS_RIGHT = ['sağa'];

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
        (acc, l) => acc + (l.path ? l.path.length : 0), 0
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

function _createArrow(px, pz, angleDeg, angleRad, delayMs) {
    const hx = px + Math.sin(angleRad) * 0.28;
    const hz = pz + Math.cos(angleRad) * 0.28;

    const shaft = document.createElement('a-cylinder');
    shaft.setAttribute('radius', '0.06');
    shaft.setAttribute('height', '0.32');
    shaft.setAttribute('position', `${px} 0.04 ${pz}`);
    shaft.setAttribute('rotation', `90 ${angleDeg} 0`);
    shaft.setAttribute('material', 'color:#1A6FD4;transparent:true;opacity:.88;roughness:.3;metalness:.1');
    shaft.setAttribute('animation__float', `property:position;to:${px} 0.14 ${pz};from:${px} 0.04 ${pz};dir:alternate;loop:true;dur:1000;easing:easeInOutSine;delay:${delayMs}`);

    const head = document.createElement('a-cone');
    head.setAttribute('radius-bottom', '0.14');
    head.setAttribute('radius-top', '0');
    head.setAttribute('height', '0.22');
    head.setAttribute('position', `${hx} 0.04 ${hz}`);
    head.setAttribute('rotation', `90 ${angleDeg} 0`);
    head.setAttribute('material', 'color:#1A6FD4;transparent:true;opacity:.95;roughness:.2;metalness:.15');
    head.setAttribute('animation__float', `property:position;to:${hx} 0.14 ${hz};from:${hx} 0.04 ${hz};dir:alternate;loop:true;dur:1000;easing:easeInOutSine;delay:${delayMs}`);

    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', '0.16');
    ring.setAttribute('radius-outer', '0.22');
    ring.setAttribute('rotation', '-90 0 0');
    ring.setAttribute('position', `${px} 0.005 ${pz}`);
    ring.setAttribute('material', 'color:#1A6FD4;transparent:true;opacity:.35;side:double');
    ring.setAttribute('animation__scale', `property:scale;from:1 1 1;to:1.4 1.4 1.4;dir:alternate;loop:true;dur:900;easing:easeInOutSine;delay:${delayMs}`);
    ring.setAttribute('animation__op', `property:material.opacity;from:.35;to:0;dir:alternate;loop:true;dur:900;easing:easeInOutSine;delay:${delayMs}`);

    return [ring, shaft, head];
}

function _drawArrows() {
    const arrowsEl = _dom.arrows();
    arrowsEl.innerHTML = '';

    const leg = AppState.arLegs[AppState.legIdx];
    if (!leg || !leg.path || leg.path.length < 2) {
        AppState.tickRafId = requestAnimationFrame(_tick);
        return;
    }

    const path = leg.path;
    for (let i = 1; i < path.length; i++) {
        const prev = _parsePos(path[i - 1]);
        const curr = _parsePos(path[i]);
        const dx = curr.x - prev.x, dz = curr.z - prev.z;
        const segLen = Math.hypot(dx, dz);
        if (segLen < 0.001) continue;

        const angleRad = Math.atan2(dx, dz);
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);
        const steps    = Math.max(1, Math.round(segLen / ARROW_SPACING_M));

        for (let j = 0; j < steps; j++) {
            const t = (j + 0.5) / steps;
            const px = prev.x + dx * t;
            const pz = prev.z + dz * t;
            _createArrow(px, pz, angleDeg, angleRad, j * 120)
                .forEach(el => arrowsEl.appendChild(el));
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

    const cam      = _dom.cam().object3D;
    const arrowsEl = _dom.arrows();
    const heads    = Array.from(arrowsEl.children).filter(el => el.tagName?.toLowerCase() === 'a-cone');
    const lastHead = heads[heads.length - 1];

    if (!lastHead) { AppState.tickRafId = requestAnimationFrame(_tick); return; }

    lastHead.object3D.updateMatrixWorld(true);
    const camPos    = new THREE.Vector3();
    const targetPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);
    lastHead.object3D.getWorldPosition(targetPos);

    const distToEnd = Math.hypot(camPos.x - targetPos.x, camPos.z - targetPos.z);
    const inGrace   = AppState.arStartTime ? (Date.now() - AppState.arStartTime) < GRACE_PERIOD_MS : true;

    /* Kalan mesafe hesabı */
    let covered = 0;
    for (let i = 0; i < AppState.legIdx; i++) {
        if (AppState.arLegs[i].path) covered += AppState.arLegs[i].path.length;
    }
    const curLeg = AppState.arLegs[AppState.legIdx];
    if (curLeg?.path) {
        covered += _getProgress(camPos, curLeg.path.map(_parsePos));
    }
    const remain = Math.max(0, AppState.totalDist - covered);

    /* HUD metrik güncelle */
    document.getElementById('ar-dist').textContent = remain < 1 ? '<1m' : `${Math.round(remain)}m`;
    document.getElementById('ar-nc-label').textContent = `${Math.round(remain)}m kaldı`;
    const estSec = Math.ceil(remain * 1.5);
    document.getElementById('ar-time').textContent = estSec >= 60 ? `${Math.ceil(estSec / 60)}dk` : `${estSec}sn`;

    /* Dönüş uyarısı */
    _handleTurnWarning(distToEnd);

    /* Otomatik varış (son bacak) */
    if (distToEnd < ARRIVAL_THRESHOLD && !inGrace && AppState.legIdx === AppState.arLegs.length - 1) {
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
