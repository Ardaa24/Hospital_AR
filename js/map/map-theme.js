// @ts-check
/**
 * map-theme.js — Harita renkleri ve boyutları (tek yer).
 * Google Haritalar iç mekân dilinden: sade gri zemin, beyaz yürünebilir alan,
 * kalın mavi rota, geçilen yol gri. Marka mavisi (#0055A5) hedef vurgusunda kullanılır.
 * Boyutlar ekran pikselidir; çizimde ölçeğe bölünerek sabit kalınlıkta görünür.
 */
export const MAP_THEME = Object.freeze({
    background:   '#DADDE1',   // Bina dışı / harita kenarı
    floor:        '#FFFFFF',   // Yürünebilir alan (koridor, hol)
    outside:      '#DADDE1',
    stairs:       '#F1EEE6',
    room:         '#ECEEF1',
    roomStroke:   '#CDD1D6',
    roomStrokePx: 1,
    line:         '#B9BEC5',

    destFill:     'rgba(0, 85, 165, 0.20)',
    destStroke:   '#0055A5',
    destStrokePx: 2.5,

    routeCasing:   '#FFFFFF',
    routeCasingPx: 15,
    routeAhead:    '#1A73E8',
    routeAheadPx:  9,
    routePassed:   '#A8AEB6',
    routePassedPx: 9,

    turnArrow:       '#FFFFFF',
    turnArrowStroke: '#0B4FB3',
    turnArrowPx:     16,       // Dönüş okunun yarı boyu
    turnArrowLinePx: 2.5,

    /** Ekran genişliğine kaç harita birimi sığsın (sabit yakınlık) */
    unitsAcross:   520,
    /** Kullanıcı noktasının dikey konumu (0 üst – 1 alt): önde daha çok yol görünür */
    anchorY:       0.62
});
