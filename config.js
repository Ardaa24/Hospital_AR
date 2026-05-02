/**
 * ============================================================
 *  HASTANE AR NAVİGASYON — config.js
 *  Tüm rota verileri ve durak tanımları bu dosyada tutulur.
 *  Yeni rota eklemek için destinations nesnesine yeni bir anahtar ekleyin.
 * ============================================================
 */

const NavConfig = {

    /**
     * durak1: Kullanıcının navigasyona başladığı fiziksel konum.
     * Her durak kendi destinations haritasını taşır.
     */
    "durak1": {
        locationName: "Ana Giriş / Resepsiyon",

        destinations: {

            /**
             * ──────────────────────────────────────────────
             *  HEDEF: NÖROLOJİ
             *  2 bacaklı rota — toplam ~5.6 metre
             * ──────────────────────────────────────────────
             */
            "noroloji": {
                name: "Nöroloji Polikliniği",
                icon: "🧠",
                description: "B Blok, 2. Kat — Oda 214",

                legs: [
                    {
                        id: 1,
                        // Kullanıcıya gösterilen sesli/yazılı talimat
                        instruction: "Dümdüz 3 Adım İlerleyiniz ⬆️",
                        audioText: "Dümdüz üç adım ilerleyiniz.",
                        color: "#81D4FA",

                        /**
                         * path: AR oklarının 3D koordinatları.
                         * pos → "x y z"  (metre cinsinden, kamera merkezi 0,0,0)
                         * rot → "-90 0 0" zeminde yatay ok için standart rotasyon
                         * Her 0.7 birim ≈ 1 orta boy adım (~70 cm)
                         */
                        path: [
                            { pos: "0 0.02 -0.7",  rot: "-90 0 0" }, // 1. adım
                            { pos: "0 0.02 -1.4",  rot: "-90 0 0" }, // 2. adım
                            { pos: "0 0.02 -2.1",  rot: "-90 0 0" }  // 3. adım → viraja gel
                        ]
                    },
                    {
                        id: 2,
                        instruction: "Sola Dön ve 5 Adım İlerle ⬅️",
                        audioText: "Sola dönünüz ve beş adım ilerleyiniz.",
                        color: "#81D4FA",

                        path: [
                            { pos: "0 0.02 -0.7",  rot: "-90 0 0" }, // 1. adım
                            { pos: "0 0.02 -1.4",  rot: "-90 0 0" }, // 2. adım
                            { pos: "0 0.02 -2.1",  rot: "-90 0 0" }, // 3. adım
                            { pos: "0 0.02 -2.8",  rot: "-90 0 0" }, // 4. adım
                            { pos: "0 0.02 -3.5",  rot: "-90 0 0" }  // 5. adım → hedef
                        ]
                    }
                ]
            },

            /**
             * ──────────────────────────────────────────────
             *  HEDEF: ACİL SERVİS
             *  Tek bacaklı kısa rota — ~2.1 metre
             * ──────────────────────────────────────────────
             */
            "acil": {
                name: "Acil Servis",
                icon: "🚨",
                description: "Zemin Kat — Güney Kanat",

                legs: [
                    {
                        id: 1,
                        instruction: "Dümdüz 3 Adım İlerleyiniz ⬆️",
                        audioText: "Acil servise gitmek için dümdüz üç adım ilerleyiniz.",
                        color: "#EF9A9A", // Kırmızımsı — acil
                        path: [
                            { pos: "0 0.02 -0.7",  rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4",  rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1",  rot: "-90 0 0" }
                        ]
                    }
                ]
            },

            /**
             * ──────────────────────────────────────────────
             *  HEDEF: ECZANE
             *  2 bacaklı rota — ~4.9 metre
             * ──────────────────────────────────────────────
             */
            "eczane": {
                name: "Eczane",
                icon: "💊",
                description: "Zemin Kat — A Blok",

                legs: [
                    {
                        id: 1,
                        instruction: "Sağa Dön ve 2 Adım İlerle ➡️",
                        audioText: "Sağa dönünüz ve iki adım ilerleyiniz.",
                        color: "#A5D6A7", // Yeşilimsi — eczane
                        path: [
                            { pos: "0 0.02 -0.7",  rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4",  rot: "-90 0 0" }
                        ]
                    },
                    {
                        id: 2,
                        instruction: "Dümdüz 5 Adım İlerleyiniz ⬆️",
                        audioText: "Dümdüz beş adım ilerleyiniz. Eczane solunuzda olacak.",
                        color: "#A5D6A7",
                        path: [
                            { pos: "0 0.02 -0.7",  rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4",  rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1",  rot: "-90 0 0" },
                            { pos: "0 0.02 -2.8",  rot: "-90 0 0" },
                            { pos: "0 0.02 -3.5",  rot: "-90 0 0" }
                        ]
                    }
                ]
            }
        }
    }
};

/**
 * NavigationState
 * Sayfalar arası (index → ar) hedef bilgisini taşır.
 * URL parametresi önceliklidir; localStorage yedek olarak kullanılır.
 */
const NavigationState = {
    setDestination: (destId) => {
        try { localStorage.setItem('hastane_hedef', destId); } catch (e) {}
    },
    getDestination: () => {
        try { return localStorage.getItem('hastane_hedef'); } catch (e) { return null; }
    },
    clearDestination: () => {
        try { localStorage.removeItem('hastane_hedef'); } catch (e) {}
    }
};