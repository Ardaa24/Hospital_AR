// @ts-check
/**
 * map-view.js — Harita modunun görünümü (yalnızca çizim; durum ve kararlar denetleyicide).
 *
 * Katmanlar:
 *   canvas  → kat planı, hedef alanı, rota (geçilen gri / kalan mavi), dönüş okları
 *   HTML    → kullanıcı noktası + bakış konisi, hedef etiketi, asansör rozeti, not, "Ortala"
 * HTML katmanı ekran uzayındadır: harita dönerken yazılar hep dik ve aynı boyutta kalır.
 *
 * Kamera: ekran = çapa + R(θ) · s · (p − merkez). Route-up: θ = −(rota yönü).
 */
import { MAP_THEME as T } from './map-theme.js?v=1.2.0';
import { splitAt } from './geometry.js?v=1.2.0';
import { FloorTiles } from './floor-tiles.js?v=1.2.0';

/** @typedef {import('./geometry.js').Point} Point */
/** @typedef {import('./floor-plan.js').FloorLayer} FloorLayer */
/** @typedef {import('./route-track.js').RouteTrack} RouteTrack */

/**
 * @typedef {Object} Camera
 * @property {Point}  center    Harita merkezi (birim)
 * @property {number} rotation  Haritanın dönüşü (derece, saat yönü +)
 * @property {Point}  pan       Ekran pikseli kaydırma
 */

/**
 * @typedef {Object} Frame
 * @property {Camera} camera
 * @property {Point}  user          Kullanıcının haritadaki noktası
 * @property {number} along         Rotada ilerleme (geçilen/kalan ayrımı için)
 * @property {number|null} facing   Kullanıcının bakış yönü (harita açısı) ya da null
 */

const DEG = Math.PI / 180;
const TOP_INSET_PX = 96;   // Üstte kalan çıkış (X) düğmesinin alanı

export class MapView {
    /**
     * @param {HTMLElement} host  Haritanın ekleneceği kapsayıcı (#ar-overlay)
     * @param {{ onRecenter: () => void, onPan: (dx: number, dy: number) => void }} handlers
     */
    constructor(host, handlers) {
        this._handlers = handlers;
        this._tiles = new FloorTiles();
        this._lastKey = '';
        this._needsRedraw = true;
        /** @type {RouteTrack|null} */
        this._track = null;
        this._dpr = 1;
        this._w = 0;
        this._h = 0;
        this._bottomInset = 0;
        this._scale = 1;
        this._background = T.background;

        this.root = document.createElement('div');
        this.root.id = 'ar-map';
        this.root.className = 'ar-map';
        this.root.setAttribute('aria-hidden', 'true');
        this.root.innerHTML = `
            <canvas class="arm-canvas"></canvas>
            <div class="arm-markers"></div>
            <div class="arm-user" hidden>
                <div class="arm-user-cone"></div>
                <div class="arm-user-dot"></div>
            </div>
            <div class="arm-note" hidden></div>
            <button class="arm-recenter ar-interactive" type="button" hidden>
                <i data-lucide="locate-fixed" width="22" height="22" aria-hidden="true"></i>
                <span>Ortala</span>
            </button>`;
        host.prepend(this.root);   // HUD ve alt panelin ALTINDA kalsın

        this._canvas = /** @type {HTMLCanvasElement} */ (this.root.querySelector('.arm-canvas'));
        this._ctx = /** @type {CanvasRenderingContext2D} */ (this._canvas.getContext('2d'));
        this._markers = /** @type {HTMLElement} */ (this.root.querySelector('.arm-markers'));
        this._user = /** @type {HTMLElement} */ (this.root.querySelector('.arm-user'));
        this._cone = /** @type {HTMLElement} */ (this.root.querySelector('.arm-user-cone'));
        this._note = /** @type {HTMLElement} */ (this.root.querySelector('.arm-note'));
        this._recenter = /** @type {HTMLButtonElement} */ (this.root.querySelector('.arm-recenter'));
        /** @type {{ el: HTMLElement, point: Point }[]} */
        this._markerEls = [];

        this._recenter.addEventListener('click', () => this._handlers.onRecenter());
        this._bindPan();
        if (/** @type {any} */ (window).lucide) /** @type {any} */ (window).lucide.createIcons({ root: this.root });
    }

    /**
     * @param {FloorLayer[]} layers @param {number} width @param {number} height
     * @param {string} [background]  Planın dışında kalan alanın rengi (yoksa temadaki)
     */
    setFloor(layers, width, height, background) {
        this._tiles.setFloor(layers, width, height);
        this._background = background || T.background;
        this._needsRedraw = true;
    }

    /** @param {RouteTrack|null} track */
    setTrack(track) {
        this._track = track;
        this._needsRedraw = true;
        this._markers.innerHTML = '';
        this._markerEls = [];
        if (!track || track.isEmpty) return;

        for (const m of track.markers) {
            if (m.kind !== 'elevator') continue;
            const el = document.createElement('div');
            el.className = 'arm-badge';
            el.innerHTML = '<i data-lucide="arrow-up-down" width="18" height="18" aria-hidden="true"></i>';
            this._markers.appendChild(el);
            this._markerEls.push({ el, point: m.point });
        }
        if (track.destLabelPoint) {
            const el = document.createElement('div');
            el.className = 'arm-dest';
            el.innerHTML = '<span class="arm-dest-pin"><i data-lucide="map-pin" width="18" height="18" aria-hidden="true"></i></span><span class="arm-dest-label"></span>';
            /** @type {HTMLElement} */ (el.querySelector('.arm-dest-label')).textContent = track.destLabel;
            this._markers.appendChild(el);
            this._markerEls.push({ el, point: track.destLabelPoint });
        }
        if (/** @type {any} */ (window).lucide) /** @type {any} */ (window).lucide.createIcons({ root: this._markers });
    }

    /** @param {boolean} visible */
    setVisible(visible) {
        this.root.classList.toggle('visible', visible);
        if (visible) this.resize();
    }

    /** @param {string|null} text */
    setNote(text) {
        this._note.hidden = !text;
        if (text) this._note.textContent = text;
    }

    /** @param {boolean} show */
    setRecenterVisible(show) { this._recenter.hidden = !show; }

    /** Kapsayıcı boyutu ve alt panel yüksekliği değişince çağrılır */
    resize() {
        const r = this.root.getBoundingClientRect();
        // DPR 2 ile sınırlı: harita için yeterince keskin, AR render'ı ile yarışan piksel sayısı ~%55 az
        this._dpr = Math.min(window.devicePixelRatio || 1, 2);
        this._w = r.width;
        this._h = r.height;
        this._canvas.width = Math.round(r.width * this._dpr);
        this._canvas.height = Math.round(r.height * this._dpr);
        const bottom = document.getElementById('ar-bottom');
        this._bottomInset = bottom ? bottom.getBoundingClientRect().height : 0;
        this._scale = Math.max(0.2, r.width / T.unitsAcross);
        this._tiles.setResolution(this._scale, this._dpr);
        this._needsRedraw = true;   // Tuval boyutu atanınca içerik silinir
    }

    /** Kullanıcının ekranda duracağı nokta (takip modunda) */
    get anchor() {
        const top = TOP_INSET_PX, bottom = this._h - this._bottomInset;
        return /** @type {Point} */ ([this._w / 2, top + (bottom - top) * T.anchorY]);
    }

    /**
     * Harita noktasını ekran pikseline çevirir.
     * @param {Point} p @param {Camera} cam
     * @returns {Point}
     */
    project(p, cam) {
        const a = this.anchor, s = this._scale, th = cam.rotation * DEG;
        const dx = (p[0] - cam.center[0]) * s, dy = (p[1] - cam.center[1]) * s;
        const c = Math.cos(th), si = Math.sin(th);
        return [a[0] + cam.pan[0] + dx * c - dy * si, a[1] + cam.pan[1] + dx * si + dy * c];
    }

    /** @param {Frame} f */
    render(f) {
        if (!this._w) this.resize();
        const cam = f.camera;

        // Değişmeyen karede hiçbir şey çizme (kullanıcı dururken GPU/pil boşta kalsın)
        const key = [
            cam.center[0].toFixed(1), cam.center[1].toFixed(1), cam.rotation.toFixed(2),
            cam.pan[0].toFixed(0), cam.pan[1].toFixed(0), f.along.toFixed(1),
            f.facing === null ? 'n' : f.facing.toFixed(1), this._w, this._h
        ].join('|');
        if (key === this._lastKey && !this._needsRedraw) return;
        this._lastKey = key;

        const ctx = this._ctx, s = this._scale, a = this.anchor;
        ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        ctx.fillStyle = this._background;
        ctx.fillRect(0, 0, this._w, this._h);

        ctx.translate(a[0] + cam.pan[0], a[1] + cam.pan[1]);
        ctx.rotate(cam.rotation * DEG);
        ctx.scale(s, s);
        ctx.translate(-cam.center[0], -cam.center[1]);

        // Eksik karo kaldıysa (karede üretim sınırı) bir sonraki karede yeniden çiz
        this._needsRedraw = !this._tiles.draw(ctx, this._visibleRect(cam));
        if (this._track && !this._track.isEmpty) this._drawRoute(ctx, s, f.along);

        this._placeHtml(f);
    }

    /**
     * Ekranın kapladığı harita dikdörtgeni (dönüş hesaba katılarak, birim).
     * @param {Camera} cam
     */
    _visibleRect(cam) {
        const a = this.anchor, s = this._scale, th = -cam.rotation * DEG;
        const c = Math.cos(th), si = Math.sin(th);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [sx, sy] of [[0, 0], [this._w, 0], [0, this._h], [this._w, this._h]]) {
            const dx = (sx - a[0] - cam.pan[0]) / s, dy = (sy - a[1] - cam.pan[1]) / s;
            const x = cam.center[0] + dx * c - dy * si, y = cam.center[1] + dx * si + dy * c;
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        }
        return { minX, minY, maxX, maxY };
    }

    /** @param {CanvasRenderingContext2D} ctx @param {number} s @param {number} along */
    _drawRoute(ctx, s, along) {
        const track = /** @type {RouteTrack} */ (this._track);

        // Hedef alanı
        ctx.fillStyle = T.destFill;
        ctx.strokeStyle = T.destStroke;
        ctx.lineWidth = T.destStrokePx / s;
        ctx.lineJoin = 'round';
        for (const area of track.destAreas) {
            ctx.beginPath();
            area.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        if (track.points.length < 2) return;
        const [passed, ahead] = splitAt(track.points, along);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        strokeLine(ctx, track.points, T.routeCasing, T.routeCasingPx / s);
        strokeLine(ctx, passed, T.routePassed, T.routePassedPx / s);
        strokeLine(ctx, ahead, T.routeAhead, T.routeAheadPx / s);

        // Dönüş okları: yalnızca önümüzdeki köşelerde (Google'daki manevra okları gibi)
        const r = T.turnArrowPx / s;
        ctx.fillStyle = T.turnArrow;
        ctx.strokeStyle = T.turnArrowStroke;
        ctx.lineWidth = T.turnArrowLinePx / s;
        for (const m of track.markers) {
            if (m.kind !== 'turn' || m.along < along - 1) continue;
            ctx.save();
            ctx.translate(m.point[0], m.point[1]);
            ctx.rotate(m.heading * DEG);
            ctx.translate(0, -r * 1.4);   // Oku köşenin biraz ilerisine, yeni yolun üstüne koy
            ctx.beginPath();
            ctx.moveTo(0, -r * 1.2);
            ctx.lineTo(r, 0);
            ctx.lineTo(r * 0.36, 0);
            ctx.lineTo(r * 0.36, r);
            ctx.lineTo(-r * 0.36, r);
            ctx.lineTo(-r * 0.36, 0);
            ctx.lineTo(-r, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
            ctx.restore();
        }
    }

    /** @param {Frame} f */
    _placeHtml(f) {
        const cam = f.camera;
        for (const m of this._markerEls) {
            const [x, y] = this.project(m.point, cam);
            m.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        }

        const [ux, uy] = this.project(f.user, cam);
        this._user.hidden = false;
        this._user.style.transform = `translate3d(${ux.toFixed(1)}px, ${uy.toFixed(1)}px, 0)`;
        if (f.facing === null) {
            this._cone.style.opacity = '0';
        } else {
            this._cone.style.opacity = '1';
            this._cone.style.transform = `rotate(${(f.facing + cam.rotation).toFixed(1)}deg)`;
        }
    }

    _bindPan() {
        /** @type {{ id: number, x: number, y: number }|null} */
        let drag = null;
        const c = this._canvas;
        c.addEventListener('pointerdown', e => {
            drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
            c.setPointerCapture(e.pointerId);
        });
        c.addEventListener('pointermove', e => {
            if (!drag || drag.id !== e.pointerId) return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            drag.x = e.clientX; drag.y = e.clientY;
            if (dx || dy) this._handlers.onPan(dx, dy);
        });
        const end = (/** @type {PointerEvent} */ e) => {
            if (drag && drag.id === e.pointerId) drag = null;
        };
        c.addEventListener('pointerup', end);
        c.addEventListener('pointercancel', end);
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {Point[]} pts
 * @param {string} color @param {number} width
 */
function strokeLine(ctx, pts, color, width) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}
