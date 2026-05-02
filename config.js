// config.js
const NavConfig = {
    "durak1": {
        locationName: "Ana Giriş",
        destinations: {
            "noroloji": {
                name: "Nöroloji Birimi",
                legs: [
                    {
                        id: 1,
                        instruction: "Koridor boyunca dümdüz ilerleyiniz.",
                        color: "#81D4FA",
                        path: [
                            { pos: "0 0.02 -0.7", rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4", rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1", rot: "-90 0 0" },
                            { pos: "0 0.02 -2.8", rot: "-90 0 0" },
                            { pos: "0 0.02 -3.5", rot: "-90 0 0" }
                        ]
                    },
                    {
                        id: 2,
                        instruction: "Sola dönüp ilerleyiniz. Nöroloji karşınızda.",
                        color: "#81D4FA",
                        path: [
                            { pos: "0 0.02 -0.7", rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4", rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1", rot: "-90 0 0" }
                        ]
                    }
                ]
            },
            "engelli_tuvaleti": {
                name: "Engelli Tuvaleti",
                legs: [
                    {
                        id: 1,
                        instruction: "Sağa dönüp koridorun sonuna kadar ilerleyin.",
                        color: "#81D4FA",
                        path: [
                            { pos: "0 0.02 -0.7", rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4", rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1", rot: "-90 0 0" }
                        ]
                    }
                ]
            },
            "laboratuvar": {
                name: "Laboratuvar (-1. Kat)",
                legs: [
                    {
                        id: 1,
                        instruction: "Asansöre doğru dümdüz ilerleyiniz.",
                        color: "#81D4FA",
                        path: [
                            { pos: "0 0.02 -0.7", rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4", rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1", rot: "-90 0 0" }
                        ]
                    },
                    {
                        id: 2,
                        // Kat değişimi için özel yönerge
                        instruction: "Asansörden inip sağa dönünüz ve ilerleyiniz.",
                        specialInstruction: "Asansöre binin ve -1. kata gidin. Asansörden inince sağa dönüp AR'yi başlatın.",
                        color: "#81D4FA",
                        path: [
                            { pos: "0 0.02 -0.7", rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4", rot: "-90 0 0" },
                            { pos: "0 0.02 -2.1", rot: "-90 0 0" }
                        ]
                    }
                ]
            },
            "danisma": {
                name: "Danışma",
                legs: [
                    {
                        id: 1,
                        instruction: "Giriş alanına doğru ilerleyiniz.",
                        color: "#81D4FA",
                        path: [
                            { pos: "0 0.02 -0.7", rot: "-90 0 0" },
                            { pos: "0 0.02 -1.4", rot: "-90 0 0" }
                        ]
                    }
                ]
            }
        }
    }
};

const NavigationState = {
    // Session storage kullanarak site kapandığında sıfırlanmasını sağlıyoruz
    setDestination: (destId) => sessionStorage.setItem('hastane_hedef', destId),
    getDestination: () => sessionStorage.getItem('hastane_hedef'),
    // Tamamlanan rotaları tutmak için
    markCompleted: (destId) => {
        let completed = JSON.parse(sessionStorage.getItem('completed_routes') || '[]');
        if (!completed.includes(destId)) {
            completed.push(destId);
            sessionStorage.setItem('completed_routes', JSON.stringify(completed));
        }
    },
    getCompleted: () => JSON.parse(sessionStorage.getItem('completed_routes') || '[]')
};