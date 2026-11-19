// @ts-check
/**
 * tilt-detector.js — "Telefon düz kondu / kaldırıldı" algılayıcı (tek sorumluluk).
 *
 * Kaynak: AR açıkken kameranın dünya yönelimi (WebXR pozu; izin gerektirmez, sensör füzyonu hazır).
 * Kamera kullanılamıyorsa `deviceorientation` (beta/gamma) yedek olarak dinlenir.
 *
 * Titremeyi önlemek için histerezis + bekleme süresi:
 *   düz say   → kamera ≥ ~68° aşağı bakıyor ve bu durum FLAT_DWELL_MS sürüyor
 *   kalktı say → kamera ≤ ~53° aşağı bakıyor ve bu durum RAISE_DWELL_MS sürüyor
 * AR'da kullanıcı kamerayı zaten yere doğru (~30–45°) tuttuğu için eşik bilerek dik tutuldu.
 */

const FLAT_ENTER_Y   = -0.93;   // sin(68°)
const FLAT_EXIT_Y    = -0.80;   // sin(53°)
const FLAT_DWELL_MS  = 700;
const RAISE_DWELL_MS = 450;

/** deviceorientation yedeği: telefon yatay düzleme bu kadar yakınsa düz sayılır (derece) */
const ORIENT_FLAT_DEG  = 22;
const ORIENT_RAISE_DEG = 40;

export class TiltDetector {
    /**
     * @param {{ readPitchY: () => number|null, onFlat: () => void, onRaise: () => void }} opts
     */
    constructor({ readPitchY, onFlat, onRaise }) {
        this._readPitchY = readPitchY;
        this._onFlat = onFlat;
        this._onRaise = onRaise;
        this._isFlat = false;
        /** @type {number|null} */
        this._candidateSince = null;
        /** @type {{ beta: number, gamma: number }|null} */
        this._orient = null;
        this._onOrientation = (/** @type {DeviceOrientationEvent} */ e) => {
            if (e.beta == null || e.gamma == null) return;
            this._orient = { beta: e.beta, gamma: e.gamma };
        };
        this._listening = false;
    }

    get isFlat() { return this._isFlat; }

    start() {
        if (this._listening) return;
        this._listening = true;
        window.addEventListener('deviceorientation', this._onOrientation);
    }

    stop() {
        this._listening = false;
        window.removeEventListener('deviceorientation', this._onOrientation);
        this._isFlat = false;
        this._candidateSince = null;
    }

    /** Her karede çağrılır (harita denetleyicisinin döngüsünden). @param {number} now */
    update(now) {
        if (!this._listening) return;
        const flatNow = this._classify();
        if (flatNow === null || flatNow === this._isFlat) {
            this._candidateSince = null;
            return;
        }
        if (this._candidateSince === null) this._candidateSince = now;
        const dwell = flatNow ? FLAT_DWELL_MS : RAISE_DWELL_MS;
        if (now - this._candidateSince < dwell) return;

        this._isFlat = flatNow;
        this._candidateSince = null;
        if (flatNow) this._onFlat(); else this._onRaise();
    }

    /** @returns {boolean|null} true = düz, false = kalkık, null = kararsız bölge */
    _classify() {
        const y = this._readPitchY();
        if (y !== null) {
            if (y <= FLAT_ENTER_Y) return true;
            if (y >= FLAT_EXIT_Y) return false;
            return null;
        }
        if (this._orient) {
            const tilt = Math.max(Math.abs(this._orient.beta), Math.abs(this._orient.gamma));
            if (tilt <= ORIENT_FLAT_DEG) return true;
            if (tilt >= ORIENT_RAISE_DEG) return false;
        }
        return null;
    }
}
