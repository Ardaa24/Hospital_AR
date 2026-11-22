/**
 * globals.d.ts — Harita modülünün okuduğu klasik betik global'leri (yalnızca tip denetimi için).
 * Kaynaklar: router.js, ar.js, config.js. Tarayıcı bu dosyayı yüklemez.
 */
declare const AppState: {
    activeRoute: any;
    arLegs: any[];
    legIdx: number;
    arActive: boolean;
};
declare function getCurrentLegProgress(): { total: number; covered: number; remaining: number } | null;
declare function _calcLegDistance(path: any[]): number;
declare function formatLegText(text: string): string;
declare const HOSPITAL_MAP: { src: string; width: number; height: number; background?: string };
declare function arSetMapArrival(arrived: boolean): void;
declare function arRealignLeg(opts: { walkedM?: number; headingDeg?: number | null }): boolean;
declare function onArrived(): void;
declare function isAutoFinishEnabled(): boolean;
