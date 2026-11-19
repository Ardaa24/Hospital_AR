// @ts-check
/**
 * map-controller.js — Harita modunun yöneticisi.
 *
 * Sorumluluklar: harita ⇄ kamera geçişi (buton + telefonu düz koyma), AR durumunu
 * okuyup kullanıcı noktasını rota üzerinde yumuşakça ilerletmek, route-up kamerası,
 * elle kaydırma ve "Ortala". Çizim MapView'de, AR okuma nav-source'ta, bölüm sonu /
 * bitiş / yeniden hizalama kuralları ArrivalPolicy'de, geometri geometry/route-track'te.
 */
import { RouteTrack } from './route-track.js?v=1.1.0';
import { MapView } from './map-view.js?v=1.1.0';
import { TiltDetector } from './tilt-detector.js?v=1.1.0';
import { loadFloorPlan } from './floor-plan.js?v=1.1.0';
import { pointAlong, angleDelta } from './geometry.js?v=1.1.0';
import { ArrivalPolicy } from './arrival-policy.js?v=1.1.0';

/** @typedef {import('./geometry.js').Point} Point */
/** @typedef {import('./nav-source.js').NavSnapshot} NavSnapshot */

const FRAME_MS        = 1000 / 30;  // AR döngüsüyle aynı 30 FPS sınırı
const ALONG_TAU_MS    = 180;        // Nokta ilerleme yumuşatması
const ROTATE_TAU_MS   = 320;        // Harita dönüş yumuşatması (köşelerde)
const FACING_TAU_MS   = 120;        // Bakış konisi yumuşatması

/**
 * @typedef {Object} MapControllerDeps
 * @property {HTMLElement} overlay            #ar-overlay (WebXR DOM overlay kökü)
 * @property {HTMLButtonElement} toggleButton  Alt paneldeki Harita/Kamera düğmesi
 * @property {HTMLElement|null} instructionEl  Harita modunda alt paneldeki talimat
 * @property {HTMLElement|null} distEl         Harita modunda kalan mesafe (odometri)
 * @property {HTMLElement|null} timeEl         Harita modunda tahmini süre
 * @property {import('./arrival-policy.js').ArCommands} commands
 * @property {() => NavSnapshot} readSnapshot
 * @property {() => number|null} readPitchY
 * @property {(leg: any) => string} formatInstruction
 * @property {(msg: string) => void} announce
 * @property {{ src: string, width: number, height: number }} floor
 */

export class MapController {
    /** @param {MapControllerDeps} deps */
    constructor(deps) {
        this._d = deps;
        this._visible = false;
        /** @type {'button'|'tilt'|null} */
        this._openedBy = null;
        this._following = true;
        /** @type {Point} */
        this._pan = [0, 0];
        /** @type {{ center: Point, rotation: number }|null} */
        this._frozen = null;

        /** @type {RouteTrack|null} */
        this._track = null;
        /** @type {string|null} */
        this._trackKey = null;
        this._along = 0;
        this._rotation = 0;
        /** @type {number|null} */
        this._facing = null;
        this._snapInstant = true;   // Açılışta yumuşatmadan doğrudan yerine otur
        this._policy = new ArrivalPolicy(deps.commands);
        this._lastMetrics = '';

        this._rafId = 0;
        this._lastFrame = 0;
        this._lastText = '';
        this._reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        this._view = new MapView(deps.overlay, {
            onRecenter: () => this._recenter(),
            onPan: (dx, dy) => this._panBy(dx, dy)
        });
        this._tilt = new TiltDetector({
            readPitchY: deps.readPitchY,
            onFlat:  () => { if (!this._visible) this.open('tilt'); },
            onRaise: () => { if (this._visible && this._openedBy === 'tilt') this.close(); }
        });

        loadFloorPlan(deps.floor.src)
            .then(layers => this._view.setFloor(layers, deps.floor.width, deps.floor.height))
            .catch(err => console.warn('[harita]', err));

        deps.toggleButton.addEventListener('click', () => {
            if (this._visible) this.close(); else this.open('button');
        });
        window.addEventListener('resize', () => { if (this._visible) this._view.resize(); });

        // AR oturumu açılıp kapandıkça döngüyü başlat/durdur (ar.js #ar-overlay'e 'ar-active' ekler)
        new MutationObserver(() => this._syncSession())
            .observe(deps.overlay, { attributes: true, attributeFilter: ['class'] });
        this._syncSession();
    }

    /** @param {'button'|'tilt'} by */
    open(by) {
        const snap = this._d.readSnapshot();
        if (!snap.arActive) return;
        this._ensureTrack(snap.route);

        this._visible = true;
        this._openedBy = by;
        this._following = true;
        this._pan = [0, 0];
        this._frozen = null;
        this._snapInstant = true;

        this._d.overlay.classList.add('map-mode');
        this._view.setVisible(true);
        this._view.setRecenterVisible(false);
        this._setButton(true);
        this._d.announce(by === 'tilt'
            ? 'Harita açıldı. Kameraya dönmek için telefonu kaldırın.'
            : 'Harita açıldı.');
    }

    close() {
        if (!this._visible) return;
        this._visible = false;
        this._openedBy = null;
        // Kameraya dönüş: yol, kaldığı mesafeden ve yürüyüş yönüyle yeniden çizilir
        this._policy.onMapClosed(this._d.readSnapshot());
        this._d.overlay.classList.remove('map-mode');
        this._view.setVisible(false);
        this._setButton(false);
        this._d.announce('Kamera görünümü.');
    }

    _syncSession() {
        const active = this._d.overlay.classList.contains('ar-active');
        if (active && !this._rafId) {
            this._tilt.start();
            this._lastFrame = 0;
            this._rafId = requestAnimationFrame(t => this._loop(t));
        } else if (!active && this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = 0;
            this._tilt.stop();
            this.close();
        }
    }

    /** @param {number} now */
    _loop(now) {
        this._rafId = requestAnimationFrame(t => this._loop(t));
        if (now - this._lastFrame < FRAME_MS) return;
        const dt = this._lastFrame ? now - this._lastFrame : FRAME_MS;
        this._lastFrame = now;

        const snap = this._d.readSnapshot();
        if (!snap.arActive) { this.close(); return; }

        this._tilt.update(now);
        this._policy.update(snap, this._visible, now);
        if (!this._visible) return;

        this._ensureTrack(snap.route);
        this._updateInstruction(snap);
        this._updateMetrics(snap);
        const track = this._track;
        if (!track || track.isEmpty) return;

        const target = track.locate(snap.legIdx, snap.fraction);
        if (!target) return;
        this._view.setNote(target.note);

        const instant = this._snapInstant || this._reduceMotion.matches;
        this._along = instant ? target.along : ease(this._along, target.along, dt, ALONG_TAU_MS);

        const at = pointAlong(track.points, this._along);
        const wantRotation = -at.heading;   // Route-up: rota yönü ekranda yukarı
        this._rotation = instant
            ? wantRotation
            : this._rotation + angleDelta(this._rotation, wantRotation) * blend(dt, ROTATE_TAU_MS);

        if (snap.facingDeg === null) {
            this._facing = null;
        } else {
            const want = at.heading + snap.facingDeg;
            this._facing = (this._facing === null || instant)
                ? want
                : this._facing + angleDelta(this._facing, want) * blend(dt, FACING_TAU_MS);
        }
        this._snapInstant = false;

        const camera = this._following || !this._frozen
            ? { center: at.point, rotation: this._rotation, pan: /** @type {Point} */ ([0, 0]) }
            : { center: this._frozen.center, rotation: this._frozen.rotation, pan: this._pan };

        this._view.render({ camera, user: at.point, along: this._along, facing: this._facing });
    }

    /** @param {any} route */
    _ensureTrack(route) {
        const key = route ? route.id : null;
        if (key === this._trackKey) return;
        this._trackKey = key;
        this._track = route ? new RouteTrack(route) : null;
        this._view.setTrack(this._track);
        this._snapInstant = true;
    }

    /**
     * Harita modunda kalan mesafe/süre odometriden gelir (AR'daki değer çizili yola
     * izdüşümdür; yol kaymışsa takılı kalabilir). Biçim AR HUD'uyla aynı.
     * @param {NavSnapshot} snap
     */
    _updateMetrics(snap) {
        const { distEl, timeEl } = this._d;
        const remain = snap.remainingM;
        const dist = remain < 1 ? '<1m' : `${Math.round(remain)}m`;
        const sec = Math.ceil(remain * 1.5);
        const time = sec >= 60 ? `${Math.ceil(sec / 60)}dk` : `${sec}sn`;
        const key = dist + time;
        if (key === this._lastMetrics) return;
        this._lastMetrics = key;
        if (distEl) distEl.textContent = dist;
        if (timeEl) timeEl.textContent = time;
    }

    /** @param {NavSnapshot} snap */
    _updateInstruction(snap) {
        const el = this._d.instructionEl;
        if (!el) return;
        const text = snap.leg ? this._d.formatInstruction(snap.leg) : '';
        if (text !== this._lastText) {
            this._lastText = text;
            el.textContent = text;
        }
    }

    /** @param {number} dx @param {number} dy */
    _panBy(dx, dy) {
        if (this._following) {
            const at = this._track && !this._track.isEmpty
                ? pointAlong(this._track.points, this._along).point
                : /** @type {Point} */ ([0, 0]);
            this._frozen = { center: at, rotation: this._rotation };
            this._following = false;
            this._pan = [0, 0];
            this._view.setRecenterVisible(true);
        }
        this._pan = [this._pan[0] + dx, this._pan[1] + dy];
    }

    _recenter() {
        this._following = true;
        this._frozen = null;
        this._pan = [0, 0];
        this._view.setRecenterVisible(false);
    }

    /** @param {boolean} mapOn */
    _setButton(mapOn) {
        const btn = this._d.toggleButton;
        btn.setAttribute('aria-pressed', String(mapOn));
        btn.dataset.view = mapOn ? 'map' : 'camera';
        const label = btn.querySelector('.arb-map-label');
        if (label) label.textContent = mapOn ? 'Kamera' : 'Harita';
    }
}

/** Kare hızından bağımsız üstel yumuşatma katsayısı @param {number} dt @param {number} tau */
function blend(dt, tau) { return 1 - Math.exp(-dt / tau); }

/** @param {number} from @param {number} to @param {number} dt @param {number} tau */
function ease(from, to, dt, tau) { return from + (to - from) * blend(dt, tau); }
