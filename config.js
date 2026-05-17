/**
 * config.js — Hastane AR Navigasyon (Tarsus Devlet Hastanesi)
 *
 * leg türleri:
 *   "ar"      → Normal AR bacağı, oklar çizilir
 *   "info"    → Kullanıcıya bilgi gösterilir (asansör gibi),
 *               AR başlamaz, "Devam Et" butonu ile geçilir
 *
 * ROTA SIRASI (zorunlu — sadece aktif rotalar):
 *   1. Nöroloji Polikliniği   (Rota 1)
 *   2. Engelli Tuvaleti        (Rota 2)
 *   3. Laboratuvar Birimi      (Rota 3 — asansörlü)
 *   4. Danışma Noktası         (Rota 4)
 *
 * isAvailable: true  → AR navigasyon aktif, sıralı kilit sistemiyle açılır
 * isAvailable: false → Pasif rota, listede görünür ama AR desteklenmiyor
 *
 * category: Rotanın ait olduğu hastane alanı kategorisi
 *
 * Her AR bacağında path: [ {pos:"x y z"}, ... ]
 * Her 1 birim ≈ 1 metre
 */

const ROUTE_CATEGORIES = [
    "Poliklinikler",
    "Laboratuvarlar",
    "Tuvaletler",
    "Danışmalar",
    "Asansörler",
    "Acil",
    "Kafeteryalar"
];

const NAV_ROUTES = [

    /* ══════════════════════════════════════════════
       ROTA 1 — Nöroloji Polikliniği  (Aktif)
    ══════════════════════════════════════════════ */
    {
        id:   "noroloji",
        order: 1,
        name: "Nöroloji Polikliniği",
        icon: "🧠",
        desc: "B Blok · 1. Kat · Oda 112",
        category: "Poliklinikler",
        isAvailable: true,
        legs: [
            {
                type: "ar",
                instruction: "Koridorda dümdüz 3 metre ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" }
                ]
            },
            {
                type: "ar",
                instruction: "Sola dönüp 5 metre ilerleyin ⬅️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" },
                    { pos: "0 0 -4" },
                    { pos: "0 0 -5" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       ROTA 2 — Engelli Erişimine Uygun Tuvalet  (Aktif)
    ══════════════════════════════════════════════ */
    {
        id:   "engelli-tuvaleti",
        order: 2,
        name: "Engelli Tuvaleti",
        icon: "♿",
        desc: "Zemin Kat · A Blok Girişi",
        category: "Tuvaletler",
        isAvailable: true,
        legs: [
            {
                type: "ar",
                instruction: "Sağa dönüp 4 metre ilerleyin ➡️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" },
                    { pos: "0 0 -4" }
                ]
            },
            {
                type: "ar",
                instruction: "Dümdüz 3 metre ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       ROTA 3 — Laboratuvar Birimi  (Aktif — Asansörlü)
    ══════════════════════════════════════════════ */
    {
        id:   "laboratuvar",
        order: 3,
        name: "Laboratuvar Birimi",
        icon: "🔬",
        desc: "Alt Zemin Kat (-1) · C Blok",
        category: "Laboratuvarlar",
        isAvailable: true,
        legs: [
            {
                type: "ar",
                instruction: "Asansöre doğru 3 metre ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" }
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
                instruction: "Asansörden çıkıp 4 metre ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" },
                    { pos: "0 0 -4" }
                ]
            },
            {
                type: "ar",
                instruction: "Sola dönüp Laboratuvar girişine 3 metre ilerleyin ⬅️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       ROTA 4 — Danışma / Bilgilendirme Noktası  (Aktif)
    ══════════════════════════════════════════════ */
    {
        id:   "danisma",
        order: 4,
        name: "Danışma Noktası",
        icon: "ℹ️",
        desc: "Zemin Kat · Ana Giriş Karşısı",
        category: "Danışmalar",
        isAvailable: true,
        legs: [
            {
                type: "ar",
                instruction: "Giriş holüne doğru 3 metre ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" }
                ]
            },
            {
                type: "ar",
                instruction: "Sağa dönüp Danışma masasına 2 metre ilerleyin ➡️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════
       PASİF ROTALAR — AR Desteklenmiyor
    ══════════════════════════════════════════════ */

    {
        id:   "kardiyoloji",
        order: 99,
        name: "Kardiyoloji Polikliniği",
        icon: "❤️",
        desc: "A Blok · 2. Kat · Oda 205",
        category: "Poliklinikler",
        isAvailable: false,
        legs: []
    },

    {
        id:   "goz",
        order: 99,
        name: "Göz Polikliniği",
        icon: "👁️",
        desc: "A Blok · 3. Kat · Oda 301",
        category: "Poliklinikler",
        isAvailable: false,
        legs: []
    },

    {
        id:   "acil-servis",
        order: 99,
        name: "Acil Servis",
        icon: "🚑",
        desc: "Ana Bina · Zemin Kat · Kuzey Giriş",
        category: "Acil",
        isAvailable: false,
        legs: []
    },

    {
        id:   "kafeterya",
        order: 99,
        name: "Kafeterya",
        icon: "☕",
        desc: "B Blok · Zemin Kat",
        category: "Kafeteryalar",
        isAvailable: false,
        legs: []
    },

    {
        id:   "asansor-2kat",
        order: 99,
        name: "2. Kat Asansörü",
        icon: "🛗",
        desc: "A Blok · Ana Koridor",
        category: "Asansörler",
        isAvailable: false,
        legs: []
    }

];