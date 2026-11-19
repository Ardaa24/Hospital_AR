// @ts-check
/**
 * geometry.js — Harita için saf 2B geometri yardımcıları.
 *
 * Koordinat sistemi: harita SVG'sinin viewBox birimi, x sağa, y AŞAĞI.
 * Açılar "yukarıdan saat yönünde" derece cinsindendir: yukarı = 0°, sağ = 90°.
 * Bu modül DOM'a ve global duruma dokunmaz; tek başına test edilebilir.
 */

/** @typedef {[number, number]} Point */

/** @param {Point} a @param {Point} b */
export function distance(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** @param {Point[]} pts */
export function polylineLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += distance(pts[i - 1], pts[i]);
    return len;
}

/**
 * a → b yönünün açısı (yukarıdan saat yönünde, derece).
 * @param {Point} a @param {Point} b
 */
export function headingDeg(a, b) {
    return Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI;
}

/**
 * Çizgi üzerinde baştan `d` birim ilerideki nokta ve o andaki parça bilgisi.
 * @param {Point[]} pts
 * @param {number} d
 * @returns {{ point: Point, segIndex: number, heading: number }}
 */
export function pointAlong(pts, d) {
    if (pts.length === 1) return { point: [pts[0][0], pts[0][1]], segIndex: 0, heading: 0 };
    let rest = Math.max(0, d);
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const seg = distance(a, b);
        if (rest <= seg || i === pts.length - 1) {
            const t = seg > 0 ? Math.min(1, rest / seg) : 0;
            return {
                point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
                segIndex: i - 1,
                heading: headingDeg(a, b)
            };
        }
        rest -= seg;
    }
    /* istanbul ignore next — döngü her zaman döner */
    return { point: pts[pts.length - 1], segIndex: pts.length - 2, heading: 0 };
}

/**
 * Çizgiyi `d` noktasından ikiye böler: [geçilen, kalan]. İkisi de bölme noktasını içerir.
 * @param {Point[]} pts
 * @param {number} d
 * @returns {[Point[], Point[]]}
 */
export function splitAt(pts, d) {
    if (pts.length < 2) return [pts.slice(), pts.slice()];
    const { point, segIndex } = pointAlong(pts, d);
    return [
        [...pts.slice(0, segIndex + 1), point],
        [point, ...pts.slice(segIndex + 1)]
    ];
}

/**
 * İki açı arasındaki en kısa işaretli fark (b - a), −180…180.
 * @param {number} a @param {number} b
 */
export function angleDelta(a, b) {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

/** @param {Point[]} poly */
export function centroid(poly) {
    let x = 0, y = 0;
    for (const p of poly) { x += p[0]; y += p[1]; }
    return /** @type {Point} */ ([x / poly.length, y / poly.length]);
}

/** @param {Point[]} pts */
export function toSvgPoints(pts) {
    return pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
