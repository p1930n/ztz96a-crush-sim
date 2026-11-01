/* ================= geometry helpers ================= */
function add(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function boxG(w, h, d) {
  const H = [w / 2, h / 2, d / 2], c = Math.min(0.012, Math.min(w, h, d) * 0.18), pos = [];
  const P = (ax, s, b, sb, e, se) => { const v = [0, 0, 0]; v[ax] = s * H[ax]; v[b] = sb * (H[b] - c); v[e] = se * (H[e] - c); return v; };
  const tri = (A, B, C) => {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const out = (uy * vz - uz * vy) * (A[0] + B[0] + C[0]) + (uz * vx - ux * vz) * (A[1] + B[1] + C[1]) + (ux * vy - uy * vx) * (A[2] + B[2] + C[2]);
    if (out < 0) pos.push(...A, ...C, ...B); else pos.push(...A, ...B, ...C);
  };
  const quad = (A, B, C, D) => { tri(A, B, C); tri(A, C, D); };
  for (let ax = 0; ax < 3; ax++) {
    const b = (ax + 1) % 3, e = (ax + 2) % 3;
    for (const s of [1, -1]) quad(P(ax, s, b, -1, e, -1), P(ax, s, b, 1, e, -1), P(ax, s, b, 1, e, 1), P(ax, s, b, -1, e, 1));
    for (const sb of [1, -1]) for (const se of [1, -1]) quad(P(b, sb, ax, -1, e, se), P(b, sb, ax, 1, e, se), P(e, se, ax, 1, b, sb), P(e, se, ax, -1, b, sb));
  }
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) tri(P(0, sx, 1, sy, 2, sz), P(1, sy, 2, sz, 0, sx), P(2, sz, 0, sx, 1, sy));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
const cylY = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
const cylZ = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s).rotateX(Math.PI / 2);
const cylX = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s).rotateZ(-Math.PI / 2);
const tubeX = (x0, x1, r0, r1, s = 22) => cylX(r1, r0, x1 - x0, s).translate((x0 + x1) / 2, 0, 0);

/* lofts a closed outline (x,z) at y0 to a second outline at y1: sloped welded-armor walls */
function loft(B, T, y0, y1) {
  const area = a => a.reduce((s, p, i) => { const q = a[(i + 1) % a.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  if (area(B) > 0) { B = B.slice().reverse(); T = T.slice().reverse(); }
  const pos = [];
  const P = (p, y) => [p[0], y, p[1]];
  const tri = (a, b, c) => pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const n = B.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const b0 = P(B[i], y0), b1 = P(B[j], y0), t0 = P(T[i], y1), t1 = P(T[j], y1);
    tri(b0, b1, t1); tri(b0, t1, t0);
  }
  const cap = (poly, y, up) => {
    THREE.ShapeUtils.triangulateShape(poly.map(p => new THREE.Vector2(p[0], p[1])), []).forEach(f => {
      let A = P(poly[f[0]], y), Bv = P(poly[f[1]], y), C = P(poly[f[2]], y);
      const ny = (Bv[2] - A[2]) * (C[0] - A[0]) - (Bv[0] - A[0]) * (C[2] - A[2]);
      if ((ny > 0) !== up) { const t = Bv; Bv = C; C = t; }
      tri(A, Bv, C);
    });
  };
  cap(T, y1, true); cap(B, y0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
function mergeGeos(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  parts.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return m;
}

