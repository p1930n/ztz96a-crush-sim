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
  carried.forEach(C => { C.lumps.count = CLUMPS + Math.round(LUMPS * (rubber ? 0.3 : 1)); C.grass.active = Math.round(C.grass.blades.length * (rubber ? 0.6 : 1)); C.grass.fresh = true; });
  paintLinks();
}
paintLinks();
const rr = (a, b) => a + Math.random() * (b - a);
// Mud is not lumps on a track: it is wet earth pressed into the links. A cake is one low sheet on the steel, thick in the middle and
// thinning to nothing at a torn edge, so it runs into the metal instead of sitting on it. It lies along -y, the side the link faces out
const lumpGeo = (() => {
  const NX = 9, NZ = 15, pos = [], idx = [], hs = [], wob = (x, z, f, o) => Math.sin(x * f + o) * Math.cos(z * f * 0.8 - o * 1.7);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x = i / (NX - 1) - 0.5, z = j / (NZ - 1) - 0.5;
    const edge = 1 - Math.pow(Math.hypot(x * 2, z * 2) / (0.93 + 0.2 * wob(x, z, 9, 1.3) + 0.1 * wob(x, z, 21, 4.1)), 3);
    const h = Math.max(0, edge) * (0.62 + 0.26 * wob(x, z, 13, 0.7) + 0.12 * wob(x, z, 31, 2.9));
    hs.push(h); pos.push(x, -h, z);
  }
  for (let i = 0; i + 1 < NX; i++) for (let j = 0; j + 1 < NZ; j++) {
    const a = i * NZ + j, b = a + 1, c = a + NZ, d = c + 1;
    if (hs[a] + hs[b] + hs[c] + hs[d] > 0) idx.push(a, b, c, b, d, c);      // the bare steel beyond a cake's edge has no sheet over it
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
})();
const lumpMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0 });
aged(lumpMat, `
  float mudN = wearNoise(vWear * vec3(70.0, 9.0, 70.0) + vWearSeed), mudF = wearNoise(vWear * vec3(210.0, 20.0, 210.0) + vWearSeed * 2.0);
  wearC *= 0.74 + 0.36 * mudN + 0.22 * mudF;
  wearRough = 0.7 + 0.28 * mudN;`);
const weedMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0, side: THREE.DoubleSide, vertexColors: true });
const WEED = [lin('#5f7a2c'), lin('#7c8f3a'), lin('#9c9450'), lin('#4c6426'), lin('#b3a566')];
const lumpM = new THREE.Matrix4(), lumpQ = new THREE.Quaternion(), lumpE = new THREE.Euler(), lumpP = new THREE.Vector3(), lumpS = new THREE.Vector3();
const place = (x, y, z, rx, ry, rz, sx, sy, sz) => new THREE.Matrix4().compose(lumpP.set(x, y, z), lumpQ.setFromEuler(lumpE.set(rx, ry, rz)), lumpS.set(sx, sy, sz));
const LUMPS = Math.round(LINKS * 1.25), CLUMPS = 34, BLADE_NODES = 6, GROOVE = 0.045, LINK_HALF = 0.3;
// Grass the wheels have run over. It lies pressed flat in the groove beside a grouser, along the link and half under the mud that holds
// it, bruised dark and stained; where a blade runs past the edge of the link nothing presses it, and that end hangs free
function newGrass(zc) {
  const blades = [];
  for (let n = 0; n < CLUMPS; n++) {
    const edge = Math.random() < 0.6, sgn = Math.random() < 0.5 ? 1 : -1, rz = edge ? sgn * rr(0.17, 0.27) : rr(-0.2, 0.2), gx = (Math.random() < 0.5 ? 1 : -1) * GROOVE;
    const clump = { i: Math.floor(Math.random() * LINKS), rz, gx, dry: Math.random() < 0.3 };
    for (let b = 0, nb = 5 + Math.floor(Math.random() * 4); b < nb; b++) {
      const dry = clump.dry ? Math.random() < 0.8 : Math.random() < 0.15, tint = WEED[dry ? 2 + 2 * Math.floor(Math.random() * 2) : [0, 0, 1, 3][Math.floor(Math.random() * 4)]];
      // most are torn short and stay wholly under the link; some are long enough to reach past its edge
      const tail = edge && Math.random() < 0.55, seg = tail ? rr(0.035, 0.07) : rr(0.018, 0.045), dir = (edge ? sgn : Math.random() < 0.5 ? 1 : -1);
      const pin = []; let z = rz + rr(-0.03, 0.03), x = gx + rr(-0.012, 0.012), d = dir, last = 0;
      for (let k = 0; k < BLADE_NODES; k++) {
        if (k > 1 && Math.abs(z) >= LINK_HALF - 0.005) { if (tail) break; d = -d; z += d * seg * 2; }    // a short blade folds back at the edge
        pin.push([x, -0.038 + rr(-0.003, 0.002), z]); last = k;
        z += d * seg; x += rr(-0.009, 0.009); x = Math.sign(x) * Math.max(0.022, Math.min(0.068, Math.abs(x)));
      }
      blades.push({
        n, i: clump.i, rz, gx, s: Math.max(1, last), pin, dirZ: dir, seg, w: rr(0.0035, 0.0065), stiff: rr(0.06, 0.16), ax: rr(-1, 1), az: rr(-1, 1), tw: rr(-0.7, 0.7), tint, gain: rr(0.6, 1), dry
      });
    }
  }
  const N = blades.length * BLADE_NODES, P = new Float32Array(N * 3), V = new Float32Array(N * 3), D = new Float32Array(BLADE_NODES * 3);
  const pos = new Float32Array(N * 9), nor = new Float32Array(N * 9), col = new Float32Array(N * 9), idx = [];
  blades.forEach((B, b) => {
    for (let k = 0; k < BLADE_NODES; k++) {
      const q = (b * BLADE_NODES + k) * 3, t = k / (BLADE_NODES - 1), pressed = k <= B.s, bruise = pressed ? rr(0.38, 0.66) : rr(0.72, 1);
      tmpC.copy(B.tint).multiplyScalar(B.gain * bruise).lerp(WEED[4], t * t * (B.dry ? 0.7 : 0.18)).lerp(MUD[B.i % 4], pressed ? rr(0.2, 0.62) : rr(0, 0.18));
      for (let v = 0; v < 3; v++) { col[q * 3 + v * 3] = tmpC.r; col[q * 3 + v * 3 + 1] = tmpC.g; col[q * 3 + v * 3 + 2] = tmpC.b; }
      if (k) { const a = q - 3, c = q; for (let v = 0; v < 2; v++) idx.push(a + v, a + v + 1, c + v, a + v + 1, c + v + 1, c + v); }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, weedMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; gear.add(mesh);
  return { zc, blades, P, V, D, pos, nor, geo, mesh, active: blades.length, fresh: true, rootX: new Float32Array(blades.length * 3), rootD: new Float32Array(blades.length * 3), flat: new Float32Array(blades.length * 2) };
}
const carried = SIDES.map(z => {
  const grass = newGrass(z), lumps = new THREE.InstancedMesh(lumpGeo, lumpMat, LUMPS + CLUMPS);
  lumps.castShadow = false; lumps.receiveShadow = true; gear.add(lumps);
  const lumpAt = [], seen = {}, mudC = () => tmpC.copy(MUD[Math.floor(Math.random() * MUD.length)]).multiplyScalar(rr(0.9, 1.5));
  // the mud that holds each clump comes first, so a lighter load still keeps it
  grass.blades.forEach(B => {
    if (seen[B.n]) return; seen[B.n] = 1;
    lumps.setColorAt(lumpAt.length, mudC());
    lumpAt.push({ i: B.i, m: place(B.gx, -0.025, B.rz, 0, Math.random() < 0.5 ? 0 : Math.PI, 0, rr(0.05, 0.062), rr(0.013, 0.02), rr(0.1, 0.2)) });
  });
  for (let n = 0; n < LUMPS; n++) {
    // packed in a groove; or caked right across a link and over the end of it, up to the grouser's height and no further
    const across = Math.random() < 0.22, gx = (Math.random() < 0.5 ? 1 : -1) * GROOVE;
    lumps.setColorAt(lumpAt.length, mudC());
    lumpAt.push({ i: Math.floor(Math.random() * LINKS), m: across
      ? place(rr(-0.02, 0.02), -0.024, rr(-0.18, 0.18), 0, Math.random() < 0.5 ? 0 : Math.PI, 0, rr(0.11, 0.15), rr(0.016, 0.028), rr(0.3, 0.62))
      : place(gx + rr(-0.006, 0.006), -0.025, rr(-0.22, 0.22), 0, Math.random() < 0.5 ? 0 : Math.PI, 0, rr(0.04, 0.062), rr(0.008, 0.02), rr(0.1, 0.36)) });
  }
  return { lumps, grass, lumpAt };
});
const dummy = new THREE.Object3D(), linkMs = Array.from({ length: LINKS }, () => new THREE.Matrix4()), linkXs = SIDES.map(() => new Float32Array(LINKS)), linkYs = SIDES.map(() => new Float32Array(LINKS)), linkAs = SIDES.map(() => new Float32Array(LINKS));
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
      linkMs[i].copy(dummy.matrix); linkXs[s][i] = p.x; linkYs[s][i] = p.y; linkAs[s][i] = p.a;
    }
    im.instanceMatrix.needsUpdate = true; treads[s].instanceMatrix.needsUpdate = true;
    const C = carried[s];
    C.lumpAt.forEach((l, n) => { lumpM.multiplyMatrices(linkMs[l.i], l.m); C.lumps.setMatrixAt(n, lumpM); });
    C.lumps.instanceMatrix.needsUpdate = true;
  });
}
layTracks();
/* What is pressed under a link goes with the link. What runs past its edge moves in the frame of the running gear, with its velocity
   kept against the ground: the air and the ground stand still. Each free end follows the link with fixed segment lengths. */
const GRASS_H = 1 / 60, BIN_X0 = -3.7, BIN_DX = 0.1, BINS = 74, BELT_OUT = 0.05;
const beltLo = SIDES.map(() => new Float32Array(BINS)), beltHi = SIDES.map(() => new Float32Array(BINS));
let grassAcc = 0, grassCost = 0, grassStill = 0;
function beltBins(s) {
  const lo = beltLo[s], hi = beltHi[s], X = linkXs[s], Y = linkYs[s];
  lo.fill(9); hi.fill(-9);
  for (let i = 0; i < LINKS; i++) {
    const j = (i + 1) % LINKS, x1 = X[i], x2 = X[j], y1 = Y[i], y2 = Y[j];
    const a = Math.max(0, Math.ceil((Math.min(x1, x2) - BIN_X0) / BIN_DX)), b = Math.min(BINS - 1, Math.floor((Math.max(x1, x2) - BIN_X0) / BIN_DX));
    for (let k = a; k <= b; k++) {
      const x = BIN_X0 + k * BIN_DX, y = x1 === x2 ? y1 : y1 + (y2 - y1) * (x - x1) / (x2 - x1);
      if (y < lo[k]) lo[k] = y; if (y > hi[k]) hi[k] = y;
    }
  }
}
function grassStep(dt) {
  // with the tank stopped the blades come to rest and stay there
  grassStill = speed === 0 && hull.w === 0 && !carried[0].grass.fresh ? grassStill + dt : 0;
  if (grassStill > 3) return;
  const t0 = performance.now();
  grassAcc = Math.min(grassAcc + dt, 5 * GRASS_H);
  const steps = Math.floor(grassAcc / GRASS_H); grassAcc -= steps * GRASS_H;
  for (let s = 0; s < 2; s++) {
    const G = carried[s].grass;
    beltBins(s);
    const roots = grassRoots(s, G);
    if (steps) grassMove(s, G, steps, roots);
    grassMesh(G);
  }
  grassCost += (performance.now() - t0 - grassCost) * 0.05;
}
// where the pressed part of each blade lies now: on its link, turning with it
function grassRoots(s, G) {
  const X = linkXs[s], Y = linkYs[s], A = linkAs[s], R = G.rootX, O = G.rootD, P = G.P, N = BLADE_NODES, lift = rubberTrack ? -0.018 : 0; let jump = false;
  for (let b = 0; b < G.active; b++) {
    const B = G.blades[b], a = A[B.i], c = Math.cos(a), sn = Math.sin(a), q = b * 3, o = b * N * 3;
    for (let k = 0; k <= B.s; k++) {
      const L = B.pin[Math.min(k, B.pin.length - 1)], ly = L[1] + lift, n = o + k * 3;
      P[n] = X[B.i] + c * L[0] - sn * ly; P[n + 1] = Y[B.i] + sn * L[0] + c * ly; P[n + 2] = G.zc + L[2];
    }
    if (!G.fresh && Math.abs(R[q] - P[o]) + Math.abs(R[q + 1] - P[o + 1]) > 1.2) jump = true;   // a seek in the replay
    R[q] = P[o]; R[q + 1] = P[o + 1]; R[q + 2] = P[o + 2];
    G.flat[b * 2] = c; G.flat[b * 2 + 1] = sn;
    // the way a free end leaves the link: past the edge, and out from the shoe
    const ox = sn * 0.5, oy = -c * 0.5, oz = B.dirZ, l = Math.hypot(ox, oy, oz);
    O[q] = ox / l; O[q + 1] = oy / l; O[q + 2] = oz / l;
  }
  if (G.fresh || jump) grassSeed(s, G);
  return R;
}
function grassSeed(s, G) {
  const O = G.rootD, N = BLADE_NODES;
  for (let b = 0; b < G.active; b++) {
    const B = G.blades[b], o = b * N * 3, e = o + B.s * 3;
    for (let k = B.s + 1; k < N; k++) {
      const q = o + k * 3, l = B.seg * (k - B.s);
      for (let v = 0; v < 3; v++) { G.P[q + v] = G.P[e + v] + O[b * 3 + v] * l; G.V[q + v] = 0; }
    }
  }
  G.fresh = false;
  grassMove(s, G, 120, G.rootX);   // let it hang before anyone sees it
}
function grassMove(s, G, steps, R) {
  const P = G.P, V = G.V, D = G.D, O = G.rootD, lo = beltLo[s], hi = beltHi[s], zc = G.zc, h = GRASS_H;
  const wy = hull.w, beltV = -(speed + wy * zc);   // lower run in this frame; the top run runs the other way
  const air = Math.exp(-5.5 * h), N = BLADE_NODES;
  const collide = (q, rest, soft) => {
    let x = P[q], y = P[q + 1], z = P[q + 2];
    const dz = z - zc, b = (x - BIN_X0) / BIN_DX;
    if (Math.abs(dz) < 0.31 && b >= 0 && b < BINS - 1) {
      const k = b | 0, f = b - k, a0 = lo[k], a1 = lo[k + 1], c0 = hi[k], c1 = hi[k + 1];
      if (a0 < 9 && a1 < 9) {
        const yl = a0 + (a1 - a0) * f - BELT_OUT, yh = c0 + (c1 - c0) * f + BELT_OUT;
        if (y > yl && y < yh) {
          const dl = y - yl, dh = yh - y, ds = 0.31 - Math.abs(dz);
          if (ds < dl && ds < dh) P[q + 2] = zc + (dz < 0 ? -0.31 : 0.31);
          else {
            P[q + 1] = dl < dh ? yl : yh;
            if (!soft) {     // caught by the links: it goes with them
              const vb = (dl < dh ? beltV : -beltV) + speed + wy * z;
              V[q] += (vb - V[q]) * 0.6; V[q + 2] *= 0.5; V[q + 1] = 0;
            }
          }
        }
      }
    }
    const roof = 1.08 + 0.1 * Math.min(1, Math.max(0, Math.max(x - 2.4, -2.7 - x) / 0.4));
    if (P[q + 1] > roof && Math.abs(z) < 1.84 && x > -3.75 && x < 3.5) P[q + 1] = roof;                 // under the fender
    if (y > 0.55 && Math.abs(z) > 1.74 && x > -3.19 && x < 3.52) P[q + 2] = z < 0 ? -1.74 : 1.74;      // behind the skirts
    if (y > 0.3 && Math.abs(z) < 1.06) P[q + 2] = z < 0 ? -1.06 : 1.06;                                 // off the hull side
    if (P[q + 1] < rest) { P[q + 1] = rest; if (!soft) { V[q] *= 0.25; V[q + 2] *= 0.25; if (V[q + 1] < 0) V[q + 1] = 0; } }   // on the ground, which stands still
  };
  for (let st = 0; st < steps; st++) {
    for (let b = 0; b < G.active; b++) {
      const B = G.blades[b], o = b * N * 3, seg = B.seg, s0 = B.s + 1;
      if (s0 >= N) continue;
      for (let k = s0; k < N; k++) {
        const q = o + k * 3, x0 = P[q], y0 = P[q + 1], z0 = P[q + 2];
        D[k * 3] = x0; D[k * 3 + 1] = y0; D[k * 3 + 2] = z0;
        V[q] *= air; V[q + 1] = (V[q + 1] - 9.81 * h) * air; V[q + 2] *= air;
        P[q] = x0 + (V[q] - speed - wy * z0) * h; P[q + 1] = y0 + V[q + 1] * h; P[q + 2] = z0 + (V[q + 2] + wy * x0) * h;
        collide(q, 0.004 + k * 0.0012, false);
      }
      // follow the leader, with the stiffness of the leaf pulling each segment towards the one before it
      let px = O[b * 3], py = O[b * 3 + 1], pz = O[b * 3 + 2];
      for (let k = s0; k < N; k++) {
        const q = o + k * 3, a = q - 3, st0 = k === s0 ? 0.3 : B.stiff * (1 - (k - 1) / (N - 1) * 0.7);
        let dx = P[q] - P[a], dy = P[q + 1] - P[a + 1], dz = P[q + 2] - P[a + 2], l = Math.hypot(dx, dy, dz) || 1;
        dx = dx / l + (px - dx / l) * st0; dy = dy / l + (py - dy / l) * st0; dz = dz / l + (pz - dz / l) * st0; l = Math.hypot(dx, dy, dz) || 1;
        px = dx / l; py = dy / l; pz = dz / l;
        P[q] = P[a] + px * seg; P[q + 1] = P[a + 1] + py * seg; P[q + 2] = P[a + 2] + pz * seg;
        collide(q, 0.004 + k * 0.0012, true);
        // what the chain really did this step becomes the velocity, so it cannot gain energy from the correction
        const ox = D[k * 3], oy = D[k * 3 + 1], oz = D[k * 3 + 2];
        V[q] = (P[q] - ox) / h + speed + wy * oz;
        V[q + 1] = (P[q + 1] - oy) / h; V[q + 2] = (P[q + 2] - oz) / h - wy * ox;
        const vm = Math.hypot(V[q] - speed, V[q + 1], V[q + 2]);
        if (vm > 7) { const f = 7 / vm; V[q] = speed + (V[q] - speed) * f; V[q + 1] *= f; V[q + 2] *= f; }
        V[q] = speed + (V[q] - speed) * 0.985; V[q + 1] *= 0.985; V[q + 2] *= 0.985;
      }
    }
  }
}
// a narrow V in section, so a leaf has a midrib and catches the light on one flank
function grassMesh(G) {
  const P = G.P, pos = G.pos, nor = G.nor, N = BLADE_NODES;
  for (let b = 0; b < G.active; b++) {
    const B = G.blades[b], o = b * N * 3;
    for (let k = 0; k < N; k++) {
      const q = o + k * 3, a = k ? q - 3 : q, c = k < N - 1 ? q + 3 : q;
      let tx = P[c] - P[a], ty = P[c + 1] - P[a + 1], tz = P[c + 2] - P[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      if (k <= B.s) {          // pressed: a flat, wider strip lying on the link
        const fc = G.flat[b * 2], fs = G.flat[b * 2 + 1], fw = B.w * 1.7 * (k === 0 || (k === N - 1) ? 0.3 : 1), v = q * 3;
        pos[v] = P[q] - fc * fw; pos[v + 1] = P[q + 1] - fs * fw; pos[v + 2] = P[q + 2];
        pos[v + 3] = P[q]; pos[v + 4] = P[q + 1]; pos[v + 5] = P[q + 2];
        pos[v + 6] = P[q] + fc * fw; pos[v + 7] = P[q + 1] + fs * fw; pos[v + 8] = P[q + 2];
        for (let e = 0; e < 3; e++) { nor[v + e * 3] = fs; nor[v + e * 3 + 1] = -fc; nor[v + e * 3 + 2] = 0; }
        continue;
      }
      const tw = B.tw * k, ca = Math.cos(tw), sa = Math.sin(tw), ax = B.ax * ca - B.az * sa, az = B.ax * sa + B.az * ca, ay = 0.35;
      let wx = ty * az - tz * ay, wy = tz * ax - tx * az, wz = tx * ay - ty * ax, wl = Math.hypot(wx, wy, wz) || 1;
      wx /= wl; wy /= wl; wz /= wl;
      const nx = wy * tz - wz * ty, ny = wz * tx - wx * tz, nz = wx * ty - wy * tx, t = k / (N - 1), w = B.w * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4 * 0.96), v = q * 3, fold = w * 0.35;
      pos[v] = P[q] - wx * w; pos[v + 1] = P[q + 1] - wy * w; pos[v + 2] = P[q + 2] - wz * w;
      pos[v + 3] = P[q] - nx * fold; pos[v + 4] = P[q + 1] - ny * fold; pos[v + 5] = P[q + 2] - nz * fold;
      pos[v + 6] = P[q] + wx * w; pos[v + 7] = P[q + 1] + wy * w; pos[v + 8] = P[q + 2] + wz * w;
      nor[v] = nx - wx * 0.45; nor[v + 1] = ny - wy * 0.45; nor[v + 2] = nz - wz * 0.45;
      nor[v + 3] = nx; nor[v + 4] = ny; nor[v + 5] = nz;
      nor[v + 6] = nx + wx * 0.45; nor[v + 7] = ny + wy * 0.45; nor[v + 8] = nz + wz * 0.45;
    }
  }
  G.geo.attributes.position.needsUpdate = true; G.geo.attributes.normal.needsUpdate = true;
  G.geo.setDrawRange(0, G.active * (N - 1) * 12);
}
const dustMarks = [1, -1].map(s => { const o = new THREE.Object3D(); o.position.set(-3.3, 0.12, s * 1.4); gear.add(o); return o; });

