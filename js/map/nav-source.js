// @ts-check
/**
 * nav-source.js — AR motorundan SALT OKUNUR anlık durum (adaptör).
 *
 * Harita modülünün ar.js / router.js global'lerini OKUDUĞU tek yer burasıdır
 * (yazma/komutlar: ar-commands.js). Diğer harita modülleri buradaki düz nesneyle çalışır.
 *
 * İlerleme ODOMETRİ ile ölçülür: bölüm yolunun başlangıç noktası ile kameranın bugünkü
 * konumu arasındaki yatay uzaklık. Bu, kameranın nereye baktığından ve AR yolunun hangi
 * açıyla çizildiğinden bağımsızdır; telefon düz, kucakta ya da yolu çapraz çizilmiş olsa da
 * yürünen mesafe doğru kalır.
 */

/**
 * @typedef {Object} NavSnapshot
 * @property {boolean} arActive       AR (XR) oturumu açık mı
 * @property {any}     route          Aktif rota (config.js öğesi) ya da null
 * @property {number}  legIdx
 * @property {any}     leg            Aktif bacak
 * @property {boolean} isLastLeg
 * @property {boolean} arrowsDrawn    Bu bacağın yolu çizildi mi (hazırlık / dönüş beklemesinde false)
 * @property {number}  totalM         Bacak uzunluğu (m)
 * @property {number}  walkedM        Bacakta yürünen mesafe (odometri, m; 0…totalM)
 * @property {number}  remainingM     Bacakta kalan (m)
 * @property {number}  fraction       walkedM / totalM
 * @property {number|null} walkHeadingDeg Yol başından kullanıcıya doğrultu (dünya Y açısı) — yürüyüş yönü
 * @property {number|null} pathHeadingDeg Çizili AR yolunun yönü (dünya Y açısı)
 * @property {number|null} facingDeg  Kullanıcının bakışı ile yol yönü arasındaki açı (saat yönü +)
 */

const WALK_HEADING_MIN_M = 1.0;   // Bu mesafeden kısa yürüyüşte doğrultu güvenilmez

/** @returns {any} */
function appState() {
    // router.js'teki `const AppState` klasik betik global'idir: window'da değil, ortak global kapsamdadır.
    // eslint-disable-next-line no-undef
    return typeof AppState !== 'undefined' ? AppState : null;
}

/** @returns {any} */
function three() { return /** @type {any} */ (window).THREE || null; }

/** @param {string} id @returns {any} */
function object3D(id) {
    const el = /** @type {any} */ (document.getElementById(id));
    return el && el.object3D ? el.object3D : null;
}

/** @returns {NavSnapshot} */
export function readNavSnapshot() {
    const st = appState();
    const route = st ? st.activeRoute : null;
    const legIdx = st ? st.legIdx : 0;
    const legs = st && st.arLegs ? st.arLegs : [];
    const leg = legs[legIdx] || null;

    const arrowsEl = document.getElementById('ar-arrows');
    const arrowsDrawn = !!(arrowsEl && arrowsEl.children.length > 0);

    // eslint-disable-next-line no-undef
    const totalM = leg && leg.path && typeof _calcLegDistance === 'function' ? _calcLegDistance(leg.path) : 0;

    /** @type {NavSnapshot} */
    const snap = {
        arActive: !!(st && st.arActive),
        route, legIdx, leg,
        isLastLeg: legIdx === legs.length - 1,
        arrowsDrawn,
        totalM,
        walkedM: 0,
        remainingM: totalM,
        fraction: 0,
        walkHeadingDeg: null,
        pathHeadingDeg: null,
        facingDeg: null
    };

    // Yol çizilmeden önce ok kapsayıcısı hâlâ önceki bölüme hizalıdır: ölçülmez
    if (arrowsDrawn && totalM > 0) measureLeg(snap);
    return snap;
}

/** Odometri + yönler. @param {NavSnapshot} snap */
function measureLeg(snap) {
    const T = three();
    const cam = object3D('ar-cam'), root = object3D('ar-arrows');
    const leg = snap.leg;
    if (!T || !cam || !root || !leg || !leg.path || leg.path.length < 2) return;

    const a = parsePos(leg.path[0]), b = parsePos(leg.path[leg.path.length - 1]);
    const startW = root.localToWorld(new T.Vector3(a.x, 0, a.z));
    const endW   = root.localToWorld(new T.Vector3(b.x, 0, b.z));
    const camW = new T.Vector3();
    cam.getWorldPosition(camW);

    const pdx = endW.x - startW.x, pdz = endW.z - startW.z;
    const wdx = camW.x - startW.x, wdz = camW.z - startW.z;
    const walked = Math.hypot(wdx, wdz);

    snap.walkedM = Math.min(snap.totalM, walked);
    snap.remainingM = Math.max(0, snap.totalM - walked);
    snap.fraction = snap.walkedM / snap.totalM;
    if (Math.hypot(pdx, pdz) > 0.01) snap.pathHeadingDeg = yawOf(pdx, pdz);
    if (walked >= WALK_HEADING_MIN_M) snap.walkHeadingDeg = yawOf(wdx, wdz);

    // Bakış: telefon dikken kameranın ileri yönü, düzken üst kenarının yönü
    if (snap.pathHeadingDeg !== null) {
        const look = lookDirection(T, cam);
        if (look) snap.facingDeg = angleDelta(snap.pathHeadingDeg, yawOf(look.x, look.z));
    }
}

/**
 * Kullanıcının baktığı yatay yön (ar.js _cameraYawDeg ile aynı kural).
 * @param {any} T @param {any} cam
 */
function lookDirection(T, cam) {
    const q = new T.Quaternion();
    cam.getWorldQuaternion(q);
    let v = new T.Vector3(0, 0, -1).applyQuaternion(q);
    if (Math.hypot(v.x, v.z) < 0.35) {
        const up = new T.Vector3(0, 1, 0).applyQuaternion(q);
        v = v.y < 0 ? up : up.negate();
    }
    return Math.hypot(v.x, v.z) < 0.05 ? null : v;
}

/**
 * Yatay vektörün dünya Y açısı (derece). (0,−1)=0°, A-Frame `rotation="0 θ 0"` ile aynı kural.
 * Saat yönü: yukarıdan bakınca θ arttıkça yön SAAT TERSİNE döner; bu yüzden harita
 * (saat yönü +) ile kıyaslarken farkın işareti çevrilir (bkz. angleDelta kullanımı).
 * @param {number} x @param {number} z
 */
function yawOf(x, z) { return Math.atan2(-x, -z) * 180 / Math.PI; }

/**
 * Yol yönünden bakış yönüne fark, haritanın kuralıyla (saat yönü +).
 * Dünya Y açısı saat tersine arttığı için fark ters işaretlidir.
 * @param {number} pathYaw @param {number} lookYaw
 */
function angleDelta(pathYaw, lookYaw) {
    let d = (pathYaw - lookYaw) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
}

/**
 * Bacak talimatının ekranda gösterilecek hali (AR'daki metinle birebir aynı).
 * @param {any} leg
 * @returns {string}
 */
export function formatInstruction(leg) {
    const raw = leg ? (leg.type === 'info' ? leg.title : leg.instruction) : '';
    // eslint-disable-next-line no-undef
    return typeof formatLegText === 'function' ? formatLegText(raw) : String(raw || '');
}

/** @param {any} pt */
function parsePos(pt) {
    const [x, , z] = String(pt && pt.pos || '0 0 0').split(' ').map(Number);
    return { x: x || 0, z: z || 0 };
}

/**
 * Kameranın ileri vektörünün dikey bileşeni (−1 = tam yere bakıyor). AR kapalıysa null.
 * Telefon masaya/dize düz konunca arka kamera yere bakar → değer −1'e yaklaşır.
 * @returns {number|null}
 */
export function readCameraPitchY() {
    const T = three();
    const cam = object3D('ar-cam');
    if (!T || !cam) return null;
    const q = new T.Quaternion();
    cam.getWorldQuaternion(q);
    return new T.Vector3(0, 0, -1).applyQuaternion(q).y;
}
