// @ts-check
/**
 * arrival-policy.js — Harita modunun kendi bölüm sonu / bitiş / yeniden hizalama kuralları.
 *
 * AR'daki varış, çizili yolun bitiş noktasına olan uzaklığa bakar; yol çapraz çizildiyse
 * bitişe hiç girilemez. Harita modu bunun yerine YÜRÜNEN MESAFEYE (odometri) bakar:
 *
 *   1. Kilit açma   — bölümde kalan ≤ UNLOCK_REMAINING_M → "Sonraki Bölüm" / "Hedefe Vardım" açılır.
 *                     Ara bölümler HER ZAMAN kullanıcı onayıyla geçilir (önce dönmesi gerekir).
 *   2. Otomatik bitiş — yalnızca SON bölümde ve Ayarlar > Otomatik bitiş açıksa:
 *                     kalan ≤ FINISH_REMAINING_M, FINISH_HOLD_MS boyunca → navigasyon tamamlanır.
 *   3. Yön öğrenme  — harita açıkken bölümde LEARN_AFTER_M yüründüğünde yürüyüş doğrultusu
 *                     çizili yoldan REALIGN_MIN_DEG'den fazla sapıyorsa yol bu doğrultuya çevrilir.
 *   4. Kameraya dönüş — harita kapanınca (buton ya da telefonu kaldırma) yol, kaldığı mesafeden
 *                     ve öğrenilen yönle yeniden çizilir: kullanıcı okları doğru yerde bulur.
 */

/** @typedef {import('./nav-source.js').NavSnapshot} NavSnapshot */

const UNLOCK_REMAINING_M = 1.5;   // ar.js GROUND_ZONE_RADIUS ile aynı
const FINISH_REMAINING_M = 1.0;   // ar.js ARRIVAL_THRESHOLD ile aynı
const FINISH_HOLD_MS     = 500;   // ar.js otomatik varış gecikmesiyle aynı
const LEARN_AFTER_M      = 1.8;
const RESUME_MIN_M       = 1.0;
const REALIGN_MIN_DEG    = 15;

/**
 * @typedef {Object} ArCommands
 * @property {(arrived: boolean) => void} setMapArrival
 * @property {(o: { walkedM: number, headingDeg: number|null }) => boolean} realignLeg
 * @property {() => void} completeLeg
 * @property {() => boolean} isAutoFinishOn
 */

export class ArrivalPolicy {
    /** @param {ArCommands} commands */
    constructor(commands) {
        this._cmd = commands;
        /** @type {string|null} */
        this._legKey = null;
        this._arrivalSent = false;
        this._learned = false;
        this._finished = false;
        /** @type {number|null} */
        this._finishSince = null;
    }

    /**
     * Her karede (AR açıkken) çağrılır.
     * @param {NavSnapshot} snap @param {boolean} mapVisible @param {number} now
     */
    update(snap, mapVisible, now) {
        this._syncLeg(snap);

        const measurable = mapVisible && snap.arrowsDrawn && snap.leg && snap.leg.type !== 'info' && snap.totalM > 0;
        if (!measurable) {
            this._sendArrival(false);
            this._finishSince = null;
            return;
        }

        // 3. Yön öğrenme (bölüm başına bir kez)
        if (!this._learned && snap.walkedM >= LEARN_AFTER_M && snap.walkHeadingDeg !== null) {
            this._learned = true;
            this._realignIfOff(snap);
        }

        // 1. Kilit açma
        this._sendArrival(snap.remainingM <= UNLOCK_REMAINING_M);

        // 2. Otomatik bitiş (son bölüm)
        if (snap.isLastLeg && !this._finished && this._cmd.isAutoFinishOn()
            && snap.remainingM <= FINISH_REMAINING_M) {
            if (this._finishSince === null) this._finishSince = now;
            if (now - this._finishSince >= FINISH_HOLD_MS) {
                this._finished = true;
                this._cmd.completeLeg();
            }
        } else {
            this._finishSince = null;
        }
    }

    /**
     * 4. Harita kapanıp kameraya dönülürken: kaldığı yerden, doğru yönde devam.
     * @param {NavSnapshot} snap
     */
    onMapClosed(snap) {
        this._sendArrival(false);
        this._finishSince = null;
        if (!snap.arrowsDrawn || !snap.leg || snap.leg.type === 'info') return;
        if (snap.walkedM < RESUME_MIN_M || snap.walkHeadingDeg === null) return;
        this._realignIfOff(snap);
    }

    /** @param {NavSnapshot} snap */
    _realignIfOff(snap) {
        if (snap.walkHeadingDeg === null || snap.pathHeadingDeg === null) return;
        const off = Math.abs(normalize(snap.walkHeadingDeg - snap.pathHeadingDeg));
        if (off <= REALIGN_MIN_DEG) return;
        this._cmd.realignLeg({ walkedM: snap.walkedM, headingDeg: snap.walkHeadingDeg });
    }

    /** @param {NavSnapshot} snap */
    _syncLeg(snap) {
        const key = snap.route ? `${snap.route.id}:${snap.legIdx}` : null;
        if (key === this._legKey) return;
        this._legKey = key;
        this._arrivalSent = false;   // ar.js bölüm değişince kendi bayrağını zaten sıfırlar
        this._learned = false;
        this._finished = false;
        this._finishSince = null;
    }

    /** @param {boolean} arrived */
    _sendArrival(arrived) {
        if (arrived === this._arrivalSent) return;
        this._arrivalSent = arrived;
        this._cmd.setMapArrival(arrived);
    }
}

/** @param {number} d */
function normalize(d) {
    d %= 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}
