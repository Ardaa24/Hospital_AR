// @ts-check
/**
 * route-track.js — Bir rotanın haritadaki izi (tek sorumluluk: rota verisi → harita konumu).
 *
 * config.js'teki her bacağın `mapPath` çizgilerini tek bir sürekli çizgide birleştirir ve
 * "şu bacakta, bacağın şu oranındayım" bilgisini haritadaki noktaya çevirir.
 * Kaynak haritalar şematik olduğu için eşleme metreyle değil, bacak içi oranla yapılır:
 * AR'da bacağın %40'ı yüründüyse nokta, o bacağın harita çizgisinin %40'ındadır.
 */
import { distance, headingDeg, pointAlong, polylineLength, centroid } from './geometry.js?v=1.2.0';

/** @typedef {import('./geometry.js').Point} Point */

/**
 * @typedef {Object} MapMarker
 * @property {'turn'|'elevator'} kind
 * @property {Point} point
 * @property {number} heading  Dönüşten sonraki yön (turn için)
 * @property {number} along    Rotanın başından bu noktaya harita mesafesi
 */

/**
 * @typedef {Object} TrackPosition
 * @property {Point}  point
 * @property {number} heading   O anki rota parçasının yönü (route-up için)
 * @property {number} along     Rotanın başından harita mesafesi
 * @property {string|null} note Haritası olmayan bacak notu
 */

const SAME_POINT_EPS = 1.5;   // Ardışık bacak uçları bu kadar yakınsa aynı nokta sayılır

export class RouteTrack {
    /**
     * @param {any} route config.js NAV_ROUTES öğesi
     */
    constructor(route) {
        this.routeId = route.id;
        /** @type {Point[]} */
        this.points = [];
        /** @type {{ start: number, length: number, single: boolean, note: string|null }[]} */
        this.legs = [];
        /** @type {MapMarker[]} */
        this.markers = [];

        for (const leg of route.legs || []) {
            const pts = /** @type {Point[]|undefined} */ (leg.mapPath);
            const start = polylineLength(this.points);

            if (pts && pts.length) {
                this._append(pts);
                if (leg.type === 'info' && pts.length === 1) {
                    this.markers.push({ kind: 'elevator', point: pts[0], heading: 0, along: start });
                }
            }
            this.legs.push({
                start,
                length: pts && pts.length > 1 ? polylineLength(pts) : 0,
                single: !pts || pts.length < 2,
                note: leg.mapNote || null
            });
        }

        this.length = polylineLength(this.points);
        this._collectTurns();

        const dest = route.mapDest || null;
        /** @type {Point[][]} */
        this.destAreas = dest && dest.areas ? dest.areas : [];
        this.destLabel = dest ? dest.label : (route.shortName || route.name || 'Hedef');
        /** @type {Point|null} */
        this.destLabelPoint = this.destAreas.length ? centroid(this.destAreas[0]) : this.end;
    }

    get isEmpty() { return this.points.length === 0; }
    get start()   { return this.points[0] || null; }
    get end()     { return this.points[this.points.length - 1] || null; }

    /**
     * @param {number} legIdx
     * @param {number} fraction 0…1, bacakta yürünen oran
     * @returns {TrackPosition|null}
     */
    locate(legIdx, fraction) {
        if (this.isEmpty) return null;
        const leg = this.legs[Math.max(0, Math.min(legIdx, this.legs.length - 1))];
        if (!leg) return null;

        const f = Math.max(0, Math.min(1, fraction || 0));
        const along = leg.single ? leg.start : leg.start + f * leg.length;
        const at = pointAlong(this.points, along);

        // Tek noktalı (asansör) ya da haritasız bacakta yön, oraya gelen parçanın yönüdür
        let heading = at.heading;
        if (leg.single && this.points.length > 1) {
            const before = pointAlong(this.points, Math.max(0, along - 0.01));
            heading = before.heading;
        }
        return { point: at.point, heading, along, note: leg.note };
    }

    /** @param {Point[]} pts */
    _append(pts) {
        const last = this.points[this.points.length - 1];
        const from = last && distance(last, pts[0]) < SAME_POINT_EPS ? 1 : 0;
        for (let i = from; i < pts.length; i++) this.points.push([pts[i][0], pts[i][1]]);
    }

    /** Çizgideki köşeler → dönüş işaretleri (manevra okları) */
    _collectTurns() {
        let along = 0;
        for (let i = 1; i < this.points.length - 1; i++) {
            along += distance(this.points[i - 1], this.points[i]);
            const inH  = headingDeg(this.points[i - 1], this.points[i]);
            const outH = headingDeg(this.points[i], this.points[i + 1]);
            let diff = Math.abs(((outH - inH) % 360 + 540) % 360 - 180);
            if (diff > 25) {
                this.markers.push({ kind: 'turn', point: this.points[i], heading: outH, along });
            }
        }
    }
}
