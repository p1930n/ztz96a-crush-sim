/* ---------- things to crush that are not cars: stuffed toys, and an instrumented crash test dummy. Same solver, same tank ---------- */
const dummySkin = new THREE.MeshStandardMaterial({ color: lin('#c4943a'), roughness: 0.66, metalness: 0 });
const dummyDark = new THREE.MeshStandardMaterial({ color: lin('#26282c'), roughness: 0.45, metalness: 0.65 });
const dummyTarget = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#f2d230'; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill(); g.fillStyle = '#111';
  for (const a of [0, Math.PI]) { g.beginPath(); g.moveTo(32, 32); g.arc(32, 32, 31, a, a + Math.PI / 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
})();
const PROPS = {
  plush: { name: '毛绒玩具', build: buildToys },
  dummy: { name: '测试假人', build: buildDummy },
};
const isProp = k => !!PROPS[k];
// what the rig's controls ask for
const PROP_OPT = { count: 5, lay: 'pile', snag: 'rand' };
// each thing's own copy of a material, with the mud and track prints the car's panels get
function propMat(c, base) {
  let m = c.pm.get(base);
  if (!m) { m = base.clone(); m.side = THREE.DoubleSide; mudOn(m, c.mud.tex, c.mudCut); c.pm.set(base, m); c.mats.push(m); }
  return m;
}
// a rigid-ish piece of mesh riding on some nodes. Pieces of one body and material are drawn as one mesh
function propPiece(c, S, geo, base, nodes, owner, frame = nodes) {
  const key = owner + ':' + base.uuid; let bin = c.bins.get(key);
  if (!bin) { bin = { base, list: [] }; c.bins.set(key, bin); }
  bin.list.push({ geo, nodes, frame });
}
function propMerge(c, S) {
  const P = S.p, K = 4;
  for (const { base, list } of c.bins.values()) {
    const nV = list.reduce((q, e) => q + e.geo.attributes.position.count, 0), nI = list.reduce((q, e) => q + e.geo.index.count, 0);
    const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), ix = new Uint32Array(nI), idx = new Int16Array(nV * K), wt = new Float32Array(nV * K), pieces = [];
    let v = 0, j = 0;
    for (const { geo, nodes, frame } of list) {
      const G = geo.attributes, n = G.position.count;
      pos.set(G.position.array, v * 3); nor.set(G.normal.array, v * 3); if (G.uv) uv.set(G.uv.array, v * 2);
      for (let q = 0; q < geo.index.count; q++) ix[j++] = geo.index.array[q] + v;
      for (let i = 0; i < n; i++) {
        const a = (v + i) * 3, near = nodes.map(q => [q, Math.hypot(P[q * 3] - pos[a], P[q * 3 + 1] - pos[a + 1], P[q * 3 + 2] - pos[a + 2])]).sort((u, w) => u[1] - w[1]).slice(0, K);
        let tot = 0; for (const q of near) tot += 1 / (q[1] * q[1] + 0.004);
        for (let k = 0; k < K; k++) { const q = near[k] || near[0]; idx[(v + i) * K + k] = q[0]; wt[(v + i) * K + k] = near[k] ? 1 / (q[1] * q[1] + 0.004) / tot : 0; }
      }
      const ns = [...new Set(nodes)];
      pieces.push({ v0: v, v1: v + n, f: frame.length >= 3 ? [frame[0], frame[1], frame[2]] : [frame[0], frame[1] === undefined ? frame[0] : frame[1], -1], ns, last: new Float32Array(ns.length * 3).fill(9e3) });
      v += n; geo.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(ix, 1));
    g.setAttribute('aPlan', new THREE.BufferAttribute(Float32Array.from(pos), 3)); g.setAttribute('aY0', new THREE.BufferAttribute(Float32Array.from({ length: nV }, (_, i) => pos[i * 3 + 1]), 1));
    const m = new THREE.Mesh(g, propMat(c, base)); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; c.group.add(m); c.meshes.push(m);
    m.userData.orig = Float32Array.from(pos); m.userData.pb = { idx, wt, K, pieces, rel: new Float32Array(nV * 3) };
  }
  c.bins.clear();
}
// what each vertex stands off its nodes by, once the nodes' rest positions are settled
function propRel(c, S) {
  const P0 = S.p0;
  for (const m of c.meshes) {
    const b = m.userData.pb; if (!b) continue;
    const O = m.userData.orig, R = b.rel, K = b.K;
    for (let i = 0, a = 0; a < O.length; i++, a += 3) {
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < K; k++) { const q = b.idx[i * K + k] * 3, w = b.wt[i * K + k]; x += w * P0[q]; y += w * P0[q + 1]; z += w * P0[q + 2]; }
      R[a] = O[a] - x; R[a + 1] = O[a + 1] - y; R[a + 2] = O[a + 2] - z;
    }
    for (const q of b.pieces) q.last.fill(9e3);
  }
}
const pmR = new Float64Array(9), pmA = new Float64Array(9), pmB = new Float64Array(9);
// a piece's axes from its frame nodes
function propAxes(P, f, out) {
  const a = f[0] * 3, b = f[1] * 3, ax = P[b] - P[a], ay = P[b + 1] - P[a + 1], az = P[b + 2] - P[a + 2], al = Math.hypot(ax, ay, az);
  if (al < 1e-3) return false;
  out[0] = ax / al; out[1] = ay / al; out[2] = az / al;
  if (f[2] < 0) return true;
  const d = f[2] * 3, dx = P[d] - P[a], dy = P[d + 1] - P[a + 1], dz = P[d + 2] - P[a + 2];
  let cx = out[1] * dz - out[2] * dy, cy = out[2] * dx - out[0] * dz, cz = out[0] * dy - out[1] * dx; const cl = Math.hypot(cx, cy, cz);
  if (cl < 1e-4) return false;
  cx /= cl; cy /= cl; cz /= cl;
  out[6] = cx; out[7] = cy; out[8] = cz; out[3] = cy * out[2] - cz * out[1]; out[4] = cz * out[0] - cx * out[2]; out[5] = cx * out[1] - cy * out[0];
  return true;
}
// the turn of a piece: from its frame nodes as they lay to as they now are
function propTurn(P0, P, f, R) {
  R[0] = R[4] = R[8] = 1; R[1] = R[2] = R[3] = R[5] = R[6] = R[7] = 0;
  if (f[0] === f[1] || !propAxes(P0, f, pmA) || !propAxes(P, f, pmB)) return;
  if (f[2] < 0) {
    // two nodes: the shortest turn that takes the old line onto the new one
    const vx = pmA[1] * pmB[2] - pmA[2] * pmB[1], vy = pmA[2] * pmB[0] - pmA[0] * pmB[2], vz = pmA[0] * pmB[1] - pmA[1] * pmB[0], cs = pmA[0] * pmB[0] + pmA[1] * pmB[1] + pmA[2] * pmB[2];
    if (cs < -0.98) return;
    const k = 1 / (1 + cs);
    R[0] = 1 - k * (vy * vy + vz * vz); R[1] = k * vx * vy - vz; R[2] = k * vx * vz + vy;
    R[3] = k * vx * vy + vz; R[4] = 1 - k * (vx * vx + vz * vz); R[5] = k * vy * vz - vx;
    R[6] = k * vx * vz - vy; R[7] = k * vy * vz + vx; R[8] = 1 - k * (vx * vx + vy * vy);
    return;
  }
  for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) R[r * 3 + q] = pmB[r] * pmA[q] + pmB[3 + r] * pmA[3 + q] + pmB[6 + r] * pmA[6 + q];
}
function propSkin(c) {
  const S = c.shell.S, P = S.p, P0 = S.p0, G = S.gap, R = pmR;
  for (const m of c.meshes) {
    const b = m.userData.pb; if (!b) continue;
    const A = m.geometry.attributes.position.array, K = b.K, idx = b.idx, wt = b.wt, rel = b.rel; let any = false;
    for (const pc of b.pieces) {
      // a piece nothing has moved costs nothing
      let moved = false; const ns = pc.ns, last = pc.last;
      for (let q = 0; q < ns.length; q++) { const a = ns[q] * 3; if (Math.abs(P[a] - last[q * 3]) + Math.abs(P[a + 1] - last[q * 3 + 1]) + Math.abs(P[a + 2] - last[q * 3 + 2]) > 0.0006) { moved = true; break; } }
      if (!moved) continue;
      any = true;
      for (let q = 0; q < ns.length; q++) { const a = ns[q] * 3; last[q * 3] = P[a]; last[q * 3 + 1] = P[a + 1]; last[q * 3 + 2] = P[a + 2]; }
      propTurn(P0, P, pc.f, R);
      for (let i = pc.v0; i < pc.v1; i++) {
        let x = 0, y = 0, z = 0, g = 0;
        for (let k = 0; k < K; k++) { const n = idx[i * K + k], q = n * 3, w = wt[i * K + k]; x += w * P[q]; y += w * P[q + 1]; z += w * P[q + 2]; g += w * Math.min(G[n], 9); }
        const a = i * 3, rx = rel[a], ry = rel[a + 1], rz = rel[a + 2];
        // the skin stands off its node only as far as the track above it has left room: flesh and stuffing go flat, not through the track
        let oy = R[3] * rx + R[4] * ry + R[5] * rz; if (oy > g) oy = g;
        A[a] = x + R[0] * rx + R[1] * ry + R[2] * rz; y += oy; A[a + 1] = y > 0.006 ? y : 0.006; A[a + 2] = z + R[6] * rx + R[7] * ry + R[8] * rz;
      }
    }
    if (any) { m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
  }
}
// a link pressed on a body: a smear of the dirt it carries, and the shoe's own bar printed hard across it, broken where it did not bear
function propRow(c, bx, L, rot) {
  const g = c.mud.g, h = LINK * MUD_PX, w = 0.58 * MUD_PX;
  g.save(); g.translate(mudX(bx + rand(-0.012, 0.012)), mudY(L + rand(-0.012, 0.012))); g.rotate(rot + rand(-0.03, 0.03));
  g.globalAlpha = rand(0.1, 0.24); g.fillStyle = mudPick(); g.fillRect(-0.5 * w, -0.5 * h, w, h);
  if (rubberTrack) { for (const sd of [-0.25, 0.25]) { g.globalAlpha = rand(0.3, 0.55); g.fillStyle = '#151413'; g.fillRect(sd * w - 0.2 * w, -0.32 * h, 0.4 * w, 0.64 * h); } }
  else {
    let x = -0.5 * w;
    while (x < 0.5 * w) { const len = rand(0.14, 0.42) * w; if (Math.random() < 0.86) { g.globalAlpha = rand(0.72, 1); g.fillStyle = '#231c13'; g.fillRect(x, -0.2 * h - 0.13 * h, Math.min(len, 0.5 * w - x), 0.26 * h); } x += len + rand(0, 0.03) * w; }
  }
  for (let i = 0, n = Math.floor(rand(1, 6)); i < n; i++) mudBlob(g, rand(-0.5, 0.5) * w, rand(-0.5, 0.5) * h, rand(0.6, 2.2), mudPick(), rand(0.5, 0.9));
  g.restore(); c.mud.dirty = true;
}
// a member has parted: what hung on both ends goes with whichever it was nearer, and the skin between them tears open
function propSever(c, S, a, b) {
  // a hinge cannot hold what is no longer joined to it
  for (let q = 0; q < S.nb; q++) { const u = S.ba[q * 3], v = S.ba[q * 3 + 1], w = S.ba[q * 3 + 2]; if ((v === a && (u === b || w === b)) || (v === b && (u === a || w === a))) S.bF[q] = 0; }
  for (const m of c.meshes) {
    const pb = m.userData.pb; if (!pb) continue;
    const K = pb.K, idx = pb.idx, wt = pb.wt, n = idx.length / K, side = new Int8Array(n); let hit = false;
    for (let i = 0; i < n; i++) {
      let wa = 0, wb = 0;
      for (let k = 0; k < K; k++) { const q = idx[i * K + k]; if (q === a) wa += wt[i * K + k]; else if (q === b) wb += wt[i * K + k]; }
      if (wa > 0 && wb > 0) {
        hit = true; side[i] = wa >= wb ? 1 : 2; const gone = wa >= wb ? b : a;
        let tot = 0; for (let k = 0; k < K; k++) { if (idx[i * K + k] === gone) wt[i * K + k] = 0; tot += wt[i * K + k]; }
        for (let k = 0; k < K; k++) wt[i * K + k] /= tot;
      }
    }
    if (!hit) continue;
    const ix = m.geometry.index.array, out = [];
    for (let t = 0; t < m.geometry.index.count; t += 3) { const u = side[ix[t]], v = side[ix[t + 1]], w = side[ix[t + 2]]; if ((u && v && u !== v) || (v && w && v !== w) || (u && w && u !== w)) continue; out.push(ix[t], ix[t + 1], ix[t + 2]); }
    m.geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(out), 1));
    const O = m.userData.orig, R = pb.rel, P0 = S.p0;
    for (let i = 0; i < n; i++) if (side[i]) {
      let x = 0, y = 0, z = 0; for (let k = 0; k < K; k++) { const q = idx[i * K + k] * 3, w = wt[i * K + k]; x += w * P0[q]; y += w * P0[q + 1]; z += w * P0[q + 2]; }
      R[i * 3] = O[i * 3] - x; R[i * 3 + 1] = O[i * 3 + 1] - y; R[i * 3 + 2] = O[i * 3 + 2] - z;
    }
    for (const q of pb.pieces) q.last.fill(9e3);
  }
}
/* Bodies lie on one another as capsules: limbs and trunk are too thin and far between for spheres at the nodes to keep them apart.
   Load passes down through them: what lies under something the track is pressing feels it as far as the one on top passes it on */
function propCaps(S) {
  const C = S.caps, nC = C.n, A = C.a, B = C.b, RR = C.r, O = C.o, p = S.p, w = S.w, M = C.m;
  for (let i = 0; i < nC; i++) { const a = A[i] * 3, b = B[i] * 3; M[i * 3] = (p[a] + p[b]) / 2; M[i * 3 + 1] = (p[a + 1] + p[b + 1]) / 2; M[i * 3 + 2] = (p[a + 2] + p[b + 2]) / 2; }
  for (let i = 0; i < nC; i++) {
    const ai = A[i] * 3, bi = B[i] * 3, ux = p[bi] - p[ai], uy = p[bi + 1] - p[ai + 1], uz = p[bi + 2] - p[ai + 2], uu = ux * ux + uy * uy + uz * uz, hi = C.h[i];
    for (let j = i + 1; j < nC; j++) {
      if (O[i] === O[j]) continue;
      const R = RR[i] + RR[j], mx = M[i * 3] - M[j * 3], my = M[i * 3 + 1] - M[j * 3 + 1], mz = M[i * 3 + 2] - M[j * 3 + 2], reach = hi + C.h[j] + R;
      if (mx * mx + my * my + mz * mz > reach * reach) continue;
      const aj = A[j] * 3, bj = B[j] * 3, vx = p[bj] - p[aj], vy = p[bj + 1] - p[aj + 1], vz = p[bj + 2] - p[aj + 2], vv = vx * vx + vy * vy + vz * vz;
      const wx = p[ai] - p[aj], wy = p[ai + 1] - p[aj + 1], wz = p[ai + 2] - p[aj + 2], uv = ux * vx + uy * vy + uz * vz, uw = ux * wx + uy * wy + uz * wz, vw = vx * wx + vy * wy + vz * wz;
      const den = uu * vv - uv * uv; let s = den > 1e-8 ? (uv * vw - vv * uw) / den : 0; s = s < 0 ? 0 : s > 1 ? 1 : s;
      let t = vv > 1e-8 ? (uv * s + vw) / vv : 0; if (t < 0) { t = 0; s = uu > 1e-8 ? Math.min(1, Math.max(0, -uw / uu)) : 0; } else if (t > 1) { t = 1; s = uu > 1e-8 ? Math.min(1, Math.max(0, (uv - uw) / uu)) : 0; }
      const dx = wx + ux * s - vx * t, dy = wy + uy * s - vy * t, dz = wz + uz * s - vz * t, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R * R || d2 < 1e-10) continue;
      const d = Math.sqrt(d2), an = A[i], bn = B[i], cn = A[j], en = B[j], wa = w[an] * (1 - s), wb = w[bn] * s, wc = w[cn] * (1 - t), we = w[en] * t, W = wa * (1 - s) + wb * s + wc * (1 - t) + we * t;
      if (W <= 0) continue;
      const push = Math.min(R - d, 0.004), k = push / (d * W), kx = k * dx, ky = k * dy, kz = k * dz;
      p[ai] += wa * kx; p[ai + 1] += wa * ky; p[ai + 2] += wa * kz; p[bi] += wb * kx; p[bi + 1] += wb * ky; p[bi + 2] += wb * kz;
      p[aj] -= wc * kx; p[aj + 1] -= wc * ky; p[aj + 2] -= wc * kz; p[bj] -= we * kx; p[bj + 1] -= we * ky; p[bj + 2] -= we * kz;
      // squeezed between another body and the ground: read as a load, no more than the other is carrying, and the skin has only the room left
      const gp = Math.max(0.012, d * 0.5), fi = Math.max(S.cf[an], S.cf[bn]), fj = Math.max(S.cf[cn], S.cf[en]);
      if (fi > 300 && fj < fi) { for (const n of [cn, en]) { S.cf[n] = Math.max(S.cf[n], fi * 0.8); if (gp < S.gap[n]) S.gap[n] = gp; } }
      else if (fj > 300 && fi < fj) { for (const n of [an, bn]) { S.cf[n] = Math.max(S.cf[n], fj * 0.8); if (gp < S.gap[n]) S.gap[n] = gp; } }
    }
  }
}
/* A piece the track has caught: pinned between a shoe and the ground it comes up with that link as the link leaves the ground, as far as what
   holds it there can pull. Then the piece either falls off the track, or goes on round the sprocket and is only let go where the track comes down at the front */
const SNAG_HOLD = 5000;
function propCatch(c) {
  const S = c.S, opt = c.snagOpt; if (opt === 'off' || speed < 0.2) return;
  const R = shR, ox = shOrigin[0], oy = shOrigin[1], oz = shOrigin[2];
  for (const g of c.grip) {
    if (g.tried || g.body.tokens <= 0) continue;
    const a = g.n * 3, dx = S.p[a] - ox, dy = S.p[a + 1] - oy, dz = S.p[a + 2] - oz;
    const xl = R[0] * dx + R[1] * dy + R[2] * dz; if (xl > -1.85 || xl < -2.75) continue;
    const zl = R[6] * dx + R[7] * dy + R[8] * dz, az = Math.abs(zl); if (az <= 1.11 || az > 1.69) continue;
    const yl = R[3] * dx + R[4] * dy + R[5] * dz, ce = ceilLocal(xl, zl); if (ce === Infinity || ce - yl > 0.09) continue;
    g.tried = true;
    if (Math.random() > (opt === 'rand' ? 0.3 : 0.6)) continue;
    const s = zl < 0 ? 1 : 0, b = belts[s], lp = LPs[s]; let li = 0, bd = 9;
    for (let i = 0; i < LINKS; i++) { const q = beltAt(b, (i + beltPh[s]) * lp); if (q.y < 0.6 && Math.abs(q.x - xl) < bd) { bd = Math.abs(q.x - xl); li = i; } }
    const fate = opt === 'rand' ? (Math.random() < 0.55 ? 'lift' : 'wind') : opt;
    c.snags.push({ n: g.n, s, i: li, zl, fate, relH: rand(0.55, 1.35), top: false, name: g.name });
    g.body.tokens--; S.air[g.n] = 2; if (fate === 'lift') c.lifted++; else c.wound++;
    propHud(c);
  }
}
function propSnags(c, S, h) {
  const { p, w } = S, R = shR, ox = shOrigin[0], oy = shOrigin[1], oz = shOrigin[2], cap0 = SNAG_HOLD * h * h;
  for (let q = c.snags.length - 1; q >= 0; q--) {
    const g = c.snags[q], z = SIDES[g.s], v = speed + hull.w * z, ph = beltPh[g.s] + v * shDt / LPs[g.s] * (1 - shFrac), b = beltAt(belts[g.s], (g.i + ph) * LPs[g.s]);
    const xl = b.x, yl = b.y - 0.05, zl = g.zl, a = g.n * 3;
    const tx = ox + R[0] * xl + R[3] * yl + R[6] * zl, ty = oy + R[1] * xl + R[4] * yl + R[7] * zl, tz = oz + R[2] * xl + R[5] * yl + R[8] * zl;
    const ex = tx - p[a], ey = ty - p[a + 1], ez = tz - p[a + 2], d = Math.hypot(ex, ey, ez);
    if (b.y > 0.95) g.top = true;
    let free = d > 0.3;                      // pulled clean out from under the shoe
    if (g.fate === 'lift' && (p[a + 1] > g.relH || g.top)) free = true;
    if (g.fate === 'wind' && g.top && b.x > 1.4 && b.y < 0.42) free = true;
    if (Math.abs(speed) < 0.02 && !hull.w) { g.still = (g.still || 0) + h; if (g.still > 0.6) free = true; } else g.still = 0;
    if (free) { c.snags.splice(q, 1); S.air[g.n] = 1; c.activeUntil = time + 9; continue; }
    if (d < 1e-6) continue;
    const k = Math.min(1, cap0 * w[g.n] / d);
    p[a] += ex * k; p[a + 1] += ey * k; p[a + 2] += ez * k;
  }
}
/* A stuffed toy: lobes of fibre in a thin skin, joined at sewn seams. Each lobe is a centre and six points on its skin on soft
   members: stuffing gives at a low force, packs down and comes back only part of the way. Seams let go when drawn out. */
const TOY_E = 2500, TOY_KG = 0.07;
function toyLobe(S, x, y, z, r, sc, grp) {
  const c = shellNode(S, x, y, z, TOY_KG * 2 * sc, 0.03, grp), out = [c], ax = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const [a, b, d] of ax) out.push(shellNode(S, x + a * r[0], y + b * r[1], z + d * r[2], TOY_KG * sc, 0.025, grp));
  const lk = (p, q, F) => shellLink(S, p, q, TOY_E, F * 2.2, F, 9, 0.8);
  for (let i = 1; i <= 6; i++) lk(c, out[i], 110 * sc);
  for (let i = 1; i <= 6; i++) for (let j = i + 1; j <= 6; j++) if (!(i % 2 === 1 && j === i + 1)) lk(out[i], out[j], 70 * sc);
  return out;
}
function buildToys(c, S) {
  const ang = c.layAcross ? [0.4, -0.3, 0.2] : [0, 0, 0], kinds = [['bear', 1.5, 0, 0], ['rabbit', 1.05, 1.45, 0], ['bear', 1, -1.45, 1]];
  c.seams = []; let grp = 2;
  kinds.forEach(([kind, sc, zb, tone], ti) => {
    const xb = rand(-0.1, 0.1), yaw = ang[ti] + rand(-0.2, 0.2), cy = Math.cos(yaw), sy = Math.sin(yaw), g = grp++;
    const T = (x, y, z) => [xb + (x * cy + z * sy) * sc, y * sc, zb + (-x * sy + z * cy) * sc];
    const fur = plushFur[tone], pale = plushPale[tone], lobes = [
      { n: 'body', p: [0, 0.22, 0], r: [0.22, 0.23, 0.19], mat: fur, extra: [[0.15, 1, 1.1, 0.5, 0, 0.19, 0.13, pale]] },
      { n: 'head', p: [0, 0.56, 0.02], r: [0.18, 0.17, 0.17], mat: fur, extra: kind === 'bear'
        ? [[0.065, 1, 1, 0.55, -0.14, 0.71, 0.01, fur], [0.065, 1, 1, 0.55, 0.14, 0.71, 0.01, fur], [0.075, 1, 0.8, 0.9, 0, 0.5, 0.15, pale], [0.022, 1, 1, 0.6, -0.068, 0.6, 0.175, plushEye], [0.022, 1, 1, 0.6, 0.068, 0.6, 0.175, plushEye], [0.028, 1.2, 0.8, 0.7, 0, 0.53, 0.225, plushEye], [0.05, 1.25, 0.8, 0.45, -0.055, 0.39, 0.165, plushBow[tone]], [0.05, 1.25, 0.8, 0.45, 0.055, 0.39, 0.165, plushBow[tone]]]
        : [[0.055, 0.9, 3.2, 0.5, -0.08, 0.88, 0, fur], [0.055, 0.9, 3.2, 0.5, 0.08, 0.88, 0, fur], [0.035, 0.8, 2.6, 0.3, -0.08, 0.88, 0.02, pale], [0.035, 0.8, 2.6, 0.3, 0.08, 0.88, 0.02, pale], [0.06, 1, 0.8, 0.9, 0, 0.51, 0.15, pale], [0.02, 1, 1, 0.6, -0.07, 0.6, 0.17, plushEye], [0.02, 1, 1, 0.6, 0.07, 0.6, 0.17, plushEye], [0.02, 1.2, 0.8, 0.7, 0, 0.53, 0.205, plushBow[0]]] },
      { n: 'armL', p: [-0.25, 0.25, 0.06], r: [0.075, 0.12, 0.075], mat: fur },
      { n: 'armR', p: [0.25, 0.25, 0.06], r: [0.075, 0.12, 0.075], mat: fur },
      { n: 'legL', p: [-0.14, 0.09, 0.26], r: [0.09, 0.085, 0.16], mat: fur, extra: [[0.06, 1, 1, 0.3, -0.14, 0.09, 0.42, pale]] },
      { n: 'legR', p: [0.14, 0.09, 0.26], r: [0.09, 0.085, 0.16], mat: fur, extra: [[0.06, 1, 1, 0.3, 0.14, 0.09, 0.42, pale]] },
    ];
    const made = lobes.map(L => {
      const [x, y, z] = T(...L.p), nodes = toyLobe(S, x, y, z, L.r.map(v => v * sc), sc * sc, g);
      const parts = new Map(); parts.set(L.mat, [[Math.max(...L.r), L.r[0] / Math.max(...L.r), L.r[1] / Math.max(...L.r), L.r[2] / Math.max(...L.r), ...L.p]]);
      (L.extra || []).forEach(e => { if (!parts.has(e[7])) parts.set(e[7], []); parts.get(e[7]).push(e.slice(0, 7)); });
      const meshes = [];
      for (const [mat, list] of parts) {
        const geo = blobs(list.map(q => { const [px, py, pz] = T(q[4], q[5], q[6]); return [q[0] * sc, q[1], q[2], q[3], px, py, pz]; }));
        propPiece(c, S, geo, mat, nodes, 't' + ti, [nodes[0], nodes[1], nodes[3]]);
      }
      return { nodes, meshes, n: L.n };
    });
    const body = made[0].nodes, seam = (a, b) => {
      for (const q of [a.nodes[0], a.nodes[1], a.nodes[3]]) {
        const near = b.nodes.slice().sort((u, v) => Math.hypot(S.p[u * 3] - S.p[q * 3], S.p[u * 3 + 1] - S.p[q * 3 + 1], S.p[u * 3 + 2] - S.p[q * 3 + 2]) - Math.hypot(S.p[v * 3] - S.p[q * 3], S.p[v * 3 + 1] - S.p[q * 3 + 1], S.p[v * 3 + 2] - S.p[q * 3 + 2]))[0];
        c.seams.push(shellLink(S, q, near, TOY_E * 2, 160 * sc * sc, 200 * sc, 0.12 * sc, 0, 1));
      }
    };
    for (let i = 1; i < made.length; i++) seam(made[i], made[0]);
    c.toys = c.toys || []; c.toys.push({ top0: 0, nodes: made.flatMap(q => q.nodes), squeaked: false, burst: false, i: ti, sc, name: kind === 'bear' ? '毛绒熊' : '毛绒兔' });
    c.plush.push({ userData: { cx: xb, cz: zb } });      // where the stuffing comes out
    const own = { tokens: 1 }; for (const L of made) if (L.n !== 'body') c.grip.push({ n: L.nodes[0], body: own, tried: false, name: L.n });
  });
}
/* A 50th percentile male dummy of the Hybrid III kind, lying on its back: 78 kg, segment masses as that dummy's. Each bone carries
   what the person's bone carries before it goes. Forces are the published tolerance figures, approximate, and vary a good deal
   from person to person: skull about 6 kN, neck 4 kN in compression, femur 10 kN along it and 4 kN across it, tibia 8 and 2.7 kN,
   humerus and forearm 1.8 and 1.2 kN across, pelvis 8 kN, lumbar spine 6 kN, chest about 26 N/mm to a limit of some 63 mm. */
const DUMMY_PARTS = [
  ['skull', '颅骨', 6200], ['neck', '颈椎', 4000], ['chest', '胸廓', 4500], ['lumbar', '腰椎', 6000], ['pelvis', '骨盆', 8000],
  ['femurL', '左大腿骨', 4000], ['femurR', '右大腿骨', 4000], ['tibiaL', '左小腿骨', 2700], ['tibiaR', '右小腿骨', 2700],
  ['humerusL', '左上臂骨', 1800], ['humerusR', '右上臂骨', 1800], ['foreL', '左前臂骨', 1200], ['foreR', '右前臂骨', 1200],
];
// where each lies. A pile is made the way it would be: each one let fall onto the ones before it, so no two piles are alike
function dummyLayout(c, n) {
  const lay = n === 1 ? 'one' : PROP_OPT.lay, out = [];
  for (let i = 0; i < n; i++) {
    if (lay === 'one') { const dz = rand(-0.12, 0.12); out.push(c.layAcross ? { x: 0, z: dz, yaw: Math.PI / 2, lift: 0 } : { x: dz * 0.5, z: 0.1 + dz, yaw: 0, lift: 0 }); }
    else if (lay === 'row') out.push({ x: rand(-0.12, 0.12), z: (i - (n - 1) / 2) * 0.62 + rand(-0.03, 0.03), yaw: Math.PI / 2 + rand(-0.14, 0.14), lift: 0 });
    else if (lay === 'scatter') { const k = (i + 0.5) / n; out.push({ x: rand(-0.55, 0.55), z: (k - 0.5) * 3.4, yaw: rand(0, Math.PI * 2), lift: 0.02 + (i % 2) * 0.28 }); }
    else out.push({ x: rand(-0.42, 0.42), z: rand(-0.6, 0.6), yaw: rand(0, Math.PI * 2), lift: 0.03 + i * 0.3 });
  }
  return out;
}
function buildDummy(c, S) {
  const places = dummyLayout(c, c.nDummy);
  c.bodies = []; c.dummyParts = []; S.grB = new Float32Array(S.maxN);
  const list = places.flatMap((T, i) => buildOneDummy(c, S, T, i)), n = list.length;
  // the capsules bodies meet each other with
  if (places.length > 1) S.caps = { n, a: Int32Array.from(list, q => q[0]), b: Int32Array.from(list, q => q[1]), r: Float32Array.from(list, q => q[2]), o: Int16Array.from(list, q => q[3]), m: new Float32Array(n * 3), h: Float32Array.from(list, q => Math.hypot(S.p[q[0] * 3] - S.p[q[1] * 3], S.p[q[0] * 3 + 1] - S.p[q[1] * 3 + 1], S.p[q[0] * 3 + 2] - S.p[q[1] * 3 + 2]) / 2 + 0.02) };
  c.toys = [];
}
function buildOneDummy(c, S, T, di) {
  const cy = Math.cos(T.yaw), sy = Math.sin(T.yaw), M = (x, y, z) => [T.x + x * cy + z * sy, y + T.lift, T.z - x * sy + z * cy], own = 'd' + di, G4 = new THREE.Matrix4().set(cy, 0, sy, T.x, 0, 1, 0, T.lift, -sy, 0, cy, T.z, 0, 0, 0, 1);
  const parts = DUMMY_PARTS.map(([id, name, limit]) => ({ id, name, limit, peak: 0, links: [], broken: null, body: di })), body = { i: di, parts, tokens: PROP_OPT.snag === 'rand' ? (Math.random() < 0.3 ? 2 : 1) : 3 };
  c.bodies.push(body); c.dummyParts.push(...parts);
  const P = {}, E_BONE = 5e7;
  const N = (id, x, y, z, m, r = 0.04, gr) => { const [a, b, d] = M(x, y, z), n = shellNode(S, a, b, d, m, r, 2 + di); P[id] = n; S.grB[n] = Math.max(0.02, y); if (gr !== undefined) (S.gr = S.gr || new Float32Array(S.maxN))[n] = gr; return n; };
  const part = id => parts.find(p => p.id === id);
  // a load path that is part of a bone: yields at the bone's limit and is then a fracture
  const bone = (pid, a, b, Fc, Ft = Fc) => { const q = part(pid), k = shellLink(S, P[a], P[b], E_BONE, Ft, Fc, 0.2, 0); q.links.push(k); return k; };
  const flesh = (a, b, F = 1400, E = 90000) => shellLink(S, P[a], P[b], E, F * 2, F, 1.5, 0.8);
  // joints carry force but turn freely
  const joint = (a, b, F = 9000) => shellLink(S, P[a], P[b], E_BONE, F, F, 0.05, 0, 1);
  // head: four points of the skull, and vinyl and foam over the crown
  N('hd', 0, 0.11, 0.72, 1.5); N('hdL', -0.075, 0.11, 0.72, 0.6); N('hdR', 0.075, 0.11, 0.72, 0.6); N('hdT', 0, 0.11, 0.81, 0.6); N('hdJ', 0, 0.09, 0.63, 0.6); N('hdF', 0, 0.2, 0.72, 0.6, 0.02);
  for (const a of ['hdL', 'hdR', 'hdT', 'hdJ', 'hdF']) bone('skull', 'hd', a, 6200);
  for (const [a, b] of [['hdL', 'hdT'], ['hdR', 'hdT'], ['hdL', 'hdF'], ['hdR', 'hdF'], ['hdT', 'hdF'], ['hdJ', 'hdF'], ['hdL', 'hdJ'], ['hdR', 'hdJ']]) bone('skull', a, b, 6200);
  // neck, thoracic and lumbar spine
  N('nk', 0, 0.09, 0.57, 1.5, 0.03); N('t1', 0, 0.1, 0.5, 4); N('th', 0, 0.1, 0.3, 7); N('lu', 0, 0.1, 0.1, 7); N('pv', 0, 0.1, -0.05, 11);
  bone('neck', 'hdJ', 'nk', 4000, 4200); bone('neck', 'hd', 'nk', 4000, 4200); bone('neck', 'nk', 't1', 4000, 4200);
  bone('lumbar', 'th', 'lu', 6000, 6000); bone('lumbar', 'lu', 'pv', 6000, 6000); joint('t1', 'th', 30000);
  // the rib cage: sternum and ribs on springs of the chest's stiffness, off the thoracic spine
  N('st', 0, 0.21, 0.36, 1); N('rbL', -0.13, 0.17, 0.3, 1); N('rbR', 0.13, 0.17, 0.3, 1); N('ab', 0, 0.2, 0.14, 1.2, 0.03);
  const rib = (a, b) => { const q = part('chest'), k = shellLink(S, P[a], P[b], 43000, 4500, 4500, 0.3, 0.6); q.links.push(k); };
  for (const [a, b] of [['st', 'th'], ['st', 't1'], ['st', 'lu'], ['rbL', 'th'], ['rbR', 'th'], ['rbL', 'st'], ['rbR', 'st'], ['rbL', 't1'], ['rbR', 't1']]) rib(a, b);
  (S.gr = S.gr || new Float32Array(S.maxN))[P.st] = 0.17; part('chest').cell = P.st;     // the sternum stands on the rib cage until the rib cage goes
  flesh('ab', 'lu', 1800, 30000); flesh('ab', 'pv', 1800, 30000); flesh('ab', 'st', 1800, 30000);
  // pelvis: a ring, hips in it
  N('ilL', -0.15, 0.11, -0.04, 2.5); N('ilR', 0.15, 0.11, -0.04, 2.5); N('hpL', -0.09, 0.09, -0.14, 1.5); N('hpR', 0.09, 0.09, -0.14, 1.5); N('pvT', 0, 0.2, -0.05, 0.7, 0.03);
  for (const [a, b] of [['pv', 'ilL'], ['pv', 'ilR'], ['ilL', 'hpL'], ['ilR', 'hpR'], ['hpL', 'hpR'], ['pv', 'hpL'], ['pv', 'hpR'], ['pvT', 'pv'], ['pvT', 'ilL'], ['pvT', 'ilR']]) bone('pelvis', a, b, 8000);
  // shoulders
  N('shL', -0.21, 0.1, 0.47, 1.2); N('shR', 0.21, 0.1, 0.47, 1.2);
  for (const s of ['L', 'R']) { const k = s === 'L' ? -1 : 1, sh = 'sh' + s, rb = 'rb' + s;
    shellLink(S, P[sh], P.t1, E_BONE, 2000, 1900, 0.02, 0); shellLink(S, P[sh], P[rb], 90000, 1500, 1500, 1.5, 0.6); shellLink(S, P[sh], P.th, 90000, 1500, 1500, 1.5, 0.6);
    // a long bone: two joints, a node at its middle with a plastic hinge, and flesh and bone across it to the crown of the limb
    // the middle of a long bone stands as thick as the limb: what it is caught with between the track and the ground is the load across
    // the bone, read like a load cell. Past the bone's limit it breaks, and that part of the limb goes flat
    const seg = (pid, a, id, A, B, r, mass, bendF, axialF) => {
      const m = id + 'm', b = id + 'e', C = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      N(b, ...B, mass * 0.35); N(m, ...C, mass * 0.65, r, r);
      bone(pid, a, m, axialF); bone(pid, m, b, axialF);
      shellBend(S, P[a], P[m], P[b], bendF); part(pid).hinge = S.nb - 1; part(pid).cell = P[m];
      return b;
    };
    const hu = seg('humerus' + s, sh, 'ua' + s, [k * 0.21, 0.1, 0.47], [k * 0.25, 0.09, 0.19], 0.05, 2, 1800, 5000);
    const fa = seg('fore' + s, hu, 'la' + s, [k * 0.25, 0.09, 0.19], [k * 0.27, 0.07, -0.08], 0.04, 1.7, 1200, 3000);
    N('hn' + s, k * 0.28, 0.05, -0.17, 0.6); joint(fa, 'hn' + s, 2500);
    const hp = 'hp' + s;
    const fe = seg('femur' + s, hp, 'th' + s, [k * 0.09, 0.09, -0.14], [k * 0.1, 0.08, -0.57], 0.08, 6, 4000, 10000);
    const ti = seg('tibia' + s, fe, 'sh2' + s, [k * 0.1, 0.08, -0.57], [k * 0.11, 0.06, -0.97], 0.06, 4.2, 2700, 8000);
    N('ft' + s, k * 0.13, 0.16, -1.02, 1.3); joint(ti, 'ft' + s, 4000);
  }
  // the meshes: built lying at the origin, then carried to where this one lies
  const put = (geo, mat, nodes, frame) => { geo.applyMatrix4(G4); const ns = nodes.map(k => P[k]); propPiece(c, S, geo, mat, ns, own, frame ? frame.map(k => P[k]) : ns); };
  const blob = (list, mat, nodes, frame) => put(blobs(list), mat, nodes, frame);
  const caps = (A, B, r, mat, nodes, rad = 12) => {
    const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), L = a.distanceTo(b), g = new THREE.CapsuleGeometry(r, Math.max(0.01, L), 4, rad);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return put(g, mat, nodes);
  };
  const disc = (x, y, z, r, nodes, nrm = [0, 1, 0]) => { const g = new THREE.CircleGeometry(r, 16); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...nrm))); g.translate(x, y, z); return put(g, dummyTarget, nodes); };
  const HD = ['hd', 'hdT', 'hdL'], TR = ['t1', 'lu', 'shL'], PV = ['pv', 'ilL', 'pvT'];
  blob([[0.1, 0.92, 1.0, 1.18, 0, 0.11, 0.72], [0.022, 0.9, 0.7, 1.1, 0, 0.21, 0.695], [0.058, 0.95, 0.75, 0.75, 0, 0.1, 0.625]], dummySkin, ['hd', 'hdL', 'hdR', 'hdT', 'hdJ', 'hdF'], HD);
  disc(0.075, 0.17, 0.74, 0.024, ['hd', 'hdR', 'hdF'], [0.7, 0.7, 0]); disc(-0.075, 0.17, 0.74, 0.024, ['hd', 'hdL', 'hdF'], [-0.7, 0.7, 0]);
  for (let q = 0; q < 4; q++) caps([-0.038, 0.09, 0.535 + q * 0.024], [0.038, 0.09, 0.535 + q * 0.024], 0.015 + (q % 2) * 0.004, dummyDark, ['nk', 't1'], 8);
  blob([[0.19, 0.95, 0.56, 1.05, 0, 0.13, 0.35], [0.155, 0.92, 0.6, 0.9, 0, 0.12, 0.16]], dummySkin, ['t1', 'th', 'lu', 'st', 'rbL', 'rbR', 'ab', 'shL', 'shR'], TR);
  disc(0, 0.243, 0.42, 0.03, ['st', 't1', 'rbL']); disc(0, 0.222, 0.07, 0.03, ['ab', 'lu', 'pv']);
  blob([[0.19, 0.95, 0.62, 0.72, 0, 0.11, -0.05]], dummySkin, ['pv', 'ilL', 'ilR', 'hpL', 'hpR', 'pvT', 'lu'], PV);
  disc(0.13, 0.19, -0.1, 0.03, ['ilR', 'hpR', 'pvT']); disc(-0.13, 0.19, -0.1, 0.03, ['ilL', 'hpL', 'pvT']);
  const capList = [['t1', 'lu', 0.15], ['lu', 'pv', 0.15], ['hd', 'hdT', 0.09]];
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? -1 : 1, seg2 = (id, A, B, rA, nodes) => {
      const M2 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
      caps(A, M2, rA, dummySkin, [nodes[0], id + 'm']); caps(M2, B, rA, dummySkin, [id + 'm', id + 'e']);
      // the steel that shows where the vinyl tears
      caps(A, M2, 0.012, dummyDark, [nodes[0], id + 'm'], 6); caps(M2, B, 0.012, dummyDark, [id + 'm', id + 'e'], 6);
      capList.push([nodes[0], id + 'm', rA], [id + 'm', id + 'e', rA]);
    };
    seg2('ua' + s, [k * 0.21, 0.1, 0.47], [k * 0.25, 0.09, 0.19], 0.05, ['sh' + s]);
    seg2('la' + s, [k * 0.25, 0.09, 0.19], [k * 0.27, 0.07, -0.08], 0.04, ['ua' + s + 'e']);
    seg2('th' + s, [k * 0.09, 0.09, -0.14], [k * 0.1, 0.08, -0.57], 0.08, ['hp' + s]);
    seg2('sh2' + s, [k * 0.1, 0.08, -0.57], [k * 0.11, 0.06, -0.97], 0.058, ['th' + s + 'e']);
    blob([[0.045, 0.9, 1, 1.1, k * 0.28, 0.05, -0.17]], dummySkin, ['hn' + s, 'la' + s + 'e']);
    blob([[0.055, 0.85, 1.8, 0.9, k * 0.13, 0.13, -1.02], [0.04, 0.9, 1, 1.4, k * 0.12, 0.05, -1.03]], dummyDark, ['ft' + s, 'sh2' + s + 'e']);
    for (const [x, y, z, r, n] of [[k * 0.21, 0.1, 0.47, 0.066, 'sh' + s], [k * 0.25, 0.09, 0.19, 0.056, 'ua' + s + 'e'], [k * 0.1, 0.08, -0.57, 0.09, 'th' + s + 'e']]) blob([[r, 1, 1, 1, x, y, z]], dummyDark, [n]);
    for (const [id, name] of [['hn' + s, '手'], ['ft' + s, '脚'], ['la' + s + 'm', '前臂'], ['sh2' + s + 'm', '小腿'], ['ua' + s + 'm', '上臂'], ['th' + s + 'm', '大腿']]) c.grip.push({ n: P[id], body, tried: false, name });
  }
  c.grip.push({ n: P.hd, body, tried: false, name: '头' });
  return capList.map(q => [P[q[0]], P[q[1]], q[2], di]);
}
function buildProp(kind, modeKey) {
  const mode = MODES[modeKey], def = PROPS[kind], V = Object.assign({}, VEHICLES.sedan, { name: def.name, hold: 9, strength: 1 });
  useV(V);
  const nD = kind === 'dummy' ? PROP_OPT.count : 0, group = new THREE.Group(), S = shellNew(kind === 'dummy' ? 20 + nD * 80 : 260, kind === 'dummy' ? 100 + nD * 240 : 1100), f = { V: new Float32Array(GN), E: new Float32Array(GN), top: new Float32Array(GN), real: new Float32Array(GN), B: new Float32Array(GN), R: new Float32Array(GN).fill(Infinity), dirty: new Uint8Array(GN), vol: 1, h0: 0, hoodN: [], roofN: [], pillarN: [], doorN: [], pressOf: new Map() };
  const carZ = modeKey === 'centre' ? rand(-0.1, 0.1) : SIDES[1] + rand(-0.06, 0.06);
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const c = { nDummy: nD, snagOpt: PROP_OPT.snag, snags: [], grip: [], activeUntil: -1, lifted: 0, wound: 0, brk0: 0, pm: new Map(), bins: new Map(), prop: kind, kind, modeKey, V, f, group, meshes: [], mats: [], bags: [], tires: [], mirrors: [], plush: [], z: carZ, across: false, layAcross: !!mode.across, nb: 0, bx: [], bL: [], over: [], Hs: new Float64Array(0), bandX: SIDES[1] - carZ, crawlK: rand(0.92, 1.08), give: 0, snapped: false, lost: 0, pass: 0, sill: V.zones[1][0], belt: 0.5, ground: [], ip: CAR_IP, ir: CAR_IR, lamp: { emissiveIntensity: 0 }, tail: { emissiveIntensity: 0 }, mudCut: { value: -9 }, mudL: 9, mud: makeMud(), oil: new THREE.Mesh(new THREE.BufferGeometry(), dark), seed: rand(0, 99), fold: [1, 1], tops: new Float32Array(TOPN * TOPM), hardF: new Float32Array(GN), bandHard: new Float32Array(0), engN: [], glShown: 0, S };
  c.oil.visible = false;
  def.build(c, S);
  propMerge(c, S);
  return c;
}
function propAttach(c) {
  const S = c.S, f = c.f;
  c.Y = CAR_CG; c.vY = 0; c.th = 0; c.ph = 0; c.w = 0; c.wr = 0; c.yawC = 0;
  S.vUp = 4.5; S.mu = 0.75; S.damp = 3; S.cf = new Float32Array(S.maxN); S.ce = new Float32Array(S.maxN).fill(9); S.gap = new Float32Array(S.maxN).fill(9); S.air = new Uint8Array(S.maxN);
  if (!S.gr) S.gr = new Float32Array(S.maxN);
  for (let i = 0; i < S.n; i++) if (!S.gr[i]) S.gr[i] = S.r[i];
  const sh = c.shell = { S, T: new Int32Array(0), nT: 0, wheels: [], engine: [], tn: new Float32Array(0), welds: [], awake: true, age: 0, prop: true, nodePanel: new Int16Array(S.n), mass: 0 };
  for (let i = 0; i < S.n; i++) sh.mass += S.m[i];
  const d0 = S.damp, built = S.p.slice(0, S.n * 3); let P1 = null;
  // the pile falls together first, standing on the ground as it was built, with nothing to break in a fall this small
  if (S.caps) {
    const gr = S.gr, Ft = S.Ft.slice(), Fc = S.Fc.slice(), bF = S.bF.slice(); S.gr = S.grB;
    for (let k = 0; k < S.nc; k++) { S.Ft[k] *= 50; S.Fc[k] *= 50; }
    for (let k = 0; k < S.nb; k++) S.bF[k] *= 3;
    const steps = 1100 + 240 * c.nDummy;
    for (let i = 0; i < steps; i++) { S.damp = i < steps - 300 ? 3 : 30; shellStep(S, 0.001, shellContactFree); }
    S.gr = gr; S.Ft.set(Ft); S.Fc.set(Fc); S.bF.set(bF); S.v.fill(0); S.force.fill(0);
    P1 = S.p.slice(0, S.n * 3);
  }
  for (let i = 0; i < 900; i++) { S.g = SHELL_G * Math.min(1, i / 600); S.damp = 25; shellStep(S, 0.001, shellContactFree); }
  S.g = undefined; S.damp = d0; S.v.fill(0);
  S.broke.length = 0; S.ce.fill(9); S.gap.fill(9); S.cf.fill(0);
  // the mesh shows how it fell; the little the nodes then sank into their own flesh is not shown as a change of shape
  if (P1) for (let i = 0; i < S.n * 3; i++) S.p0[i] = built[i] + S.p[i] - P1[i]; else S.p0.set(S.p);
  propRel(c, S);
  shellRaster(c);
  let h0 = 0, vol = 0; for (let n = 0; n < GN; n++) if (f.V[n] > 0.02) { f.real[n] = f.top[n] = f.V[n]; h0 = Math.max(h0, f.V[n]); vol += f.V[n] * GC * GC; f.E[n] = 0; }
  f.h0 = h0; f.vol = vol || 1; c.lost = 0; c.t0 = -1;
  sh.y0 = S.p.slice(0, S.n * 3);
  sh.ySum = 0; for (let i = 0, a = 1; i < S.n; i++, a += 3) sh.ySum += S.p[a];
  if (c.dummyParts) for (const q of c.dummyParts) { q.peak = 0; q.broken = null; }
  if (c.toys) for (const t of c.toys) t.top0 = Math.max(...t.nodes.map(q => S.p[q * 3 + 1]));
  propSkin(c);
}
// once a frame, near the tank: what the sensors read, what has gone, and how much stuffing has come back
function propFrame(c, dt) {
  const sh = c.shell, S = sh.S;
  propCatch(c);
  for (; c.brk0 < S.broke.length; c.brk0++) { const k = S.broke[c.brk0]; propSever(c, S, S.ca[k], S.cb[k]); if (time - (c.tearT || -9) > 0.1) { c.tearT = time; fx('snap', 0.7); } }
  shellFrame(c);
  // how much is gone, from the nodes: a few nodes on a grid would read every step they take as a loss
  let sum = 0; for (let i = 0, a = 1; i < S.n; i++, a += 3) sum += S.p[a];
  c.lost = c.f.vol * Math.max(0, Math.min(1, 1 - sum / sh.ySum));
  if (sh.load > 200 && c.t0 < 0) c.t0 = time;
  const t = c.t0 < 0 ? 0 : time - c.t0;
  if (c.dummyParts) for (const q of c.dummyParts) {
    let pk = 0, gone = false;
    for (const k of q.links) {
      // a long bone's reading is across it, from its load cell; its strength along it is higher, and has a different limit
      const F = Math.abs(S.force[k]); if (S.on[k] && F > pk && q.cell === undefined) pk = F;
      if (!S.on[k] || Math.abs(S.L[k] - S.L0[k]) / (S.L0[k] + 1e-6) > 0.02) gone = true;
    }
    if (q.cell !== undefined) { pk = S.cf[q.cell]; S.cf[q.cell] = 0; if (pk > q.limit) gone = true; }
    if (pk > q.peak) q.peak = pk;
    if (gone && !q.broken) {
      q.broken = t + 0.001;
      for (const k of q.links) { S.Fc[k] *= 0.3; S.Ft[k] *= 0.3; }
      if (q.hinge !== undefined) S.bF[q.hinge] *= 0.1;
      if (q.cell !== undefined) { S.gr[q.cell] *= 0.35; S.r[q.cell] *= 0.35; }
      fx('snap', 1); shake = Math.max(shake, 0.004);
      const a = q.links[0], n = S.ca[a] * 3; for (let i = 0; i < 6; i++) { const w = carW(c, S.p[n], S.p[n + 1], S.p[n + 2], gp); spawnBit(new THREE.Vector3(w[0], w[1] + 0.05, w[2]), new THREE.Vector3(rand(-1, 1), rand(0.3, 1.4), rand(-1, 1)), rand(0.012, 0.03), i % 3 ? dummySkin.color : dummyDark.color); }
      propHud(c);
    }
  }
  if (c.toys && c.toys.length) {
    // fibre springs back slowly, and never all the way
    for (let k = 0; k < S.nc; k++) { if (S.kind[k] || !S.on[k]) continue; if (S.L[k] < S.L0[k] * 0.8 && Math.abs(S.force[k]) < 20) S.L[k] += (S.L0[k] * 0.8 - S.L[k]) * Math.min(1, dt * 0.9); }
    c.toys.forEach((T, i) => {
      // the fibre comes part of the way back up once the track has gone by
      let top = 9; for (const q of T.nodes) { if (S.ce[q] < 9 && sh.load < 50) { S.ce[q] = Math.min(Math.max(S.ce[q], 0) + dt * 0.25, Math.max(S.ce[q], T.top0 * 0.5)); if (S.gap[q] < 0.2) S.gap[q] = Math.min(0.2, S.gap[q] + dt * 0.12); } if (S.ce[q] < top) top = S.ce[q]; }
      if (!T.squeaked && c.t0 >= 0 && top < T.top0 * 0.85) { T.squeaked = true; T.squeakT = t; fx('squeak', i); propHud(c); }
      // pressed to under half its height the air and fibre have nowhere to go, and the seams give; after that a limb comes away easily
      const seams = c.seams.slice(i * 15, i * 15 + 15);
      if (!T.burst && c.t0 >= 0 && (top < T.top0 * 0.4 || seams.some(k => !S.on[k]))) {
        T.burst = true; T.burstT = t; c.stuffed = true; fx('fluff', i); fx('squeak', 0.4);
        for (const k of seams) { S.Ft[k] *= 0.25; S.Fc[k] *= 0.25; S.ef[k] *= 0.5; }
        propHud(c);
      }
    });
    let torn = 0; for (const k of c.seams) if (!S.on[k]) torn++;
    c.seamsTorn = torn;
  }
  S.cf.fill(0);
  c.mudCut.value = -9;
}
// the HUD's list, told by the sensors rather than the car's stages
function propHud(c) {
  let rows;
  if (c.dummyParts) {
    if (c.nDummy === 1) rows = c.dummyParts.map(q => [q.name, q.broken != null ? '断裂 ' + q.broken.toFixed(2) + ' s' : (q.peak / 1000).toFixed(1) + ' / ' + (q.limit / 1000).toFixed(1) + ' kN', q.broken != null]);
    else rows = c.bodies.map(b => { const gone = b.parts.filter(q => q.broken != null), hard = b.parts.reduce((m, q) => q.peak / q.limit > m.peak / m.limit ? q : m, b.parts[0]); return [(b.i + 1) + ' 号假人', gone.length ? '断 ' + gone.length + ' / ' + b.parts.length : hard.peak > 50 ? hard.name + ' ' + (hard.peak / 1000).toFixed(1) + ' kN' : '—', gone.length > 0]; });
  } else rows = c.toys.flatMap(T => [[T.name + ' 被压扁', T.squeakT != null ? T.squeakT.toFixed(2) + ' s' : '—', T.squeakT != null], [T.name + ' 开线爆棉', T.burstT != null ? T.burstT.toFixed(2) + ' s' : '—', T.burstT != null]]);
  rows.push(['被履带带起', c.lifted + ' 处', c.lifted > 0], ['卷进履带', c.wound + ' 处', c.wound > 0]);
  hLog.textContent = ''; hLog.dataset.prop = '1';
  for (const [n, v, on] of rows) { const li = document.createElement('li'); li.dataset.on = on ? '1' : '0'; const s = document.createElement('span'); s.textContent = n; const i = document.createElement('i'); i.textContent = v; li.append(s, i); hLog.append(li); }
}
