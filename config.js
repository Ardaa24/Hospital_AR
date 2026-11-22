/**
 * config.js — Tarsus Devlet Hastanesi AR Navigasyon Sistemi
 *
 * isAvailable: true  → AR navigasyon aktif
 * isAvailable: false → Klinikte bilgi görüntülenir, AR henüz desteklenmiyor
 *
 * leg türleri:
 *   "ar"   → AR kamera açılır, yerdeki oklar çizilir
 *   "info" → Ara adım bilgi ekranı (asansör vb.), "Devam Et" ile geçilir
 *
 * AR ROTALARI (4 Aktif):
 *   1. Nöroloji Polikliniği
 *   2. Engelli Erişim Tuvaleti
 *   3. Laboratuvar Birimi (Asansörlü — farklı kat)
 *   4. Danışma / Bilgilendirme Noktası
 */

/* ─────────────────────────────────────────────────────────────
   AR NAVİGASYON SABİTLERİ
───────────────────────────────────────────────────────────── */
/**
 * STEP_LENGTH_M: Her adımın metre cinsinden uzunluğu.
 * Standat yetişkin adımı ~0.75m. Geliştirici buradan değiştirebilir.
 */
const STEP_LENGTH_M = 0.75;

/* ─────────────────────────────────────────────────────────────
   KAT HARİTASI (js/map/*)
───────────────────────────────────────────────────────────── */
/**
 * Harita modunun zemin çizimi. Koordinatlar bu SVG'nin viewBox birimindedir
 * (Assets/maps/*.png kaynak çizimlerinin 1/4 ölçeği).
 *
 * Rotalardaki harita alanları (AR motoru bunları okumaz, yalnızca harita kullanır):
 *   route.mapDest      → { label, areas: [[[x,y],…],…] }  hedef alan(lar)ı (vurgulanır) ve etiketi
 *   leg.mapPath        → [[x,y],…]  bacağın haritadaki çizgisi; bir önceki bacağın
 *                        bittiği noktadan başlar. Bilgi (asansör) bacağında tek nokta.
 *                        Kullanıcı noktası, AR'da yürünen mesafe oranında bu çizgide ilerler.
 *   leg.mapNote        → Haritası olmayan bacak (ör. −1. kat) için gösterilecek not.
 *   route.map          → { src, width, height, background? }  Rotanın kendi tasarım planı. Yoksa
 *                        HOSPITAL_MAP kullanılır. Bu rotanın mapPath/mapDest koordinatları, kendi
 *                        planının viewBox biriminde olmalıdır.
 *
 * Not: Kaynak haritalar şematiktir, ölçek bacaktan bacağa değişir (≈20–37 birim/m).
 * Bu yüzden ilerleme metre ile değil, bacak içi oranla eşlenir.
 */
const HOSPITAL_MAP = {
    src:    "Assets/maps/zemin-kat.svg",
    width:  2922,
    height: 3414
};

/* ─────────────────────────────────────────────────────────────
   KATEGORİLER
───────────────────────────────────────────────────────────── */
const ROUTE_CATEGORIES = [
    "Poliklinikler",
    "Röntgen ve Tomografi",
    "Laboratuvarlar",
    "Acil ve Müdahale",
    "Danışma ve Hizmetler",
    "Tuvaletler ve Erişim"
];

/* ─────────────────────────────────────────────────────────────
   AR ROTALARI — Aktif (4 adet)
───────────────────────────────────────────────────────────── */
const NAV_ROUTES = [

    /* ══════════════════════════════════════════════════════
       ROTA 1 — Nöroloji Polikliniği (Girişten) |  AR Aktif
    ══════════════════════════════════════════════════════ */
    {
        id:       "noroloji",
        order:    1,
        name:     "Nöroloji Polikliniği",
        shortName: "Nöroloji",
        icon:     "brain",
        category: "Poliklinikler",
        isAvailable: true,

        /* Detay bilgileri */
        block:     "B Blok",
        floor:     "Zemin Kat",
        room:      "Oda 112",
        hours:     "Pzt–Cum  08:00 – 17:00",
        phone: "(0324) 613 47 00",
        accessible: true,
        hasElevator: false,
        desc: "B Blok, Zemin Kat — Oda 112",
        detail: "Nöroloji Polikliniği, beyin ve sinir sistemi hastalıklarının tanı ve tedavisi amacıyla hizmet vermektedir. Hastane ana girişinden başlar.",

      
        legs: [
            {
                type: "ar",
                instruction: "Koridorda dümdüz 4.5 metre ilerleyin ⬆️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -4.5" }],
                mapPath: [[976, 1028], [883, 980]]
            },
            {
                type: "ar",
                instruction: "Dümdüz 4.5 metre daha ilerleyin ⬆️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -4.5" }],
                mapPath: [[883, 980], [766, 991]]
            },
            {
                type: "ar",
                instruction: "Sola dönüp 13.5 metre ilerleyin ⬅️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -13.5" }],
                mapPath: [[766, 991], [701, 1255]]
            }
        ],
        /* Bu rota kendi tasarım planını kullanır; mapPath/mapDest koordinatları bu SVG'nin
           birimindedir (eski zemin-kat.svg'ye göre ×0,96 ölçekli, (−252, −1453) kaydırmalı). */
        map: {
            src:        "Assets/maps/noroloji-map-02.svg",
            width:      1714.29,
            height:     1766.4,
            background: "#B0C6AF"   // Planın dışı, SVG'deki dış alan (yeşil) ile aynı renk
        },
        mapDest: {
            label: "Nöroloji Polikliniği",
            areas: [[[738, 1266], [705, 1325], [704, 1332], [837, 1417], [846, 1420], [887, 1346], [889, 1337], [744, 1266]]]
        }
     },

    /* ══════════════════════════════════════════════════════
       ROTA 2 — Engelli Erişim Tuvaleti (Nöroloji'den) |  AR Aktif
    ══════════════════════════════════════════════════════ */
    {
        id:       "engelli-tuvaleti",
        order:    2,
        name:     "Engelli Erişim Tuvaleti",
        shortName: "Engelli Tuvaleti",
        icon:     "accessibility",
        category: "Tuvaletler ve Erişim",
        isAvailable: true,

        block:     "A Blok",
        floor:     "Zemin Kat",
        room:      "Giriş Yanı",
        hours:     "7/24 Erişim",
        phone:     null,
        accessible: true,
        hasElevator: false,
        desc: "A Blok, Zemin Kat — Giriş Yanı",
        detail: "Engelli erişimine uygun tuvalet birimi. Bu rota Nöroloji Polikliniği'nden başlamaktadır.",

        legs: [
            {
                type: "ar",
                instruction: "Koridorda dümdüz 13.5 metre ilerleyin ⬆️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -13.5" }],
                mapPath: [[989, 2816], [1060, 2544]]
            },
            {
                type: "ar",
                instruction: "Sola dönüp 5.25 metre ilerleyin ⬅️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -5.25" }],
                mapPath: [[1060, 2544], [864, 2540]]
            }
        ],
        mapDest: {
            label: "Engelli Tuvaleti",
            areas: [[[798, 2328], [784, 2352], [771, 2387], [758, 2439], [751, 2485], [791, 2487], [884, 2485], [883, 2465], [871, 2407], [860, 2371], [846, 2339], [839, 2328]]]
        }
    },

    /* ══════════════════════════════════════════════════════
       ROTA 3 — Laboratuvar Birimi (Tuvalet'ten) |  AR Aktif — Asansörlü
    ══════════════════════════════════════════════════════ */
    {
        id:       "laboratuvar",
        order:    3,
        name:     "Laboratuvar Birimi",
        shortName: "Laboratuvar",
        icon:     "flask-conical",
        category: "Laboratuvarlar",
        isAvailable: true,

        block:     "C Blok",
        floor:     "Alt Zemin Kat (−1)",
        room:      "Lab. Koridoru",
        hours:     "Pzt–Cum  07:30 – 17:00",
        phone: "(0324) 613 47 00",
        accessible: true,
        hasElevator: true,
        desc: "C Blok, Alt Zemin Kat (−1) — Asansörlü Erişim",
        detail: "Laboratuvar Birimi. Bu rota Engelli Erişim Tuvaleti'nden başlamaktadır. Erişim için asansör kullanılması gerekmektedir.",

       
        legs: [
            {
                type: "ar",
                instruction: "Koridorda dümdüz 17.25 metre ilerleyin ⬆️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -17.25" }],
                mapPath: [[832, 2545], [1441, 2541]]
            },
            {
                type: "ar",
                instruction: "Sola dönüp 22.5 metre ilerleyin ⬅️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -22.5" }],
                mapPath: [[1441, 2541], [1441, 1875], [1300, 1877]]
            },
            {
                type: "info",
                icon: "arrow-up-down",
                title: "Soldaki Asansöre Binin",
                lines: [
                    "Önünüzdeki solda yer alan asansöre girin.",
                    "Panel üzerinden  −1  tuşuna basın.",
                    "Kapı açılınca asansörden çıkıp düz ilerleyin.",
                    "Hazır olduğunuzda aşağıdaki butonuna basın."
                ],
                mapPath: [[1300, 1877]]
            },
            {
                type: "ar",
                instruction: "Asansörden çıkıp düz 5.25 metre ilerleyin ⬆️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -5.25" }],
                mapNote: "−1. kattasınız. Bu katın haritası henüz yok; okları takip edin."
            }
        ],
        // −1. kat haritası olmadığından zemin katta varış noktası asansörlerdir
        mapDest: {
            label: "Asansör (−1. kat Laboratuvar)",
            areas: [
                [[1259, 1920], [1253, 1921], [1190, 1979], [1191, 1985], [1224, 2021], [1231, 2020], [1294, 1962], [1294, 1958]],
                [[1190, 1844], [1183, 1846], [1121, 1903], [1121, 1908], [1155, 1945], [1161, 1945], [1225, 1886], [1225, 1882]]
            ]
        }
    },

    /* ══════════════════════════════════════════════════════
       ROTA 4 — Danışma Noktası (Laboratuvar'dan) |  AR Aktif
    ══════════════════════════════════════════════════════ */
    {
        id:       "danisma",
        order:    4,
        name:     "Danışma Noktası",
        shortName: "Danışma",
        icon:     "info",
        category: "Danışma ve Hizmetler",
        isAvailable: true,

        block:     "Ana Bina",
        floor:     "Zemin Kat",
        room:      "Giriş Holü",
        hours:     "Pzt–Cum  08:00 – 17:00",
        phone: "(0324) 613 47 00",
        accessible: true,
        hasElevator: true,
        desc: "Ana Bina, Zemin Kat — Giriş Holü",
        detail: "Danışma Noktası. Bu rota Laboratuvar Birimi'nin (-1. Kat) önündeki asansörden başlar; Zemin Kata çıkıp asansörden inince düz 10 adım ilerlenir.",

        // 1 adım ≈ 0.75 m (diğer rotalardaki metrajla aynı ölçek) → 10 adım = 7.5 m
        legs: [
            {
                type: "info",
                icon: "arrow-up-down",
                title: "Asansöre Binin",
                lines: [
                    "Önünüzdeki asansöre girin.",
                    "Panel üzerinden Zemin Kat (0) tuşuna basın.",
                    "Zemin katta asansörden inip navigasyonu başlatın.",
                    "Hazır olduğunuzda aşağıdaki 'AR'yi Başlat' butonuna basın."
                ],
                mapPath: [[1268, 1883]]
            },
            {
                type: "ar",
                instruction: "Asansörden çıkıp düz 10 adım ilerleyin ⬆️",
                path: [{ pos: "0 0 0" }, { pos: "0 0 -7.5" }],
                // AR'daki tek düz adımla aynı: dönüş yok, Danışma yürüyüşün hemen solunda kalır
                mapPath: [[1268, 1883], [1439, 1884]]
            }
        ],
        mapDest: {
            label: "Danışma",
            areas: [[[1308, 1688], [1570, 1688], [1557, 1660], [1544, 1642], [1527, 1625], [1512, 1614], [1491, 1603], [1474, 1597], [1447, 1592], [1422, 1592], [1398, 1596], [1373, 1605], [1355, 1615], [1338, 1628], [1322, 1645], [1308, 1666]]]
        }
    },

    /* ══════════════════════════════════════════════════════
       PASİF ROTALAR — Klinikler
    ══════════════════════════════════════════════════════ */

    /* Poliklinikler */
    {
        id: "acil-servis", order: 99, name: "Acil Servis", shortName: "Acil Servis",
        icon: "ambulance", category: "Acil ve Müdahale", isAvailable: false,
        block: "Ana Bina", floor: "Zemin Kat", room: "Kuzey Giriş", hours: "7/24",
        accessible: true, hasElevator: false,
        desc: "Ana Bina, Zemin Kat — Kuzey Giriş (7/24)",
        detail: "Acil servisimiz 7/24 kesintisiz hizmet vermektedir. Hayati tehlike durumlarında ambulans için 112'yi arayın. Yeşil, sarı ve kırmızı kod sistemine göre triaj uygulanmaktadır.",
        legs: []
    },
    {
        id: "agri-pol", order: 99, name: "Ağrı Polikliniği", shortName: "Ağrı",
        icon: "pill", category: "Poliklinikler", isAvailable: false,
        block: "B Blok", floor: "2. Kat", room: "Oda 215", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: true,
        desc: "B Blok, 2. Kat — Oda 215",
        detail: "Kronik ağrı yönetimi, bel-boyun ağrısı, fibromiyalji ve nöropatik ağrı tedavisi sunulmaktadır. Randevu için MHRS (182) sistemini kullanabilirsiniz.",
        legs: []
    },
    {
        id: "cocuk-sag", order: 99, name: "Çocuk Sağlığı ve Hastalıkları", shortName: "Pediatri",
        icon: "baby", category: "Poliklinikler", isAvailable: false,
        block: "A Blok", floor: "1. Kat", room: "Oda 108", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "A Blok, 1. Kat — Oda 108",
        detail: "0–18 yaş arası çocukların genel sağlık takibi, aşı uygulamaları, büyüme-gelişme değerlendirmesi ve akut hastalık tedavileri gerçekleştirilmektedir.",
        legs: []
    },
    {
        id: "dahiliye", order: 99, name: "İç Hastalıkları Polikliniği", shortName: "Dahiliye",
        icon: "stethoscope", category: "Poliklinikler", isAvailable: false,
        block: "B Blok", floor: "Zemin Kat", room: "Oda 005", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, Zemin Kat — Oda 005",
        detail: "Dahiliye polikliniğimiz; diyabet, hipertansiyon, tiroid hastalıkları, anemi ve genel dahili hastalıklarda kapsamlı tanı ve tedavi hizmeti sunmaktadır.",
        legs: []
    },
    {
        id: "dermatoloji", order: 99, name: "Dermatoloji Polikliniği", shortName: "Cildiye",
        icon: "leaf", category: "Poliklinikler", isAvailable: false,
        block: "A Blok", floor: "2. Kat", room: "Oda 210", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: true,
        desc: "A Blok, 2. Kat — Oda 210",
        detail: "Cilt hastalıkları, egzama, psöriazis, akne, saç dökülmesi, mantar enfeksiyonları ve cilt kanseri taraması konularında uzman hekim desteği sunulmaktadır.",
        legs: []
    },
    {
        id: "genel-cerrahi", order: 99, name: "Genel Cerrahi", shortName: "Genel Cerrahi",
        icon: "scissors", category: "Poliklinikler", isAvailable: false,
        block: "C Blok", floor: "1. Kat", room: "Oda 115", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "C Blok, 1. Kat — Oda 115",
        detail: "Genel Cerrahi biriminde apandisit, fıtık, safra kesesi, kolon ve mide ameliyatları gerçekleştirilmektedir. Poliklinik muayenesi randevu ile yapılmaktadır.",
        legs: []
    },
    {
        id: "fizik-tedavi", order: 99, name: "Fizik Tedavi Polikliniği", shortName: "FTR",
        icon: "accessibility", category: "Poliklinikler", isAvailable: false,
        block: "D Blok", floor: "Zemin Kat", room: "FTR Ünitesi", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "D Blok, Zemin Kat — FTR Ünitesi",
        detail: "Fizik Tedavi ve Rehabilitasyon birimimiz; ortopedik rehabilitasyon, nörolojik rehabilitasyon, ağrı tedavisi ve spor yaralanmaları konusunda kapsamlı fizyoterapi programları sunmaktadır.",
        legs: []
    },
    {
        id: "gogus-pol", order: 99, name: "Göğüs Polikliniği", shortName: "Göğüs Hst.",
        icon: "activity", category: "Poliklinikler", isAvailable: false,
        block: "B Blok", floor: "1. Kat", room: "Oda 118", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, 1. Kat — Oda 118",
        detail: "Astım, KOAH, pnömoni, akciğer nodülleri ve solunum yolu hastalıklarının tanı ve tedavisi gerçekleştirilmektedir. Solunum fonksiyon testi (SFT) birimde uygulanmaktadır.",
        legs: []
    },
    {
        id: "goz-pol", order: 99, name: "Göz Polikliniği", shortName: "Göz",
        icon: "eye", category: "Poliklinikler", isAvailable: false,
        block: "A Blok", floor: "3. Kat", room: "Oda 301", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: true,
        desc: "A Blok, 3. Kat — Oda 301",
        detail: "Göz muayenesi, görme testi, katarakt, glokom, retina hastalıkları ve şaşılık tedavisi sunulmaktadır. Gözlük-lens reçetesi düzenlenmekte, gerekli vakalarda ameliyathane randevusu verilmektedir.",
        legs: []
    },
    {
        id: "kadin-dogum", order: 99, name: "Kadın Hastalıkları ve Doğum", shortName: "Kadın-Doğum",
        icon: "baby", category: "Poliklinikler", isAvailable: false,
        block: "A Blok", floor: "2. Kat", room: "Oda 220", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: true,
        desc: "A Blok, 2. Kat — Oda 220",
        detail: "Kadın sağlığı, gebelik takibi, doğum planlaması, jinekolojik muayene ve ultrasonografi hizmetleri sunulmaktadır. Gebe izlem programına kayıt için poliklinikimize başvurabilirsiniz.",
        legs: []
    },
    {
        id: "kbb", order: 99, name: "Kulak Burun Boğaz", shortName: "KBB",
        icon: "ear", category: "Poliklinikler", isAvailable: false,
        block: "B Blok", floor: "Zemin Kat", room: "Oda 010", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, Zemin Kat — Oda 010",
        detail: "İşitme kaybı, sinüzit, bademcik-adenoid problemleri, baş dönmesi ve ses kısıklığı konularında tanı ve tedavi hizmeti verilmektedir. Odyoloji testi cihazlarımız poliklinik bünyesindedir.",
        legs: []
    },
    {
        id: "kardiyoloji", order: 99, name: "Kardiyoloji Polikliniği", shortName: "Kardiyoloji",
        icon: "heart", category: "Poliklinikler", isAvailable: false,
        block: "A Blok", floor: "2. Kat", room: "Oda 205", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: true,
        desc: "A Blok, 2. Kat — Oda 205",
        detail: "Kalp ve damar hastalıklarının tanı ve tedavisi gerçekleştirilmektedir. EKG, ekokardiyografi, efor testi ve Holter monitörizasyonu poliklinik bünyesinde uygulanmaktadır.",
        legs: []
    },
    {
        id: "dis-pol", order: 99, name: "Diş Hastalıkları", shortName: "Diş",
        icon: "plus-square", category: "Poliklinikler", isAvailable: false,
        block: "Ek Bina", floor: "Zemin Kat", room: "Diş Kliniği", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "Ek Bina, Zemin Kat — Diş Kliniği",
        detail: "Genel diş muayenesi, dolgu, kanal tedavisi, çekim, protez ve diş temizliği hizmetleri sunulmaktadır. Çocuk diş tedavisi için özel muayene odaları mevcuttur.",
        legs: []
    },
    {
        id: "uroloji", order: 99, name: "Üroloji Polikliniği", shortName: "Üroloji",
        icon: "activity", category: "Poliklinikler", isAvailable: false,
        block: "C Blok", floor: "1. Kat", room: "Oda 120", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "C Blok, 1. Kat — Oda 120",
        detail: "Böbrek taşı, prostat hastalıkları, mesane sorunları, idrar yolu enfeksiyonları ve ürolojik cerrahi konularında uzman hekim muayenesi gerçekleştirilmektedir.",
        legs: []
    },
    {
        id: "ortopedi", order: 99, name: "Ortopedi Polikliniği", shortName: "Ortopedi",
        icon: "bone", category: "Poliklinikler", isAvailable: false,
        block: "C Blok", floor: "2. Kat", room: "Oda 215", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: true,
        desc: "C Blok, 2. Kat — Oda 215",
        detail: "Kırık-çıkık tedavisi, eklem hastalıkları, omurga bozuklukları, spor yaralanmaları ve ortopedik cerrahi konularında kapsamlı hizmet sunulmaktadır.",
        legs: []
    },
    {
        id: "psikiyatri", order: 99, name: "Psikiyatri Polikliniği", shortName: "Psikiyatri",
        icon: "user", category: "Poliklinikler", isAvailable: false,
        block: "D Blok", floor: "1. Kat", room: "Oda 110", hours: "Pzt–Cum  09:00–17:00",
        accessible: true, hasElevator: false,
        desc: "D Blok, 1. Kat — Oda 110",
        detail: "Depresyon, anksiyete, bipolar bozukluk, uyku sorunları ve diğer ruh sağlığı rahatsızlıklarında tanı ve tedavi hizmeti verilmektedir. Gizlilik ve hasta mahremiyeti ön planda tutulmaktadır.",
        legs: []
    },
    {
        id: "trsm", order: 99, name: "Toplum Ruh Sağlığı Birimi", shortName: "TRSM",
        icon: "users", category: "Danışma ve Hizmetler", isAvailable: false,
        block: "D Blok", floor: "1. Kat", room: "TRSM Birimi", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "D Blok, 1. Kat — TRSM Birimi",
        detail: "Toplum Ruh Sağlığı Birimi, kronik ruh sağlığı hastaları için toplum temelli rehabilitasyon, sosyal beceri eğitimi ve psikososyal destek programları yürütmektedir.",
        legs: []
    },
    {
        id: "anestezi", order: 99, name: "Anesteziyoloji ve Reanimasyon", shortName: "Anestezi",
        icon: "syringe", category: "Acil ve Müdahale", isAvailable: false,
        block: "C Blok", floor: "Zemin Kat", room: "Ameliyathane Kompleksi", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "C Blok, Zemin Kat — Ameliyathane Kompleksi",
        detail: "Ameliyat öncesi anestezi değerlendirmesi ve preoperatif hazırlık için randevulu muayene yapılmaktadır. Ameliyat planlanmış hastalar için ameliyat gününden önce vizit önerilmektedir.",
        legs: []
    },
    {
        id: "enfeksiyon", order: 99, name: "Enfeksiyon Polikliniği", shortName: "Enfeksiyon",
        icon: "bug", category: "Poliklinikler", isAvailable: false,
        block: "B Blok", floor: "1. Kat", room: "Oda 125", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, 1. Kat — Oda 125",
        detail: "Bulaşıcı hastalıklar, HIV/AIDS takibi, hepatit, tüberküloz, seyahat öncesi aşı danışmanlığı ve kronik enfeksiyon tedavileri konusunda uzman hekim hizmeti verilmektedir.",
        legs: []
    },

    /* ── Röntgen ve Tomografi ── */
    {
        id: "goruntuleme", order: 99, name: "Görüntüleme Merkezi", shortName: "Görüntüleme",
        icon: "radio", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "B Blok", floor: "Zemin Kat", room: "Radyoloji Koridoru", hours: "Pzt–Cmt  07:30–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, Zemin Kat — Radyoloji Koridoru",
        detail: "Röntgen, ultrasonografi, mamografi, kemik dansitometrisi ve bilgisayarlı tomografi hizmetleri sunulmaktadır. İstek belgesi (sevk/reçete) ile başvurulması gerekmektedir.",
        legs: []
    },
    {
        id: "usg", order: 99, name: "USG (Ultrasonografi)", shortName: "USG",
        icon: "volume-2", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "B Blok", floor: "Zemin Kat", room: "USG Odaları", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, Zemin Kat — USG Odaları",
        detail: "Karın, pelvis, tiroid, meme, testis ve kas-iskelet sistemi ultrasonografisi uygulanmaktadır. İşlem öncesi hazırlık gerektiren bölgeler için lütfen randevu onay mesajınızdaki talimatları inceleyin.",
        legs: []
    },
    {
        id: "mamografi", order: 99, name: "Mamografi", shortName: "Mamografi",
        icon: "activity", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "B Blok", floor: "Zemin Kat", room: "Mamografi Odası", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, Zemin Kat — Mamografi Odası",
        detail: "Dijital mamografi ile meme kanseri erken tanısı yapılmaktadır. 40 yaş üstü kadınlar için yıllık mamografi çekilmesi önerilmektedir. İşlem yaklaşık 15–20 dakika sürmektedir.",
        legs: []
    },
    {
        id: "bt", order: 99, name: "Bilgisayarlı Tomografi (BT)", shortName: "BT / CT",
        icon: "monitor", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "B Blok", floor: "Zemin Kat", room: "BT Odası", hours: "Pzt–Cmt  07:30–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, Zemin Kat — BT Odası",
        detail: "Kontrastlı ve kontrastsız BT çekimi gerçekleştirilmektedir. Kontrast madde uygulanacak hastalarda allerji ve böbrek fonksiyon testi bilgilerinin ibraz edilmesi gerekmektedir.",
        legs: []
    },
    {
        id: "emg", order: 99, name: "EMG (Elektromiyografi)", shortName: "EMG",
        icon: "zap", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "B Blok", floor: "1. Kat", room: "EMG Odası", hours: "Pzt–Cum  09:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, 1. Kat — EMG Odası",
        detail: "Sinir iletim çalışması ve kas-sinir elektrofizyolojisi testleri uygulanmaktadır. Tünel sendromu, sinir sıkışması ve polinöropati değerlendirmesinde kullanılmaktadır.",
        legs: []
    },
    {
        id: "eeg", order: 99, name: "EEG (Elektroensefalografi)", shortName: "EEG",
        icon: "dna", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "B Blok", floor: "1. Kat", room: "EEG Odası", hours: "Pzt–Cum  09:00–17:00",
        accessible: true, hasElevator: false,
        desc: "B Blok, 1. Kat — EEG Odası",
        detail: "Beyin biyoelektrik aktivitesinin kaydedildiği EEG testi epilepsi, bilinç bozuklukları ve uyku hastalıklarının değerlendirilmesinde uygulanmaktadır. İşlem öncesi saçların temiz olması önerilir.",
        legs: []
    },
    {
        id: "pano-dis-rontgen", order: 99, name: "Panoramik Diş Röntgeni", shortName: "Pano Röntgen",
        icon: "plus-square", category: "Röntgen ve Tomografi", isAvailable: false,
        block: "Ek Bina", floor: "Zemin Kat", room: "Diş Röntgen", hours: "Pzt–Cum  08:00–17:00",
        accessible: true, hasElevator: false,
        desc: "Ek Bina, Zemin Kat — Diş Röntgen",
        detail: "Tüm ağız panoramik röntgeni, diş implantı planlaması, çene kemiği değerlendirmesi ve ortodontik tetkik amacıyla çekilmektedir. İşlem 5 dakikadan kısa sürmektedir.",
        legs: []
    },

    /* ── Laboratuvarlar ── */
    {
        id: "mikrobiyoloji-lab", order: 99, name: "Mikrobiyoloji Laboratuvarı", shortName: "Mikrobiyoloji Lab.",
        icon: "circle-dashed", category: "Laboratuvarlar", isAvailable: false,
        block: "C Blok", floor: "Alt Zemin Kat (−1)", room: "Mikrobiyoloji", hours: "Pzt–Cum  07:30–17:00",
        accessible: true, hasElevator: true,
        desc: "C Blok, Alt Zemin Kat (−1) — Asansörlü Erişim",
        detail: "Kültür ve antibiyogram, idrar kültürü, boğaz kültürü, dışkı parazitolojisi, mantar kültürü ve serolojik testler gerçekleştirilmektedir. Sonuçlar e-Nabız sisteminde görüntülenebilir.",
        legs: []
    },
    {
        id: "biyokimya-lab", order: 99, name: "Biyokimya Laboratuvarı", shortName: "Biyokimya Lab.",
        icon: "test-tube", category: "Laboratuvarlar", isAvailable: false,
        block: "C Blok", floor: "Alt Zemin Kat (−1)", room: "Biyokimya", hours: "Pzt–Cmt  07:00–18:00",
        accessible: true, hasElevator: true,
        desc: "C Blok, Alt Zemin Kat (−1) — Asansörlü Erişim",
        detail: "Kan biyokimyası, hormon testleri, lipid profili, tam kan sayımı, koagülasyon testleri ve idrar analizi uygulanmaktadır. Aç karnına kan alımı gerektiren testler için lütfen ön bilgilendirme alın.",
        legs: []
    }

];
