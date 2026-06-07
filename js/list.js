/**
 * list.js — Rota Listesi Render & Arama
 *
 * Sorumluluk: Yalnızca Screen 2 (Route List) içeriği.
 *   - Kategori + rota kartlarını DOM'a yaz
 *   - Arama/filtre
 *   - Kart tıklama → openDetail() veya startAR() yönlendirmesi
 *
 * Bağımlılıklar: config.js (NAV_ROUTES, ROUTE_CATEGORIES), router.js
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

/* ── Kart HTML Fabrikası (DRY) ── */
function _createRouteCard(route) {
    const isAR = route.isAvailable;

    const card = document.createElement('div');
    card.className = `route-card${isAR ? ' ar-route' : ''}`;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${route.name}, ${route.desc}${isAR ? ', AR navigasyon mevcut' : ''}`);

    /* İkon */
    const icon = document.createElement('div');
    icon.className = 'rc-icon';
    icon.textContent = route.icon;
    icon.setAttribute('aria-hidden', 'true');

    /* Bilgi */
    const info = document.createElement('div');
    info.className = 'rc-info';
    info.innerHTML = `
        <div class="rc-name">${route.name}</div>
        <div class="rc-desc">${route.desc}</div>
    `;

    /* Sağ kısım (badge + ok) */
    const right = document.createElement('div');
    right.className = 'rc-right';
    right.setAttribute('aria-hidden', 'true');
    right.innerHTML = `
        <span class="rc-badge ${isAR ? 'badge-ar' : 'badge-passive'}">
            ${isAR ? '▶ AR' : 'Bilgi'}
        </span>
        <span class="rc-chevron">›</span>
    `;

    card.append(icon, info, right);

    /* Olay dinleyici */
    const onActivate = () => openDetail(route);
    card.addEventListener('click', onActivate);
    card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
        }
    });

    return card;
}

/* ── Kategori Başlığı Fabrikası (DRY) ── */
function _createCategoryLabel(text, isFirst) {
    const el = document.createElement('div');
    el.className = 'category-label';
    el.textContent = text;
    if (isFirst) el.style.marginTop = '8px';
    return el;
}

/* ── Rota Filtresi (DRY) ── */
function _matchesQuery(route, category, query) {
    if (route.category !== category) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
        route.name.toLowerCase().includes(q)    ||
        (route.shortName || '').toLowerCase().includes(q) ||
        category.toLowerCase().includes(q)      ||
        (route.block || '').toLowerCase().includes(q)
    );
}

/* ── Ana Render Fonksiyonu ── */
function renderList(filter = '') {
    const listEl = document.getElementById('route-list');
    listEl.innerHTML = '';

    let totalVisible = 0;

    ROUTE_CATEGORIES.forEach(cat => {
        const routes = NAV_ROUTES.filter(r => _matchesQuery(r, cat, filter));
        if (!routes.length) return;

        totalVisible += routes.length;
        listEl.appendChild(_createCategoryLabel(cat, totalVisible === routes.length));
        routes.forEach(route => listEl.appendChild(_createRouteCard(route)));
    });

    if (totalVisible === 0) {
        listEl.innerHTML = `
            <div class="no-results" role="status" aria-live="polite">
                <div class="no-results-icon" aria-hidden="true">🔍</div>
                <div class="no-results-text">"${filter}" için sonuç bulunamadı.</div>
            </div>`;
    }
}

/* ── Arama Başlat ── */
function initSearch() {
    const input = document.getElementById('search-input');
    const wrap  = document.querySelector('.search-wrap');

    input.addEventListener('input',  e => renderList(e.target.value));
    input.addEventListener('focus',  () => wrap.style.borderColor = 'var(--primary)');
    input.addEventListener('blur',   () => wrap.style.borderColor = '');
}
