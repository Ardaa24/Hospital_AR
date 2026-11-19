// @ts-check
/**
 * floor-tiles.js — Kat planı için karo (tile) önbelleği (takılma düzeltmesi).
 *
 * Kat planı yüzlerce çokgenden oluşur; her karede baştan doldurmak AR render'ı ile
 * yarışır ve takılma yapar. Bunun yerine plan, ekranda görünen bölgeyi kaplayan
 * TILE_UNITS'lik karolara BİR KEZ çizilir; sonraki karelerde karolar yalnızca
 * dönüştürülerek basılır (drawImage). Karolar ekran çözünürlüğünde üretildiği için keskindir.
 * Komşu karolar PAD kadar üst üste biner: dönüş sırasında birleşim çizgisi görünmez.
 */
import { MAP_THEME as T } from './map-theme.js?v=1.1.0';

/** @typedef {import('./floor-plan.js').FloorLayer} FloorLayer */

const TILE_UNITS        = 512;
const PAD_UNITS         = 2;
const MAX_TILES         = 20;   // ~1–2 MB/karo → en fazla ~40 MB
const MAX_NEW_PER_FRAME = 3;    // Bir karede en çok bu kadar karo üret (ani takılmayı önler)

export class FloorTiles {
    constructor() {
        /** @type {FloorLayer[]} */
        this._layers = [];
        this._w = 0;
        this._h = 0;
        this._res = 1;    // Karo pikseli / harita birimi
        this._dpr = 1;
        /** @type {Map<string, HTMLCanvasElement>} */
        this._tiles = new Map();
    }

    get ready() { return this._layers.length > 0; }

    /** @param {FloorLayer[]} layers @param {number} width @param {number} height */
    setFloor(layers, width, height) {
        this._layers = layers;
        this._w = width;
        this._h = height;
        this._tiles.clear();
    }

    /**
     * Ekran ölçeği değişince (yeniden boyutlanma) önbellek geçersizleşir.
     * @param {number} scale CSS pikseli / harita birimi @param {number} dpr
     */
    setResolution(scale, dpr) {
        const res = scale * dpr;
        if (Math.abs(res - this._res) < 1e-6 && dpr === this._dpr) return;
        this._res = res;
        this._dpr = dpr;
        this._tiles.clear();
    }

    /**
     * Görünen dikdörtgeni (harita birimi) kaplayan karoları, o anki dönüşümlü bağlama basar.
     * @param {CanvasRenderingContext2D} ctx
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} view
     * @returns {boolean} tüm karolar hazır mı (false → sonraki karede yeniden çizilmeli)
     */
    draw(ctx, view) {
        if (!this.ready) return false;
        const x0 = Math.max(0, Math.floor(view.minX / TILE_UNITS));
        const y0 = Math.max(0, Math.floor(view.minY / TILE_UNITS));
        const x1 = Math.min(Math.ceil(this._w / TILE_UNITS) - 1, Math.floor(view.maxX / TILE_UNITS));
        const y1 = Math.min(Math.ceil(this._h / TILE_UNITS) - 1, Math.floor(view.maxY / TILE_UNITS));

        let created = 0, complete = true;
        const span = TILE_UNITS + PAD_UNITS * 2;
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                const key = `${tx},${ty}`;
                let tile = this._tiles.get(key);
                if (tile) {
                    this._tiles.delete(key);   // LRU: en son kullanılan sona
                    this._tiles.set(key, tile);
                } else if (created < MAX_NEW_PER_FRAME) {
                    tile = this._render(tx, ty);
                    this._tiles.set(key, tile);
                    created++;
                    this._evict();
                } else {
                    complete = false;
                    continue;
                }
                ctx.drawImage(tile, tx * TILE_UNITS - PAD_UNITS, ty * TILE_UNITS - PAD_UNITS, span, span);
            }
        }
        return complete;
    }

    /** @param {number} tx @param {number} ty */
    _render(tx, ty) {
        const span = TILE_UNITS + PAD_UNITS * 2;
        const px = Math.ceil(span * this._res);
        const c = document.createElement('canvas');
        c.width = px;
        c.height = px;
        const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
        g.scale(px / span, px / span);
        g.translate(-(tx * TILE_UNITS - PAD_UNITS), -(ty * TILE_UNITS - PAD_UNITS));

        // Zemin beyaz; dış alan, atriyum, odalar ve çizgiler üstüne
        g.fillStyle = T.floor;
        g.fillRect(0, 0, this._w, this._h);
        const unitPx = px / span;   // Bir harita birimi kaç karo pikseli
        for (const layer of this._layers) {
            switch (layer.kind) {
                case 'o': g.fillStyle = T.outside; g.fill(layer.path, 'evenodd'); break;
                case 's': g.fillStyle = T.stairs;  g.fill(layer.path, 'evenodd'); break;
                case 'r':
                    g.fillStyle = T.room; g.fill(layer.path, 'evenodd');
                    g.strokeStyle = T.roomStroke;
                    g.lineWidth = (T.roomStrokePx * this._dpr) / unitPx;
                    g.stroke(layer.path);
                    break;
                case 'l': g.fillStyle = T.line; g.fill(layer.path, 'evenodd'); break;
            }
        }
        return c;
    }

    _evict() {
        while (this._tiles.size > MAX_TILES) {
            const oldest = this._tiles.keys().next().value;
            if (oldest === undefined) break;
            this._tiles.delete(oldest);
        }
    }
}
