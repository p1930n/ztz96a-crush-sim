/* ---------- running gear ---------- */
const spinners = [];
const WX = [2.15, 1.30, 0.45, -0.42, -1.28, -2.15];      // road-wheel stations, front to rear
const wheelArms = WX.map(() => []);                       // per station: left and right wheel, moved by the suspension
const latheZ = P => new THREE.LatheGeometry(P.map(p => new THREE.Vector2(p[0], p[1])), 32).rotateX(Math.PI / 2);
const wheelDish = latheZ([[0.0, 0.20], [0.11, 0.20], [0.135, 0.125], [0.29, 0.10], [0.31, 0.21], [0.335, 0.225]]);
const wheelTyre = latheZ([[0.325, 0.215], [0.36, 0.20], [0.36, -0.20], [0.325, -0.215]]);
M.paint.side = THREE.DoubleSide; M.rubber.side = THREE.DoubleSide;
function roadWheel(side, x) {
  const g = new THREE.Group(); g.position.set(x, 0.42, side * 1.40); gear.add(g);
  wheelArms[WX.indexOf(x)].push(g);
  const s = new THREE.Group(); g.add(s);
  const w = 0.46, f = side * w / 2;
  add(cylZ(0.30, 0.30, 0.18, 24), M.paint, s);
  add(wheelDish, M.paint, s).rotation.y = side < 0 ? Math.PI : 0;
  add(wheelTyre, M.rubber, s);
  add(cylZ(0.05, 0.05, 0.03, 12), M.steel, s, 0, 0, side * 0.245);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    add(cylZ(0.014, 0.014, 0.02, 8), M.steel, s, Math.cos(a) * 0.085, Math.sin(a) * 0.085, side * 0.205);
  }
  spinners.push({ o: s, r: 0.36, side });
}
function gearShape(N, rTip, rRoot) {
  const pts = [], pitch = Math.PI * 2 / N;
  for (let k = 0; k < N; k++) {
    const a = k * pitch;
    [[-0.32, rRoot], [-0.13, rTip], [0.13, rTip], [0.32, rRoot]].forEach(([fr, r]) => pts.push([Math.cos(a + fr * pitch) * r, Math.sin(a + fr * pitch) * r]));
  }
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, 0.12, 0, Math.PI * 2, true); s.holes.push(h);
  return s;
}
const sprocketGeo = new THREE.ExtrudeGeometry(gearShape(13, 0.335, 0.285), { depth: 0.05, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.025);
for (const side of [1, -1]) {
  WX.forEach(x => roadWheel(side, x));
  // idler (front)
  const ig = new THREE.Group(); ig.position.set(2.98, 0.78, side * 1.40); gear.add(ig);
  add(cylZ(0.28, 0.28, 0.42, 26), M.paint, ig);
  add(cylZ(0.10, 0.10, 0.06, 14), M.steel, ig, 0, 0, side * 0.23);
  for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; add(cylZ(0.05, 0.05, 0.02, 12), M.dark, ig, Math.cos(a) * 0.18, Math.sin(a) * 0.18, side * 0.211); }
  spinners.push({ o: ig, r: 0.28, side });
  // drive sprocket (rear)
  const sg = new THREE.Group(); sg.position.set(-3.10, 0.72, side * 1.40); gear.add(sg);
  add(sprocketGeo, M.paint, sg, 0, 0, 0.13);
  add(sprocketGeo, M.paint, sg, 0, 0, -0.13);
  add(cylZ(0.22, 0.22, 0.30, 20), M.paint, sg);
  add(cylZ(0.15, 0.17, 0.10, 18), M.steel, sg, 0, 0, side * 0.20);
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; add(cylZ(0.018, 0.018, 0.03, 8), M.dark, sg, Math.cos(a) * 0.12, Math.sin(a) * 0.12, side * 0.26); }
  spinners.push({ o: sg, r: 0.30, side });
  // return rollers
  [1.45, 0.0, -1.45].forEach(x => { const rg = new THREE.Group(); rg.position.set(x, 0.88, side * 1.40); gear.add(rg); add(cylZ(0.07, 0.07, 0.22, 14), M.paint, rg); spinners.push({ o: rg, r: 0.07, side }); });
}

/* tracks: links ride a belt path wrapped around sprocket, wheels, idler and rollers */
function buildBelt(circles) {
  const n = circles.length, tang = [];
  for (let i = 0; i < n; i++) {
    const A = circles[i], Bc = circles[(i + 1) % n];
    const dx = Bc.x - A.x, dy = Bc.y - A.y, L = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx) - Math.acos(Math.max(-1, Math.min(1, (A.r - Bc.r) / L)));
    const nx = Math.cos(phi), ny = Math.sin(phi);
    tang.push({ phi, x0: A.x + A.r * nx, y0: A.y + A.r * ny, x1: Bc.x + Bc.r * nx, y1: Bc.y + Bc.r * ny });
  }
  const segs = []; let total = 0;
  for (let i = 0; i < n; i++) {
    const t = tang[i], len = Math.hypot(t.x1 - t.x0, t.y1 - t.y0);
    segs.push({ L: 1, x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1, len, s0: total }); total += len;
    const C = circles[(i + 1) % n], t2 = tang[(i + 1) % n];
    let da = t2.phi - t.phi;
    if (C.end) {                       // sprocket and idler: the belt wraps half way round
      while (da < -1e-4) da += Math.PI * 2;
      while (da > Math.PI * 2) da -= Math.PI * 2;
    } else {                           // wheels and supports: a lifted wheel is a concave corner, no wrap
      while (da <= -Math.PI) da += Math.PI * 2;
      while (da > Math.PI) da -= Math.PI * 2;
    }
    if (da < 0) da = 0;
    segs.push({ L: 0, cx: C.x, cy: C.y, r: C.r, a0: t.phi, da, len: da * C.r, s0: total }); total += da * C.r;
  }
  return { segs, total };
}
function beltAt(b, s) {
  s = ((s % b.total) + b.total) % b.total;
  let lo = 0, hi = b.segs.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (b.segs[mid].s0 <= s) lo = mid; else hi = mid - 1; }
  const g = b.segs[lo], u = g.len > 0 ? (s - g.s0) / g.len : 0;
  if (g.L) return { x: g.x0 + (g.x1 - g.x0) * u, y: g.y0 + (g.y1 - g.y0) * u, a: Math.atan2(g.y1 - g.y0, g.x1 - g.x0) };
  const ang = g.a0 + g.da * u;
  return { x: g.cx + g.r * Math.cos(ang), y: g.cy + g.r * Math.sin(ang), a: ang + Math.PI / 2 };
}
const HT = 0.025;  // half link thickness
const SIDES = [1.40, -1.40];                       // track centre lines: right, left
const wd = SIDES.map(() => new Float64Array(WX.length));   // suspension travel per side and station: + = pushed up into the hull
// Belt path: sprocket, road wheels at their current travel, idler, return rollers. `sup` are points the
// lower run has to pass over (the top of something under that track), in tank frame at belt-centre height.
function beltCircles(side, sup) {
  const SPR = { x: -3.10, y: 0.72, r: 0.30 + HT, end: true }, IDL = { x: 2.98, y: 0.78, r: 0.28 + HT, end: true };
  const run = [SPR];
  for (let i = WX.length - 1; i >= 0; i--) run.push({ x: WX[i], y: 0.42 + wd[side][i], r: 0.36 + HT });
  run.push(IDL);
  const out = [];
  for (let k = 0; k < run.length; k++) {
    const A = run[k]; out.push(A);
    const B = run[k + 1]; if (!B) break;
    for (const P of sup) {
      if (P.x <= A.x || P.x >= B.x) continue;
      if (Math.hypot(P.x - A.x, P.y - A.y) < A.r + 0.01 || Math.hypot(P.x - B.x, P.y - B.y) < B.r + 0.01) continue;
      const yl = (A.y - A.r) + ((B.y - B.r) - (A.y - A.r)) * (P.x - A.x) / (B.x - A.x);
      if (P.y > yl + 0.004) out.push({ x: P.x, y: P.y, r: 0 });
    }
  }
  [1.45, 0.0, -1.45].forEach(x => out.push({ x, y: 0.88, r: 0.07 + HT }));
  return out;
}
const belts = SIDES.map((z, s) => buildBelt(beltCircles(s, [])));
const LINKS = Math.round(belts[0].total / 0.155);
const LPs = belts.map(b => b.total / LINKS), LP = LPs[0];
const linkGeo = mergeGeos([
  boxG(LP * 0.9, 0.05, 0.58),
  boxG(0.05, 0.06, 0.05).translate(LP / 2, 0, 0.30),
  boxG(0.05, 0.06, 0.05).translate(LP / 2, 0, -0.30),
  cylZ(0.016, 0.016, 0.03, 8).translate(LP / 2, 0, 0.33),
  cylZ(0.016, 0.016, 0.03, 8).translate(LP / 2, 0, -0.33),
  boxG(0.07, 0.085, 0.05).translate(0, 0.058, 0),
  boxG(LP * 0.5, 0.02, 0.14).translate(0, 0.03, 0.2),
  boxG(LP * 0.5, 0.02, 0.14).translate(0, 0.03, -0.2)
]);
// links carry packed mud and dirt: each one a different mix of steel and earth
const MUD = [lin('#4b3e2d'), lin('#5d4c37'), lin('#3d342a'), lin('#6a5a45')], STEEL = lin('#5b5a55'), tmpC = new THREE.Color();
const tracks = SIDES.map(z => {
  const im = new THREE.InstancedMesh(linkGeo, M.track, LINKS);
  im.castShadow = true; im.receiveShadow = true; im.userData.z = z; gear.add(im);
  return im;
});
// what meets the ground: a steel grouser bar, or two rubber pads of the same depth
const cleatGeo = boxG(0.035, 0.03, 0.52).translate(0, -0.038, 0);
const padGeo = mergeGeos([boxG(LP * 0.74, 0.03, 0.25).translate(0, -0.038, 0.145), boxG(LP * 0.74, 0.03, 0.25).translate(0, -0.038, -0.145)]);
const padMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
aged(padMat, `
  float n = wearNoise(vWear * 50.0 + vWearSeed), torn = smoothstep(0.66, 0.72, wearNoise(vWear * 26.0 + vWearSeed * 3.0)) * smoothstep(0.07, 0.11, abs(abs(vWear.z) - 0.145));
  wearC = mix(wearC, vec3(0.075, 0.07, 0.065), smoothstep(0.42, 0.7, n) * 0.8);
  wearC = mix(wearC, vec3(0.006), torn);`);
const treads = SIDES.map(z => {
  const im = new THREE.InstancedMesh(cleatGeo, M.track, LINKS);
  im.castShadow = true; im.receiveShadow = true; im.userData.z = z; gear.add(im);
  return im;
});
const RUBBER = lin('#1b1a19'), PAD_DUST = lin('#57493a');
let rubberTrack = false;
// steel carries packed mud; a padded link is cleaner, with dust on the rubber and only a little earth on the frame
function paintLinks() {
  tracks.forEach((im, s) => {
    for (let i = 0; i < LINKS; i++) {
      const m = MUD[Math.floor(Math.random() * MUD.length)];
      im.setColorAt(i, tmpC.copy(STEEL).lerp(m, rubberTrack ? 0.1 + Math.random() * 0.3 : 0.45 + Math.random() * 0.5));
      treads[s].setColorAt(i, rubberTrack ? tmpC.copy(RUBBER).lerp(PAD_DUST, Math.random() * Math.random() * 0.35) : tmpC.copy(STEEL).lerp(m, 0.45 + Math.random() * 0.5));
    }
    im.instanceColor.needsUpdate = true; treads[s].instanceColor.needsUpdate = true;
  });
}
function setTrackKind(rubber) {
  rubberTrack = rubber;
  treads.forEach(im => { im.geometry = rubber ? padGeo : cleatGeo; im.material = rubber ? padMat : M.track; });
  markMat.map = rubber ? markTexR : markTex;
  carried.forEach(C => { C.lumps.count = Math.round(LUMPS * (rubber ? 0.35 : 1)); C.weeds.count = Math.round(WEEDS * (rubber ? 0.6 : 1)); });
  paintLinks();
}
paintLinks();
const rr = (a, b) => a + Math.random() * (b - a);
const lumpGeo = new THREE.IcosahedronGeometry(1, 1);
{
  const a = lumpGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) { const k = 0.72 + 0.56 * Math.abs(Math.sin(a[i] * 7.1 + a[i + 1] * 4.3) * Math.cos(a[i + 2] * 5.7 - a[i] * 3.1)); a[i] *= k; a[i + 1] *= k; a[i + 2] *= k; }
  lumpGeo.computeVertexNormals();
}
// a tuft: thin bent blades growing along +y from the root
const tuftGeo = (() => {
  const pos = [];
  for (let b = 0; b < 6; b++) {
    const a = rr(0, 6.28), lean = rr(0.25, 0.9), L = rr(0.55, 1), w = 0.035, cx = Math.cos(a), cz = Math.sin(a), bx = rr(-0.08, 0.08), bz = rr(-0.08, 0.08);
    let prev = null;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, x = bx + cx * lean * L * t * t, y = L * t * (1 - 0.3 * t), z = bz + cz * lean * L * t * t, ww = w * (1 - t * 0.92);
      const P = [x - cz * ww, y, z + cx * ww, x + cz * ww, y, z - cx * ww];
      if (prev) pos.push(...prev.slice(0, 3), ...prev.slice(3), ...P.slice(0, 3), ...prev.slice(3), ...P.slice(3), ...P.slice(0, 3));
      prev = P;
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
})();
const lumpMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
const weedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
const WEED = [lin('#5f7a2c'), lin('#7c8f3a'), lin('#9c9450'), lin('#4c6426'), lin('#b3a566')];
const lumpM = new THREE.Matrix4(), lumpQ = new THREE.Quaternion(), lumpE = new THREE.Euler(), lumpP = new THREE.Vector3(), lumpS = new THREE.Vector3();
const place = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(lumpP.set(x, y, z), lumpQ.setFromEuler(lumpE.set(rx, ry, rz)), lumpS.set(sx, sy, sz));
const LUMPS = Math.round(LINKS * 1.5), WEEDS = Math.round(LINKS * 0.45);
const carried = SIDES.map(() => {
  const lumps = new THREE.InstancedMesh(lumpGeo, lumpMat, LUMPS), weeds = new THREE.InstancedMesh(tuftGeo, weedMat, WEEDS);
  lumps.castShadow = true; lumps.receiveShadow = true; weeds.castShadow = true; gear.add(lumps, weeds);
  const lumpAt = [], weedAt = [];
  for (let n = 0; n < LUMPS; n++) {
    const out = Math.random() < 0.8, z = out ? rr(-0.28, 0.28) : (Math.random() < 0.5 ? 1 : -1) * rr(0.25, 0.3), big = Math.random() < 0.18 ? 1.7 : 1;
    lumpAt.push({ i: Math.floor(Math.random() * LINKS), m: place(rr(-0.07, 0.07), out ? -0.05 : 0.03, z, rr(0, 3), rr(0, 3), rr(0, 3), rr(0.035, 0.075) * big, rr(0.016, 0.034) * big, rr(0.04, 0.11) * big) });
    lumps.setColorAt(n, tmpC.copy(MUD[Math.floor(Math.random() * MUD.length)]).multiplyScalar(rr(0.75, 1.25)));
  }
  for (let n = 0; n < WEEDS; n++) {
    const L = rr(0.14, 0.34);
    weedAt.push({ i: Math.floor(Math.random() * LINKS), m: place(rr(-0.05, 0.05), -0.045, rr(-0.27, 0.27), rr(-0.5, 0.5), rr(0, 6.28), Math.PI + rr(-0.5, 0.5), L * rr(0.7, 1.2), L, L * rr(0.7, 1.2)) });
    weeds.setColorAt(n, tmpC.copy(WEED[Math.floor(Math.random() * WEED.length)]).multiplyScalar(rr(0.8, 1.2)));
  }
  return { lumps, weeds, lumpAt, weedAt };
});
const dummy = new THREE.Object3D(), linkMs = Array.from({ length: LINKS }, () => new THREE.Matrix4()), linkYs = new Float32Array(LINKS), weedFlat = new THREE.Vector3();
const beltPh = [0, 0];     // how far the links have moved round, in links
// arc length of the lower run under tank-frame x
function lowerRunS(b, x) {
  const N = 480; let best = 0, by = Infinity, q = beltAt(b, 0);
  for (let k = 1; k <= N; k++) {
    const p = beltAt(b, k * b.total / N);
    if ((q.x - x) * (p.x - x) <= 0 && q.x !== p.x && Math.min(p.y, q.y) < by) { by = Math.min(p.y, q.y); best = (k - 1 + (x - q.x) / (p.x - q.x)) * b.total / N; }
    q = p;
  }
  return best;
}
// the belt is relaid over what it crosses, so its length changes: the links on the ground do not move for that
function relayBelt(s, nb) {
  const lp = nb.total / LINKS;
  beltPh[s] = (beltPh[s] + lowerRunS(nb, 0) / lp - lowerRunS(belts[s], 0) / LPs[s]) % LINKS;
  belts[s] = nb; LPs[s] = lp;
}
function layTracks() {
  tracks.forEach((im, s) => {
    const b = belts[s], lp = LPs[s];
    for (let i = 0; i < LINKS; i++) {
      const p = beltAt(b, (i + beltPh[s]) * lp);
      dummy.position.set(p.x, p.y, im.userData.z); dummy.rotation.set(0, 0, p.a); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix); treads[s].setMatrixAt(i, dummy.matrix);
      linkMs[i].copy(dummy.matrix); linkYs[i] = p.y;
    }
    im.instanceMatrix.needsUpdate = true; treads[s].instanceMatrix.needsUpdate = true;
    const C = carried[s];
    C.lumpAt.forEach((l, n) => { lumpM.multiplyMatrices(linkMs[l.i], l.m); C.lumps.setMatrixAt(n, lumpM); });
    // weeds lie pressed flat under the wheels and stand out again where the track lifts off the ground
    C.weedAt.forEach((w, n) => {
      const y = linkYs[w.i], k = y < 0.08 ? 0.22 : y > 0.32 ? 1 : 0.22 + 0.78 * (y - 0.08) / 0.24;
      lumpM.multiplyMatrices(linkMs[w.i], w.m).scale(weedFlat.set(1, k, 1)); C.weeds.setMatrixAt(n, lumpM);
    });
    C.lumps.instanceMatrix.needsUpdate = true; C.weeds.instanceMatrix.needsUpdate = true;
  });
}
layTracks();
const dustMarks = [1, -1].map(s => { const o = new THREE.Object3D(); o.position.set(-3.3, 0.12, s * 1.4); gear.add(o); return o; });

