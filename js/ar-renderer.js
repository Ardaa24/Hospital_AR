/**
 * js/ar-renderer.js
 * AR Navigasyon Three.js Renderer (Sadece Ribbon + Chevron)
 * v2.5 — Ayak izi animasyonlarından arındırılmış temiz sürüm
 */

'use strict';

const ARRenderer = (function() {

    let _arrowTexture    = null;
    let _holoPathMesh    = null;
    let _holoMaterial    = null;

    function _buildArrowTexture() {
        if (_arrowTexture) return _arrowTexture;

        const W = 256;
        const H = 256;

        const canvas = document.createElement('canvas');
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Mavi solid arka plan
        ctx.fillStyle = 'rgba(10, 118, 255, 0.78)';
        ctx.fillRect(0, 0, W, H);

        // Beyaz chevron
        const MX     = Math.round(W * 0.055);
        const TIP_Y  = Math.round(H * 0.16);
        const BASE_Y = Math.round(H * 0.82);
        const ARM_W  = Math.round(W * 0.125);

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.97)';
        ctx.lineWidth   = ARM_W;
        ctx.lineCap     = 'butt';
        ctx.lineJoin    = 'miter';
        ctx.miterLimit  = 25;

        ctx.beginPath();
        ctx.moveTo(MX,       BASE_Y);
        ctx.lineTo(W / 2,    TIP_Y);
        ctx.lineTo(W - MX,   BASE_Y);
        ctx.stroke();
        ctx.restore();

        _arrowTexture = new THREE.CanvasTexture(canvas);
        _arrowTexture.wrapS = THREE.RepeatWrapping;
        _arrowTexture.wrapT = THREE.RepeatWrapping;
        _arrowTexture.needsUpdate = true;
        return _arrowTexture;
    }

    function _buildRibbonGeo(points, width) {
        const geo     = new THREE.BufferGeometry();
        const verts   = [];
        const uvs     = [];
        const indices = [];
        const hw = width / 2;
        const N  = points.length;

        let runLen = 0;
        const arcLens = [0];
        for (let i = 1; i < N; i++) {
            runLen += points[i].distanceTo(points[i - 1]);
            arcLens.push(runLen);
        }

        const TILE_LEN = 1.0;

        for (let i = 0; i < N; i++) {
            const pt   = points[i];
            const next = points[Math.min(i + 1, N - 1)];

            const dir = new THREE.Vector3().subVectors(next, pt);
            if (dir.length() < 1e-6) dir.set(0, 0, -1);
            dir.normalize();

            const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(hw);
            const t = arcLens[i] / TILE_LEN;

            verts.push(
                pt.x - perp.x, pt.y, pt.z - perp.z,
                pt.x + perp.x, pt.y, pt.z + perp.z
            );
            uvs.push(0, t,  1, t);

            if (i < N - 1) {
                const b = i * 2;
                indices.push(b, b + 1, b + 2,  b + 1, b + 3, b + 2);
            }
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    function clearPath(parent) {
        if (_holoPathMesh && parent) {
            parent.remove(_holoPathMesh);
            _holoPathMesh.geometry.dispose();
            if (_holoMaterial) {
                _holoMaterial.dispose();
                _holoMaterial = null;
            }
            _holoPathMesh = null;
        }
    }

    function drawPath(leg, parent) {
        clearPath(parent);

        if (!leg?.path || leg.path.length < 2) return;

        const parsedPath = leg.path.map(pt => {
            const [x, y, z] = (pt.pos || '').split(' ').map(Number);
            return { x: x || 0, y: y || 0, z: z || 0 };
        });

        const startPt = parsedPath[0];
        const pts = parsedPath.map(p => new THREE.Vector3(
            p.x - startPt.x,
            0,
            p.z - startPt.z
        ));

        const curve       = new THREE.CatmullRomCurve3(pts);
        const detail      = Math.max(40, parsedPath.length * 20);
        const curvePoints = curve.getPoints(detail);

        const RIBBON_WIDTH = 1.2;
        const geo = _buildRibbonGeo(curvePoints, RIBBON_WIDTH);

        const tex = _buildArrowTexture();
        tex.offset.set(0, 0);

        _holoMaterial = new THREE.MeshBasicMaterial({
            map:         tex,
            transparent: true,
            opacity:     0.92,
            depthWrite:  false,
            depthTest:   false,
            side:        THREE.DoubleSide,
            blending:    THREE.NormalBlending,
        });

        _holoPathMesh = new THREE.Mesh(geo, _holoMaterial);
        _holoPathMesh.position.y = 0.01; // Zemin parent uzerinden yonetiliyor
        parent.add(_holoPathMesh);
    }

    function updateUniforms(time) {
        if (_holoMaterial?.map) {
            const SCROLL_SPEED = 0.45;
            _holoMaterial.map.offset.y = -(time * 0.001 * SCROLL_SPEED) % 1.0;
        }
    }

    // AR.js tarafindan animasyon loopunda kullaniliyordu, ici bos birakildi (ayak izi animasyonlari kaldirildi)
    function updateAnimations() {}

    // updateGroundY artik gerekmiyor cunku zemin ar.js tarafindan arrowsObj parenti uzerinden guncelleniyor
    function updateGroundY() {}

    return {
        clearPath,
        drawPath,
        updateUniforms,
        updateAnimations,
        updateGroundY
    };
})();
