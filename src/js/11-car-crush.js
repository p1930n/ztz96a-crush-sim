// how much each height band of a car gives: tyres and springs, sills and floor pan, body panels, glasshouse
function colLen(y, eps) {       // compressed height of the stretch 0..y of a column at squeeze level eps
  let out = 0, prev = 0;
  for (const [lim, w] of ZONES) {
    const seg = Math.min(y, lim) - prev; if (seg <= 0) break;
    out += seg * (1 - Math.min(0.86, eps * w)); prev = lim;
  }
  return out;
}
function squeezeEps(top, ceil) {
  let lo = 0, hi = 40;
  for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (colLen(top, mid) > ceil) lo = mid; else hi = mid; }
  return hi;
}

// underside of each track as currently laid, tank frame: lowest grouser face per 5 cm of length
const LB0 = -3.75, LBS = 0.05, LBN = 152, LBs = SIDES.map(() => new Float32Array(LBN));
function trackUnderside(s) {
  const LB = LBs[s], b = belts[s]; LB.fill(Infinity);
  const n = Math.ceil(b.total / 0.03);
  for (let k = 0; k < n; k++) {
    const p = beltAt(b, k * b.total / n), q = Math.round((p.x - LB0) / LBS);
    if (q >= 0 && q < LBN && p.y - 0.05 < LB[q]) LB[q] = p.y - 0.05;
  }
}
function lbAt(s, x) {
  const LB = LBs[s], f = (x - LB0) / LBS, b = Math.floor(f);
  if (b < 0 || b >= LBN - 1) return Infinity;
  const p = LB[b], q = LB[b + 1];
  if (p === Infinity || q === Infinity) return Math.min(p, q);
  return p + (q - p) * (f - b);
}
function ceilLocal(xl, zl) {    // tank underside over (xl, zl) in the tank frame; Infinity where there is no tank
  const az = Math.abs(zl), s = zl < 0 ? 1 : 0, tr = lbAt(s, xl);
  if (az <= 1.11) {             // between the tracks: belly plates; the car sags toward the track lines
    let c = (xl >= -3.42 && xl <= 3.46) ? 0.52 + (xl > 3.02 ? (xl - 3.02) * 1.05 : 0) + (xl < -3.30 ? (-3.30 - xl) * 3 : 0) : Infinity;
    const sag = tr + (1.11 - az) * 0.45;
    return Math.min(c, sag);
  }
  if (az <= 1.69) return tr;                  // under the track
  if (az <= 1.83 && xl > -3.19 && xl < 3.52) return 0.58 + Math.max(0, xl - 2.3) * 0.34;    // side skirts
  return Infinity;
}
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tankInv = new THREE.Matrix4(), MUDC = [lin('#5b4a35'), lin('#46392a')];
// where the column through car-local (x0, z0) meets the tank's underside: car-local height
function columnHit(cm, ti, x0, z0, yStart) {
  const bx = cm[0] * x0 + cm[8] * z0 + cm[12], by = cm[1] * x0 + cm[9] * z0 + cm[13], bz = cm[2] * x0 + cm[10] * z0 + cm[14];
  const lbx = ti[0] * bx + ti[4] * by + ti[8] * bz + ti[12], lby = ti[1] * bx + ti[5] * by + ti[9] * bz + ti[13], lbz = ti[2] * bx + ti[6] * by + ti[10] * bz + ti[14];
  const ux = ti[0] * cm[4] + ti[4] * cm[5] + ti[8] * cm[6], uy = ti[1] * cm[4] + ti[5] * cm[5] + ti[9] * cm[6], uz = ti[2] * cm[4] + ti[6] * cm[5] + ti[10] * cm[6];
  if (uy < 0.3) return Infinity;
  let y = yStart;
  for (let it = 0; it < 3; it++) {
    const c = ceilLocal(lbx + y * ux, lbz + y * uz); if (c === Infinity) return Infinity;
    y = (c - lby) / uy;
  }
  return y;
}
/* The collapse field. Sheet steel is one continuous skin, so nothing is crushed column by column: a grid over the car's
   plan holds how high the car may still stand at each point, and every part of the car (skin, glass, seats, wheels) is
   moved by the same smooth warp of space read from that grid. Where the tank presses, the grid is held under its underside;
   each neighbour is then dragged down within the slope the metal can bend at, so a collapse spreads as ramps and creases and
   never as a cut. The roof is stiff until its pillars let go, then comes down as one plate. Nothing springs back. */
const GC = 0.08, GNX = 33, GNZ = 66, GN = GNX * GNZ, GX0 = -1.28, GZ0 = -2.6;
const FALL_RATE = 9;    // how fast a panel with nothing holding it comes down: under its own collapse, close to free
function buildField(meshes, seed, V) {
  const top = new Float32Array(GN), real = new Float32Array(GN), sb = new Float32Array(GN), rf = new Float32Array(GN);
  meshes.forEach(m => {
    if (m.userData.mirror || m.userData.thin) return;
    const a = m.userData.orig;
    for (let i = 0; i < a.length; i += 3) {
      const gi = Math.round((a[i] - GX0) / GC), gj = Math.round((a[i + 2] - GZ0) / GC);
      if (gi < 0 || gi >= GNX || gj < 0 || gj >= GNZ) continue;
      const n = gi * GNZ + gj; if (a[i + 1] > real[n]) real[n] = a[i + 1];
    }
  });
  top.set(real);
  for (let p = 0; p < 2; p++) {             // the skin's vertices are sparse: spread each height to the nodes around it
    const t = top.slice();
    for (let i = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++) for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const a = i + di, b = j + dj; if (a < 0 || a >= GNX || b < 0 || b >= GNZ) continue;
      if (t[a * GNZ + b] > top[i * GNZ + j]) top[i * GNZ + j] = t[a * GNZ + b];
    }
  }
  const belt = beltY(0);
  for (let i = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++) {
    const n = i * GNZ + j, x = GX0 + i * GC, z = GZ0 + j * GC;
    sb[n] = 2.2 * (0.62 + 0.76 * vnoise(x * 2.6 + seed, z * 2.6, 3));     // uneven: the fold lines wander
    rf[n] = smooth01(belt + 0.08, belt + 0.26, top[n]);
  }
  let h0 = 0, vol = 0; for (let n = 0; n < GN; n++) { if (real[n] > h0) h0 = real[n]; vol += real[n]; }
  const hoodN = [], pillarN = [], roofN = [], doorN = [];   // the places whose failure is worth telling apart
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) {
    if (!real[n]) continue;
    const x = GX0 + i * GC, z = GZ0 + j * GC;
    if (z > V.cab[1] + 0.1) hoodN.push(n);
    if (rf[n] > 0.5) roofN.push(n);
    if (rf[n] > 0.1 && z > V.cab[1] - 0.5 && z < V.cab[1] + 0.05) pillarN.push(n);
    if (Math.abs(x) > 0.66 && Math.abs(z) < 1.0) doorN.push(n);
  }
  let px0 = 9, px1 = -9, pz0 = 9, pz1 = -9;
  for (const n of roofN) { const x = GX0 + Math.floor(n / GNZ) * GC, z = GZ0 + (n % GNZ) * GC; if (x < px0) px0 = x; if (x > px1) px1 = x; if (z < pz0) pz0 = z; if (z > pz1) pz1 = z; }
  const plate = { x0: px0, sx: 1 / Math.max(0.1, px1 - px0), z0: pz0, sz: 1 / Math.max(0.1, pz1 - pz0), D: [0, 0, 0, 0], W: roofN.map(n => { const u = (GX0 + Math.floor(n / GNZ) * GC - px0) / Math.max(0.1, px1 - px0), v = (GZ0 + (n % GNZ) * GC - pz0) / Math.max(0.1, pz1 - pz0); return [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v]; }) };
  const fold = new Float32Array(GN);
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) {
    const x = GX0 + i * GC, z = GZ0 + j * GC, r1 = 1 - Math.abs(2 * vnoise(x * 2.1 + seed, z * 1.3, 11) - 1), r2 = 1 - Math.abs(2 * vnoise(x * 4.3, z * 3.7 + seed, 13) - 1);
    fold[n] = Math.min(1, r1 * r1 * 0.75 + r2 * r2 * r2 * 0.4);
  }
  return { fold, plate, hoodN, pillarN, roofN, doorN, vol: vol * GC * GC, top, real, sb, rf, h0, R: new Float32Array(GN).fill(Infinity), V: Float32Array.from(top, t => t + 0.01), T: new Float32Array(GN), B: new Float32Array(GN), E: new Float32Array(GN), dirty: new Uint8Array(GN) };
}
function fieldStep(c, dt) {
  const f = c.f, { top, R, V, T: Vt, B, E, dirty, sb, rf } = f;
  useV(c.V);
  tank.updateMatrixWorld(); c.group.updateMatrixWorld();
  const ti = tankInv.copy(tank.matrixWorld).invert().elements, cm = c.group.matrixWorld.elements;
  let hit = false;
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) {
    let y = columnHit(cm, ti, GX0 + i * GC, GZ0 + j * GC, top[n]);
    if (c.pvBed && y < c.pvBed[n] + c.pvBedDrop) y = c.pvBed[n] + c.pvBedDrop;
    if (y < c.hardF[n]) y = c.hardF[n];
    if (y < R[n]) R[n] = y;
    if (R[n] < top[n]) hit = true;
  }
  if (!hit) return;
  const sr = c.V.stiff + (c.V.soft - c.V.stiff) * c.give, D1 = GC, D2 = GC * 1.414;
  const slope = n => sb[n] * (1 - rf[n]) + sr * rf[n];
  const open = f.h0 + 0.6;      // where nothing presses the field stays open, also off the car's edge
  for (let n = 0; n < GN; n++) Vt[n] = Math.min(R[n], open);
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) {     // two sweeps spread each low point outward
    const s = slope(n); let v = Vt[n];
    if (j > 0) v = Math.min(v, Vt[n - 1] + s * D1);
    if (i > 0) { v = Math.min(v, Vt[n - GNZ] + s * D1); if (j > 0) v = Math.min(v, Vt[n - GNZ - 1] + s * D2); if (j < GNZ - 1) v = Math.min(v, Vt[n - GNZ + 1] + s * D2); }
    Vt[n] = v;
  }
  for (let i = GNX - 1, n = GN - 1; i >= 0; i--) for (let j = GNZ - 1; j >= 0; j--, n--) {
    const s = slope(n); let v = Vt[n];
    if (j < GNZ - 1) v = Math.min(v, Vt[n + 1] + s * D1);
    if (i < GNX - 1) { v = Math.min(v, Vt[n + GNZ] + s * D1); if (j < GNZ - 1) v = Math.min(v, Vt[n + GNZ + 1] + s * D2); if (j > 0) v = Math.min(v, Vt[n + GNZ - 1] + s * D2); }
    Vt[n] = v;
  }
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) {     // round the folds off a little
    B[n] = (i > 0 && j > 0 && i < GNX - 1 && j < GNZ - 1) ? Math.min(R[n], (4 * Vt[n] + Vt[n - 1] + Vt[n + 1] + Vt[n - GNZ] + Vt[n + GNZ]) / 8) : Vt[n];
  }
  // The roof is a plate on four pillars, not a cloth: wherever it is pressed the whole plate tilts on its corners, and once the
  // pillars on one side have gone the cross members take the other side down with them
  const P = f.plate, Dp = P.D;
  f.roofN.forEach((n, q) => {
    if (R[n] >= top[n]) return;
    const w = P.W[q], d = top[n] - R[n], cur = w[0] * Dp[0] + w[1] * Dp[1] + w[2] * Dp[2] + w[3] * Dp[3];
    if (d > cur) { const e = (d - cur) / (w[0] * w[0] + w[1] * w[1] + w[2] * w[2] + w[3] * w[3]); for (let i = 0; i < 4; i++) Dp[i] += e * w[i]; }
  });
  if (c.snapped) for (const [a, b] of [[0, 1], [2, 3]]) { const m = Math.max(Dp[a], Dp[b]) * 0.62; if (Dp[a] < m) Dp[a] = m; if (Dp[b] < m) Dp[b] = m; }
  f.roofN.forEach((n, q) => {
    const w = P.W[q], dr = w[0] * Dp[0] + w[1] * Dp[1] + w[2] * Dp[2] + w[3] * Dp[3], y = top[n] - dr * (1 - 0.34 * f.fold[n]);
    if (y < B[n]) B[n] = y;
  });
  for (let n = 0; n < GN; n++) if (B[n] < c.hardF[n]) B[n] = c.hardF[n];
  const fall = FALL_RATE * dt;
  let lost = 0;
  for (let n = 0; n < GN; n++) {
    let v = Math.min(V[n], Math.max(B[n], V[n] - fall));
    if (R[n] < v) v = R[n];
    if (v < V[n] - 1e-4) { V[n] = v; dirty[n] = 1; E[n] = v < top[n] ? squeezeEps(top[n], Math.max(0.02, v)) : 0; }
    if (f.real[n] > 0 && V[n] < f.real[n]) lost += f.real[n] - V[n];
  }
  c.lost = lost * GC * GC;
}
function pvCrush(c, dt) {
  const f = c.f, cc = Math.cos(c.yawC), sc = Math.sin(c.yawC), grind = 1 + Math.abs(hull.w) * 1.6, load = Math.min(1, carLoad / GRAV * 2);
  if (load <= 0) return;
  for (const z of SIDES) for (let x = -2.2; x <= 2.2; x += 0.14) for (const o of [-0.24, 0, 0.24]) {
    const wx = x * hull.cy + (z + o) * hull.sy, wz = -x * hull.sy + (z + o) * hull.cy, px = wx - (c.u + c.X), pz = wz - c.z;
    const lx = px * sc + pz * cc, L = -(px * cc - pz * sc), gi = Math.round((lx - GX0) / GC), gj = Math.round((L - GZ0) / GC);
    if (gi < 0 || gi >= GNX || gj < 0 || gj >= GNZ) continue;
    const n = gi * GNZ + gj; if (f.real[n] <= 0) continue;
    const fl = Math.max(c.pvBed[n] + c.pvBedDrop, c.hardF[n]), v = f.V[n], rate = (v > c.belt ? 1.1 : v > c.sill ? 0.5 : 0.16) * grind * load;
    if (v > fl) f.R[n] = Math.min(f.R[n], Math.max(fl, v - rate * dt));
  }
}
// the tracks' mud and rubber wiped across the wreck at whatever angle they lie
function pvStamp(c, dt) {
  const v = Math.abs(speed) + Math.abs(hull.w) * 1.4; if (v < 0.05 || carLoad < 0.1) return;
  const cc = Math.cos(c.yawC), sc = Math.sin(c.yawC);
  for (let q = 0, m = Math.min(5, Math.ceil(v * dt * 40)); q < m; q++) {
    const z = SIDES[q % 2] + rand(-0.25, 0.25), x = rand(-2.2, 2.2), wx = x * hull.cy + z * hull.sy, wz = -x * hull.sy + z * hull.cy, px = wx - (c.u + c.X), pz = wz - c.z;
    const lx = px * sc + pz * cc, L = -(px * cc - pz * sc);
    if (Math.abs(lx) < 1.1 && Math.abs(L) < 2.4 && sampleV(c, lx, L) > 0.03) mudRow(c, lx, L, hull.yaw - c.yawC);
  }
  c.mudCut.value = -9;
}
// the ground scrubbed to a ring where the tracks swing round
function pvScuff(c) {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.1, 3.3, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d1710, transparent: true, opacity: 0, depthWrite: false }));
  m.userData.dx = -c.u; m.userData.dz = -c.z; m.position.set(0, -0.011, 0); scene.add(m); c.scuff = m;
}
function warpCar(c, all) {
  const f = c.f, D = f.dirty, EP = f.E, TP = f.top, VV = f.V, Gz = GNZ;
  useV(c.V);
  for (const m of c.meshes) {
    const ud = m.userData;
    if (ud.loose) continue;
    if (c.shell && !ud.fieldWarp) continue;
    const A = m.geometry.attributes.position.array, O = ud.orig, Nr = ud.nrm, N = ud.nz, GN_ = ud.gn, GA = ud.ga, GB = ud.gb;
    if (ud.engine) {
      const drop = Math.max(0, c.eTop + 0.004 - sampleV(c, 0, (c.V.eng[0] + c.V.eng[1]) / 2));
      if (drop !== ud.drop) { ud.drop = drop; for (let i = 1; i < A.length; i += 3) A[i] = O[i] - drop; m.geometry.attributes.position.needsUpdate = true; }
      continue;
    }
    const col = m.geometry.attributes.color.array;
    let dirty = false, tint = false;
    for (let i = 0, j = 0; i < A.length; i += 3, j++) {
      const g = GN_[j];
      if (!all && !(D[g] | D[g + 1] | D[g + Gz] | D[g + Gz + 1])) continue;
      const a = GA[j], b = GB[j], w00 = (1 - a) * (1 - b), w01 = (1 - a) * b, w10 = a * (1 - b), w11 = a * b;
      const eps = EP[g] * w00 + EP[g + 1] * w01 + EP[g + Gz] * w10 + EP[g + Gz + 1] * w11;
      const x0 = O[i], y0 = O[i + 1], z0 = O[i + 2];
      dirty = true;
      if (eps < 1e-4) { A[i] = x0; A[i + 1] = y0; A[i + 2] = z0; continue; }
      const top = TP[g] * w00 + TP[g + 1] * w01 + TP[g + Gz] * w10 + TP[g + Gz + 1] * w11;
      const vb = VV[g] * w00 + VV[g + 1] * w01 + VV[g + Gz] * w10 + VV[g + Gz + 1] * w11;
      let y = colLen(y0, eps), dx = 0, dz = 0;
      const dsp = y0 - y, n0 = N[i], n1 = N[i + 1], n2 = N[i + 2], belt = beltY(z0), ax = Math.abs(x0), sg = x0 < 0 ? -1 : 1, lean = c.fold[sg > 0 ? 0 : 1] * c.V.bulge * (0.85 + 0.3 * (n1 * 0.5 + 0.5));
      if (ud.plush) {
        const k = Math.min(0.75, dsp * 1.2);
        A[i] = x0 + (x0 - ud.cx) * k; A[i + 1] = Math.max(0.012, Math.min(vb - 0.004, y)); A[i + 2] = z0 + (z0 - ud.cz) * k * 0.7;
        if (dsp > ud.maxDsp) ud.maxDsp = dsp;
        continue;
      }
      if (y0 > belt) {
        // pillars and the glasshouse sides fold outward about their middle as the roof comes down
        const L = Math.max(1e-3, top - belt), Lc = colLen(top, eps) - colLen(belt, eps), sF = Math.min(1, (y0 - belt) / L);
        dx += sg * Math.min(0.24, Math.sqrt(Math.max(0, L * L - Lc * Lc)) * 0.5 * lean) * Math.sin(Math.PI * sF) * smooth01(0.42, 0.62, ax);
      } else if (y0 > 0.34) {
        // the doors buckle the same way: the panel keeps its length, so it has to go somewhere
        const L = belt - 0.34, Lc = colLen(belt, eps) - colLen(0.34, eps);
        dx += sg * Math.min(0.2, Math.sqrt(Math.max(0, L * L - Lc * Lc)) * 0.42 * lean) * Math.sin(Math.PI * (y0 - 0.34) / L) * smooth01(0.3, 0.72, ax);
      }
      const crease = ud.cr[j] + 0.012 * n2;
      if (c.shell) dx = 0;      // what still follows the heights on a shell car is floor and liners: they lie down, they are not sheet to crease
      else { dx += Nr[i] * dsp * crease; y += Nr[i + 1] * dsp * crease; dz += Nr[i + 2] * dsp * crease + dsp * 0.03 * n0; }
      const onBand = c.nb && Math.abs(c.across ? z0 - c.Lc : x0 - c.bandX) < 0.31 && y > vb - 0.06 && vb < top - 0.02;
      if (onBand) {
        // the mud the links leave behind on the flanks
        const mud = Math.min(1, 0.6 + 0.3 * (n0 * 0.5 + 0.5));
        if (Nr[i + 1] < 0.3 && mud > ud.mud[j]) { ud.mud[j] = mud; tint = true; }
      }
      // the paint cracks along the sharpest folds
      const sc = Math.min(1, Math.max(0, ud.cr[j] - 0.04) * dsp * 14);
      if (sc > ud.scr[j] + 0.03) { ud.scr[j] = sc; tint = true; }
      A[i] = x0 + dx;
      A[i + 1] = Math.max(0.012, Math.min(vb - 0.004, y));
      A[i + 2] = z0 + dz;
      if (dsp > 0.03 && !ud.hitMask[j]) { ud.hitMask[j] = 1; ud.hit++; }
      if (dsp > ud.maxDsp) ud.maxDsp = dsp;
    }
    if (tint) {
      const SC = ud.scr;
      for (let j = 0; j < ud.mud.length; j++) { const k = ud.mud[j], q = 1 + 0.22 * SC[j], mc = MUDC[(j * 7) % 2]; col[j * 3] = (1 + (mc.r * 4 - 1) * k) * q; col[j * 3 + 1] = (1 + (mc.g * 4 - 1) * k) * q; col[j * 3 + 2] = (1 + (mc.b * 4 - 1) * k) * q; }
      m.geometry.attributes.color.needsUpdate = true;
    }
    if (dirty) { m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
  }
  D.fill(0);
}
// pieces that break off: the door mirrors snap and tumble, then lie on the ground
function updateLoose(c, dt) {
  for (const m of c.mirrors) {
    const ud = m.userData;
    if (ud.loose || ud.maxDsp <= 0.04) continue;
    ud.loose = true;
    const g = m.geometry, a = g.attributes.position.array; let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < a.length; i += 3) { cx += a[i]; cy += a[i + 1]; cz += a[i + 2]; }
    const n = a.length / 3; cx /= n; cy /= n; cz /= n; g.translate(-cx, -cy, -cz); m.position.set(cx, cy, cz);
    scene.attach(m);                    // from now on it is its own object in the world
    loose.push({ m, v: new THREE.Vector3(rand(-0.4, 0.4), rand(0.3, 0.9), Math.sign(m.position.z - c.z) * rand(0.4, 1.2)), w: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), rest: false });
  }
  if (c.leak) {
    c.leak = Math.min(1, c.leak + dt / 5);
    const p = carW(c, 0.05, 0, 1.5, gp); c.oil.visible = true; c.oil.position.set(p[0], -0.004, p[2]);
    c.oil.scale.set(0.15 + 0.38 * c.leak, 1, 0.15 + 0.5 * c.leak);
  }
}
function updateLooseParts(dt) {
  for (let i = loose.length - 1; i >= 0; i--) {
    const L = loose[i], m = L.m;
    if (!L.rest) {
      L.v.y -= GRAV * dt; m.position.addScaledVector(L.v, dt);
      m.rotation.x += L.w.x * dt; m.rotation.y += L.w.y * dt; m.rotation.z += L.w.z * dt;
      if (m.position.y < 0.05) { m.position.y = 0.05; if (L.v.y > -1) { L.rest = true; m.rotation.set(0.2, m.rotation.y, Math.PI / 2); } else { L.v.multiplyScalar(0.3); L.v.y = Math.abs(L.v.y); } }
    }
    m.position.x -= speed * dt;
    if (m.position.x < -45) { scene.remove(m); m.geometry.dispose(); loose.splice(i, 1); }
  }
}
const qYaw90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
function placeCar(c) {          // the car group follows its body pose
  if (!c.ao) { c.ao = aoDecal(5.0, 2.3); scene.add(c.ao); }
  c.ao.rotation.y = (c.across ? Math.PI / 2 : 0) + (c.yawC || 0);
  c.ao.position.set(c.u + c.X, -0.010, c.z + (c.across ? 0 : 0)); c.ao.material.opacity = Math.max(0, 1 - Math.abs(c.th) * 3 - Math.max(0, c.Y - 0.6) * 2);
  c.group.rotation.set(-c.th, -Math.PI / 2 + (c.yawC || 0), c.ph, 'YXZ');
  if (c.scuff) c.scuff.position.set(c.u + c.scuff.userData.dx, -0.011, c.z + c.scuff.userData.dz);
  if (c.across) c.group.quaternion.multiply(qYaw90);
  c.group.position.set(c.u + c.X, c.Y, c.z).sub(tmpV3.set(0, CAR_CG, 0).applyQuaternion(c.group.quaternion));
}
const tmpV3 = new THREE.Vector3();
function disposeCar(c) {
  if (c.scuff) { scene.remove(c.scuff); c.scuff.geometry.dispose(); c.scuff.material.dispose(); }
  scene.remove(c.group); scene.remove(c.oil); if (c.ao) { scene.remove(c.ao); c.ao.geometry.dispose(); c.ao.material.dispose(); }
  c.meshes.forEach(m => { if (!m.userData.loose) m.geometry.dispose(); }); c.bags.forEach(b => b.geometry.dispose()); c.mats.forEach(m => m.dispose()); c.mud.tex.dispose(); c.oil.geometry.dispose();
  if (c.ghost) { c.ghost.children.forEach(g => g.geometry.dispose()); c.ghost.userData.mat.dispose(); }
}
function removeCar() {
  if (!car) return;
  if (car.done) wrecks.push(car); else disposeCar(car);
  car = null;
}
function setCrushReady(ready, label) {
  crushBtn.dataset.busy = ready ? '0' : '1';
  crushLbl.textContent = label;
}
let auto = false, autoDrive = true, carCount = 1, hold = 0, crawl = CRAWL, userRate = 1, paused = false, pendingView = false;
const queue = [];
function newCar(kind, u) {
  CAR_Z = MODES[carMode].z;
  const c = isProp(kind) ? buildProp(kind, carMode) : buildCar(kind, carMode);
  Object.assign(c, { yawC: c.across ? 0 : rand(-0.03, 0.03), pv: carMode === 'pivot' && !c.prop ? { on: false, st: 0, t: 0, rot: 0 } : null, u, X: 0, vX: 0, Y: CAR_CG - 0.025, vY: 0, th: 0, w: 0, ph: 0, wr: 0, slam: 0, done: false, glassStage: 0, glShown: 0, leak: 0, crushed: 0, cth: 1, sth: 0, cph: 1, sph: 0,
    st: [], t0: -1, peak: 0, popped: 0, alarm: 0, steam: 0, bagT: -1, hiss: 0, cool: 0, dir: 1, bottomT: -9, settle: 0, floorMark: new Uint8Array(NB) });
  if (c.prop) propAttach(c); else if (SHELL_ON) shellAttach(c);
  placeCar(c); scene.add(c.group); scene.add(c.oil);
  return c;
}
function spawnCar() {
  if (replay.on) replayResume();
  if (car && !car.done && auto) return;
  removeCar();
  queue.splice(0).forEach(disposeCar);
  hull.yaw = 0; hull.w = 0; hull.cy = 1; hull.sy = 0; markMat.opacity = 1;
  const kinds = Object.keys(VEHICLES), i0 = kinds.indexOf(carKind), u0 = autoDrive ? 12 : 8.2;
  car = newCar(carKind, u0);
  if (!car.prop) for (let i = 1; i < carCount; i++) queue.push(newCar(kinds[(i0 + i) % kinds.length], u0 + 13 * i));
  auto = autoDrive; pendingView = false; audio();
  setSpin(false); beginRun();
}
function beginRun() {
  recReset();
  setCrushReady(!auto, auto ? '碾压中' : '换一辆');
  $('#hud').hidden = false; hudLog(true);
  wreckBtn.disabled = false; ghostBtn.disabled = !!(car && car.prop); ghostBtn.setAttribute('aria-pressed', 'false');
  if (camMode === 'free' && auto) setCam('auto');
  else if (camMode === 'auto') { if (!shots) startShots(); else shots.i = -1; }
}
crushBtn.addEventListener('click', spawnCar);

