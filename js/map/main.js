// @ts-check
/**
 * main.js — Harita modülünün giriş noktası (index.html'den type="module" ile yüklenir).
 *
 * Bağımlılıkları burada birleştirir (composition root): DOM öğeleri, AR adaptörü ve
 * config.js'teki HOSPITAL_MAP. Modüller birbirini değil, buradan verilen arayüzleri tanır.
 * Modül betikleri ertelenmiş çalışır: DOM ve klasik betikler (router/ar/config) hazırdır.
 */
import { MapController } from './map-controller.js?v=1.2.0';
import { readNavSnapshot, readCameraPitchY, formatInstruction } from './nav-source.js?v=1.2.0';
import * as arCommands from './ar-commands.js?v=1.2.0';

function boot() {
    const overlay = document.getElementById('ar-overlay');
    const toggleButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('ar-map-btn'));
    // eslint-disable-next-line no-undef
    const floor = typeof HOSPITAL_MAP !== 'undefined' ? HOSPITAL_MAP : null;
    if (!overlay || !toggleButton || !floor) {
        console.warn('[harita] Başlatılamadı: #ar-overlay, #ar-map-btn veya HOSPITAL_MAP eksik.');
        return;
    }

    const srStatus = document.getElementById('ar-sr-status');
    const controller = new MapController({
        overlay,
        toggleButton,
        instructionEl: document.getElementById('ar-map-instr'),
        distEl: document.getElementById('ar-map-dist'),
        timeEl: document.getElementById('ar-map-time'),
        commands: arCommands,
        readSnapshot: readNavSnapshot,
        readPitchY: readCameraPitchY,
        formatInstruction,
        announce: msg => {
            if (!srStatus) return;
            srStatus.textContent = '';
            setTimeout(() => { srStatus.textContent = msg; }, 60);
        },
        floor
    });

    // Konsoldan deneme için (ör. masaüstünde): window.__arMap.open('button')
    /** @type {any} */ (window).__arMap = controller;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
