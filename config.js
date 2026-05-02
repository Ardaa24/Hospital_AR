/**
 * config.js — Hastane AR Navigasyon
 *
 * leg türleri:
 *   "ar"      → Normal AR bacağı, oklar çizilir
 *   "info"    → Kullanıcıya bilgi gösterilir (asansör gibi),
 *               AR başlamaz, "Devam Et" butonu ile geçilir
 *
 * Her AR bacağında path: [ {pos:"x y z"}, ... ]
 * Her ~0.7 birim ≈ 1 adım (~70 cm)
 */

const NAV_ROUTES = [

    /* ══════════════════════════════════════════════
       GÖREV 1 & 2 — Nöroloji Polikliniği
    ══════════════════════════════════════════════ */
    {
        id: "noroloji",
        task: 1,          // Görev numarası (rozet için)
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
       GÖREV 3 — Engelli Erişimine Uygun Tuvalet
    ══════════════════════════════════════════════ */
    {
        id: "engelli-tuvaleti",
        task: 3,
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
       GÖREV 4 — Laboratuvar Birimi (Asansörlü Rota)
       Asansörde -1. kata iniş içerir.
    ══════════════════════════════════════════════ */
    {
        id: "laboratuvar",
        task: 4,
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
                /* ── Asansör Bilgi Ekranı ──────────────────
                   type: "info" → oklar çizilmez,
                   kullanıcıya talimat gösterilir.
                ──────────────────────────────────────────── */
                type: "info",
                icon: "🛗",
                title: "Asansöre Binin",
                lines: [
                    "Önünüzdeki asansöre girin.",
                    "Panel üzerinden  −1  tuşuna basın.",
                    "Asansörden çıkınca sağa dönün.",
                    "Kapı açılınca AR'yi tekrar başlatın."
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
       GÖREV 5 — Danışma / Bilgilendirme Noktası
    ══════════════════════════════════════════════ */
    {
        id: "danisma",
        task: 5,
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