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
  for (let i = 0; i < S.n * 3; i++) S.p0[i] = S.p0[i];
  shellFrame(c);
  for (const m of c.meshes) { const ud = m.userData; ud.maxDsp = 0; ud.hit = 0; ud.hitMask.fill(0); }
  for (const W of sh.wheels) W.popped = false;
}
function shellCarStep(c, h, withTank) {
  const sh = c.shell, S = sh.S; sh.age++;
  if (withTank) shellPrepTank(c);
  shellStep(S, h, withTank ? shellContactTank : shellContactFree);
}
function shellContactFree(S) { shellGround(S); shellSelf4(S); }
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
function shellContactTank(S, h) {
  shellGround(S); shellSelf4(S);
  const c = shC, { p, o, m, w, n } = S, R = shR, ox = shOrigin[0], oy = shOrigin[1], oz = shOrigin[2], h2 = h * h, ih2 = 1 / h2;
  const used = shellUsed; used.fill(0);
  const maxStep = 6 * h;
  let Fb = 0, Mpb = 0, Mrb = 0, load = 0;
  for (let i = 0, a = 0; i < n; i++, a += 3) {
    if (w[i] === 0) continue;
    const dx = p[a] - ox, dy = p[a + 1] - oy, dz = p[a + 2] - oz;
    const xl = R[0] * dx + R[1] * dy + R[2] * dz; if (xl > 3.7 || xl < -3.6) continue;
    const zl = R[6] * dx + R[7] * dy + R[8] * dz; if (zl > 1.9 || zl < -1.9) continue;
    const yl = R[3] * dx + R[4] * dy + R[5] * dz;
    const ce = ceilLocal(xl, zl); if (ce === Infinity) continue;
    const rad = S.r[i] * 0.5, pen = yl + rad - ce;
    if (pen <= 0 || pen > 1.5) continue;
    let d = pen < maxStep ? pen : maxStep;
    const az = zl < 0 ? -zl : zl, track = az > 1.11 && az <= 1.69;
    if (track) {
      // what a road wheel can press with is what its spring carries
      const s = zl < 0 ? 1 : 0, cell = s * 8 + shellStation(xl), lim = Math.max(3000, shBudget[cell]);
      const f = m[i] * d * ih2, room = lim - used[cell];
      if (room <= 0) continue;
      if (f > room) d *= room / f;
      used[cell] += m[i] * d * ih2; load += m[i] * d * ih2;
    } else {
      // belly plates and skirts lean directly on the hull
      const f = m[i] * d * ih2; Fb += f; Mpb += f * (xl - XCG); Mrb += f * zl; load += f;
    }
    // down along the tank's own up axis, and along with it where it has run into something standing proud
    p[a] -= R[3] * d; p[a + 1] -= R[4] * d; p[a + 2] -= R[5] * d;
    // shoes grip: they stand still on what they press unless the tank is turning, when they sweep across it
    const lim = 0.5 * d; if (lim > 0) {
      const sw = hull.w * h, vt = track ? xl * sw : 0, tx0 = R[6] * vt, tz0 = R[8] * vt;
      const tx = p[a] - o[a] - tx0, tz = p[a + 2] - o[a + 2] - tz0, t = Math.sqrt(tx * tx + tz * tz);
      if (t > 1e-9) { const k = t <= lim ? 1 : lim / t; p[a] -= tx * k; p[a + 2] -= tz * k; }
    }
  }
  if (Fb) { const k = h / HULL_KG; hull.vy += Fb * k; hull.va += Mpb * k / PITCH_I; hull.vr += Mrb * k / ROLL_I; }
  c.shell.load = load;
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
  let lost = 0;
  for (let n = 0; n < GN; n++) {
    let v = tmp[n];
    if (v === 0 && f.real[n] > 0) {        // a gap between samples
      const i = Math.floor(n / GNZ), j = n % GNZ;
      if (j > 0) v = Math.max(v, tmp[n - 1]); if (j < GNZ - 1) v = Math.max(v, tmp[n + 1]); if (i > 0) v = Math.max(v, tmp[n - GNZ]); if (i < GNX - 1) v = Math.max(v, tmp[n + GNZ]);
    }
    if (f.real[n] > 0 && v > f.real[n] + 0.08) v = f.real[n] + 0.08;
    if (Math.abs(v - Vn[n]) > 0.002) { Vn[n] = v; f.dirty[n] = 1; f.E[n] = v < f.top[n] ? squeezeEps(f.top[n], Math.max(0.02, v)) : 0; }
    if (f.real[n] > 0 && v < f.real[n]) lost += f.real[n] - v;
  }
  c.lost = lost * GC * GC;
  for (let k = 0; k < c.nb; k++) c.Hs[k] = sampleV(c, c.bx[k], c.bL[k]);
}
// move the fine meshes
function shellSkin(c) {
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
        const d0 = O[a + 1] - y;
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
    }
  }
}
const shV = (P, a, b) => [P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]];
// once a frame: what the viewer sees and what the rest of the page reads
function shellFrame(c) {
  const sh0 = c.shell, cx0 = c.u + c.X, far = Math.hypot(cx0, c.z) > 6.5;
  // with nothing pressing on it the wreck comes to rest, and then it costs nothing
  sh0.S.damp = far ? 14 : 3;
  sh0.quiet = far && shellEnergy(sh0.S) < 30 ? (sh0.quiet || 0) + 1 : 0;
  if (sh0.quiet > 45) sh0.awake = false;
  shellRaster(c);
  shellSkin(c);
  warpCar(c);
  const sh = c.shell, S = sh.S;
  for (const W of sh.wheels) {
    if (W.popped) continue;
    const tooLow = sampleV(c, W.x0 * 0.92, W.zw) < W.y0 + 0.2 || S.p[W.hub * 3 + 1] < W.y0 - 0.1;
    if (tooLow) { W.popped = true; S.gr[W.hub] = 0.21; for (const t of c.tires) if (t.userData.wz === W.zw && Math.sign(t.userData.wx) === W.sx) t.userData.maxDsp = 1; }
  }
}
function shellEnergy(S) { let e = 0; for (let i = 0, a = 0; i < S.n; i++, a += 3) e += 0.5 * S.m[i] * (S.v[a] ** 2 + S.v[a + 1] ** 2 + S.v[a + 2] ** 2); return e; }
