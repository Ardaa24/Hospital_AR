/**
 * config.js — Hastane AR Navigasyon
 *
 * leg türleri:
 *   "ar"      → Normal AR bacağı, oklar çizilir
 *   "info"    → Kullanıcıya bilgi gösterilir (asansör gibi),
 *               AR başlamaz, "Devam Et" butonu ile geçilir
 *
 * DURAK SIRASI (zorunlu):
 *   1. Nöroloji Polikliniği   (Görev 1 & 2)
 *   2. Engelli Tuvaleti        (Görev 3)
 *   3. Laboratuvar Birimi      (Görev 4 — asansörlü)
 *   4. Danışma Noktası         (Görev 5)
 *
 * Her AR bacağında path: [ {pos:"x y z"}, ... ]
 * Her ~0.7 birim ≈ 1 adım (~70 cm)
 */

const NAV_ROUTES = [

    /* ══════════════════════════════════════════════
       DURAK 1 — Nöroloji Polikliniği  (Görev 1 & 2)
    ══════════════════════════════════════════════ */
    {
        id:   "noroloji",
        task: 1,
        order: 1,          // Sıralı kilit için
        name: "Nöroloji Polikliniği",
        icon: "🧠",
        desc: "B Blok · 1. Kat · Oda 112",
        legs: [
            {
                type: "ar",
                instruction: "Koridorda dümdüz 3 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            },
            {
                type: "ar",
                instruction: "Sola dönüp 5 adım ilerleyin ⬅️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" },
                    { pos: "0 0 -2.8" },
                    { pos: "0 0 -3.5" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       DURAK 2 — Engelli Erişimine Uygun Tuvalet  (Görev 3)
    ══════════════════════════════════════════════ */
    {
        id:   "engelli-tuvaleti",
        task: 3,
        order: 2,
        name: "Engelli Tuvaleti",
        icon: "♿",
        desc: "Zemin Kat · A Blok Girişi",
        legs: [
            {
                type: "ar",
                instruction: "Sağa dönüp 4 adım ilerleyin ➡️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" },
                    { pos: "0 0 -2.8" }
                ]
            },
            {
                type: "ar",
                instruction: "Dümdüz 3 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       DURAK 3 — Laboratuvar Birimi  (Görev 4 — Asansörlü)
    ══════════════════════════════════════════════ */
    {
        id:   "laboratuvar",
        task: 4,
        order: 3,
        name: "Laboratuvar Birimi",
        icon: "🔬",
        desc: "Alt Zemin Kat (-1) · C Blok",
        legs: [
            {
                type: "ar",
                instruction: "Asansöre doğru 3 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            },
            {
                type: "info",
                icon: "🛗",
                title: "Asansöre Binin",
                lines: [
                    "Önünüzdeki asansöre girin.",
                    "Panel üzerinden  −1  tuşuna basın.",
                    "Kapı açılınca asansörden çıkıp sağa dönün.",
                    "Hazır olunca 'AR\'yi Başlat' butonuna basın."
                ]
            },
            {
                type: "ar",
                instruction: "Asansörden çıkıp 4 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" },
                    { pos: "0 0 -2.8" }
                ]
            },
            {
                type: "ar",
                instruction: "Sola dönüp Laboratuvar girişine 3 adım ilerleyin ⬅️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       DURAK 4 — Danışma / Bilgilendirme Noktası  (Görev 5)
    ══════════════════════════════════════════════ */
    {
        id:   "danisma",
        task: 5,
        order: 4,
        name: "Danışma Noktası",
        icon: "ℹ️",
        desc: "Zemin Kat · Ana Giriş Karşısı",
        legs: [
            {
                type: "ar",
                instruction: "Giriş holüne doğru 3 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            },
            {
                type: "ar",
                instruction: "Sağa dönüp Danışma masasına 2 adım ilerleyin ➡️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" }
                ]
            }
        ]
    }

];