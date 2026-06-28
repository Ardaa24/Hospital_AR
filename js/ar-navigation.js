/**
 * js/ar-navigation.js
 * AR Navigasyon Mesafe, İlerleme ve Dönüş Uyarı Mantığı
 */

'use strict';

const ARNavigation = (function() {
    const TURN_WARN_SHOW_DIST = 2.5;
    const TURN_WARN_HIDE_DIST = 3.2;
    const TURN_WARN_MIN_DIST  = 0.30;
    const TURN_CONFIRM_MS     = 400;

    const TURN_KEYWORDS_LEFT  = ['sola'];
    const TURN_KEYWORDS_RIGHT = ['sağa'];

    let _turnState = 'hidden'; 
    let _turnCandidateData = null;
    let _turnStateTime = 0;

    const AR_SCALE_FACTOR = 0.625;

    function _parsePos(pt) {
        if (!pt?.pos) return { x: 0, y: 0, z: 0 };
        const [x, y, z] = pt.pos.split(' ').map(Number);
        return { 
            x: (x || 0) * AR_SCALE_FACTOR, 
            y: (y || 0) * AR_SCALE_FACTOR, 
            z: (z || 0) * AR_SCALE_FACTOR 
        };
    }

    function calcLegDistance(path) {
        if (!path || path.length < 2) return 0;
        let dist = 0;
        for (let i = 1; i < path.length; i++) {
            const a = _parsePos(path[i - 1]);
            const b = _parsePos(path[i]);
            dist += Math.hypot(b.x - a.x, b.z - a.z);
        }
        return dist;
    }

    function getProgress(camPos, pathPoints) {
        let closestDist = Infinity;
        let coveredUpTo = 0;
        let runningLen  = 0;

        const parsed = pathPoints.map(_parsePos);

        for (let i = 1; i < parsed.length; i++) {
            const a = parsed[i - 1];
            const b = parsed[i];
            const segLen = Math.hypot(b.x - a.x, b.z - a.z);
            const segLen2 = segLen * segLen + 1e-10;

            const t = Math.max(0, Math.min(1,
                ((camPos.x - a.x) * (b.x - a.x) + (camPos.z - a.z) * (b.z - a.z)) / segLen2
            ));

            const cx = a.x + t * (b.x - a.x);
            const cz = a.z + t * (b.z - a.z);
            const d  = Math.hypot(camPos.x - cx, camPos.z - cz);

            if (d < closestDist) {
                closestDist = d;
                coveredUpTo = runningLen + t * segLen;
            }
            runningLen += segLen;
        }
        return coveredUpTo;
    }

    function handleTurnWarning(distToTurn, curLeg, nextLeg) {
        const turnOverlay = document.getElementById('ar-turn');
        const turnIcon = document.getElementById('ar-turn-icon');
        const turnDist = document.getElementById('ar-turn-dist');
        const now = performance.now();

        if (distToTurn < TURN_WARN_MIN_DIST) {
            turnOverlay.classList.remove('visible');
            _turnState = 'hidden';
            return;
        }

        if (_turnState === 'hidden' && distToTurn < TURN_WARN_SHOW_DIST) {
            if (nextLeg?.instruction && nextLeg.type !== 'info') {
                const ins = nextLeg.instruction.toLowerCase();
                const isLeft = TURN_KEYWORDS_LEFT.some(k => ins.includes(k));
                const isRight = TURN_KEYWORDS_RIGHT.some(k => ins.includes(k));

                if (isLeft || isRight) {
                    _turnCandidateData = {
                        icon: isLeft ? 'corner-down-left' : 'corner-down-right',
                        text: isLeft ? 'Sola Dönün' : 'Sağa Dönün'
                    };
                    _turnState = 'evaluating_show';
                    _turnStateTime = now;
                }
            }
        } else if (_turnState === 'evaluating_show') {
            if (distToTurn > TURN_WARN_SHOW_DIST + 0.2) {
                _turnState = 'hidden';
            } else if (now - _turnStateTime > TURN_CONFIRM_MS) {
                turnIcon.innerHTML = `<i data-lucide="${_turnCandidateData.icon}"></i>`;
                if (window.lucide) lucide.createIcons({ root: turnIcon });
                turnOverlay.classList.add('visible');
                _turnState = 'visible';
            }
        } else if (_turnState === 'visible') {
            if (distToTurn > TURN_WARN_HIDE_DIST) {
                _turnState = 'evaluating_hide';
                _turnStateTime = now;
            } else {
                turnDist.textContent = `${Math.max(1, Math.round(distToTurn))}m`;
            }
        } else if (_turnState === 'evaluating_hide') {
            if (distToTurn < TURN_WARN_HIDE_DIST - 0.2) {
                _turnState = 'visible';
            } else if (now - _turnStateTime > TURN_CONFIRM_MS) {
                turnOverlay.classList.remove('visible');
                _turnState = 'hidden';
            }
        }
    }

    function updateHUD(remain) {
        document.getElementById('ar-dist').textContent = remain < 1 ? '<1m' : `${Math.round(remain)}m`;
        document.getElementById('ar-nc-label').textContent = `${Math.round(remain)}m kaldı`;
        const estSec = Math.ceil(remain * 1.5);
        document.getElementById('ar-time').textContent = estSec >= 60 ? `${Math.ceil(estSec / 60)}dk` : `${estSec}sn`;
    }

    function reset() {
        _turnState = 'hidden';
        _turnCandidateData = null;
        document.getElementById('ar-turn')?.classList.remove('visible');
    }

    return {
        calcLegDistance,
        getProgress,
        handleTurnWarning,
        updateHUD,
        reset
    };
})();
