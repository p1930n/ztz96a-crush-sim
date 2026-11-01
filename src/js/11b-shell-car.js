/* ---------- the shell in the scene: fine meshes follow it, the tank presses on it, and the height of what is left feeds everything else ---------- */
const SHELL_ON = !new URLSearchParams(location.search).has('field');
const HULL_KG = 42800, shBudget = new Float32Array(16), shTank = new THREE.Matrix4(), shEuler = new THREE.Euler(0, 0, 0, 'YXZ');
function shellAttach(c) {
  const sh = c.shell = shellBuild(c);
  c.Y = CAR_CG; c.vY = 0; c.th = 0; c.ph = 0; c.w = 0; c.wr = 0;
  const { S, T, nT } = sh;
  // each fine vertex rides on the nearest triangle of its panel, as weights plus a height off it
  const tc = new Float32Array(nT * 3);
  for (let t = 0; t < nT; t++) for (let q = 0; q < 3; q++) tc[t * 3 + q] = (S.p[T[t * 4] * 3 + q] + S.p[T[t * 4 + 1] * 3 + q] + S.p[T[t * 4 + 2] * 3 + q]) / 3;
  sh.tc = tc; sh.tn = new Float32Array(nT * 3);
  const wheelOf = new Map(); (c.wheelSets || []).forEach(w => { const i = sh.wheels.findIndex(q => q.sx === w.sx && q.zw === w.zw); w.src.forEach(m => wheelOf.set(m, i)); });
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3(), N = new THREE.Vector3(), E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), Q = new THREE.Vector3();
  for (const m of c.meshes) {
    const ud = m.userData, O = ud.orig, n = O.length / 3;
    if (wheelOf.has(m)) { ud.wheel = wheelOf.get(m); continue; }
    if (ud.engine) { ud.rigidE = true; continue; }
    if (ud.block) {
      const b = ud.block; b.lo = 9; b.hi = -9; b.xa = 9; b.xb = -9; b.za = 9; b.zb = -9;
      for (let a = 0; a < O.length; a += 3) { b.lo = Math.min(b.lo, O[a + 1]); b.hi = Math.max(b.hi, O[a + 1]); b.xa = Math.min(b.xa, O[a]); b.xb = Math.max(b.xb, O[a]); b.za = Math.min(b.za, O[a + 2]); b.zb = Math.max(b.zb, O[a + 2]); }
      continue;
    }
    if (ud.plush || ud.interior || m.material === carCloth || m.material === carLiner) { ud.fieldWarp = true; continue; }
    const pid = ud.panel;
    const tri = new Int32Array(n), bu = new Float32Array(n * 2), off = new Float32Array(n);
    for (let i = 0, a = 0; i < n; i++, a += 3) {
      const x = O[a], y = O[a + 1], z = O[a + 2]; let best = -1, bd = 1e9;
      for (let t = 0; t < nT; t++) {
        if (pid !== undefined && T[t * 4 + 3] !== pid) continue;
        const dx = tc[t * 3] - x, dy = tc[t * 3 + 1] - y, dz = tc[t * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = t; }
      }
      if (best < 0) for (let t = 0; t < nT; t++) { const dx = tc[t * 3] - x, dy = tc[t * 3 + 1] - y, dz = tc[t * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = t; } }
      A.fromArray(S.p, T[best * 4] * 3); B.fromArray(S.p, T[best * 4 + 1] * 3); C.fromArray(S.p, T[best * 4 + 2] * 3); P.set(x, y, z);
      E1.subVectors(B, A); E2.subVectors(C, A); N.crossVectors(E1, E2); const nn = N.lengthSq() || 1e-9;
      Q.subVectors(P, A); const v = Q.clone().cross(E2).dot(N) / nn * -1, w = E1.clone().cross(Q).dot(N) / nn * 1;
      const h = Q.dot(N) / Math.sqrt(nn);
      tri[i] = best; bu[i * 2] = 0; bu[i * 2 + 1] = 0; off[i] = h;
      // solve the weights on the triangle's plane
      const d00 = E1.dot(E1), d01 = E1.dot(E2), d11 = E2.dot(E2), d20 = Q.dot(E1), d21 = Q.dot(E2), den = d00 * d11 - d01 * d01 || 1e-9;
      bu[i * 2] = (d11 * d20 - d01 * d21) / den; bu[i * 2 + 1] = (d00 * d21 - d01 * d20) / den;
    }
    ud.skinTri = tri; ud.skinW = bu; ud.skinH = off;
  }
  // the fine wheel meshes keep their shape, relative to the hub
  // let it take up its own weight gently, as it was built standing on its wheels
  const d0 = S.damp;
  for (let i = 0; i < 1400; i++) { S.g = SHELL_G * Math.min(1, i / 900); S.damp = 25; shellCarStep(c, 0.001, false); }
  S.g = undefined; S.damp = d0; S.v.fill(0);
  // as it now stands is as new: damage is counted from here
  const f = c.f;
  shellRaster(c);
  let h0 = 0; for (let n = 0; n < GN; n++) { if (f.real[n] > 0 || f.V[n] > 0.05) { f.real[n] = f.top[n] = f.V[n]; if (f.V[n] > h0) h0 = f.V[n]; } f.E[n] = 0; }
  f.h0 = h0; c.lost = 0;
  sh.y0 = S.p.slice(0, S.n * 3);
  // what each failure is measured on
  const hood = [], door = [], roof = [], post = [];
  for (let i = 0; i < S.n; i++) {
    const pid = sh.nodePanel[i], y = S.p[i * 3 + 1], ax = Math.abs(S.p[i * 3]);
    if (pid === P_HOOD || pid === P_BUMPF) hood.push(i);
    else if (pid >= P_DOOR && pid < P_DOOR + 4) door.push(i);
    else if (i >= sh.cabin0 && i < sh.cabin1) { if (y > h0Roof(V0Of(c)) - 0.2) roof.push(i); else post.push(i); }
  }
  f.pressOf = new Map([[f.hoodN, { S, Y: sh.y0, nodes: hood }], [f.doorN, { S, Y: sh.y0, nodes: door }], [f.roofN, { S, Y: sh.y0, nodes: roof }], [f.pillarN, { S, Y: sh.y0, nodes: post }]]);
  shellFrame(c);
  for (const m of c.meshes) {
    const ud = m.userData; ud.maxDsp = 0; ud.hit = 0; ud.hitMask.fill(0);
    if (ud.skinTri) { const A = m.geometry.attributes.position.array, Y = ud.skinY0 = new Float32Array(A.length / 3); for (let i = 0; i < Y.length; i++) Y[i] = A[i * 3 + 1]; }
  }
  sh.engY0 = sh.engine.reduce((q, i) => q + S.p[i * 3 + 1], 0) / sh.engine.length;
  for (const W of sh.wheels) W.popped = false;
}
function shellCarStep(c, h, withTank) {
  const sh = c.shell, S = sh.S; sh.age++;
  if (withTank) shellPrepTank(c);
  shellStep(S, h, withTank ? shellContactTank : shellContactFree);
}
function shellContactFree(S) { shellGround(S); shellSelf4(S); if (S.caps && shSelfN % 3 === 0) propCaps(S); }
let shSelfN = 0;
function shellSelf4(S) { if ((shSelfN = (shSelfN + 1) & 3) === 0) shellSelf(S); }
let shC = null;
const shR = new Float32Array(9);   // tank axes expressed in the car's frame, tank origin in the car's frame
function shellPrepTank(c) {
  shC = c;
  // car frame: x lateral, z along, nose at the tank. The tank's axes and origin, turned into it
  const cy = hull.cy, sy = hull.sy, ca = Math.cos(hull.a), sa = Math.sin(hull.a), cr = Math.cos(hull.r), sr = Math.sin(hull.r);
  shEuler.set(-hull.r, hull.yaw, hull.a, 'YXZ'); shTank.makeRotationFromEuler(shEuler); const e = shTank.elements;
  const cc = Math.cos(c.yawC), sc = Math.sin(c.yawC);
  // world (wx,wz) relative to the car: car lateral b and along a (see carW), then swapped when it lies across
  const toCar = (wx, wy, wz, out, off) => { const a = -(wx * cc - wz * sc), b = wx * sc + wz * cc; if (c.across) { out[off] = -a; out[off + 2] = b; } else { out[off] = b; out[off + 2] = a; } out[off + 1] = wy; };
  toCar(e[0], e[1], e[2], shR, 0); toCar(e[4], e[5], e[6], shR, 3); toCar(e[8], e[9], e[10], shR, 6);
  const tmp = shOrigin; toCar(-(c.u + c.X), hull.y, -c.z, tmp, 0);
}
const shOrigin = new Float32Array(3);
let shFrac = 1, shDt = 0;
function shellContactTank(S, h) {
  shellGround(S); shellSelf4(S); if (S.caps && shSelfN % 3 === 0) propCaps(S);
  const c = shC, { p, o, m, w, n } = S, R = shR, ox = shOrigin[0], oy = shOrigin[1], oz = shOrigin[2], h2 = h * h, ih2 = 1 / h2;
  const used = shellUsed; used.fill(0);
  const maxStep = 6 * h;
  let Fb = 0, Mpb = 0, Mrb = 0, load = 0;
  for (let i = 0, a = 0; i < n; i++, a += 3) {
    if (w[i] === 0 || (S.air && S.air[i] === 2)) continue;
    const dx = p[a] - ox, dy = p[a + 1] - oy, dz = p[a + 2] - oz;
    const xl = R[0] * dx + R[1] * dy + R[2] * dz; if (xl > 3.7 || xl < -3.6) continue;
    const zl = R[6] * dx + R[7] * dy + R[8] * dz; if (zl > 1.9 || zl < -1.9) continue;
    const yl = R[3] * dx + R[4] * dy + R[5] * dz;
    const ce = ceilLocal(xl, zl); if (ce === Infinity) continue;
    if (S.ce) { if (ce < S.ce[i]) S.ce[i] = ce; const g = ce - yl; if (g < S.gap[i]) S.gap[i] = g > 0.012 ? g : 0.012; }
    const rad = S.r[i] * 0.5, pen = yl + rad - ce;
    if (pen <= 0 || pen > (c.prop ? 0.4 : 1.5)) continue;      // something this far above the track's face has gone up past it, and is on top
    // a car's nodes are heavy enough for a few millimetres a step to pass on any force; a toy's or a limb's would slip through under far less than 42 t
    const stepLim = c.prop ? Math.max(maxStep, 60000 * h2 / m[i]) : maxStep;
    let d = pen < stepLim ? pen : stepLim;
    const az = zl < 0 ? -zl : zl, track = az > 1.11 && az <= 1.69;
    if (track) {
      // what a road wheel can press with is what its spring carries
      const s = zl < 0 ? 1 : 0, cell = s * 8 + shellStation(xl), lim = Math.max(c.prop ? 40000 : 3000, shBudget[cell]);     // something this small can be off the line the wheels' load is read along, and still has a wheel's load on it
      const f = m[i] * d * ih2, room = lim - used[cell];
      if (room <= 0) continue;
      if (f > room) d *= room / f;
      used[cell] += m[i] * d * ih2; load += m[i] * d * ih2;
    } else {
      // belly plates and skirts lean directly on the hull
      const f = m[i] * d * ih2; Fb += f; Mpb += f * (xl - XCG); Mrb += f * zl; load += f;
    }
    if (S.cf) { const f = m[i] * d * ih2; if (f > S.cf[i]) S.cf[i] = f; }
    // down along the tank's own up axis, and along with it where it has run into something standing proud
    p[a] -= R[3] * d; p[a + 1] -= R[4] * d; p[a + 2] -= R[5] * d;
    // shoes grip: they stand still on what they press unless the tank is turning, when they sweep across it
    const lim = 0.5 * d; if (lim > 0) {
      const sw = hull.w * h, vt = track ? xl * sw : 0, tx0 = R[6] * vt, tz0 = R[8] * vt;
      const tx = p[a] - o[a] - tx0, tz = p[a + 2] - o[a + 2] - tz0, t = Math.sqrt(tx * tx + tz * tz);
      if (t > 1e-9) { const k = t <= lim ? 1 : lim / t; p[a] -= tx * k; p[a + 2] -= tz * k; }
    }
  }
  // sheet metal under the belly can hold up only what it is strong enough to: a car's whole frame, some 260 kN, not the impulse of each node it touches
  if (Fb) { const lim = Fb > 260000 ? 260000 / Fb : 1, k = lim * h / HULL_KG; hull.vy += Fb * k; hull.va += Mpb * k / PITCH_I; hull.vr += Mrb * k / ROLL_I; }
  c.shell.load = load;
  if (c.snags && c.snags.length) propSnags(c, S, h);
}
const shellUsed = new Float32Array(16);
const shellStation = x => { if (x > 2.6) return 6; if (x < -2.6) return 7; let b = 0, bd = 9; for (let i = 0; i < 6; i++) { const d = Math.abs(WX[i] - x); if (d < bd) { bd = d; b = i; } } return b; };
// everything else reads the car as heights: the top surface of the structure, rasterised on the old grid
function shellRaster(c) {
  const sh = c.shell, S = sh.S, f = c.f, Vn = f.V, T = sh.T, nT = sh.nT, tmp = f.B;
  tmp.fill(0);
  const put = (x, y, z) => { const i = Math.round((x - GX0) / GC), j = Math.round((z - GZ0) / GC); if (i < 0 || i >= GNX || j < 0 || j >= GNZ) return; const n = i * GNZ + j; if (y > tmp[n]) tmp[n] = y; };
  for (let t = 0; t < nT; t++) {
    const a = T[t * 4] * 3, b = T[t * 4 + 1] * 3, q = T[t * 4 + 2] * 3;
    const ax = S.p[a], ay = S.p[a + 1], az = S.p[a + 2], bx = S.p[b] - ax, by = S.p[b + 1] - ay, bz = S.p[b + 2] - az, cx = S.p[q] - ax, cy = S.p[q + 1] - ay, cz = S.p[q + 2] - az;
    const ext = Math.max(Math.abs(bx), Math.abs(bz), Math.abs(cx), Math.abs(cz)), N = Math.min(5, Math.ceil(ext / (GC * 0.8)));
    for (let u = 0; u <= N; u++) for (let v = 0; v + u <= N; v++) { const s = u / N, r = v / N; put(ax + bx * s + cx * r, ay + by * s + cy * r, az + bz * s + cz * r); }
  }
  const eng = sh.engine; for (let i = 0; i < eng.length; i++) { const a = eng[i] * 3; put(S.p[a], S.p[a + 1] + S.r[eng[i]], S.p[a + 2]); }
  if (sh.prop) for (let i = 0, a = 0; i < S.n; i++, a += 3) if (!S.air[i] && S.p[a + 1] < 1.1) put(S.p[a], S.p[a + 1], S.p[a + 2]);      // what the track is carrying or has let fall is no ground for the wheels
  let lost = 0;
  // the samples leave gaps, and a gap must not read as a roof fallen to the floor: each cell looks to its neighbours, then further out if it is still empty
  const fil = sh.fil || (sh.fil = new Float32Array(GN));
  for (let i = 0, n = 0; i < GNX; i++) for (let j = 0; j < GNZ; j++, n++) {
    let v = tmp[n];
    if (j > 0 && tmp[n - 1] > v) v = tmp[n - 1]; if (j < GNZ - 1 && tmp[n + 1] > v) v = tmp[n + 1];
    if (i > 0) { if (tmp[n - GNZ] > v) v = tmp[n - GNZ]; if (j > 0 && tmp[n - GNZ - 1] > v) v = tmp[n - GNZ - 1]; if (j < GNZ - 1 && tmp[n - GNZ + 1] > v) v = tmp[n - GNZ + 1]; }
    if (i < GNX - 1) { if (tmp[n + GNZ] > v) v = tmp[n + GNZ]; if (j > 0 && tmp[n + GNZ - 1] > v) v = tmp[n + GNZ - 1]; if (j < GNZ - 1 && tmp[n + GNZ + 1] > v) v = tmp[n + GNZ + 1]; }
    fil[n] = v;
  }
  for (let n = 0; n < GN; n++) {
    let v = tmp[n] > 0 ? tmp[n] : fil[n];      // only a true gap is filled: a height read high would hold the tank up
    if (f.real[n] > 0 && v > f.real[n] + 0.08) v = f.real[n] + 0.08;
    if (Math.abs(v - Vn[n]) > 0.002) { Vn[n] = v; f.dirty[n] = 1; const vf = Math.max(v, fil[n]); f.E[n] = vf < f.top[n] ? squeezeEps(f.top[n], Math.max(0.02, vf)) : 0; }
    if (f.real[n] > 0 && v < f.real[n]) lost += f.real[n] - v;
  }
  if (!sh.prop) c.lost = lost * GC * GC;     // a prop's loss is read from its nodes
  for (let k = 0; k < c.nb; k++) c.Hs[k] = sampleV(c, c.bx[k], c.bL[k]);
}
// move the fine meshes
function shellSkin(c) {
  if (c.prop) { propSkin(c); return; }
  const sh = c.shell, S = sh.S, P = S.p, T = sh.T, nT = sh.nT, Tn = sh.tn;
  for (let t = 0; t < nT; t++) {
    const a = T[t * 4] * 3, b = T[t * 4 + 1] * 3, q = T[t * 4 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[q] - P[a], vy = P[q + 1] - P[a + 1], vz = P[q + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1e-9);
    Tn[t * 3] = nx * l; Tn[t * 3 + 1] = ny * l; Tn[t * 3 + 2] = nz * l;
  }
  const eN = sh.engine, e0 = eN[0] * 3, e6 = eN[6] * 3, e2 = eN[2] * 3;
  // the engine: a rigid frame from three of its nodes
  const ex = shV(P, e6, e0), ez = shV(P, e2, e0); const exl = 1 / Math.hypot(ex[0], ex[1], ex[2]), ezl = 1 / Math.hypot(ez[0], ez[1], ez[2]);
  ex[0] *= exl; ex[1] *= exl; ex[2] *= exl; ez[0] *= ezl; ez[1] *= ezl; ez[2] *= ezl;
  const ey = [ez[1] * ex[2] - ez[2] * ex[1], ez[2] * ex[0] - ez[0] * ex[2], ez[0] * ex[1] - ez[1] * ex[0]];
  const p00 = S.p0, oe = [p00[e0], p00[e0 + 1], p00[e0 + 2]];
  for (const m of c.meshes) {
    const ud = m.userData, A = m.geometry.attributes.position.array, O = ud.orig;
    if (ud.skinTri) {
      const tri = ud.skinTri, W = ud.skinW, H = ud.skinH; let dsp = 0;
      for (let i = 0, a = 0; i < tri.length; i++, a += 3) {
        const t = tri[i], t4 = t * 4, A0 = T[t4] * 3, B0 = T[t4 + 1] * 3, C0 = T[t4 + 2] * 3, v = W[i * 2], w = W[i * 2 + 1], u = 1 - v - w, h = H[i];
        const x = u * P[A0] + v * P[B0] + w * P[C0] + Tn[t * 3] * h, y = u * P[A0 + 1] + v * P[B0 + 1] + w * P[C0 + 1] + Tn[t * 3 + 1] * h, z = u * P[A0 + 2] + v * P[B0 + 2] + w * P[C0 + 2] + Tn[t * 3 + 2] * h;
        A[a] = x; A[a + 1] = y > 0.006 ? y : 0.006; A[a + 2] = z;
        const d0 = (ud.skinY0 ? ud.skinY0[i] : O[a + 1]) - y;
        if (d0 > 0.03 && !ud.hitMask[i]) { ud.hitMask[i] = 1; ud.hit++; }
        if (d0 > dsp) dsp = d0;
      }
      if (dsp > ud.maxDsp) ud.maxDsp = dsp;
      m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals();
    } else if (ud.rigidE) {
      for (let a = 0; a < A.length; a += 3) {
        const qx = O[a] - oe[0], qy = O[a + 1] - oe[1], qz = O[a + 2] - oe[2], fx = qx, fy = qy, fz = qz;
        A[a] = P[e0] + ex[0] * fx + ey[0] * fy + ez[0] * fz; A[a + 1] = P[e0 + 1] + ex[1] * fx + ey[1] * fy + ez[1] * fz; A[a + 2] = P[e0 + 2] + ex[2] * fx + ey[2] * fy + ez[2] * fz;
      }
      m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals();
    } else if (ud.wheel !== undefined) {
      const W = sh.wheels[ud.wheel], hA = W.hub * 3, iA = W.inn * 3, pA = W.ptr * 3, sx = W.sx;
      const ax = shV(P, hA, iA), al = sx / Math.hypot(ax[0], ax[1], ax[2]); ax[0] *= al; ax[1] *= al; ax[2] *= al;
      const up = shV(P, pA, hA), ul = 1 / Math.hypot(up[0], up[1], up[2]); up[0] *= ul; up[1] *= ul; up[2] *= ul;
      const fw = [ax[1] * up[2] - ax[2] * up[1], ax[2] * up[0] - ax[0] * up[2], ax[0] * up[1] - ax[1] * up[0]];
      const hx = S.p0[hA], hy = S.p0[hA + 1], hz = S.p0[hA + 2], flat = W.popped ? 0.02 : 0.012;
      for (let a = 0; a < A.length; a += 3) {
        const qx = O[a] - hx, qy = O[a + 1] - hy, qz = O[a + 2] - hz;
        const x = P[hA] + ax[0] * qx + up[0] * qy + fw[0] * qz, y = P[hA + 1] + ax[1] * qx + up[1] * qy + fw[1] * qz, z = P[hA + 2] + ax[2] * qx + up[2] * qy + fw[2] * qz;
        A[a] = x; A[a + 1] = y > flat ? y : flat; A[a + 2] = z;      // a tyre flattens where it meets the ground
      }
      m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals();
    } else if (ud.block) shellBlock(c, m);
  }
}
// seats and dash are solid parts, not sheet: each rides on its frame node. A seat back turns with its own node; foam and
// plastic go down as one piece under what presses on them, only so far, and never tear
function shellBlock(c, m) {
  const sh = c.shell, ud = m.userData, b = ud.block, P = sh.S.p, Y = sh.y0, O = ud.orig, A = m.geometry.attributes.position.array;
  if (!Y) return;
  const nodes = b.seat === 4 ? [sh.dashN] : b.seat === 2 ? [sh.seatTop[2], sh.seatTop[3]] : [sh.seatTop[b.seat]];
  let dx = 0, dy = 0, dz = 0;
  for (const n of nodes) { dx += P[n * 3] - Y[n * 3]; dy += P[n * 3 + 1] - Y[n * 3 + 1]; dz += P[n * 3 + 2] - Y[n * 3 + 2]; }
  dx /= nodes.length; dy /= nodes.length; dz /= nodes.length;
  if (Math.abs(dx - (b.dx || 0)) + Math.abs(dy - (b.dy || 0)) + Math.abs(dz - (b.dz || 0)) < 0.0015 && b.kind !== 'back' && b.seen) return;
  b.dx = dx; b.dy = dy; b.dz = dz; b.seen = true;
  if (b.kind === 'back') {
    const t = sh.seatTop[b.seat] * 3, q = sh.seatBack[b.seat] * 3;
    const a = Math.atan2(P[q + 2] - P[t + 2], P[q + 1] - P[t + 1]) - Math.atan2(Y[q + 2] - Y[t + 2], Y[q + 1] - Y[t + 1]), ca = Math.cos(a), sa = Math.sin(a), hy = Y[t + 1], hz = Y[t + 2] - 0.2, lean = (P[q] - Y[q] - dx) / Math.max(0.1, Y[q + 1] - Y[t + 1]);
    for (let i = 0; i < A.length; i += 3) {
      const ry = O[i + 1] - hy, rz = O[i + 2] - hz, y = ry * ca - rz * sa, z = ry * sa + rz * ca;
      A[i] = O[i] + dx + lean * Math.max(0, ry); A[i + 1] = Math.max(0.02, hy + y + dy); A[i + 2] = hz + z + dz;
    }
  } else {
    const fx = (b.xb - b.xa) * 0.35, fz = (b.zb - b.za) * 0.35, mx = (b.xa + b.xb) / 2, mz = (b.za + b.zb) / 2;
    const H = (sampleV(c, mx, mz) + sampleV(c, mx - fx, mz - fz) + sampleV(c, mx + fx, mz - fz) + sampleV(c, mx - fx, mz + fz) + sampleV(c, mx + fx, mz + fz)) / 5, span = b.hi - b.lo;
    if (b.kind === 'rigid') {
      const d = Math.max(0.03 - b.lo, Math.min(dy, H - b.hi));
      for (let i = 0; i < A.length; i += 3) { A[i] = O[i] + dx; A[i + 1] = O[i + 1] + d; A[i + 2] = O[i + 2] + dz; }
    } else {
      // once it can squash no further the whole part goes down with what presses on it: nothing stays up in the air
      const top = Math.min(b.hi + dy, H - 0.005), lo = Math.max(0.02, Math.min(b.lo + dy, top - span * 0.45)), s = Math.max(0.45, Math.min(1, (top - lo) / span));
      for (let i = 0; i < A.length; i += 3) { A[i] = O[i] + dx; A[i + 1] = lo + (O[i + 1] - b.lo) * s; A[i + 2] = O[i + 2] + dz; }
    }
  }
  m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals();
}
const V0Of = c => c.V, h0Roof = V => V.roof.reduce((m, p) => Math.max(m, p[1]), 0);
const shV = (P, a, b) => [P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]];
// the links print themselves on the metal where they actually bear, each with the mud it carries; turning, they smear
const shLink = SIDES.map(() => ({ on: new Uint8Array(LINKS), x: new Float32Array(LINKS), L: new Float32Array(LINKS) }));
function shellStamp(c) {
  const cc = Math.cos(c.yawC), sc = Math.sin(c.yawC); tank.updateMatrixWorld(); const m = tank.matrixWorld.elements, cx = c.u + c.X;
  const rot = c.across ? Math.PI / 2 : hull.yaw - c.yawC;
  SIDES.forEach((z, s) => {
    const b = belts[s], lp = LPs[s], st = shLink[s];
    for (let i = 0; i < LINKS; i++) {
      const p = beltAt(b, (i + beltPh[s]) * lp);
      if (p.y > 0.7) { st.on[i] = 0; continue; }
      const fy = p.y - 0.05, wx = m[0] * p.x + m[4] * fy + m[8] * z + m[12], wy = m[1] * p.x + m[5] * fy + m[9] * z + m[13], wz = m[2] * p.x + m[6] * fy + m[10] * z + m[14];
      const px = wx - cx, pz = wz - c.z; let lx = px * sc + pz * cc, L = -(px * cc - pz * sc);
      if (c.across) { const t = lx; lx = -L; L = t; }
      if (Math.abs(lx) > 1.2 || Math.abs(L) > 2.5 || wy < 0.03 || wy > sampleV(c, lx, L) + 0.05) { st.on[i] = 0; continue; }
      if (!st.on[i]) { st.on[i] = 1; st.x[i] = lx; st.L[i] = L; (c.prop ? propRow : mudRow)(c, lx, L, rot); }
      else if (hull.w && Math.hypot(lx - st.x[i], L - st.L[i]) > 0.05) {
        const g = c.mud.g; g.globalAlpha = 0.35; g.strokeStyle = mudPick(); g.lineWidth = rand(3, 9); g.beginPath(); g.moveTo(mudX(st.x[i]), mudY(st.L[i])); g.lineTo(mudX(lx), mudY(L)); g.stroke(); g.globalAlpha = 1;
        st.x[i] = lx; st.L[i] = L; c.mud.dirty = true;
      }
    }
  });
}
// once a frame: what the viewer sees and what the rest of the page reads
function shellFrame(c) {
  const sh0 = c.shell, cx0 = c.u + c.X, far = Math.hypot(cx0, c.z) > 6.5;
  if (sh0.prop) { const Sa = sh0.S; for (let i = 0, q = 1; i < Sa.n; i++, q += 3) if (Sa.air[i] === 1 && Sa.p[q] < 0.35) Sa.air[i] = 0; }
  // with nothing pressing on it the wreck comes to rest, and then it costs nothing
  const carrying = c.snags && (c.snags.length || time < c.activeUntil);
  sh0.S.damp = far && !carrying ? 14 : 3;
  sh0.quiet = far && !carrying && shellEnergy(sh0.S) < 30 ? (sh0.quiet || 0) + 1 : 0;
  if (sh0.quiet > 45) sh0.awake = false;
  shellRaster(c);
  shellSkin(c);
  warpCar(c);
  const sh = c.shell, S = sh.S;
  if (!c.snapped && pressedIn(c.f, c.f.roofN) > c.V.hold + 0.25) { c.snapped = true; c.give = 1; fx('snap', 1); shake = Math.max(shake, 0.014); }
  // what came apart this frame, and what hit the ground
  if (S.broke.length > (sh.broke0 || 0)) {
    let tears = 0; for (let q = sh.broke0 || 0; q < S.broke.length; q++) if (S.kind[S.broke[q]]) tears++;
    sh.broke0 = S.broke.length;
    if (tears && time - (sh.tearT || -9) > 0.08 && !replay.on) { sh.tearT = time; fx('tear', Math.min(1, tears / 4)); }
  }
  if (S.hit > 10 && time - (sh.hitT || -9) > 0.1 && !replay.on) { sh.hitT = time; fx('clang', Math.min(1, S.hit / 60)); }
  S.hit = 0;
  for (const W of sh.wheels) {
    if (W.popped) continue;
    const tooLow = sampleV(c, W.x0 * 0.92, W.zw) < W.y0 + 0.2 || S.p[W.hub * 3 + 1] < W.y0 - 0.1;
    if (tooLow) { W.popped = true; S.gr[W.hub] = 0.21; for (const t of c.tires) if (t.userData.wz === W.zw && Math.sign(t.userData.wx) === W.sx) t.userData.maxDsp = 1; }
  }
}
function shellEnergy(S) { let e = 0; for (let i = 0, a = 0; i < S.n; i++, a += 3) e += 0.5 * S.m[i] * (S.v[a] ** 2 + S.v[a + 1] ** 2 + S.v[a + 2] ** 2); return e; }
// the crossing remembered: where every node was, and now and then the state of every member so it can be driven on from there
function shellRec(c, fr) {
  const S = c.shell.S, n = S.n * 3, P = new Int16Array(n), Vl = new Int16Array(n);
  for (let i = 0; i < n; i++) { P[i] = Math.max(-32767, Math.min(32767, S.p[i] * 3000)); Vl[i] = Math.max(-32767, Math.min(32767, S.v[i] * 2000)); }
  fr.sp = P; fr.sv = Vl; if (S.gap) fr.gap = S.gap.slice(0, S.n);
  if (!c.shell.keyT || rec.frames.length - c.shell.keyT >= 30 || !rec.frames.length) {
    c.shell.keyT = rec.frames.length;
    fr.sk = { L: S.L.slice(0, S.nc), on: S.on.slice(0, S.nc), gr: S.gr.slice(0, S.n), bd: S.bd && S.bd.slice(0, S.nb * 3), pop: c.shell.wheels.map(w => w.popped) };
  }
}
function shellShow(c, a, b, t) {
  const S = c.shell.S, n = S.n * 3;
  for (let i = 0; i < n; i++) S.p[i] = (a.sp[i] + (b.sp[i] - a.sp[i]) * t) / 3000;
  if (a.gap) S.gap.set(a.gap);
  shellRaster(c); shellSkin(c); warpCar(c);
}
function shellResume(c, F, i) {
  const S = c.shell.S, a = F[i], n = S.n * 3;
  let k = i; while (k > 0 && !F[k].sk) k--;
  const K = F[k].sk;
  if (K) { S.L.set(K.L); S.on.set(K.on); S.gr.set(K.gr); if (K.bd) S.bd.set(K.bd); c.shell.wheels.forEach((w, q) => { w.popped = K.pop[q]; }); }
  for (let q = 0; q < n; q++) { S.p[q] = a.sp[q] / 3000; S.o[q] = S.p[q]; S.v[q] = a.sv[q] / 2000; }
  S.broke.length = 0; for (let q = 0; q < S.nc; q++) if (!S.on[q]) S.broke.push(q);
  if (a.gap) { S.gap.set(a.gap); S.air.fill(0); c.snags.length = 0; c.brk0 = S.broke.length; }
  c.shell.broke0 = S.broke.length; c.shell.keyT = 0; c.shell.awake = true; c.shell.quiet = 0;
}
