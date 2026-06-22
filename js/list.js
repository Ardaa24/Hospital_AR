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
    card.className = isAR ? 'route-card ar-route' : 'route-card'; // ar-route sınıfını sadece isAR olduğunda ekle, Samsung GPU bug'ı için
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${route.name}, ${route.desc}${isAR ? ', AR navigasyon mevcut' : ''}`);

    /* İkon */
    const icon = document.createElement('div');
    icon.className = 'rc-icon';
    icon.innerHTML = `<i data-lucide="${route.icon}"></i>`;
    icon.setAttribute('aria-hidden', 'true');

    /* Bilgi */
    const info = document.createElement('div');
    info.className = 'rc-info';
    info.innerHTML = `
        <div class="rc-name">${route.name}</div>
        <div class="rc-desc">${route.desc}</div>
    `;

    /* Sağ kısım (badge) */
    const right = document.createElement('div');
    right.className = 'rc-right';
    right.setAttribute('aria-hidden', 'true');
    
    // Kurumsal bütünlük: Listedeki tüm birimlerde AR etiketi görünür (detayda Yakında yazar)
    right.innerHTML = `
        <span class="rc-badge badge-ar">
            <i data-lucide="play" width="11" height="11" fill="currentColor"></i> AR
        </span>
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
                <div class="no-results-icon" aria-hidden="true"><i data-lucide="search" width="40" height="40"></i></div>
                <div class="no-results-text">"${filter}" için sonuç bulunamadı.</div>
            </div>`;
    }

    if (window.lucide) {
        lucide.createIcons({ root: listEl });
    }
}

/* ── Arama Başlat ── */
function initSearch() {
    const input = document.getElementById('search-input');
    const wrap  = document.querySelector('.search-wrap');

    input.addEventListener('input',  e => renderList(e.target.value));
    input.addEventListener('focus',  () => wrap.style.borderColor = 'var(--primary)');
    input.addEventListener('blur',   () => wrap.style.borderColor = '');

    initVoiceSearch(input);
}

/* ── Sesli Arama (Web Speech API) ── */
function initVoiceSearch(inputEl) {
    const btnVoice = document.getElementById('btn-voice-search');
    if (!btnVoice) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        return; // Desteklenmiyorsa butonu gösterme
    }

    btnVoice.style.display = 'flex'; // Destekleniyorsa göster

    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let isListening = false;

    btnVoice.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }
        try {
            recognition.start();
        } catch (e) {
            console.error("Speech API Error:", e);
        }
    });

    recognition.onstart = () => {
        isListening = true;
        btnVoice.classList.add('listening');
        btnVoice.innerHTML = `<i data-lucide="mic-off" width="18" height="18"></i>`;
        if (window.lucide) lucide.createIcons({ root: btnVoice });
        inputEl.placeholder = "Dinleniyor...";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        inputEl.value = transcript;
        renderList(transcript);
    };

    recognition.onerror = (event) => {
        console.warn("Ses tanıma hatası: ", event.error);
        if (event.error === 'not-allowed') {
            showToast("Mikrofon izni reddedildi.");
        }
    };

    recognition.onend = () => {
        isListening = false;
        btnVoice.classList.remove('listening');
        btnVoice.innerHTML = `<i data-lucide="mic" width="18" height="18"></i>`;
        if (window.lucide) lucide.createIcons({ root: btnVoice });
        inputEl.placeholder = "Klinik veya birim ara...";
    };
}
