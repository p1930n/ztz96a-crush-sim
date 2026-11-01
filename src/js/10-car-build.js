/* ---------- the car: a lofted saloon body, glasshouse, cabin, wheels ---------- */
// Length runs along z (front at +z), width along x. The body and the glasshouse are each one smooth surface,
// lofted through cross-sections, so they bend and crease as one skin when crushed; the faces are split into paint,
// black trim and glass by where they sit (pillars, sills, bumper valances, window openings).
const carChrome = new THREE.MeshStandardMaterial({ color: lin('#c9ccce'), roughness: 0.16, metalness: 1 });
const carAlloy = new THREE.MeshStandardMaterial({ color: lin('#a9adb1'), roughness: 0.32, metalness: 0.9 });
const carPlate = new THREE.MeshStandardMaterial({ color: lin('#e4e4de'), roughness: 0.5, metalness: 0.2 });
const carTrim = new THREE.MeshStandardMaterial({ color: lin('#161718'), roughness: 0.62, metalness: 0.05, vertexColors: true, side: THREE.DoubleSide });
const carLiner = new THREE.MeshStandardMaterial({ color: lin('#0d0d0d'), roughness: 0.95, side: THREE.DoubleSide });
const carCloth = new THREE.MeshStandardMaterial({ color: lin('#2c2d2f'), roughness: 1 });
const carTyre = new THREE.MeshStandardMaterial({ color: lin('#1b1b1b'), roughness: 0.88, side: THREE.DoubleSide, vertexColors: true });
const carDisc = new THREE.MeshStandardMaterial({ color: lin('#4a4846'), roughness: 0.5, metalness: 0.8 });
const carLamp = new THREE.MeshStandardMaterial({ color: lin('#e9eef0'), roughness: 0.14, metalness: 0.55, emissive: lin('#1c1f20') });
const carTail = new THREE.MeshStandardMaterial({ color: lin('#6a0b08'), roughness: 0.12, metalness: 0.3, emissive: lin('#2a0302') });
const carEngine = new THREE.MeshStandardMaterial({ color: lin('#3a3c3e'), roughness: 0.58, metalness: 0.7 });
const carEngineTop = new THREE.MeshStandardMaterial({ color: lin('#17181a'), roughness: 0.45, metalness: 0.5 });
const carRad = new THREE.MeshStandardMaterial({ color: lin('#55585a'), roughness: 0.5, metalness: 0.8 });
const carSeam = new THREE.MeshStandardMaterial({ color: lin('#0b0b0b'), roughness: 0.8 });
const carOil = new THREE.MeshBasicMaterial({ color: lin('#0a0907'), transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
const furTex = (() => {             // short pile: thousands of little strokes, used as both colour and bump
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 256, 256); g.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, a = rand(0.9, 2.2), l = rand(3, 8), v = Math.floor(rand(150, 255));
    g.strokeStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 4); return t;
})();
const furMat = hex => new THREE.MeshStandardMaterial({ color: lin(hex), map: furTex, bumpMap: furTex, bumpScale: 0.012, roughness: 1, envMapIntensity: 0.5 });
const plushFur = [furMat('#9a6636'), furMat('#d8cdb8')], plushPale = [furMat('#d9b98c'), furMat('#f1e9d8')];
const plushEye = new THREE.MeshStandardMaterial({ color: lin('#0d0b0a'), roughness: 0.18, metalness: 0.2 });
const plushBow = [new THREE.MeshStandardMaterial({ color: lin('#a3232a'), roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: lin('#27518f'), roughness: 0.7 })];
// spheres joined into one mesh, with shared vertices so a squashed bear stays smooth
function blobs(parts) {
  const pos = [], uv = [], idx = [];
  for (const [r, sx, sy, sz, x, y, z] of parts) {
    const g = new THREE.SphereGeometry(r, 18, 14).scale(sx, sy, sz).translate(x, y, z), o = pos.length / 3;
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); for (const i of g.index.array) idx.push(i + o);
    g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); m.setIndex(idx); m.computeVertexNormals();
  return m;
}
const CAR_COLORS = ['#8b8f93', '#5d6266', '#6b1d1a', '#1f3350', '#2f3a30', '#a7a9aa', '#3a3b3e'];   // silver, gunmetal and the dark colours of old saloons
const crackTex = (() => {          // laminated glass after a hit: radial cracks round two impact points, rings between
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.fillStyle = '#26323a'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(225,232,236,0.75)'; g.lineCap = 'round';
  for (const [cx, cy] of [[170, 260], [360, 210]]) {
    for (let k = 0; k < 22; k++) {
      let a = k / 22 * Math.PI * 2 + Math.random() * 0.2, x = cx, y = cy;
      g.lineWidth = 1 + Math.random() * 1.4; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 14; s++) { a += (Math.random() - 0.5) * 0.35; x += Math.cos(a) * 18; y += Math.sin(a) * 18; g.lineTo(x, y); }
      g.stroke();
    }
    for (let r = 14; r < 200; r *= 1.45) {
      g.lineWidth = 0.8; g.beginPath();
      for (let k = 0; k <= 40; k++) { const a = k / 40 * Math.PI * 2, rr = r * (0.85 + Math.random() * 0.3); g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
})();

function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let a = x - xi, b = y - yi, c = z - zi;
  a = a * a * (3 - 2 * a); b = b * b * (3 - 2 * b); c = c * c * (3 - 2 * c);
  const L = (p, q, t) => p + (q - p) * t, H = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return L(L(L(H(0, 0, 0), H(1, 0, 0), a), L(H(0, 1, 0), H(1, 1, 0), a), b), L(L(H(0, 0, 1), H(1, 0, 1), a), L(H(0, 1, 1), H(1, 1, 1), a), b), c);
}
const crumple = (x, y, z, o) => 2 * (0.65 * vnoise(x * 6 + o, y * 6, z * 6) + 0.35 * vnoise(x * 15, y * 15 + o, z * 15)) - 1;
const crazeTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#7d878b'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(240,244,246,0.8)'; g.lineWidth = 1;
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y);
    let a = Math.random() * 6.3;
    for (let k = 0; k < 3; k++) { a += rand(1.2, 2.4); g.lineTo(x + Math.cos(a) * rand(3, 8), y + Math.sin(a) * rand(3, 8)); g.moveTo(x, y); }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.encoding = THREE.sRGBEncoding; return t;
})();
function spline(P, z) {           // smooth curve through points sorted by z (cubic Hermite)
  const n = P.length;
  if (z <= P[0][0]) return P[0][1];
  if (z >= P[n - 1][0]) return P[n - 1][1];
  let i = 1; while (P[i][0] < z) i++;
  const p0 = P[Math.max(0, i - 2)], p1 = P[i - 1], p2 = P[i], p3 = P[Math.min(n - 1, i + 1)], h = p2[0] - p1[0];
  const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * h, m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * h;
  const t = (z - p1[0]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}
// side view and plan of a mid-size saloon, metres
const VEHICLES = {
  sedan: { name: '轿车', top: [[-2.285, 0.68], [-2.27, 0.85], [-2.235, 0.93], [-2.15, 0.962], [-1.75, 0.972], [-1.40, 0.975], [-1.00, 0.962], [0.00, 0.95], [0.95, 0.936], [1.30, 0.895], [1.75, 0.842], [2.03, 0.808], [2.17, 0.79], [2.24, 0.765], [2.272, 0.72], [2.285, 0.62]],
    bot: [[-2.285, 0.32], [-2.20, 0.27], [-2.00, 0.235], [2.00, 0.22], [2.18, 0.24], [2.285, 0.29]],
    w: [[-2.285, 0.83], [-2.20, 0.868], [-2.00, 0.88], [-1.60, 0.884], [1.60, 0.884], [2.00, 0.878], [2.18, 0.862], [2.285, 0.815]],
    roof: [[-1.40, 0.962], [-1.25, 1.09], [-1.10, 1.222], [-0.95, 1.335], [-0.80, 1.40], [-0.40, 1.432], [0.00, 1.432], [0.25, 1.405], [0.42, 1.33], [0.60, 1.215], [0.80, 1.075], [0.97, 0.94]],
    wheel: { z: [1.36, -1.36], y: 0.31, arch: 0.395, x: 0.79, k: 1 }, cab: [-1.40, 0.97], cabX: [-0.33, -0.25, -0.84, 0.27, -1.05, 0.84], roofW: 0.655,
    win: z => z > 0.84 ? PAINT : z > -0.25 ? SIDEGLASS : z > -0.33 ? TRIM : z > -1.05 ? SIDEGLASS : PAINT, scr: z => z > 0.27 ? SCREEN : z > -0.84 ? PAINT : SCREEN,
    eng: [1.22, 1.86, 0.38], doors: [0.93, -0.285, -0.97], hood: [0.98, 2.06], boot: [-2.12, -1.42], handles: [0.22, -0.78], mir: 0.82, ly: 0, ty: 0, gy: 0, sy: 0, dash: 0.78, eye: [0, 1.24, -0.85],
    zones: [[0.34, 0.32], [0.50, 0.10], [0.97, 0.40], [9, 1.0]], hold: 0.14, stiff: 3.2, soft: 1.5, bulge: 1, strength: 1 },
  // body-on-frame SUV: tall, a long roof carried on four stiff pillars, which hold and then all go at once
  suv: { name: 'SUV', top: [[-2.285, 0.72], [-2.27, 0.93], [-2.235, 1.05], [-2.15, 1.10], [-1.4, 1.12], [0, 1.11], [1.0, 1.10], [1.3, 1.06], [1.75, 1.02], [2.03, 0.98], [2.17, 0.93], [2.24, 0.90], [2.272, 0.84], [2.285, 0.72]],
    bot: [[-2.285, 0.42], [-2.20, 0.36], [-2.00, 0.31], [2.00, 0.30], [2.18, 0.33], [2.285, 0.39]],
    w: [[-2.285, 0.86], [-2.20, 0.895], [-2.00, 0.91], [-1.60, 0.915], [1.60, 0.915], [2.00, 0.908], [2.18, 0.89], [2.285, 0.85]],
    roof: [[-2.18, 1.06], [-2.12, 1.30], [-2.02, 1.52], [-1.85, 1.66], [-1.40, 1.72], [0, 1.73], [0.35, 1.70], [0.52, 1.60], [0.72, 1.42], [0.92, 1.24], [1.06, 1.12]],
    wheel: { z: [1.36, -1.36], y: 0.355, arch: 0.44, x: 0.82, k: 1.148 }, cab: [-2.18, 1.06], cabX: [-0.38, -0.30, -1.13, -1.05, -1.95, 0.35, -1.85, 0.95], roofW: 0.72,
    win: z => z > 0.95 ? PAINT : z > -0.30 ? SIDEGLASS : z > -0.38 ? TRIM : z > -1.05 ? SIDEGLASS : z > -1.13 ? TRIM : z > -1.95 ? SIDEGLASS : PAINT, scr: z => z > 0.35 ? SCREEN : z > -1.85 ? PAINT : SCREEN,
    eng: [1.24, 1.88, 0.42], doors: [1.02, -0.34, -1.09], hood: [1.08, 2.06], boot: null, handles: [0.22, -0.85], mir: 0.88, ly: 0.13, ty: 0.12, gy: 0.08, sy: 0.10, dash: 0.85, eye: [0, 1.44, -0.85],
    zones: [[0.42, 0.30], [0.60, 0.08], [1.12, 0.38], [9, 1.0]], hold: 0.24, stiff: 3.6, soft: 1.8, bulge: 0.8, strength: 1.3 },
  // one-box van: thin tall walls on a light frame; the walls balloon out and the roof comes down early and in one long fold
  van: { name: '面包车', top: [[-2.285, 0.70], [-2.27, 0.90], [-2.20, 1.00], [-1.40, 1.03], [0, 1.03], [1.20, 1.02], [1.55, 0.98], [1.85, 0.93], [2.10, 0.85], [2.20, 0.80], [2.26, 0.74], [2.285, 0.62]],
    bot: [[-2.285, 0.35], [-2.20, 0.30], [-2.00, 0.26], [2.00, 0.25], [2.18, 0.27], [2.285, 0.32]],
    w: [[-2.285, 0.86], [-2.20, 0.90], [-2.00, 0.915], [1.60, 0.915], [2.00, 0.88], [2.18, 0.84], [2.285, 0.76]],
    roof: [[-2.27, 1.02], [-2.25, 1.35], [-2.20, 1.66], [-2.10, 1.84], [-1.80, 1.93], [0, 1.96], [0.50, 1.94], [0.75, 1.85], [1.00, 1.66], [1.25, 1.42], [1.50, 1.18], [1.66, 1.00]],
    wheel: { z: [1.40, -1.40], y: 0.325, arch: 0.41, x: 0.82, k: 1.05 }, cab: [-2.27, 1.66], cabX: [-0.70, -0.60, 0.62, 0.70, -1.90, 0.85, -2.12, 1.40], roofW: 0.82,
    win: z => z > 1.40 ? PAINT : z > 0.70 ? SIDEGLASS : z > 0.62 ? TRIM : z > -0.60 ? SIDEGLASS : z > -0.70 ? TRIM : z > -1.90 ? SIDEGLASS : PAINT, scr: z => z > 0.85 ? SCREEN : z > -2.12 ? PAINT : SCREEN,
    eng: [0.72, 1.32, 0.36], doors: [1.42, 0.66, -0.65], hood: [1.68, 2.06], boot: null, handles: [0.75, 0.2], mir: 1.25, ly: 0, ty: 0.06, gy: 0.03, sy: 0.12, dash: 1.2, eye: [0, 1.5, -0.6],
    zones: [[0.36, 0.32], [0.52, 0.12], [1.03, 0.50], [9, 1.0]], hold: 0.08, stiff: 2.4, soft: 1.1, bulge: 1.5, strength: 1.05 },
};
let curV, C_TOP, C_BOT, C_W, C_ROOF, WHEEL_Z, WHEEL_Y, ARCH_R, ZONES;
function useV(V) { curV = V; C_TOP = V.top; C_BOT = V.bot; C_W = V.w; C_ROOF = V.roof; WHEEL_Z = V.wheel.z; WHEEL_Y = V.wheel.y; ARCH_R = V.wheel.arch; ZONES = V.zones; }
const beltY = z => spline(C_TOP, z);
function bodyBot(z) {
  let y = spline(C_BOT, z);
  for (const zw of WHEEL_Z) { const d = Math.abs(z - zw); if (d < ARCH_R) y = Math.max(y, WHEEL_Y + Math.sqrt(ARCH_R * ARCH_R - d * d)); }
  return y;
}
function superPt(th, nTop, nBot) {     // unit superellipse, th from the bottom centre round counter-clockwise (seen from the front)
  const c = Math.cos(th), s = Math.sin(th), n = s > 0 ? nTop : nBot;
  return [Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Math.sign(s) * Math.pow(Math.abs(s), 2 / n), s];
}
function bodyPt(z, th) {
  const yb = bodyBot(z), yt = beltY(z), W = spline(C_W, z), [ex, ey, s] = superPt(th, 4.4, 9.0);
  const v = (ey + 1) / 2;
  const tuck = 0.975 + 0.025 * Math.sin(Math.PI * Math.min(1, v * 1.25)) + 0.008 * Math.exp(-Math.pow((v - 0.74) / 0.035, 2));   // shoulder line
  const x = ex * W * tuck * (1 - 0.035 * v * v);
  return [x, (yb + yt) / 2 + (yt - yb) / 2 * ey + (s > 0 ? 0.022 * (1 - Math.pow(x / W, 2)) * Math.pow(s, 4) : 0), z];
}
function cabinPt(z, th) {
  const yb = beltY(z) - 0.015, yt = Math.max(yb + 0.002, spline(C_ROOF, z)), Wb = spline(C_W, z) * 0.905, [ex, ey, s] = superPt(th, 4.6, 9.0);
  const v = (ey + 1) / 2, W = Wb + (curV.roofW - Wb) * Math.pow(v, 1.3);
  return [ex * W, yb + (yt - yb) * v + (s > 0 ? 0.02 * (1 - ex * ex) * Math.pow(s, 4) : 0), z];
}
function stations(z0, z1, step, extra) {
  const out = [];
  for (let z = z0; z < z1 - 1e-6; z += step) out.push(z);
  out.push(z1, ...extra.filter(z => z > z0 && z < z1));
  return out.sort((a, b) => a - b).filter((z, i, a) => i === 0 || z - a[i - 1] > 1e-4);
}
// one surface through rings of points; `cls(x, y, z, th)` picks the material of each quad
function loftGeo(rings, ths, cls, capEnds, uvOf) {
  const K = rings.length, Mr = rings[0].length, pos = [], uv = [], buckets = [];
  rings.forEach(r => r.forEach(p => { pos.push(p[0], p[1], p[2]); const q = uvOf(p); uv.push(q[0], q[1]); }));
  const add3 = (m, a, b, c) => { (buckets[m] = buckets[m] || []).push(a, b, c); };
  for (let k = 0; k < K - 1; k++) for (let j = 0; j < Mr; j++) {
    const j2 = (j + 1) % Mr, a = k * Mr + j, b = k * Mr + j2, c = (k + 1) * Mr + j2, d = (k + 1) * Mr + j;
    const P = rings[k][j], Q = rings[k + 1][j2];
    const m = cls((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2, ths[j] + Math.PI / Mr);
    add3(m, a, b, d); add3(m, b, c, d);
  }
  if (capEnds) for (const [k, flip] of [[0, true], [K - 1, false]]) {
    const r = rings[k]; let cx = 0, cy = 0; r.forEach(p => { cx += p[0]; cy += p[1]; });
    const ci = pos.length / 3; pos.push(cx / Mr, cy / Mr, r[0][2]); const q = uvOf([cx / Mr, cy / Mr, r[0][2]]); uv.push(q[0], q[1]);
    for (let j = 0; j < Mr; j++) {
      const a = k * Mr + j, b = k * Mr + (j + 1) % Mr, m = cls(r[j][0], r[j][1], r[j][2], -9);
      if (flip) add3(m, ci, b, a); else add3(m, ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const idx = [];
  buckets.forEach((b, m) => { if (!b) return; g.addGroup(idx.length, b.length, m); for (let i = 0; i < b.length; i++) idx.push(b[i]); });
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function ribbon(pts, nrm, w, axis) {   // a thin strip on the skin: door shut lines, the hood and boot cuts
  const pos = [], idx = [];
  pts.forEach((p, i) => {
    const n = nrm(p), o = [p[0] + n[0] * 0.003, p[1] + n[1] * 0.003, p[2] + n[2] * 0.003];
    const d = axis === 'z' ? [0, 0, w / 2] : axis === 'y' ? [0, w / 2, 0] : [w / 2, 0, 0];
    pos.push(o[0] - d[0], o[1] - d[1], o[2] - d[2], o[0] + d[0], o[1] + d[1], o[2] + d[2]);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const deg = d => d * DEG;
// what each band of the body skin is: paint, black trim (sills, valances), and which window
const PAINT = 0, TRIM = 1, SIDEGLASS = 2, SCREEN = 3;
const fold = th => { const a = th / DEG; return a <= 90 ? a : 180 - a; };
function bodyCls(x, y, z, th) {
  if (th === -9) return y < 0.315 ? TRIM : PAINT;                               // bumper faces: black lower valance
  const a = fold(th);
  if (a < -62) return TRIM;                                                     // underside
  if ((z > 2.12 || z < -2.15) && y < 0.315) return TRIM;                        // valances under the bumpers
  if (Math.abs(z) < 2.0 && a < -40) return TRIM;                                // rocker panels
  return PAINT;
}
function cabinCls(x, y, z, th) {
  const a = fold(th);
  if (a < -55) return TRIM;                                                     // hidden inside the body
  if (a < -32) return TRIM;                                                     // waist seal
  if (a < 24) return curV.win(z);                                             // door glass, B pillar, C pillar
  if (a < 30) return TRIM;                                                      // window frame
  if (a < 62) return PAINT;                                                     // A pillars, roof rails, C pillars
  return curV.scr(z);                        // windscreen, roof, rear screen
}

/* the mud on a car: a canvas seen from above in car coordinates (x across, z along), laid over everything that faces up.
   The track prints its links into it where it touches, row by row; clods that land on the car splat into it. */
const MUD_W = 512, MUD_H = 1024, MUD_PX = MUD_W / 2.4, LINK = 0.155;
const BLADE_PAINT = ['#6d8532', '#8a9a43', '#a79c58', '#566e2a'];
const MUD_PAINT = ['#4b3e2d', '#5d4c37', '#3d342a', '#6a5a45'], mudPick = () => MUD_PAINT[Math.floor(Math.random() * 4)];
const mudX = x => (x + 1.2) / 2.4 * MUD_W, mudY = L => (1 - (L + 2.6) / 5.2) * MUD_H;
function makeMud() {
  const canvas = document.createElement('canvas'); canvas.width = MUD_W; canvas.height = MUD_H;
  const tex = new THREE.CanvasTexture(canvas); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  return { g: canvas.getContext('2d'), tex, rows: new Uint8Array(40), dirty: false };
}
// the car's height as built, so age stays where it was on the metal while the panels move
const ROOF_CUT = { value: new THREE.Vector4(0, 0, 0, 0) };    // half width, z from, z to, on: the roof opens only for the inside camera
function mudOn(mat, tex, cut, age = 0) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.tRust = REAL.tRust; sh.uniforms.tRustD = REAL.tRustD; sh.uniforms.uRustOn = REAL.rustOn; sh.uniforms.tMud = { value: tex }; sh.uniforms.uMudCut = cut; sh.uniforms.uRoofCut = ROOF_CUT; sh.uniforms.uAge = { value: age };
    sh.vertexShader = 'varying vec2 vMudUv; varying float vMudN; varying float vMudY; varying float vMudY0; attribute float aY0; attribute vec3 aPlan;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vMudUv = vec2((aPlan.x + 1.2) / 2.4, (aPlan.z + 2.6) / 5.2); vMudN = normal.y; vMudY = aPlan.y; vMudY0 = aY0;');
    sh.fragmentShader = 'uniform sampler2D tRust, tRustD; uniform float uRustOn; uniform sampler2D tMud; uniform float uMudCut; uniform vec4 uRoofCut; uniform float uAge; varying vec2 vMudUv; varying float vMudN; varying float vMudY; varying float vMudY0;\n' + WEAR_GLSL.replace('varying vec3 vWear; varying float vWearSeed;', '') + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uRoofCut.w > 0.5 && vMudY > 0.45 && abs(vMudUv.x * 2.4 - 1.2) < uRoofCut.x && vMudUv.y * 5.2 - 2.6 > uRoofCut.y && vMudUv.y * 5.2 - 2.6 < uRoofCut.z) discard;
        vec3 ageP = vec3(vMudUv.x * 2.4, vMudUv.y * 5.2, vMudY0);
        float ageN = wearNoise(ageP * vec3(11.0, 11.0, 5.0)) * 0.7 + wearNoise(ageP * vec3(37.0, 37.0, 13.0)) * 0.3;
        float ageRust = uAge * smoothstep(0.74, 0.86, ageN * 0.8 + 0.2 * wearNoise(ageP * vec3(3.0, 9.0, 2.0)) + 0.26 * smoothstep(0.62, 0.3, vMudY0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))), 0.22 * uAge);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.26, 0.19), uAge * 0.4 * smoothstep(0.15, 0.8, vMudN) * smoothstep(0.25, 0.7, wearNoise(ageP * 3.0)));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.14, 0.058, 0.024), texture2D(tRust, ageP.xy * 0.8 + ageP.z * 0.5).rgb, uRustOn), ageRust * 0.9);
        if (!gl_FrontFacing) diffuseColor.rgb *= 0.28;
        vec4 mudS = texture2D(tMud, vMudUv); float mudA = gl_FrontFacing && vMudUv.y * 5.2 - 2.6 > uMudCut ? mudS.a * smoothstep(-0.2, 0.2, vMudN) : 0.0;
        diffuseColor.rgb = mix(diffuseColor.rgb, pow(mudS.rgb, vec3(2.2)), mudA); diffuseColor.a = mix(diffuseColor.a, 1.0, mudA);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { // what the links printed reads as relief in the light: the dark of a bar is a dent
          float dH = -(1.0 - dot(mudS.rgb, vec3(0.33))) * mudA * 0.012 + ageRust * uRustOn * texture2D(tRustD, ageP.xy * 0.8 + ageP.z * 0.5).r * 0.006;
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), R1 = cross(sy, normal), R2 = cross(normal, sx);
          float det = dot(sx, R1); det *= gl_FrontFacing ? 1.0 : -1.0;
          vec3 grad = sign(det) * (dFdx(dH) * R1 + dFdy(dH) * R2);
          normal = normalize(abs(det) * normal - grad);
        }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, max(mudA, ageRust));')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0.0, max(mudA, ageRust));')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoat *= (1.0 - mudA) * (1.0 - ageRust);\n#endif');
  };
}
function mudBlob(g, cx, cy, r, color, alpha) {
  g.fillStyle = color; g.globalAlpha = alpha; g.beginPath();
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, q = r * rand(0.6, 1.25); g.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q * rand(0.75, 1.1)); }
  g.closePath(); g.fill(); g.globalAlpha = 1;
}
// one link of the left track pressed onto the car. No two links carry the same mud: some are caked, some nearly clean,
// and the crumpling car and the sagging track twist and shift each print, break up its bar and fray its edges
function mudRow(c, bx, L, rot) {
  const g = c.mud.g, h = LINK * MUD_PX, w = 0.58 * MUD_PX, load = Math.pow(Math.random(), 1.15) * (rubberTrack ? 0.45 : 1);   // some links lightly fouled, some caked; rubber holds less
  g.save();
  g.translate(mudX(bx + rand(-0.025, 0.025)), mudY(L + rand(-0.03, 0.03))); g.rotate(rot + rand(-0.09, 0.09));
  const patches = 4 + Math.floor(load * 11);
  for (let i = 0; i < patches; i++) {
    const px = rand(-0.5, 0.5) * w, rx = rand(0.05, 0.2) * w * (0.6 + load), ry = rand(0.12, 0.42) * h;
    g.globalAlpha = rand(0.35, 0.65 + 0.3 * load); g.fillStyle = mudPick(); g.beginPath();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.lineTo(px + Math.cos(a) * rx * rand(0.6, 1.3), rand(-0.1, 0.1) * h + Math.sin(a) * ry * rand(0.6, 1.3)); }
    g.closePath(); g.fill();
  }
  // rubber pads leave two rows of soft black scuff, heavier where the metal beneath stood proud
  if (rubberTrack) {
    for (const sd of [-0.25, 0.25]) for (let i = 0, n = 2 + Math.floor(rand(0, 4)); i < n; i++) {
      const pw = rand(0.08, 0.2) * w, ph = rand(0.25, 0.7) * h, px = sd * w + rand(-0.14, 0.14) * w, py = rand(-0.2, 0.2) * h;
      g.globalAlpha = rand(0.22, 0.62); g.fillStyle = '#151413'; g.beginPath();
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.lineTo(px + Math.cos(a) * pw * rand(0.75, 1.15), py + Math.sin(a) * ph * 0.5 * rand(0.75, 1.15)); }
      g.closePath(); g.fill();
    }
  }
  // the grouser bar prints only where it bore hard: broken lengths of uneven weight, sometimes nothing at all
  else if (Math.random() > 0.14) {
    let x = -0.5 * w + rand(0, 0.12) * w;
    const end = 0.5 * w - rand(0, 0.12) * w, by = -0.2 * h;
    while (x < end) {
      const len = rand(0.08, 0.34) * w, th = h * rand(0.08, 0.24);
      if (Math.random() < 0.72) {
        g.globalAlpha = rand(0.55, 0.97); g.fillStyle = Math.random() < 0.7 ? '#2f2519' : '#3d342a'; g.beginPath();
        g.moveTo(x, by - th * rand(0.3, 0.7)); g.lineTo(x + len * 0.5, by - th * rand(0.4, 0.8) + rand(-1, 1)); g.lineTo(Math.min(end, x + len), by - th * rand(0.2, 0.6));
        g.lineTo(Math.min(end, x + len) + rand(-1, 2), by + th * rand(0.2, 0.6)); g.lineTo(x + len * 0.5, by + th * rand(0.4, 0.8)); g.lineTo(x + rand(-2, 1), by + th * rand(0.2, 0.6));
        g.closePath(); g.fill();
      }
      x += len + rand(0, 0.08) * w;
    }
  }
  // crumbs squeezed off the link, thrown a little way past the track's edges too
  const crumbs = 3 + Math.floor(load * 14);
  for (let i = 0; i < crumbs; i++) mudBlob(g, rand(-0.56, 0.56) * w, rand(-0.7, 0.7) * h, rand(0.8, 2.5 + 3.5 * load), mudPick(), rand(0.6, 1));
  if (Math.random() < 0.4) {
    const blades = 1 + Math.floor(rand(0, 5));
    for (let i = 0; i < blades; i++) {
      const bx = rand(-0.5, 0.5) * w, by = rand(-0.6, 0.6) * h, a = rand(0, 6.3), ln = rand(4, 16);
      g.globalAlpha = rand(0.7, 1); g.strokeStyle = BLADE_PAINT[Math.floor(Math.random() * BLADE_PAINT.length)]; g.lineWidth = rand(0.7, 1.7); g.beginPath(); g.moveTo(bx, by);
      g.quadraticCurveTo(bx + Math.cos(a) * ln * 0.5 + rand(-3, 3), by + Math.sin(a) * ln * 0.5 + rand(-3, 3), bx + Math.cos(a) * ln, by + Math.sin(a) * ln); g.stroke();
    }
  }
  g.restore();
  // now and then the track slips on the folding metal and drags a streak along the car
  if (!rot && Math.random() < 0.3) {
    const sx = mudX(bx + rand(-0.27, 0.27)), sy = mudY(L), ln = rand(0.5, 2.6) * h, wd = rand(1.5, 7);
    g.globalAlpha = rand(0.25, 0.6); g.fillStyle = rubberTrack ? '#191817' : mudPick(); g.beginPath();
    g.moveTo(sx - wd, sy); g.lineTo(sx + wd, sy + rand(-2, 2)); g.lineTo(sx + wd * 0.3 + rand(-4, 4), sy + ln); g.lineTo(sx - wd * 0.3 + rand(-4, 4), sy + ln * rand(0.85, 1));
    g.closePath(); g.fill(); g.globalAlpha = 1;
  }
  c.mud.dirty = true;
}
// a clod lands: the lump flattens, and spatter flies out round it
function mudSplat(c, x, L, size) {
  const g = c.mud.g, cx = mudX(x), cy = mudY(L), r = size * MUD_PX * 1.25, col = mudPick();
  mudBlob(g, cx, cy, r, col, 0.97);
  mudBlob(g, cx + rand(-r, r) * 0.3, cy + rand(-r, r) * 0.3, r * 0.55, '#332919', 0.7);
  for (let i = 0; i < 7; i++) { const a = rand(0, 6.3), q = r * rand(1.2, 3); mudBlob(g, cx + Math.cos(a) * q, cy + Math.sin(a) * q, rand(0.8, 2.6), col, rand(0.7, 1)); }
  c.mud.dirty = true;
}
// where the laid track touches the strip of car beneath it, print the links that have not been printed yet
function stampTrack(c) {
  for (let k = 0; k < c.nb; k++) {
    if (c.Hs[k] <= 0) continue;
    const row = Math.floor(k * BDL / LINK);
    if (c.mud.rows[row]) continue;
    tmpV3.set(BP[k][0], BP[k][1], BP[k][2]).applyMatrix4(tankInv);
    const lb = lbAt(1, tmpV3.x);
    if (lb !== Infinity && tmpV3.y + 0.07 >= lb) {
      c.mud.rows[row] = 1;
      if (c.across) mudRow(c, -1.1 + (row + 0.5) * LINK, c.Lc, Math.PI / 2);
      else { const L = BL0 + (row + 0.5) * LINK; mudRow(c, c.bandX, L, 0); if (L < c.mudL) c.mudL = L; }
    }
  }
}
// the height of the car from above as it now stands, for clods to land on
const TOPN = 12, TOPM = 52;
function carTops(c) {
  const T = c.tops; T.fill(0);
  for (const m of c.meshes) {
    if (m.userData.loose) continue;
    const A = m.geometry.attributes.position.array;
    for (let i = 0; i < A.length; i += 3) {
      const ix = Math.floor((A[i] + 1.2) / 0.2), iz = Math.floor((A[i + 2] + 2.6) / 0.1);
      if (ix < 0 || ix >= TOPN || iz < 0 || iz >= TOPM) continue;
      const q = ix + iz * TOPN; if (A[i + 1] > T[q]) T[q] = A[i + 1];
    }
  }
}

const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
};
const headTex = canvasTex(256, 256, (g, w, h) => {     // u across the corner, v along the car (nose at v = 1)
  g.fillStyle = '#0b0c0d'; g.fillRect(0, 0, w, h);
  for (const [cx, cy, r] of [[86, 150, 62], [186, 150, 50]]) {
    const gr = g.createRadialGradient(cx, cy, r * 0.1, cx, cy, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.28, '#8e949a'); gr.addColorStop(0.62, '#3a3e42'); gr.addColorStop(1, '#101214');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
    g.strokeStyle = '#6a6f74'; g.lineWidth = 3; g.stroke();
  }
  g.fillStyle = '#c98a1c'; g.fillRect(14, 28, w - 28, 22);    // indicator
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 10);
});
const headGlow = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (const [cx, cy, r] of [[86, 150, 20], [186, 150, 16]]) { g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill(); } g.fillRect(14, 28, w - 28, 22); });
const tailTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3c0504'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 12) { g.fillStyle = y % 24 ? 'rgba(255,60,40,.22)' : 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 6); }
  g.fillStyle = '#8e5e12'; g.fillRect(170, 196, 62, 34); g.fillStyle = '#7f8284'; g.fillRect(100, 196, 62, 34);
  g.strokeStyle = '#120202'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
});
const grilleTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
  for (let y = 18; y < h - 12; y += 14) { g.fillStyle = '#16171a'; g.fillRect(16, y, w - 32, 7); g.fillStyle = '#2a2c30'; g.fillRect(16, y, w - 32, 2); }
  g.strokeStyle = '#6f7276'; g.lineWidth = 4; g.strokeRect(10, 8, w - 20, h - 16);
  g.fillStyle = '#c9ccce'; g.beginPath(); g.ellipse(w / 2, h / 2, 34, 22, 0, 0, 6.3); g.fill(); g.fillStyle = '#17181a'; g.beginPath(); g.ellipse(w / 2, h / 2, 27, 16, 0, 0, 6.3); g.fill();
});
const intakeTex = canvasTex(256, 32, (g, w, h) => { g.fillStyle = '#060606'; g.fillRect(0, 0, w, h); g.fillStyle = '#26282b'; for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 0; x < w; x += 8) g.fillRect(x, y, 5, 3); g.strokeStyle = '#2d2f32'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2); });
const plateTex = canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = '#123f93'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8ecef'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#eef1f3'; g.font = '700 42px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TEST 96A', w / 2, h / 2 + 2);
});
// lathe coordinates: u round the tyre, v across it from one bead over the tread to the other
const tyreDraw = (g, w, h, bump) => {
  g.fillStyle = bump ? '#808080' : '#191919'; g.fillRect(0, 0, w, h);
  const t0 = h * 0.33, t1 = h * 0.67, tw = t1 - t0, N = 96;
  for (let k = 0; k < N; k++) {           // shoulder blocks and the sipes between them
    const x = k / N * w; g.fillStyle = bump ? '#303030' : '#0c0c0c';
    g.save(); g.translate(x, t0); g.transform(1, 0, 0.34, 1, 0, 0); g.fillRect(0, -h * 0.05, 3.5, tw * 0.34); g.restore();
    g.save(); g.translate(x, t1 - tw * 0.3); g.transform(1, 0, -0.34, 1, 0, 0); g.fillRect(0, 0, 3.5, tw * 0.34); g.restore();
    g.fillStyle = bump ? '#505050' : '#101010'; g.fillRect(x + w / N / 2, t0 + tw * 0.36, 2, tw * 0.28);
  }
  g.fillStyle = bump ? '#101010' : '#060606'; for (const f of [0.3, 0.7]) g.fillRect(0, t0 + tw * f - 5, w, 10);  // the two main grooves
  g.fillStyle = bump ? '#c8c8c8' : '#2c2c2c'; g.font = '700 34px Arial, sans-serif'; g.textBaseline = 'middle';
  for (const y of [h * 0.14, h * 0.86]) for (const x of [80, 1104]) { g.fillText('205/55 R16  RADIAL  TUBELESS  91V', x, y); g.fillText('STEEL BELTED', x + 620, y); }
};
const tyreMap = canvasTex(2048, 384, (g, w, h) => tyreDraw(g, w, h, false)), tyreBump = canvasTex(2048, 384, (g, w, h) => tyreDraw(g, w, h, true), false);
const carGrille = new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide });
const carIntake = new THREE.MeshStandardMaterial({ map: intakeTex, roughness: 0.7, metalness: 0.2 });
const carCaliper = new THREE.MeshStandardMaterial({ color: lin('#5a2019'), roughness: 0.5, metalness: 0.5 });
Object.assign(carLamp, { map: headTex, color: new THREE.Color(0xffffff), roughness: 0.1, metalness: 0.35, emissiveMap: headGlow, side: THREE.DoubleSide });
Object.assign(carTail, { map: tailTex, color: new THREE.Color(0xffffff), roughness: 0.14, metalness: 0.1, side: THREE.DoubleSide, emissiveMap: tailTex });
carTail.emissive.setRGB(0.5, 0.5, 0.5);
carPlate.map = plateTex; carPlate.color.setRGB(1, 1, 1);
Object.assign(carTyre, { map: tyreMap, bumpMap: tyreBump, bumpScale: 0.018, roughness: 0.92 });
function buildCar(kind, modeKey) {
  const V0 = VEHICLES[kind], mode = MODES[modeKey];
  // age, rust and welds differ from car to car, and no driver holds a line to the centimetre
  const V = Object.assign({}, V0, { strength: V0.strength * rand(0.86, 1.14), hold: V0.hold * rand(0.75, 1.25), stiff: V0.stiff * rand(0.88, 1.12), soft: V0.soft * rand(0.85, 1.15), bulge: V0.bulge * rand(0.8, 1.2) });
  const carZ = mode.z + (mode.across ? rand(-0.18, 0.18) : mode.track ? rand(-0.12, 0.12) : rand(-0.22, 0.22)), bandX = SIDES[1] - carZ;
  useV(V);
  const paint = new THREE.MeshPhysicalMaterial({ color: lin(CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]), roughness: 0.52, metalness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.3, vertexColors: true, side: THREE.DoubleSide });
  const sideGlass = new THREE.MeshStandardMaterial({ color: lin('#0c1418'), roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.78 });
  const screen = new THREE.MeshStandardMaterial({ color: lin('#0c1418'), roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.8 });
  const mud = makeMud(), mudCut = { value: -9 }; mudOn(paint, mud.tex, mudCut, 1); [sideGlass, screen].forEach(m => mudOn(m, mud.tex, mudCut));
  const lamp = carLamp.clone(), tail = carTail.clone();   // their own, so the hazards can flash
  const group = new THREE.Group(), meshes = [], tires = [], mirrors = [];
  const put = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0) => {
    if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); geo.translate(x, y, z);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    group.add(m); meshes.push(m); return m;
  };
  const M = 48, ths = Array.from({ length: M }, (_, j) => -Math.PI / 2 + j / M * Math.PI * 2);
  const archEdges = []; WHEEL_Z.forEach(zw => [-ARCH_R, ARCH_R].forEach(d => archEdges.push(zw + d - 0.002, zw + d + 0.002)));
  const zb = stations(-2.27, 2.275, 0.055, [...archEdges, -2.25, -2.23, -2.2, 2.2, 2.23, 2.255]);
  const planUV = p => [p[0] * 0.55 + 0.5, p[2] * 0.4 + 0.5];
  const body = put(loftGeo(zb.map(z => ths.map(t => bodyPt(z, t))), ths, bodyCls, true, planUV), [paint, carTrim]);
  const zc = stations(V.cab[0], V.cab[1], 0.05, V.cabX);
  const cabin = put(loftGeo(zc.map(z => ths.map(t => cabinPt(z, t))), ths, cabinCls, false, p => [p[2] * 0.9 + p[0] * 0.4, p[1] * 1.3 + p[0] * 0.3]), [paint, carTrim, sideGlass, screen]);
  cabin.userData.glass = true; cabin.userData.panel = P_CABIN;
  const sideIdx = new Set(), gi = cabin.geometry.index.array;
  for (const gr of cabin.geometry.groups) if (gr.materialIndex === SIDEGLASS) for (let k = gr.start; k < gr.start + gr.count; k++) sideIdx.add(gi[k]);

  // door shut lines, hood and boot cuts
  const sideN = p => { const l = Math.hypot(p[0], (p[1] - 0.6) * 0.5) || 1; return [p[0] / l, (p[1] - 0.6) * 0.5 / l, 0]; };
  const upN = () => [0, 1, 0];
  for (const zs of V.doors) for (const sx of [1, -1]) {
    const pts = []; for (let a = -44; a <= 30; a += 4) { const p = bodyPt(zs, deg(sx > 0 ? a : 180 - a)); if (p[1] >= bodyBot(zs) + 0.015) pts.push(p); }
    if (pts.length > 1) put(ribbon(pts, sideN, 0.006, 'z'), carSeam);
  }
  for (const sx of [1, -1]) {
    const hood = [], boot = [];
    for (let z = V.hood[0]; z <= V.hood[1]; z += 0.06) hood.push(bodyPt(z, deg(sx > 0 ? 47 : 133)));
    put(ribbon(hood, upN, 0.006, 'x'), carSeam);
    if (V.boot) { for (let z = V.boot[0]; z <= V.boot[1]; z += 0.06) boot.push(bodyPt(z, deg(sx > 0 ? 47 : 133))); put(ribbon(boot, upN, 0.006, 'x'), carSeam); }
    // handles
    for (const zh of V.handles) { const p = bodyPt(zh, deg(sx > 0 ? 24 : 156)); put(boxG(0.025, 0.03, 0.15), carChrome, p[0] + sx * 0.008, p[1], zh); }
    // mirrors on a short stalk at the base of the A pillar
    const mp = cabinPt(V.mir, deg(sx > 0 ? -20 : 200));
    put(boxG(0.10, 0.035, 0.07), carTrim, mp[0] + sx * 0.05, mp[1] + 0.02, V.mir - 0.02);
    { const g = new THREE.SphereGeometry(0.08, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(Math.PI / 2).scale(1.2, 0.72, 0.8), a = g.attributes.position.array;
      for (let i = 2; i < a.length; i += 3) a[i] = Math.max(a[i], -0.012);
      mirrors.push(put(g, paint, mp[0] + sx * 0.15, mp[1] + 0.05, V.mir - 0.04)); }
  }
  const edgeF = [], edgeB = [];
  for (let a = 47; a <= 133; a += 4) { edgeF.push(bodyPt(2.05, deg(a))); edgeB.push(bodyPt(-2.11, deg(a))); }
  put(ribbon(edgeF, upN, 0.006, 'z'), carSeam); if (V.boot) put(ribbon(edgeB, upN, 0.006, 'z'), carSeam);   // hood front edge, boot lid rear edge

  // lamps, grille and plates, laid flush on the skin
  const onSkin = (geo, mat, z, x, yWant, lift) => {
    let best = null;                                     // the ring point at station z closest to (x, yWant)
    for (let a = -90; a <= 270; a += 0.5) { const p = bodyPt(z, deg(a)), e = Math.hypot(p[0] - x, (p[1] - yWant) * 0.6); if (!best || e < best.e) best = { e, a, p }; }
    const p = best.p, dz = 0.01, pa = bodyPt(z, deg(best.a + 0.5)), pz = bodyPt(z + dz, deg(best.a));
    const tA = new THREE.Vector3(pa[0] - p[0], pa[1] - p[1], pa[2] - p[2]), tZ = new THREE.Vector3(pz[0] - p[0], pz[1] - p[1], pz[2] - p[2]);
    const n = tA.clone().cross(tZ).normalize(), e1 = new THREE.Vector3(1, 0, 0).addScaledVector(n, -n.x).normalize(), e2 = n.clone().cross(e1);
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(e1, e2, n).setPosition(p[0] + n.x * lift, p[1] + n.y * lift, p[2] + n.z * lift));
    return put(geo, mat);
  };
  const capPt = (geo, mat, x, y, z) => put(geo, mat, x, y, z);
  // a patch of the skin itself, lifted a hair: it follows every curve of the panel under it
  const skinPatch = (z0, z1, a0, a1, sx, lift, mat, nz = 8, na = 10) => {
    const pos = [], uv = [], idx = [], D = 0.004;
    for (let i = 0; i <= nz; i++) for (let j = 0; j <= na; j++) {
      const z = z0 + (z1 - z0) * i / nz, a = a0 + (a1 - a0) * j / na, A = q => deg(sx > 0 ? q : 180 - q);
      const p = bodyPt(z, A(a)), pa = bodyPt(z, A(a + 1)), pz = bodyPt(z + D, A(a));
      const tA = new THREE.Vector3(pa[0] - p[0], pa[1] - p[1], pa[2] - p[2]), tZ = new THREE.Vector3(pz[0] - p[0], pz[1] - p[1], pz[2] - p[2]), n = tA.cross(tZ).normalize();
      if (n.x * p[0] + n.y * (p[1] - 0.6) + n.z * p[2] < 0) n.multiplyScalar(-1);
      pos.push(p[0] + n.x * lift, p[1] + n.y * lift, p[2] + n.z * lift); uv.push(j / na, i / nz);
      if (i < nz && j < na) { const a1_ = i * (na + 1) + j, b = a1_ + 1, c = a1_ + na + 1, d = c + 1; idx.push(a1_, b, d, a1_, d, c); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return put(g, mat);
  };
  for (const sx of [1, -1]) {
    skinPatch(2.04, 2.255, 22, 60, sx, 0.0035, carTrim, 8, 10);                         // the recess round each lamp
    skinPatch(2.06, 2.245, 26, 56, sx, 0.0055, lamp, 8, 10);                            // headlamp under its lens
    skinPatch(-2.27, -2.09, 8, 56, sx, 0.0035, tail, 8, 10);                          // tail lamp round the corner of the boot
    const fog = put(new THREE.CylinderGeometry(0.042, 0.042, 0.018, 14).rotateX(Math.PI / 2), lamp, sx * 0.62, 0.345 + V.gy, 2.288);
    put(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 14).rotateX(Math.PI / 2), carTrim, sx * 0.62, 0.345 + V.gy, 2.283);
  }
  skinPatch(2.19, 2.283, 62, 118, 1, 0.004, carGrille, 6, 16);                          // grille following the nose
  { const lo = new THREE.BoxGeometry(0.86, 0.075, 0.02); put(lo, carIntake, 0, 0.335 + V.gy, 2.285); }  // lower intake
  put(new THREE.BoxGeometry(0.44, 0.115, 0.008), carPlate, 0, 0.405 + V.gy, 2.293);
  put(new THREE.BoxGeometry(0.44, 0.115, 0.008), carPlate, 0, 0.46 + V.gy, -2.29);
  for (const sx of [1, -1]) put(new THREE.CylinderGeometry(0.03, 0.033, 0.09, 12).rotateX(Math.PI / 2), carChrome, sx * 0.46, 0.27 + V.gy, -2.27);   // exhaust tips
  // bright strip along each flank, rubbing strip below it
  for (const sx of [1, -1]) {
    const strip = [], rub = [];
    for (let z = -2.05; z <= 2.0; z += 0.06) { if (WHEEL_Z.every(zw => Math.abs(z - zw) > ARCH_R + 0.03)) rub.push(bodyPt(z, deg(sx > 0 ? -8 : 188))); }
    const runs = [[], [], []]; rub.forEach(p => runs[p[2] > WHEEL_Z[0] ? 0 : p[2] > WHEEL_Z[1] ? 1 : 2].push(p));
    runs.forEach(r => { if (r.length > 1) put(ribbon(r, sideN, 0.028, 'y'), carTrim); });
    for (let z = V.cab[0] + 0.12; z <= V.cab[1] - 0.05; z += 0.08) strip.push(cabinPt(z, deg(sx > 0 ? -34 : 214)));
    if (strip.length > 1) put(ribbon(strip, sideN, 0.012, 'y'), carChrome);
  }
  // wipers lying at the foot of the screen, aerial on the roof
  { const zw = V.cab[1] - 0.09; for (const x0 of [0.5, -0.1]) { const a = cabinPt(zw, deg(90)), g = boxG(0.52, 0.012, 0.018); g.rotateY(0.12); put(g, carTrim, x0 - 0.2, a[1] + 0.012 - Math.abs(x0) * 0.03, zw); } }
  { const a = cabinPt(V.cab[0] + 0.5, deg(90)); put(new THREE.CylinderGeometry(0.003, 0.006, 0.34, 6), carTrim, 0, a[1] + 0.17, a[2]).userData.thin = true; put(new THREE.SphereGeometry(0.02, 8, 6).scale(1, 0.5, 2), carTrim, 0, a[1] + 0.008, a[2]); }

  // cabin seen through the glass: seats, dash, wheel
  const ibox = (w, h, d) => new THREE.BoxGeometry(w, h, d, Math.ceil(w / 0.08), Math.max(1, Math.ceil(h / 0.08)), Math.ceil(d / 0.08));
  for (const sx of [1, -1]) {
    put(ibox(0.48, 0.12, 0.50), carCloth, sx * 0.38, 0.55 + V.sy, 0.05);
    put(ibox(0.46, 0.58, 0.12), carCloth, sx * 0.38, 0.86 + V.sy, -0.25, -0.22);
    put(ibox(0.24, 0.16, 0.10), carCloth, sx * 0.38, 1.22 + V.sy, -0.34, -0.22);
  }
  put(ibox(1.40, 0.12, 0.48), carCloth, 0, 0.56 + V.sy, -0.85);
  put(ibox(1.40, 0.52, 0.12), carCloth, 0, 0.84 + V.sy, -1.12, -0.28);
  put(ibox(1.44, 0.16, 0.30), carTrim, 0, 0.90 + V.sy, V.dash).userData.interior = true;
  put(new THREE.TorusGeometry(0.17, 0.018, 8, 24), carTrim, 0.38, 0.98 + V.sy, V.dash - 0.23, -1.05).userData.interior = true;

  // a big teddy bear sitting on each front seat, facing forward
  const plush = [];
  if (carPlush) [0.38, -0.38].forEach((bx, i) => {
    const b = 0.61 + V.sy, bz = -0.02, P = (r, sx, sy, sz, x, y, z) => [r, sx, sy, sz, bx + x, b + y, bz + z];
    const fur = blobs([P(0.22, 1, 1.05, 0.86, 0, 0.2, 0), P(0.18, 1, 0.95, 0.95, 0, 0.55, 0.02), P(0.065, 1, 1, 0.55, -0.14, 0.7, 0.01), P(0.065, 1, 1, 0.55, 0.14, 0.7, 0.01),
      P(0.075, 1, 1.5, 1, -0.23, 0.23, 0.06), P(0.075, 1, 1.5, 1, 0.23, 0.23, 0.06), P(0.09, 1, 0.95, 1.7, -0.13, 0.06, 0.24), P(0.09, 1, 0.95, 1.7, 0.13, 0.06, 0.24)]);
    const pale = blobs([P(0.15, 1, 1.1, 0.5, 0, 0.19, 0.13), P(0.075, 1, 0.8, 0.9, 0, 0.5, 0.15), P(0.04, 1, 1, 0.45, -0.14, 0.7, 0.04), P(0.04, 1, 1, 0.45, 0.14, 0.7, 0.04), P(0.06, 1, 1, 0.3, -0.13, 0.06, 0.385), P(0.06, 1, 1, 0.3, 0.13, 0.06, 0.385)]);
    const eyes = blobs([P(0.022, 1, 1, 0.6, -0.068, 0.6, 0.175), P(0.022, 1, 1, 0.6, 0.068, 0.6, 0.175), P(0.028, 1.2, 0.8, 0.7, 0, 0.53, 0.225)]);
    const bow = blobs([P(0.05, 1.25, 0.8, 0.45, -0.055, 0.39, 0.165), P(0.05, 1.25, 0.8, 0.45, 0.055, 0.39, 0.165), P(0.024, 1, 1, 0.8, 0, 0.39, 0.185)]);
    [[fur, plushFur[i]], [pale, plushPale[i]], [eyes, plushEye], [bow, plushBow[i]]].forEach(([g, mat], q) => {
      const m = put(g, mat); m.userData.plush = true; m.userData.cx = bx; m.userData.cz = bz; if (!q) plush.push(m);
    });
  });

  // the engine: cast iron, moved but never folded. Firewall, radiator and strut towers stand round it
  const eg = V.gy, eL = (V.eng[0] + V.eng[1]) / 2, eLen = V.eng[1] - V.eng[0], eW = V.eng[2];
  const engineParts = [
    put(ibox(eW * 1.5, 0.10, eLen * 0.8), carEngine, 0, 0.23 + eg, eL),                  // sump
    put(ibox(eW * 2, 0.32, eLen), carEngine, 0, 0.44 + eg, eL),                          // block
    put(ibox(eW * 1.6, 0.10, eLen * 0.86), carEngine, 0, 0.65 + eg, eL),                 // head
    put(ibox(eW * 1.25, 0.05, eLen * 0.74), carEngineTop, 0, 0.725 + eg, eL),            // cover
    put(ibox(eW * 0.5, 0.14, eLen * 0.5), carEngine, eW * 1.05, 0.48 + eg, eL + 0.04),   // gearbox end
  ];
  engineParts.forEach(m => { m.userData.engine = true; });
  const eTop = 0.75 + eg;
  if (V.hood[1] - V.hood[0] > 0.8) {
    put(ibox(1.0, 0.42, 0.05), carRad, 0, 0.53 + eg, Math.min(2.02, V.eng[1] + 0.12));
    for (const sx of [1, -1]) put(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 12), carTrim, sx * 0.6, 0.55 + eg, V.eng[0] - 0.02);
    put(ibox(1.3, 0.44, 0.04), carTrim, 0, 0.55 + eg, V.hood[0] - 0.02);       // firewall
  }

  // floor pan between the wheels, wheel-well liners
  put(ibox(1.26, 0.14, 3.70), carTrim, 0, 0.29 + V.gy, 0).userData.interior = true;
  for (const sx of [1, -1]) for (const zw of WHEEL_Z)
    put(new THREE.CylinderGeometry(ARCH_R - 0.01, ARCH_R - 0.01, 0.26, 20, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), carLiner, sx * 0.74, WHEEL_Y, zw);

  // wheels: tyre with sidewall and tread shoulders, five-spoke alloy, brake disc
  const tyreProfile = [[0.205, -0.098], [0.245, -0.108], [0.283, -0.104], [0.304, -0.089], [0.312, -0.06], [0.3135, 0], [0.312, 0.06], [0.304, 0.089], [0.283, 0.104], [0.245, 0.108], [0.205, 0.098]].map(p => new THREE.Vector2(p[0], p[1]));
  const wk = V.wheel.k, wg = g => g.scale(1, wk, wk);
  const wheelSets = [];
  for (const sx of [1, -1]) for (const zw of WHEEL_Z) {
    const wx = sx * V.wheel.x, w0 = meshes.length;
    { const t = put(wg(new THREE.LatheGeometry(tyreProfile, 40).rotateZ(-Math.PI / 2)), carTyre, wx, WHEEL_Y, zw); t.userData.wx = wx; t.userData.wz = zw; tires.push(t); }
    put(wg(new THREE.CylinderGeometry(0.206, 0.206, 0.19, 32, 1, true).rotateZ(Math.PI / 2)), carAlloy, wx, WHEEL_Y, zw);
    put(wg(new THREE.TorusGeometry(0.198, 0.012, 6, 32).rotateY(Math.PI / 2)), carAlloy, wx + sx * 0.09, WHEEL_Y, zw);
    put(new THREE.CylinderGeometry(0.058, 0.064, 0.05, 16).rotateZ(Math.PI / 2), carAlloy, wx + sx * 0.08, WHEEL_Y, zw);
    put(wg(new THREE.CylinderGeometry(0.16, 0.16, 0.022, 28).rotateZ(Math.PI / 2)), carDisc, wx - sx * 0.02, WHEEL_Y, zw);
    put(boxG(0.05, 0.11, 0.09), carCaliper, wx - sx * 0.02, WHEEL_Y + 0.07, zw - 0.11);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + 0.93;
      put(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6).rotateZ(Math.PI / 2), carChrome, wx + sx * 0.108, WHEEL_Y + Math.cos(a) * 0.042 * wk, zw + Math.sin(a) * 0.042 * wk);
    }
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + 0.3, g = boxG(0.035, 0.15, 0.045);
      g.translate(0, 0.115, 0); g.rotateX(a);
      put(wg(g), carAlloy, wx + sx * 0.075, WHEEL_Y, zw);
    }
    wheelSets.push({ sx, zw, src: meshes.slice(w0) });
  }
  if (SHELL_ON) shellCarve(V, body, put, [paint, carTrim], zb.length, M, ths);
  // oil and coolant come out under the engine once it is crushed
  const oil = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2), carOil);
  oil.scale.setScalar(0.001); oil.visible = false;

  // per vertex: original position and normal, where it sits in the collapse field, a fixed crumple
  const seed = rand(0, 50);
  meshes.forEach(m => {
    m.geometry.computeVertexNormals();
    const a = m.geometry.attributes.position.array, nr = m.geometry.attributes.normal.array, n = a.length / 3, ud = m.userData;
    m.geometry.setAttribute('aPlan', new THREE.BufferAttribute(Float32Array.from(a), 3)); m.geometry.setAttribute('aY0', new THREE.BufferAttribute(Float32Array.from({ length: n }, (_, i) => a[i * 3 + 1]), 1));
    ud.orig = Float32Array.from(a); ud.nrm = Float32Array.from(nr, v => (isFinite(v) ? v : 0));
    ud.gn = new Int32Array(n); ud.ga = new Float32Array(n); ud.gb = new Float32Array(n); ud.scr = new Float32Array(n); ud.nz = new Float32Array(n * 3); ud.cr = new Float32Array(n); ud.maxDsp = 0; ud.hit = 0; ud.hitMask = new Uint8Array(n);
    ud.mud = new Float32Array(n); m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (let i = 0, j = 0; j < n; i += 3, j++) {
      const gi = Math.max(0, Math.min(GNX - 2, Math.floor((a[i] - GX0) / GC))), gj = Math.max(0, Math.min(GNZ - 2, Math.floor((a[i + 2] - GZ0) / GC)));
      ud.gn[j] = gi * GNZ + gj; ud.ga[j] = Math.max(0, Math.min(1, (a[i] - GX0) / GC - gi)); ud.gb[j] = Math.max(0, Math.min(1, (a[i + 2] - GZ0) / GC - gj));
      ud.nz[i] = crumple(a[i], a[i + 1], a[i + 2], seed);
      ud.nz[i + 1] = crumple(a[i + 2], a[i], a[i + 1], seed + 31);
      ud.nz[i + 2] = crumple(a[i + 1], a[i + 2], a[i], seed + 57);
      const r = 1 - Math.abs(2 * vnoise(a[i] * 3.4 + seed, a[i + 1] * 3.4, a[i + 2] * 3.4) - 1);   // ridged: sharp folds, not bumps
      const r2 = 1 - Math.abs(2 * vnoise(a[i] * 8 + 7, a[i + 1] * 8, a[i + 2] * 8 + seed) - 1);
      ud.cr[j] = (r * r * r * r - 0.28) * 0.15 + (r2 * r2 - 0.35) * 0.018;
    }
  });
  tires.forEach(t => t.userData.tire = true);
  mirrors.forEach(m => m.userData.mirror = true);
  // airbags fire on the first hit: no part of the warp, they only hang there and get squeezed
  const bagMat = new THREE.MeshStandardMaterial({ color: lin('#e9e7df'), roughness: 0.85 }), bags = [];
  for (const [bx, by, bz] of [[0.38, 0.98 + V.sy, V.dash - 0.42], [-0.38, 0.98 + V.sy, V.dash - 0.34]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), bagMat);
    b.position.set(bx, by, bz); b.scale.setScalar(0.001); b.visible = false; b.userData.loose = true; group.add(b); bags.push(b);
  }
  // the strip of car the track will run along, and its height along that strip
  const across = !!mode.across, Lc = across ? bandX : 0, bx = [], bL = [], over = [];
  if (across) for (let k = 0; k < 23; k++) { const x = -1.1 + k * BDL; bx.push(x); bL.push(Lc); over.push(Math.abs(x) > 0.92); }
  else if (mode.track) for (let k = 0; k < NB; k++) { const L = BL0 + k * BDL; bx.push(bandX); bL.push(L); over.push(Math.abs(L) > 1.42); }
  const nb = bx.length, Hs = new Float64Array(nb);
  meshes.forEach(m => { if (m.userData.thin) return; const a = m.userData.orig; for (let i = 0; i < a.length; i += 3) {
    if (Math.abs(across ? a[i + 2] - Lc : a[i] - bandX) > 0.29) continue;
    const k = Math.round(across ? (a[i] + 1.1) / BDL : (a[i + 2] - BL0) / BDL); if (k >= 0 && k < nb) Hs[k] = Math.max(Hs[k], a[i + 1]);
  } });
  let roofTop = 0, rxMax = 0, rz0 = 9, rz1 = -9;
  { const a = cabin.geometry.attributes.position.array; for (let i = 1; i < a.length; i += 3) if (a[i] > roofTop) roofTop = a[i];
    for (let i = 0; i < a.length; i += 3) if (a[i + 1] > roofTop - 0.1) { rxMax = Math.max(rxMax, Math.abs(a[i])); rz0 = Math.min(rz0, a[i + 2]); rz1 = Math.max(rz1, a[i + 2]); } }
  const hardF = new Float32Array(GN), bandHard = new Float32Array(nb);
  // the frame of the car, as heights it cannot be pressed below: floor pan and sills doubled over, axles and hubs with the
  // tyre folded round them, seat frames, the rear subframe; the sheet drapes from each of them down to the next
  const lump = (x, L, cx, cL, rx, rL, h, fall = 1.5) => h - fall * Math.hypot(Math.max(0, Math.abs(x - cx) - rx), Math.max(0, Math.abs(L - cL) - rL));
  const strRand = Array.from({ length: 8 }, () => rand(0.92, 1.1)), g0 = V.gy;
  const hardAt = (x, L) => {
    // heights are in the car's own frame, where its underside is at about 0.22 m: with the belly on the ground that is the part standing above it
    const b0 = 0.22 + g0;
    let h = Math.abs(x) < 1.0 && Math.abs(L) < 1.7 ? b0 + 0.11 * strRand[0] + 0.035 * vnoise(x * 3.1 + seed, L * 3.1, 9) : 0;   // nose and tail are hollow beyond the rails
    h = Math.max(h, lump(x, L, 0, (V.eng[0] + V.eng[1]) / 2, V.eng[2], (V.eng[1] - V.eng[0]) / 2, eTop - 0.05 * strRand[1]));
    for (const zw of WHEEL_Z) for (const sx of [1, -1]) h = Math.max(h, lump(x, L, sx * V.wheel.x * 0.92, zw, 0.13, 0.17, b0 + 0.27 * strRand[2]));
    for (const zw of WHEEL_Z) h = Math.max(h, lump(x, L, 0, zw, 0.6, 0.05, b0 + 0.15 * strRand[3]));   // axle beam, subframe
    for (const sx of [1, -1]) h = Math.max(h, lump(x, L, sx * 0.38, 0.05, 0.2, 0.22, b0 + 0.19 * strRand[4]), lump(x, L, sx * 0.42, -0.85, 0.2, 0.18, b0 + 0.15 * strRand[5]));
    for (const sx of [1, -1]) for (const L0 of V.doors) h = Math.max(h, lump(x, L, sx * 0.84, L0, 0.05, 0.06, b0 + 0.22 * strRand[6], 2.2));   // pillar feet
    return Math.max(0, h);
  };
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) hardF[n] = hardAt(GX0 + i * GC, GZ0 + j * GC);
  for (let k = 0; k < nb; k++) bandHard[k] = Math.max(hardAt(bx[k], bL[k]), hardAt(bx[k] - 0.15, bL[k]), hardAt(bx[k] + 0.15, bL[k]));
  const engN = []; for (let n = 0; n < GN; n++) { const x = GX0 + Math.floor(n / GNZ) * GC, L = GZ0 + (n % GNZ) * GC; if (Math.abs(x) < V.eng[2] && L > V.eng[0] && L < V.eng[1]) engN.push(n); }
  return { wheelSets, engN, hardF, bandHard, eTop, roofHole: [rxMax * 0.6, rz0 + 0.22, rz1 - 0.22], plush, kind, modeKey, V, f: buildField(meshes, seed, V), give: 0, snapped: false, lost: 0, pass: 0, belt: beltY(0), sill: V.zones[1][0], z: carZ, bandX, crawlK: rand(0.88, 1.12), across, Lc, nb, bx, bL, over, ground: carGround(V),
    ip: across ? CAR_IR : CAR_IP, ir: across ? CAR_IP : CAR_IR, lamp, tail, bags, bagMat, mudCut, mudL: 9, mud, tops: new Float32Array(TOPN * TOPM), group, meshes, paint, mats: [paint, sideGlass, screen, lamp, tail, bagMat], cabin, sideGlass, screen, sideIdx: Array.from(sideIdx), tires, mirrors, oil, seed,
    fold: [rand(0.75, 1.15), rand(0.75, 1.15)], phase: rand(0, 0.155), Hs };
}

