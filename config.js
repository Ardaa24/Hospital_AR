/**
 * config.js — Hastane AR Navigasyon Rota Verisi
 *
 * Her hedef "legs" dizisi içerir.
 * Her leg = bir koridorun tamamı.
 * Leg bitince kullanıcı fiziksel olarak döner, AR yeniden başlar.
 *
 * path içindeki her nokta:
 *   pos: "x y z"  → x/z yatay düzlem
 *   Her ~0.7 birim ≈ 1 adım (~70 cm)
 */
const NavConfig = {

    "noroloji": {
        name: "Nöroloji Polikliniği",
        icon: "🧠",
        legs: [
            {
                instruction: "Dümdüz 3 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            },
            {
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

    "acil": {
        name: "Acil Servis",
        icon: "🚨",
        legs: [
            {
                instruction: "Sağa dönüp 4 adım ilerleyin ➡️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" },
                    { pos: "0 0 -2.8" }
                ]
            },
            {
                instruction: "Dümdüz 3 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" }
                ]
            }
        ]
    },

    "eczane": {
        name: "Eczane",
        icon: "💊",
        legs: [
            {
                instruction: "Dümdüz 2 adım ilerleyin ⬆️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" }
                ]
            },
            {
                instruction: "Sola dönüp 4 adım ilerleyin ⬅️",
                path: [
                    { pos: "0 0 -0.7" },
                    { pos: "0 0 -1.4" },
                    { pos: "0 0 -2.1" },
                    { pos: "0 0 -2.8" }
                ]
            }
        ]
    }
};