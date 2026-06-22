/**
 * detail.js — Rota Detay Ekranı
 *
 * Sorumluluk: Yalnızca Screen 3 (Route Detail) içeriği.
 *   - İstatistik hesaplama (mesafe, süre, dönüş sayısı)
 *   - Hero kart, stat grid, etiketler, konum bilgileri render
 *   - AR butonuna tıklandığında startAR() çağrısı
 *
 * Bağımlılıklar: router.js (showScreen), ar.js (startAR)
 * Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 */

/* ── Sabitler ── */
const TURN_KEYWORDS = ['sola', 'sağa', 'sol ', 'sağ '];

/* ── Rota İstatistikleri Hesapla ── */
function _calcStats(route) {
    let totalDist = 0;
    let turns     = 0;
    let hasElev   = route.hasElevator || false;

    (route.legs || []).forEach(leg => {
        if (leg.type === 'ar') {
            if (leg.path) totalDist += leg.path.length;
            const ins = (leg.instruction || '').toLowerCase();
            if (TURN_KEYWORDS.some(kw => ins.includes(kw))) turns++;
        }
        if (leg.type === 'info') hasElev = true;
    });

    const estMin = Math.max(1, Math.ceil(totalDist * 1.5 / 60));
    return { totalDist, turns, hasElev, estMin };
}

/* ── Bilgi Satırı Fabrikası (DRY) ── */
function _infoRow(icon, label, value) {
    if (!value) return '';
    return `
        <div class="info-row">
            <span class="info-row-icon" aria-hidden="true">${icon}</span>
            <div>
                <div class="info-row-label">${label}</div>
                <div class="info-row-value">${value}</div>
            </div>
        </div>`;
}

/* ── AR Aktif Detay HTML ── */
function _buildARContent(route, stats) {
    return `
        <!-- Hero Kart -->
        <div class="detail-hero" role="region" aria-label="${route.name} detayları">
            <div class="detail-hero-band">
                <div class="detail-hero-icon-lg" aria-hidden="true">
                    <i data-lucide="${route.icon}"></i>
                </div>
                <div class="detail-hero-band-info">
                    <div class="detail-hero-name">${route.name}</div>
                    <div class="detail-hero-loc">
                        ${[route.block, route.floor, route.room].filter(Boolean).join(' — ')}
                    </div>
                    <span class="detail-hero-badge-ar">
                        <i data-lucide="play" width="11" height="11" fill="currentColor"></i> AR Navigasyon
                    </span>
                </div>
            </div>

            <!-- İstatistikler Şeridi -->
            <div class="detail-stat-strip" aria-label="Navigasyon bilgileri">
                <div class="detail-stat-item">
                    <i data-lucide="milestone" width="16" height="16"></i>
                    <div class="detail-stat-val">${stats.totalDist}m</div>
                    <div class="detail-stat-label">Mesafe</div>
                </div>
                <div class="detail-stat-sep"></div>
                <div class="detail-stat-item">
                    <i data-lucide="clock" width="16" height="16"></i>
                    <div class="detail-stat-val">~${stats.estMin} dk</div>
                    <div class="detail-stat-label">Yürüyüş</div>
                </div>
            </div>

            <!-- Etiketler (Yatay Scroll) -->
            <div class="detail-tags-scroll">
                <span class="tag tag-green"><i data-lucide="accessibility" width="13" height="13"></i> Engelsiz Erişim</span>
                ${stats.hasElev ? `<span class="tag tag-gray"><i data-lucide="chevrons-up-down" width="13" height="13"></i> Asansör</span>` : ''}
                ${stats.turns > 0 ? `<span class="tag tag-gray"><i data-lucide="corner-down-right" width="13" height="13"></i> ${stats.turns} Dönüş</span>` : ''}
            </div>
        </div>

        <!-- Konum Bilgileri -->
        <div class="section-card" role="region" aria-label="Konum bilgileri">
            <div class="section-label">Konum Bilgileri</div>
            ${_infoRow('<i data-lucide="building" width="18" height="18"></i>', 'Blok / Alan', route.block)}
            ${_infoRow('<i data-lucide="layers" width="18" height="18"></i>', 'Kat', route.floor)}
            ${_infoRow('<i data-lucide="door-open" width="18" height="18"></i>', 'Oda / Bölüm', route.room)}
            ${_infoRow('<i data-lucide="clock" width="18" height="18"></i>', 'Çalışma Saatleri', route.hours)}
            ${_infoRow('<i data-lucide="phone" width="18" height="18"></i>', 'İletişim', route.phone)}
        </div>

        <!-- Birim Hakkında -->
        ${route.detail ? `
        <div class="section-card" role="region" aria-label="Birim hakkında">
            <div class="section-label">Birim Hakkında</div>
            <p class="detail-about-text">${route.detail}</p>
        </div>` : ''}
        <div style="height:8px;"></div>
    `;
}

/* ── Pasif Klinik Detay HTML ── */
function _buildPassiveContent(route) {
    const hasElev = route.hasElevator ||
        (route.legs || []).some(l => l.type === 'info');

    return `
        <!-- Hero Kart -->
        <div class="detail-hero passive" role="region" aria-label="${route.name} detayları">
            <div class="detail-hero-band">
                <div class="detail-hero-icon-lg" aria-hidden="true">
                    <i data-lucide="${route.icon}"></i>
                </div>
                <div class="detail-hero-band-info">
                    <div class="detail-hero-name">${route.name}</div>
                    <div class="detail-hero-loc">
                        ${[route.block, route.floor, route.room].filter(Boolean).join(' — ')}
                    </div>
                    <span class="detail-hero-badge-passive">
                        <i data-lucide="play-circle" width="11" height="11"></i> AR Yakında
                    </span>
                </div>
            </div>

            <!-- Etiketler (Yatay Scroll) -->
            <div class="detail-tags-scroll">
                <span class="tag tag-green"><i data-lucide="accessibility" width="13" height="13"></i> Engelsiz Erişim</span>
                ${hasElev ? `<span class="tag tag-gray"><i data-lucide="chevrons-up-down" width="13" height="13"></i> Asansör</span>` : ''}
            </div>
        </div>

        <!-- Konum Bilgileri -->
        <div class="section-card" role="region" aria-label="Konum bilgileri">
            <div class="section-label">Konum Bilgileri</div>
            ${_infoRow('<i data-lucide="building" width="18" height="18"></i>', 'Blok / Alan', route.block)}
            ${_infoRow('<i data-lucide="layers" width="18" height="18"></i>', 'Kat', route.floor)}
            ${_infoRow('<i data-lucide="door-open" width="18" height="18"></i>', 'Oda / Bölüm', route.room)}
            ${_infoRow('<i data-lucide="clock" width="18" height="18"></i>', 'Çalışma Saatleri', route.hours)}
            ${_infoRow('<i data-lucide="phone" width="18" height="18"></i>', 'İletişim', route.phone)}
        </div>

        <!-- Birim Hakkında -->
        ${route.detail ? `
        <div class="section-card" role="region" aria-label="Birim hakkında">
            <div class="section-label">Birim Hakkında</div>
            <p class="detail-about-text">${route.detail}</p>
        </div>` : ''}
        <div style="height:8px;"></div>
    `;
}

/* ── AR Butonu Footer ── */
function _buildARFooter() {
    return `
        <button class="btn btn-primary"
                id="btn-start-ar"
                aria-label="AR navigasyonu başlat">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            AR Navigasyonu Başlat
        </button>`;
}

/* ── Pasif Klinik Footer ── */
function _buildPassiveFooter() {
    return `
        <div class="ar-pending" role="status" aria-label="AR navigasyon henüz aktif değil">
            <div class="ar-pending-icon" aria-hidden="true">
                <i data-lucide="play-circle" width="32" height="32" style="color: var(--muted); opacity: 0.5;"></i>
            </div>
            <p class="ar-pending-text">
                Bu birim için AR navigasyon<br>henüz aktif değildir.
            </p>
        </div>`;
}

/* ── Ana Fonksiyon ── */
function openDetail(route) {
    AppState.activeRoute = route;

    const stats  = _calcStats(route);
    const body   = document.getElementById('detail-body');
    const footer = document.getElementById('detail-foot');

    body.innerHTML   = route.isAvailable ? _buildARContent(route, stats)  : _buildPassiveContent(route);
    footer.innerHTML = route.isAvailable ? _buildARFooter()                : _buildPassiveFooter();

    if (route.isAvailable) {
        document.getElementById('btn-start-ar').addEventListener('click', () => startAR(route));
    }

    showScreen('s-detail');
    if (window.lucide) {
        lucide.createIcons({ root: document.getElementById('s-detail') });
    }
}
