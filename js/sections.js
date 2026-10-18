/**
 * sections.js — "Bölüm Seç" Çekmecesi
 *
 * Sorumluluklar:
 *   - Aktif rotanın TÜM bölümlerini (bacaklarını) listelemek
 *   - Seçilen bölüm için onay adımı göstermek
 *   - Onaylanınca ar.js → goToLeg(index) ile o bölümü bulunulan noktadan başlatmak
 *
 * Çekmece #ar-overlay İÇİNDE durur: WebXR DOM overlay yalnızca o elementi gösterir,
 * body'ye eklenen bir çekmece AR sırasında görünmez.
 *
 * Erişilebilirlik: dialog rolü; odak çekmeceye taşınır ve içinde kalır; Escape geri/kapat;
 * arka plan (HUD) inert; kapanınca odak ana butona döner.
 *
 * Bağımlılıklar:
 *   - router.js → AppState, formatLegText, formatMeters
 *   - ar.js     → goToLeg, getCurrentLegProgress, _calcLegDistance
 *
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

/* opener: çekmece açılmadan önce odaktaki öğe | chosen: seçilen bölüm | walkedM: o bölümde zaten yürünen mesafe */
const SECTION_STATE = { opener: null, chosen: null, walkedM: 0 };

/** Aynı bölüm yeniden başlatılırken, bundan az yürünmüşse "kalan mesafe" ayrımı yapılmaz */
const MIN_WALKED_FOR_REMAINING_M = 0.5;

let _secDom = {};

/* ════════════════════════════════════════════════════
   BAŞLATMA
════════════════════════════════════════════════════ */
function initSectionPicker() {
    _secDom = {
        sheet:        document.getElementById('sections-sheet'),
        backdrop:     document.getElementById('sections-backdrop'),
        viewList:     document.getElementById('sections-view-list'),
        viewConfirm:  document.getElementById('sections-view-confirm'),
        sub:          document.getElementById('sections-sub'),
        list:         document.getElementById('sections-list'),
        close:        document.getElementById('sections-close'),
        cancel:       document.getElementById('sections-cancel'),
        confirmTitle: document.getElementById('sections-confirm-title'),
        confirmText:  document.getElementById('sections-confirm-text'),
        confirmOk:    document.getElementById('sections-confirm-ok'),
        confirmAlt:   document.getElementById('sections-confirm-alt'),
        confirmBack:  document.getElementById('sections-confirm-back'),
        hudTop:       document.getElementById('ar-top-hud'),
        hudBottom:    document.getElementById('ar-bottom')
    };
    if (!_secDom.sheet) return;

    const closeAndRestore = () => closeSectionPicker({ restoreFocus: true });
    _secDom.backdrop.addEventListener('click', closeAndRestore);
    _secDom.close.addEventListener('click', closeAndRestore);
    _secDom.cancel.addEventListener('click', closeAndRestore);

    _secDom.list.addEventListener('click', (e) => {
        const row = e.target.closest('.section-row');
        if (row) _showSectionConfirm(Number(row.dataset.index));
    });
    _secDom.confirmBack.addEventListener('click', _backToSectionList);
    _secDom.confirmOk.addEventListener('click', () => _confirmSection(SECTION_STATE.walkedM));
    _secDom.confirmAlt.addEventListener('click', () => _confirmSection(0)); // Bölümü baştan başlat

    document.addEventListener('keydown', _onSectionKeydown);
}

/* ════════════════════════════════════════════════════
   AÇ / KAPAT
════════════════════════════════════════════════════ */
function _isSectionPickerOpen() {
    return !!_secDom.sheet && _secDom.sheet.classList.contains('is-open');
}

function openSectionPicker() {
    const legs = AppState.arLegs;
    if (!_secDom.sheet || !legs.length) return;

    SECTION_STATE.opener = document.activeElement;
    _secDom.sub.textContent = `${AppState.activeRoute.name} · ${legs.length} bölüm`;
    _renderSectionList();
    _showSectionView('list');
    _secDom.sheet.classList.add('is-open');
    _setHudInert(true);

    const first = _secDom.list.querySelector('.is-current') || _secDom.list.querySelector('.section-row');
    if (first) first.focus();
}

/** restoreFocus: true → odak, çekmeceyi açan butona döner (AR çıkışında false) */
function closeSectionPicker({ restoreFocus = false } = {}) {
    if (!_isSectionPickerOpen()) return;

    _secDom.sheet.classList.remove('is-open');
    _setHudInert(false);
    SECTION_STATE.chosen = null;

    const opener = SECTION_STATE.opener;
    SECTION_STATE.opener = null;
    if (restoreFocus && opener && opener.focus) opener.focus();
}

/** Çekmece açıkken arkadaki HUD odaklanamaz ve ekran okuyucuya görünmez olur */
function _setHudInert(on) {
    [_secDom.hudTop, _secDom.hudBottom].forEach((el) => { if (el) el.inert = on; });
}

function _showSectionView(view) {
    _secDom.viewList.hidden    = view !== 'list';
    _secDom.viewConfirm.hidden = view !== 'confirm';
}

/* ════════════════════════════════════════════════════
   LİSTE
════════════════════════════════════════════════════ */
function _renderSectionList() {
    const list = _secDom.list;
    list.innerHTML = '';
    AppState.arLegs.forEach((leg, index) => {
        list.appendChild(_createSectionRow(leg, index, AppState.legIdx));
    });
}

function _createSectionRow(leg, index, currentIdx) {
    const isInfo = leg.type === 'info';

    const li  = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'section-row';
    btn.dataset.index = String(index);
    if (index < currentIdx) btn.classList.add('is-done');
    if (index === currentIdx) {
        btn.classList.add('is-current');
        btn.setAttribute('aria-current', 'step');
    }

    const num = document.createElement('span');
    num.className = 'section-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(index + 1);

    const body = document.createElement('span');
    body.className = 'section-body';

    const text = document.createElement('span');
    text.className = 'section-text';
    const spoken = document.createElement('span');
    spoken.className = 'visually-hidden';
    spoken.textContent = `${index + 1}. bölüm: `;
    text.append(spoken, formatLegText(isInfo ? leg.title : leg.instruction));

    const meta = document.createElement('span');
    meta.className = 'section-meta';
    meta.textContent = isInfo
        ? (leg.icon === 'arrow-up-down' ? 'Asansör adımı' : 'Ara adım')
        : formatMeters(_calcLegDistance(leg.path));

    body.append(text, meta);
    btn.append(num, body);

    const stateText = index < currentIdx ? 'Tamamlandı' : (index === currentIdx ? 'Şu an' : '');
    if (stateText) {
        const state = document.createElement('span');
        state.className = 'section-state';
        state.textContent = stateText;
        btn.appendChild(state);
    }

    li.appendChild(btn);
    return li;
}

/* ════════════════════════════════════════════════════
   ONAY ADIMI
   Oklar, onaya basıldığı andaki konum ve yöne göre çizilir; bu yüzden kullanıcıya
   önce o bölümün başlangıç noktasında durup yürüyeceği yöne bakması söylenir.
════════════════════════════════════════════════════ */
function _showSectionConfirm(index) {
    const leg = AppState.arLegs[index];
    if (!leg) return;

    const n = index + 1;
    let title, text, okLabel, altLabel = '';
    let walkedM = 0;

    if (leg.type === 'info') {
        title   = `${n}. bölüm: ${leg.title}`;
        text    = 'Kamera kapanacak ve bu adımın yönergeleri gösterilecek.';
        okLabel = 'Yönergeleri göster';
    } else if (index === AppState.legIdx) {
        // Aynı bölüm: kullanıcı yolun bir kısmını yürümüş olabilir. Yürünen kısım kadar
        // yolu çizmek yerine yalnızca KALAN mesafe çizilir (HUD'daki "kalan" ile tutarlı).
        const progress = getCurrentLegProgress();
        if (progress && progress.covered >= MIN_WALKED_FOR_REMAINING_M) {
            const remaining = formatMeters(Math.round(progress.remaining * 10) / 10);
            const total     = formatMeters(progress.total);
            title    = 'Bu bölümü buradan yeniden başlat';
            text     = `Ekranda yaklaşık ${remaining} kalmış görünüyor. Yürüyeceğiniz yöne bakın ve seçin. ` +
                       'Oklar bulunduğunuz noktadan, yalnızca kalan mesafe kadar çizilir. ' +
                       'Sayı gerçeğe uymuyorsa bölümü baştan başlatabilirsiniz.';
            okLabel  = `Kalan ${remaining} ile devam et`;
            altLabel = `Bölümü baştan başlat (${total})`;
            walkedM  = progress.covered;
        } else {
            title   = 'Bu bölümü buradan yeniden başlat';
            text    = 'Yürüyeceğiniz yöne bakın ve onaylayın. Oklar bulunduğunuz noktadan yeniden çizilir.';
            okLabel = 'Buradan yeniden başlat';
        }
    } else {
        title   = `${n}. bölümü başlat`;
        text    = 'Bu bölümün başlangıç noktasında durun ve yürüyeceğiniz yöne bakın. ' +
                  'Hazır olduğunuzda onaylayın. Oklar bulunduğunuz noktadan çizilir.';
        okLabel = 'Burada başlat';
    }

    SECTION_STATE.chosen  = index;
    SECTION_STATE.walkedM = walkedM;
    _secDom.confirmTitle.textContent = title;
    _secDom.confirmText.textContent  = text;
    _secDom.confirmOk.textContent    = okLabel;
    _secDom.confirmAlt.textContent   = altLabel;
    _secDom.confirmAlt.hidden        = !altLabel;
    _showSectionView('confirm');
    _secDom.confirmTitle.focus();
}

function _backToSectionList() {
    const chosen = SECTION_STATE.chosen;
    _showSectionView('list');
    const row = _secDom.list.querySelector(`[data-index="${chosen}"]`);
    if (row) row.focus();
}

/** walkedM: bu bölümde zaten yürünen mesafe; 0 → bölüm baştan başlar */
function _confirmSection(walkedM) {
    const index = SECTION_STATE.chosen;
    if (index === null) return;

    closeSectionPicker({ restoreFocus: true });
    goToLeg(index, { walkedM });
}

/* ════════════════════════════════════════════════════
   KLAVYE: Escape geri/kapat, Tab çekmece içinde kalır
════════════════════════════════════════════════════ */
function _onSectionKeydown(e) {
    if (!_isSectionPickerOpen()) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        if (_secDom.viewConfirm.hidden) closeSectionPicker({ restoreFocus: true });
        else _backToSectionList();
        return;
    }

    if (e.key === 'Tab') _keepFocusInside(e);
}

function _keepFocusInside(e) {
    const focusable = [..._secDom.sheet.querySelectorAll('button:not([disabled])')]
        .filter((el) => !el.closest('[hidden]'));
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (!_secDom.sheet.contains(active)) {
        e.preventDefault();
        first.focus();
    } else if (e.shiftKey && (active === first || active === _secDom.confirmTitle)) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
    }
}
