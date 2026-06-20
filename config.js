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
       ROTA 1 — Nöroloji Polikliniği  |  AR Aktif
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
        floor:     "1. Kat",
        room:      "Oda 112",
        hours:     "Pzt–Cum  08:00 – 17:00",
        phone:     "0324 613 60 00 (Dahili 112)",
        accessible: true,
        hasElevator: false,
        desc: "B Blok, 1. Kat — Oda 112",
        detail: "Nöroloji Polikliniği, beyin ve sinir sistemi hastalıklarının tanı ve tedavisi amacıyla hizmet vermektedir. Baş ağrısı, epilepsi, inme, MS ve hareket bozuklukları gibi durumlarda uzman hekimlerimiz ile randevu alabilirsiniz. Randevu için MHRS (182) veya e-Devlet üzerinden başvurabilirsiniz.",

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

    /* ══════════════════════════════════════════════════════
       ROTA 2 — Engelli Erişim Tuvaleti  |  AR Aktif
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
        detail: "Engelli erişimine uygun tuvalet birimi, tekerlekli sandalye kullananlar ve hareket kısıtlılığı olan bireyler için tasarlanmıştır. Geniş kapı açıklığı (≥ 90 cm), tutunma barları, acil çağrı butonu ve yeterli manevra alanına sahiptir. A Blok ana girişinin hemen yanında yer almaktadır.",

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
                instruction: "Dümdüz 3 metre ilerleyin — Tuvalet girişine ulaştınız ⬆️",
                path: [
                    { pos: "0 0 -1" },
                    { pos: "0 0 -2" },
                    { pos: "0 0 -3" }
                ]
            }
        ]
    },

    /* ══════════════════════════════════════════════════════
       ROTA 3 — Laboratuvar Birimi  |  AR Aktif — Asansörlü
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
        hours:     "Pzt–Cum  07:30 – 17:00  |  Cmt  08:00 – 13:00",
        phone:     "0324 613 60 00 (Dahili 340)",
        accessible: true,
        hasElevator: true,
        desc: "C Blok, Alt Zemin Kat (−1) — Asansörlü Erişim",
        detail: "Laboratuvar Birimi, kan tahlili, idrar tetkiki, mikrobiyoloji ve biyokimya analizlerini gerçekleştirmektedir. Alt zemin katta yer alır; erişim için asansör kullanılması gerekmektedir. Numune verme için sıra numaranızı girişteki dispenserdan alabilirsiniz. Aç karnına kan alımı için sabah randevusu önerilir.",

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
                icon: "arrow-up-down",
                title: "Asansöre Binin",
                lines: [
                    "Önünüzdeki asansöre girin.",
                    "Panel üzerinden  −1  tuşuna basın.",
                    "Kapı açılınca asansörden çıkıp sağa dönün.",
                    "Hazır olduğunuzda aşağıdaki 'AR'yi Başlat' butonuna basın."
                ]
            },
            {
                type: "ar",
                instruction: "Asansörden çıkıp düz 4 metre ilerleyin ⬆️",
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

    /* ══════════════════════════════════════════════════════
       ROTA 4 — Danışma / Bilgilendirme Noktası  |  AR Aktif
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
        room:      "Ana Giriş Karşısı",
        hours:     "Pzt–Cum  08:00 – 17:00",
        phone:     "0324 613 60 00",
        accessible: true,
        hasElevator: false,
        desc: "Ana Bina, Zemin Kat — Giriş Holü",
        detail: "Danışma ve Bilgilendirme Noktası, hastanenin tüm birimleri hakkında yönlendirme, randevu, sigorta ve genel hasta hizmetleri konusunda destek sağlamaktadır. Görevlilerimiz Türkçe, İngilizce ve Arapça dil desteği sunabilmektedir. Tekerlekli sandalye talebinde bu noktadan yararlanabilirsiniz.",

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
        icon: "wheelchair", category: "Poliklinikler", isAvailable: false,
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