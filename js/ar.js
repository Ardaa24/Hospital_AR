/**
 * js/ar.js
 * AR Navigasyon Koordinatör Dosyası (Facade)
 */

'use strict';

/* ════════════════════════════════════════════════════
   SABITLER VE DURUM (STATE)
════════════════════════════════════════════════════ */
const ARRIVAL_THRESHOLD         = 0.5;
const GRACE_PERIOD_MS           = 3000;
const NEXT_SECTION_UNLOCK_DIST  = 0.5;

const TARGET_FPS     = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

let _lastTickTime = 0;
const _camPosCache = new THREE.Vector3();

/* ════════════════════════════════════════════════════
   AR YAŞAM DÖNGÜSÜ (LIFECYCLE)
════════════════════════════════════════════════════ */

async function startAR(route) {
    const hasSessionPerm = sessionStorage.getItem('ar_camera_granted');
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

    const modal = document.getElementById('ar-onboarding');
    modal.style.display = 'flex';

    document.getElementById('btn-accept-ar').onclick = () => {
        modal.style.display = 'none';
        sessionStorage.setItem('ar_camera_granted', 'true');

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
    AppState.activeRoute = route;
    AppState.arLegs      = route.legs || [];
    AppState.legIdx      = 0;
    AppState.arActive    = false;
    AppState.arStartTime = null;
    
    // Toplam mesafe hesaplama (ARNavigation)
    AppState.totalDist = AppState.arLegs.reduce(
        (acc, l) => acc + ARNavigation.calcLegDistance(l.path), 0
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
    const scene = ARCore.getDOM().scene();
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
   CALLBACKS
════════════════════════════════════════════════════ */

function _onEnterARCallback() {
    AppState.arActive = true;
    AppState.arStartTime = AppState.arStartTime || Date.now();
    document.body.style.background = 'transparent';

    // Debug/Koordinat yakalayıcıyı başlat
    if (window.ARDebug) {
        window.ARDebug.initAR();
    }

    const dom = ARCore.getDOM();
    dom.infoScreen().classList.remove('visible');
    dom.overlay().classList.add('ar-active');
    dom.topHud().style.display = 'flex';
    dom.bottomPanel().style.display = 'flex';

    document.getElementById('ar-hud-arrow').style.display = 'block';

    _updateHUDInfo();
    document.getElementById('ar-dest').textContent = AppState.activeRoute.name;
    _updateArrivedBtn();

    // In local space, starting a new XR session automatically places the origin (0,0,0)
    // at the user's current physical position. We don't need any offset!
    AppState.arOriginOffset = { x: 0, z: 0 };
    _drawCurrentLegPath();

    _lastTickTime = 0;
    AppState.tickRafId = requestAnimationFrame(_tick);
}

function _onExitARCallback() {
    AppState.arActive = false;
    document.body.style.background = '';
    cancelAnimationFrame(AppState.tickRafId);

    // Debug/Koordinat yakalayıcıyı sonlandır
    if (window.ARDebug) {
        window.ARDebug.cleanupAR();
    }

    const dom = ARCore.getDOM();
    dom.topHud().style.display = 'none';
    dom.bottomPanel().style.display = 'none';
    dom.turnOverlay().classList.remove('visible');
    document.getElementById('ar-hud-arrow').style.display = 'none';

    // Clear Path from Scene directly
    const arrowsObj = dom.arrows().object3D;
    ARRenderer.clearPath(arrowsObj);

    ARNavigation.reset();
    ARCompass.reset();

    const arrivedBtn = dom.arrivedBtn();
    if (arrivedBtn) {
        arrivedBtn.disabled = false;
        arrivedBtn.classList.remove('btn-arrive-unlock');
    }

    dom.scene().classList.remove('ar-active');
    dom.overlay().classList.remove('ar-active');

    const scene = dom.scene();
    if (scene.pause) scene.pause();
}

/* ════════════════════════════════════════════════════
   UI GÜNCELLEMELERİ
════════════════════════════════════════════════════ */

function _updateHUDInfo() {
    const nextLeg = AppState.arLegs[AppState.legIdx + 1];
    const iconEl = document.getElementById('ar-nc-icon');
    const labelEl = document.getElementById('ar-nc-label');
    const actionEl = document.getElementById('ar-nc-action');

    if (nextLeg?.type === 'info') {
        iconEl.innerHTML = `<i data-lucide="${nextLeg.icon || 'info'}"></i>`;
        labelEl.textContent = 'Sonraki Adım';
        actionEl.textContent = nextLeg.title || 'Bilgi Ekranı';
    } else if (nextLeg?.instruction) {
        iconEl.innerHTML = `<i data-lucide="corner-up-right"></i>`;
        labelEl.textContent = 'Sonraki Dönüş';
        actionEl.textContent = nextLeg.instruction.replace(/[⬆️⬅️➡️↗↙↖↘]/g, '').trim().substring(0, 28);
    } else {
        iconEl.innerHTML = `<i data-lucide="flag"></i>`;
        labelEl.textContent = 'Son Düzlük';
        actionEl.textContent = 'Hedefe yaklaştınız';
    }
    if (window.lucide) lucide.createIcons({ root: iconEl });
}

function _updateArrivedBtn() {
    const dom = ARCore.getDOM();
    const btn = dom.arrivedBtn();
    if (!btn) return;

    const isLast = AppState.legIdx === AppState.arLegs.length - 1;
    const label = document.getElementById('ar-arrive-label');
    if (label) label.textContent = isLast ? 'Hedefe Vardım' : 'Sonraki Bölüm';
    btn.setAttribute('aria-label', isLast ? 'Hedefe vardım' : 'Sonraki bölüme geç');

    _setArrivedBtnLocked(true);
}

function _setArrivedBtnLocked(locked) {
    const btn = ARCore.getDOM().arrivedBtn();
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
   RENDER & ÇİZİM
════════════════════════════════════════════════════ */

function _drawCurrentLegPath() {
    const leg = AppState.arLegs[AppState.legIdx];
    if (!leg?.path) return;

    const dom = ARCore.getDOM();
    const cam = dom.cam().object3D;
    
    // Zaten arOriginOffset varsa onu kullan, yoksa fallback olarak mevcudu al
    if (!AppState.arOriginOffset) {
        cam.getWorldPosition(_camPosCache);
        AppState.arOriginOffset = { x: _camPosCache.x, z: _camPosCache.z };
    }

    const arrowsObj = dom.arrows().object3D;
    ARRenderer.drawPath(leg, arrowsObj, ARCore.getGroundY(), AppState.arOriginOffset);
}

/* ════════════════════════════════════════════════════
   TICK (ANA DÖNGÜ)
════════════════════════════════════════════════════ */

function _tick(time) {
    if (!AppState.arActive) return;

    if (time - _lastTickTime < FRAME_INTERVAL) {
        AppState.tickRafId = requestAnimationFrame(_tick);
        return;
    }
    _lastTickTime = time;

    const dom = ARCore.getDOM();
    const cam = dom.cam().object3D;
    cam.getWorldPosition(_camPosCache);

    // Hit test ve groundY güncellemesi (gerçek zemini bulma)
    const prevGroundY = ARCore.getGroundY();
    ARCore.updateGroundY(dom.scene(), _camPosCache.y);
    const newGroundY = ARCore.getGroundY();
    if (Math.abs(prevGroundY - newGroundY) > 0.001) {
        ARRenderer.updateGroundY(newGroundY);
    }

    // Animasyonlar
    ARRenderer.updateUniforms(time);
    ARRenderer.updateAnimations();

    const arrowsObj = dom.arrows().object3D;
    arrowsObj.position.y = 0; // Her zaman zemin referansı 0'da kalmalı.

    const inGrace = AppState.arStartTime ? (Date.now() - AppState.arStartTime) < GRACE_PERIOD_MS : true;
    const curLeg = AppState.arLegs[AppState.legIdx];

    // Pusula 
    const arrowEl = document.getElementById('ar-hud-arrow');
    ARCompass.updateHUD(arrowEl, _camPosCache, cam, curLeg);

    let distToTurn = Infinity;
    if (curLeg?.path?.length > 0) {
        const fpRaw = curLeg.path[curLeg.path.length - 1].pos.split(' ').map(Number);
        // Origin offset ile düzeltilmiş hedef pozisyon
        const fp = { x: fpRaw[0], z: fpRaw[2] };
    }
    
    // Mesafe ve İlerleme
    let remain = 0;
    if (curLeg?.path) {
        const totalDist = ARNavigation.calcLegDistance(curLeg.path);
      
        if (!AppState.arOriginOffset) AppState.arOriginOffset = { x: 0, z: 0 };

        const localCamPos = new THREE.Vector3(
            _camPosCache.x - AppState.arOriginOffset.x,
            _camPosCache.y,
            _camPosCache.z - AppState.arOriginOffset.z
        );

        const covered = ARNavigation.getProgress(localCamPos, curLeg.path);
        remain = Math.max(0, totalDist - covered);
        
        const fpRaw = curLeg.path[curLeg.path.length - 1].pos.split(' ').map(Number);
        distToTurn = Math.hypot(localCamPos.x - fpRaw[0], localCamPos.z - fpRaw[2]);
    }

    ARNavigation.updateHUD(remain);
    ARNavigation.handleTurnWarning(distToTurn, curLeg, AppState.arLegs[AppState.legIdx + 1]);

    if (!inGrace) {
        _setArrivedBtnLocked(distToTurn > NEXT_SECTION_UNLOCK_DIST);
    }

    if (distToTurn < ARRIVAL_THRESHOLD && !inGrace && AppState.legIdx === AppState.arLegs.length - 1) {
        cancelAnimationFrame(AppState.tickRafId);
        dom.scene().exitVR();
        _showDone();
        return;
    }

    AppState.tickRafId = requestAnimationFrame(_tick);
}

/* ════════════════════════════════════════════════════
   GELİŞMİŞ GEÇİŞ (WAYPOINTS, INFO SCREENS)
════════════════════════════════════════════════════ */

function _showInfoScreen(leg) {
    const dom = ARCore.getDOM();
    dom.scene().classList.remove('ar-active');
    dom.overlay().classList.remove('ar-active');

    document.getElementById('ar-info-title').textContent = leg.title || 'Bilgi';
    document.getElementById('ar-info-desc').innerHTML    = leg.desc  || '';
    dom.infoScreen().classList.add('visible');

    const nextBtn = document.getElementById('btn-info-next');
    nextBtn.onclick = () => {
        dom.infoScreen().classList.remove('visible');
        AppState.legIdx++;
        if (AppState.legIdx < AppState.arLegs.length) {
            const nLeg = AppState.arLegs[AppState.legIdx];
            if (nLeg.type === 'info') _showInfoScreen(nLeg);
            else _enterAR();
        } else {
            _showDone();
        }
    };
}

function advanceLeg() {
    vibrate([30, 50, 30]);
    AppState.legIdx++;
    
    //  Her yeni bacak için AR oturumunu kapatıp yeniden açarak kamerayı sıfırla.
    cancelAnimationFrame(AppState.tickRafId);
    ARCore.getDOM().scene().exitVR();

    if (AppState.legIdx >= AppState.arLegs.length) {
        _showDone();
        return;
    }

    const nLeg = AppState.arLegs[AppState.legIdx];
    if (nLeg.type === 'info') {
        _showInfoScreen(nLeg);
    } else {
        _updateHUDInfo();
        _updateArrivedBtn();
        ARNavigation.reset();
        
        // Eski originOffset'i temizle, yeni girişle birlikte tekrar hesaplanacak
        AppState.arOriginOffset = null;

        setTimeout(() => {
            _enterAR();
        }, 500); // Kamera sıfırlanması için kısa bekleme
    }
}

function _showDone() {
    AppState.arActive = false;
    const route = AppState.activeRoute;
    document.getElementById('done-route-name').textContent = route.name;

    const headSub = document.getElementById('done-head-sub');
    if (headSub) {
        headSub.textContent = route.block ? `${route.block}${route.floor ? ', ' + route.floor : ''}` : 'Navigasyon tamamlandı';
    }

    const locEl = document.getElementById('done-route-loc');
    if (locEl) locEl.textContent = route.desc || '';

    const distEl = document.getElementById('done-dist');
    if (distEl) {
        const totalDist = AppState.arLegs.reduce((acc, l) => acc + (l.path ? l.path.length : 0), 0);
        distEl.textContent = `${totalDist}m`;
    }

    if (AppState.arStartTime) {
        const elapsed = Math.round((Date.now() - AppState.arStartTime) / 1000);
        document.getElementById('done-time').textContent = elapsed >= 60 ? `${Math.ceil(elapsed / 60)} dk` : `${elapsed} sn`;
    } else {
        document.getElementById('done-time').textContent = '—';
    }

    const infoBox = document.getElementById('done-info-box');
    if (route.detail) {
        const sentences = route.detail.split('.').filter(s => s.trim());
        if (sentences.length > 0) {
            infoBox.style.display = 'block';
            document.getElementById('done-info-text').textContent = sentences.slice(0, 2).join('. ').trim() + '.';
        }
    } else {
        infoBox.style.display = 'none';
    }

    vibrate([150, 100, 150, 100, 300]);
    ARCore.getDOM().doneScreen().classList.add('visible');
}

function returnToRoutes() {
    ARCore.getDOM().doneScreen().classList.remove('visible');
    renderList();
    showScreen('s-routes');
}

function exitARToRoutes() {
    cancelAnimationFrame(AppState.tickRafId);
    ARCore.getDOM().scene().exitVR();
    ARCore.getDOM().infoScreen().classList.remove('visible');
    renderList();
    showScreen('s-routes');
}

function onArrived() {
    advanceLeg();
}

function onInfoContinue() {
    const nextBtn = document.getElementById('btn-info-next');
    if (nextBtn) {
        nextBtn.click();
    }
}

/* ════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════ */
// Initialize ARCore with callbacks
ARCore.init(_onEnterARCallback, _onExitARCallback);
