// @ts-check
/**
 * floor-plan.js — Kat planı SVG'sini Canvas'ta çizilebilir Path2D katmanlarına çevirir.
 *
 * İki tür SVG okunur:
 *   • Eski plan (zemin-kat.svg): dört büyük path; sınıfları o | s | r | l. Renkler harita
 *     temasından (MAP_THEME) gelir, SVG'deki renkler kullanılmaz.
 *   • Tasarımcı çıktısı (ör. nöroloji map-02.svg): Illustrator'dan gelen path / polygon
 *     öğeleri ve kendi <style> sınıfları (.st0 {fill:#…}). Renkler SVG'nin kendisinden
 *     okunur; öğeler belge sırasıyla (alttan üste) çizilir.
 * Neden Canvas: haritanın sürekli dönmesi ve yakınlaşması <img>/inline SVG'de yüksek
 * DPI ekranlarda ya bulanık ya da çok büyük katman üretir; Canvas her karede keskin çizer.
 */

/**
 * @typedef {Object} LayerStyle
 * @property {string|null} fill         null → doldurma
 * @property {string|null} stroke       null → çizgi yok
 * @property {number}      strokeWidth  Harita birimi
 * @property {CanvasFillRule} rule
 */

/**
 * @typedef {Object} FloorLayer
 * @property {string} kind   Eski plan sınıfı: o (dış alan) | s (merdiven/atriyum) | r (oda) | l (çizgi);
 *                           tasarımcı çıktısında SVG sınıfı (st0…)
 * @property {Path2D} path
 * @property {LayerStyle|null} style  Yalnızca tasarımcı çıktısında dolu; eski planda null (tema kullanılır)
 */

/** Eski planın, renkleri temadan alınan sınıfları */
const THEMED_KINDS = new Set(['o', 's', 'r', 'l']);

/** @type {Map<string, Promise<FloorLayer[]>>} */
const cache = new Map();

/**
 * @param {string} src
 * @returns {Promise<FloorLayer[]>}
 */
export function loadFloorPlan(src) {
    let p = cache.get(src);
    if (!p) {
        p = fetch(src)
            .then(r => {
                if (!r.ok) throw new Error(`Kat planı yüklenemedi: ${r.status}`);
                return r.text();
            })
            .then(parseFloorPlan);
        cache.set(src, p);
        p.catch(() => cache.delete(src));   // Hata olursa sonraki açılışta yeniden dene
    }
    return p;
}

/**
 * @param {string} svgText
 * @returns {FloorLayer[]}
 */
function parseFloorPlan(svgText) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Kat planı SVG\'si okunamadı');

    const classStyles = readClassStyles(doc);
    /** @type {FloorLayer[]} */
    const layers = [];

    // querySelectorAll belge sırasını korur: Illustrator'da üstte olan sonra gelir
    doc.querySelectorAll('path, polygon').forEach(el => {
        const d = el.tagName === 'polygon'
            ? polygonToPath(el.getAttribute('points'))
            : el.getAttribute('d');
        if (!d) return;

        const kind = el.getAttribute('class') || '';
        if (THEMED_KINDS.has(kind)) {
            layers.push({ kind, path: new Path2D(d), style: null });
            return;
        }
        const style = classStyles.get(kind);
        if (!style || (!style.fill && !style.stroke)) return;   // Görünmez öğe
        const rule = el.getAttribute('fill-rule') === 'evenodd' ? 'evenodd' : 'nonzero';
        layers.push({ kind, path: new Path2D(d), style: { ...style, rule } });
    });
    // <rect> öğeleri yok sayılır: tasarımcı çıktısındaki rect'ler sıfır kalınlıklı kılavuz çizgileridir.
    return layers;
}

/**
 * <style> içindeki ".st0{fill:#B0C6AF;}" benzeri kuralları sınıf → stil tablosuna çevirir.
 * @param {Document} doc
 * @returns {Map<string, Omit<LayerStyle, 'rule'>>}
 */
function readClassStyles(doc) {
    /** @type {Map<string, Omit<LayerStyle, 'rule'>>} */
    const styles = new Map();
    const css = Array.from(doc.querySelectorAll('style')).map(s => s.textContent || '').join('\n');
    for (const m of css.matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
        /** @type {Record<string, string>} */
        const decl = {};
        for (const part of m[2].split(';')) {
            const i = part.indexOf(':');
            if (i > 0) decl[part.slice(0, i).trim()] = part.slice(i + 1).trim();
        }
        const fill = decl['fill'] === undefined ? '#000000' : decl['fill'];   // SVG varsayılanı: siyah
        const stroke = decl['stroke'];
        styles.set(m[1], {
            fill: fill === 'none' ? null : fill,
            stroke: !stroke || stroke === 'none' ? null : stroke,
            strokeWidth: parseFloat(decl['stroke-width'] || '1') || 1
        });
    }
    return styles;
}

/** @param {string|null} points "x,y x,y …" */
function polygonToPath(points) {
    if (!points) return '';
    const n = points.trim().split(/[\s,]+/).filter(Boolean);
    if (n.length < 6) return '';
    let d = `M${n[0]} ${n[1]}`;
    for (let i = 2; i + 1 < n.length; i += 2) d += `L${n[i]} ${n[i + 1]}`;
    return d + 'Z';
}
