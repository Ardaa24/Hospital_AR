// @ts-check
/**
 * floor-plan.js — Kat planı SVG'sini Canvas'ta çizilebilir Path2D katmanlarına çevirir.
 *
 * SVG dosyası tek başına da görüntülenebilir (kendi <style>'ı var); burada yalnızca
 * path geometrisi okunur, renkler harita temasından (MAP_THEME) gelir.
 * Neden Canvas: haritanın sürekli dönmesi ve yakınlaşması <img>/inline SVG'de yüksek
 * DPI ekranlarda ya bulanık ya da çok büyük katman üretir; Canvas her karede keskin çizer.
 */

/**
 * @typedef {Object} FloorLayer
 * @property {string} kind   SVG sınıfı: o (dış alan) | s (merdiven/atriyum) | r (oda) | l (çizgi)
 * @property {Path2D} path
 */

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
    /** @type {FloorLayer[]} */
    const layers = [];
    doc.querySelectorAll('path').forEach(el => {
        const d = el.getAttribute('d');
        if (!d) return;
        layers.push({ kind: el.getAttribute('class') || '', path: new Path2D(d) });
    });
    return layers;
}
