// @ts-check
/**
 * ar-commands.js — Harita modülünün AR motoruna verdiği komutlar (adaptör, yazma tarafı).
 *
 * Yalnızca ar.js'teki "HARİTA KANCALARI" bloğunu ve mevcut onArrived()'ı çağırır.
 * Okuma tarafı nav-source.js'tedir. Diğer harita modülleri global'leri tanımaz.
 */

/** @typedef {{ walkedM: number, headingDeg: number|null }} RealignOptions */

/** @param {boolean} arrived */
export function setMapArrival(arrived) {
    // eslint-disable-next-line no-undef
    if (typeof arSetMapArrival === 'function') arSetMapArrival(arrived);
}

/**
 * @param {RealignOptions} opts
 * @returns {boolean}
 */
export function realignLeg(opts) {
    // eslint-disable-next-line no-undef
    return typeof arRealignLeg === 'function' ? arRealignLeg(opts) : false;
}

/** Aktif bölümü tamamlar (son bölümde navigasyonu bitirir). */
export function completeLeg() {
    // AR'ın kendi otomatik varışı rotayı az önce bitirdiyse ikinci kez bitirme
    const done = document.getElementById('ar-done');
    if (done && done.classList.contains('visible')) return;
    // eslint-disable-next-line no-undef
    if (typeof onArrived === 'function') onArrived();
}

/** Ayarlar > Otomatik bitiş (varsayılan açık) */
export function isAutoFinishOn() {
    // eslint-disable-next-line no-undef
    return typeof isAutoFinishEnabled === 'function' ? isAutoFinishEnabled() : true;
}
