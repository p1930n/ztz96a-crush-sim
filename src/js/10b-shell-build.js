/* ---------- the car as a structure: a coarse shell and frame the solver runs on, and the fine meshes bound to it ---------- */
// which panel a piece of the body skin belongs to. a is the angle up the side (fold(th) in degrees), z along the car
const P_BASE = 0, P_HOOD = 1, P_BOOT = 2, P_BUMPF = 3, P_BUMPR = 4, P_DOOR = 5, P_CABIN = 20;   // doors: 5 front R, 6 front L, 7 rear R, 8 rear L
function shellZone(V, x, z, a) {
  if (a < -62) return P_BASE;
  const zr = V.boot ? V.boot[0] : -2.12;
  if (z > 2.06) return P_BUMPF;
  if (z < zr) return P_BUMPR;
  if (a >= 47) {
    if (z > V.hood[0] && z < V.hood[1]) return P_HOOD;
    if (V.boot && z > V.boot[0] && z < V.boot[1]) return P_BOOT;
    return P_BASE;
  }
  if (a >= -44 && a < 30) {
    const d = V.doors, s = x > 0 ? 0 : 1;
    if (z < d[0] && z > d[1]) return P_DOOR + s;
    if (z < d[1] && z > d[2]) return P_DOOR + 2 + s;
  }
  return P_BASE;
}
const SHELL_THS = [-90, -62, -44, -10, 30, 47, 70, 90, 110, 133, 150, 190, 224, 242];
const CABIN_THS = [-30, 10, 30, 62, 90, 118, 150, 170, 210];
// cut the fine body mesh along its panels: each panel is its own mesh, so it can leave
function shellCarve(V, body, put, mats, K, Mr, ths) {
  const g = body.geometry, I = g.index.array, A = g.attributes.position.array, U = g.attributes.uv.array, parts = new Map();
  const take = (id, m, a, b, c) => { let q = parts.get(id); if (!q) parts.set(id, q = []); q.push(m, a, b, c); };
  for (const gr of g.groups) for (let t = gr.start; t < gr.start + gr.count; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], cz = (A[a * 3 + 2] + A[b * 3 + 2] + A[c * 3 + 2]) / 3, cx = (A[a * 3] + A[b * 3] + A[c * 3]) / 3;
    let js = [a, b, c].filter(v => v < K * Mr).map(v => v % Mr);
    if (js.length && Math.max(...js) - Math.min(...js) > Mr / 2) js = js.map(j => j < Mr / 2 ? j + Mr : j);
    const jm = js.reduce((s, j) => s + j, 0) / (js.length || 1) + 0.33;
    const id = js.length === 3 ? shellZone(V, cx, cz, fold(ths[0] + jm / Mr * Math.PI * 2)) : cz > 0 ? P_BUMPF : P_BUMPR;
    take(id, gr.materialIndex, a, b, c);
  }
  const out = [];
  for (const [id, q] of parts) {
    const map = new Map(), pos = [], uv = [], bk = [[], []];
    const v = i => { let n = map.get(i); if (n === undefined) { n = pos.length / 3; map.set(i, n); pos.push(A[i * 3], A[i * 3 + 1], A[i * 3 + 2]); uv.push(U[i * 2], U[i * 2 + 1]); } return n; };
    for (let i = 0; i < q.length; i += 4) bk[q[i]].push(v(q[i + 1]), v(q[i + 2]), v(q[i + 3]));
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ng.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const idx = []; bk.forEach((b, m) => { if (b.length) { ng.addGroup(idx.length, b.length, m); idx.push(...b); } }); ng.setIndex(idx); ng.computeVertexNormals();
    if (id === P_BASE) { body.geometry.dispose(); body.geometry = ng; body.userData.panel = P_BASE; out.push(body); }
    else { const m = put(ng, mats); m.userData.panel = id; out.push(m); }
  }
  return out;
}
const SHELL_STEEL = {
  panel: [8000, 1500], panelDiag: [6000, 1300], panelBend: [550, 550], floor: [12000, 4000], floorBend: [3000, 3000],
  sill: [60000, 22000], sillBend: [5000, 5000], rail: [30000, 9000], railBend: [1500, 1500], cross: [30000, 12000],
  beltRail: [40000, 16000], ring: [50000, 20000], pillar: [30000, 7000], pillarBend: [1600, 1600], roofRail: [25000, 6000], roofRailBend: [900, 900], belt: [15000, 4000],
};
const E_M = 8e7, E_BEND = 4e6;
function shellBuild(c) {
  const V = c.V, S = shellNew(760, 6200), rs = () => rand(0.9, 1.1), carK = rand(0.92, 1.08);
  useV(V);
  // the rows of nodes run along the seams
  const zs = stations(-2.27, 2.27, 0.26, [...V.doors, ...V.hood, ...(V.boot || []), 2.06, -2.12].map(z => z)).filter((z, i, a) => i === 0 || i === a.length - 1 || (z - a[i - 1] > 0.07));
  const R = zs.length, Cn = SHELL_THS.length, nodeAt = new Map(), key = (r, j, p) => r * 1000 + j + p * 100000, tris = [];
  const ptOf = (r, j) => bodyPt(zs[r], deg(SHELL_THS[j]));
  const zoneQ = (r, j) => { const j2 = (j + 1) % Cn, p = ptOf(r, j), q = ptOf(r + 1, j2), a = fold(deg(SHELL_THS[j] + (j2 ? SHELL_THS[j2] - SHELL_THS[j] : 270 - SHELL_THS[j]) / 2)); return shellZone(V, (p[0] + q[0]) / 2, (zs[r] + zs[r + 1]) / 2, a); };
  const massAt = (a, z) => a < -70 ? 1.4 : a <= -44 ? (Math.abs(z) < 1.9 ? 6 : 2.2) : a < 30 ? 1.6 : 1.3;   // the weight is in the rails and sills
  const node = (r, j, pid) => {
    const k = key(r, j, pid); let n = nodeAt.get(k);
    if (n === undefined) { const p = ptOf(r, j), jit = 0.004; n = shellNode(S, p[0] + rand(-jit, jit), p[1] + rand(-jit, jit), p[2] + rand(-jit, jit), massAt(fold(deg(SHELL_THS[j])), zs[r]), 0.055, 0); nodeAt.set(k, n); S.oid = S.oid || []; S.oid[n] = r * 100 + j; }
    return n;
  };
  const seen = new Set(), link = (a, b, F, E = E_M, ef = 1.1, H = 0.5) => {
    const k = a < b ? a * 8192 + b : b * 8192 + a; if (seen.has(k) || a === b) return -1; seen.add(k);
    const q = carK * rs() * V.strength; return shellLink(S, a, b, E, F[0] * q, F[1] * q, ef, H);
  };
  const edgeMat = (r, j, along) => {
    const a = fold(deg(SHELL_THS[j])), z = zs[r];
    if (along) { if (a <= -44 && a >= -62) return Math.abs(z) < 1.75 ? SHELL_STEEL.sill : SHELL_STEEL.rail; if (a < -62) return SHELL_STEEL.floor; if (a > 25 && a < 50 && Math.abs(z) < 1.3) return SHELL_STEEL.beltRail; }
    else if (a < -44) return SHELL_STEEL.floor;
    return SHELL_STEEL.panel;
  };
  for (let r = 0; r + 1 < R; r++) for (let j = 0; j < Cn; j++) {
    const j2 = (j + 1) % Cn, pid = zoneQ(r, j), n00 = node(r, j, pid), n01 = node(r, j2, pid), n10 = node(r + 1, j, pid), n11 = node(r + 1, j2, pid);
    link(n00, n10, edgeMat(r, j, true)); link(n01, n11, edgeMat(r, j2, true)); link(n00, n01, edgeMat(r, j, false)); link(n10, n11, edgeMat(r + 1, j, false));
    link(n00, n11, SHELL_STEEL.panelDiag); link(n01, n10, SHELL_STEEL.panelDiag);
    tris.push(n00, n01, n11, pid, n00, n11, n10, pid);
    // members that skip a node resist bending, and leave a crease when they yield
    if (j + 2 < Cn || true) { const j3 = (j + 2) % Cn; if (zoneQ(r, j2) === pid) { const n02 = node(r, j3, pid); const flo = fold(deg(SHELL_THS[j2])) < -44; link(n00, n02, flo ? SHELL_STEEL.floorBend : SHELL_STEEL.panelBend, flo ? E_M : E_BEND, 1e9, 0.3); } }
    if (r + 2 < R && zoneQ(r + 1, j) === pid) { const a = fold(deg(SHELL_THS[j])), n20 = node(r + 2, j, pid); link(n00, n20, a <= -44 && a >= -62 ? SHELL_STEEL.sillBend : a < -62 ? SHELL_STEEL.floorBend : SHELL_STEEL.panelBend, a < -44 ? E_M : E_BEND, 1e9, 0.3); }
  }
  // what holds the panels on: hinges and latches, at their strengths. Everywhere else a panel only rests against the frame
  const welds = [], weld = (a, b, F, ef, what) => { const q = rs(); const w = shellLink(S, a, b, 4e7, F * q, F * q, ef, 0, 1); welds.push({ w, what, a, b }); return w; };
  const panelNodes = new Map(); for (const [k, n] of nodeAt) { const p = Math.floor(k / 100000), r = Math.floor((k % 100000) / 1000), j = k % 1000; if (!panelNodes.has(p)) panelNodes.set(p, []); panelNodes.get(p).push({ n, r, j, x: S.p[n * 3], y: S.p[n * 3 + 1], z: S.p[n * 3 + 2] }); }
  const baseN = panelNodes.get(P_BASE);
  const nearestBase = q => { let b = null, bd = 9; for (const t of baseN) { const d = Math.hypot(t.x - q.x, t.y - q.y, t.z - q.z); if (d < bd) { bd = d; b = t; } } return b; };
  const fix = (pid, pick, F, ef, what) => { const L = panelNodes.get(pid); if (!L) return; for (const q of L.filter(pick)) { const b = nearestBase(q); if (b && Math.hypot(b.x - q.x, b.y - q.y, b.z - q.z) < 0.34) weld(q.n, b.n, F, ef, what); } };
  for (const pid of [P_DOOR, P_DOOR + 1, P_DOOR + 2, P_DOOR + 3]) {
    const L = panelNodes.get(pid); if (!L) continue;
    const zF = Math.max(...L.map(q => q.z)), zR = Math.min(...L.map(q => q.z));
    fix(pid, q => q.z > zF - 0.02 && S.oid, 11000, 0.05, 'hinge');
    fix(pid, q => q.z < zR + 0.02, 5000, 0.03, 'latch');
    fix(pid, q => q.z > zR + 0.02 && q.z < zF - 0.02 && q.y < 0.5, 2000, 0.02, 'seal');     // the sill flange the door shuts against
  }
  for (const [pid, hingeZ] of [[P_HOOD, 'min'], [P_BOOT, 'max']]) {
    const L = panelNodes.get(pid); if (!L) continue;
    const zs_ = L.map(q => q.z), zH = hingeZ === 'min' ? Math.min(...zs_) : Math.max(...zs_), zL = hingeZ === 'min' ? Math.max(...zs_) : Math.min(...zs_);
    fix(pid, q => Math.abs(q.z - zH) < 0.02 && Math.abs(q.x) > 0.3, 11000, 0.05, 'hinge');
    fix(pid, q => Math.abs(q.z - zL) < 0.02 && Math.abs(q.x) < 0.45, 5000, 0.03, 'latch');
    fix(pid, q => Math.abs(q.x) > 0.5, 1800, 0.02, 'edge');
  }
  for (const pid of [P_BUMPF, P_BUMPR]) fix(pid, () => true, 2500, 0.02, 'clip');
  // the door rings: sill, A, B and C posts and the rail along the window line make the side of the car a deep beam
  const j44 = [2, Cn - 2], j30 = [4, Cn - 4];
  for (const d0 of V.doors) {
    const r = zs.reduce((b, z, i) => Math.abs(z - d0) < Math.abs(zs[b] - d0) ? i : b, 0);
    for (let s = 0; s < 2; s++) {
      const lo = nodeAt.get(key(r, j44[s], P_BASE)), hi = nodeAt.get(key(r, j30[s], P_BASE));
      if (lo === undefined || hi === undefined) continue;
      link(lo, hi, SHELL_STEEL.ring);
      for (const dr of [-1, 1]) { const q1 = nodeAt.get(key(r + dr, j30[s], P_BASE)), q2 = nodeAt.get(key(r + dr, j44[s], P_BASE)); if (q1 !== undefined) link(lo, q1, SHELL_STEEL.ring); if (q2 !== undefined) link(hi, q2, SHELL_STEEL.ring); }
    }
  }
  // cross members tie the sills together and carry the floor
  const j62 = 1, j62L = Cn - 1;
  for (let r = 1; r + 1 < R; r += 2) {
    const a = nodeAt.get(key(r, j62, P_BASE)), b = nodeAt.get(key(r, j62L, P_BASE)), a2 = nodeAt.get(key(r + 1, j62L, P_BASE));
    if (a !== undefined && b !== undefined) { link(a, b, SHELL_STEEL.cross); if (a2 !== undefined && Math.abs(zs[r]) < 1.8) link(a, a2, SHELL_STEEL.cross); }
  }
  // the glasshouse: rows along the car, with a stiff hoop where each pillar stands
  const zc = stations(V.cab[0], V.cab[1], 0.34, V.doors.filter(z => z > V.cab[0] + 0.1 && z < V.cab[1] - 0.05)).filter((z, i, a) => i === 0 || z - a[i - 1] > 0.1);
  const CR = zc.length, CC = CABIN_THS.length, cn = (r, j) => r * CC + j, c0 = S.n;
  zc.forEach(z => CABIN_THS.forEach(t => { const p = cabinPt(z, deg(t)); shellNode(S, p[0] + rand(-0.003, 0.003), p[1] + rand(-0.003, 0.003), p[2] + rand(-0.003, 0.003), 1.1, 0.05, 0); }));
  const isPillar = r => r === 0 || r === CR - 1 || V.doors.some(d => Math.abs(zc[r] - d) < 0.06);
  for (let r = 0; r < CR; r++) for (let j = 0; j < CC; j++) {
    const a = c0 + cn(r, j), up = fold(deg(CABIN_THS[j]));
    if (j + 1 < CC) link(a, a + 1, isPillar(r) ? (up < 40 || CABIN_THS[j] > 140 ? SHELL_STEEL.pillar : SHELL_STEEL.roofRail) : SHELL_STEEL.panel);
    if (j + 2 < CC) link(a, a + 2, isPillar(r) ? SHELL_STEEL.pillarBend : SHELL_STEEL.panelBend, E_BEND, 1e9, 0.3);
    if (r + 1 < CR) {
      const b = a + CC, rail = Math.abs(up - 62) < 3;
      link(a, b, rail ? SHELL_STEEL.roofRail : SHELL_STEEL.panel);
      if (j + 1 < CC) { link(a, b + 1, SHELL_STEEL.panelDiag); link(a + 1, b, SHELL_STEEL.panelDiag); tris.push(a, a + 1, b + 1, P_CABIN, a, b + 1, b, P_CABIN); }
      if (r + 2 < CR) link(a, a + 2 * CC, rail ? SHELL_STEEL.roofRailBend : SHELL_STEEL.panelBend, E_BEND, 1e9, 0.3);
    }
  }
  // the glasshouse stands on the body: its lowest row of nodes is tied to the nearest body nodes, strongly at the pillars
  for (let r = 0; r < CR; r++) for (const j of [0, CC - 1]) {
    const a = c0 + cn(r, j), q = { x: S.p[a * 3], y: S.p[a * 3 + 1], z: S.p[a * 3 + 2] };
    const cand = baseN.slice().sort((u, v) => Math.hypot(u.x - q.x, u.y - q.y, u.z - q.z) - Math.hypot(v.x - q.x, v.y - q.y, v.z - q.z)).slice(0, 3);
    for (const t of cand) link(a, t.n, isPillar(r) ? SHELL_STEEL.pillar : SHELL_STEEL.belt);
  }
  // solid things inside: the engine block, a lattice of heavy nodes that stays square
  const eL = (V.eng[0] + V.eng[1]) / 2, eLen = V.eng[1] - V.eng[0], eW = V.eng[2], eY0 = 0.28 + V.gy, eY1 = 0.68 + V.gy, en = [], grpE = 1;
  for (const y of [eY0, eY1]) for (const i of [-1, 0, 1]) for (const k of [-1, 0, 1]) en.push(shellNode(S, i * (eW - 0.07), y, eL + k * (eLen / 2 - 0.07), 11, 0.09, grpE));
  en.forEach((a, i) => { for (let q = i + 1; q < en.length; q++) shellLink(S, a, en[q], 1e9, 2e6, 2e6, 99, 0); });
  // mounts on the rails: these let go, and the block drops through to the ground
  const eMount = [en[0], en[2], en[6], en[8]];
  for (const m of eMount) { const q = { x: S.p[m * 3], y: S.p[m * 3 + 1], z: S.p[m * 3 + 2] }; const t = baseN.filter(b => fold(0) !== null && b.y < 0.6 + V.gy).sort((u, v) => Math.hypot(u.x - q.x, u.y - q.y, u.z - q.z) - Math.hypot(v.x - q.x, v.y - q.y, v.z - q.z))[0]; link(m, t.n, [22000, 22000], 2e7, 0.2, 0); }
  // seat frames: stiff until they fold, on the floor nodes under them
  const seats = [[0.38, 0.05], [-0.38, 0.05], [0.42, -0.85], [-0.42, -0.85]];
  seats.forEach(([sx, sz], si) => {
    const top = shellNode(S, sx, 0.62 + V.sy, sz, 15, 0.14, 2 + si), t2 = baseN.filter(b => b.y < 0.42 + V.gy).sort((u, v) => Math.hypot(u.x - sx, u.z - sz) - Math.hypot(v.x - sx, v.z - sz)).slice(0, 4);
    for (const b of t2) link(top, b.n, [9000, 4500], 2e7, 0.5, 0.8);
  });
  // wheels: hub with a stub axle and a pointer, on soft suspension members, carried on the tyre or, once it has burst, the rim
  const wheels = []; let bodyMass = 200; for (let i = 0; i < S.n; i++) bodyMass += S.m[i]; const heavy = bodyMass / 1350;
  for (const zw of V.wheel.z) for (const sx of [1, -1]) {
    const wx = sx * V.wheel.x, y = V.wheel.y, gw = 10 + wheels.length;
    const hub = shellNode(S, wx, y, zw, 14, 0.15, gw), inn = shellNode(S, wx - sx * 0.2, y, zw, 3, 0.05, gw), ptr = shellNode(S, wx, y + 0.2, zw, 3, 0.05, gw);
    S.gr = S.gr || new Float32Array(S.maxN); S.gr[hub] = y * 0.96;
    shellLink(S, hub, inn, 1e9, 3e5, 3e5, 99, 0); shellLink(S, hub, ptr, 1e9, 3e5, 3e5, 99, 0); shellLink(S, inn, ptr, 1e9, 3e5, 3e5, 99, 0);
    // the rail nodes nearest the axle: lower arms locate the hub, springs and struts carry the corner
    const low = baseN.filter(b => Math.sign(b.x) === sx && b.y < 0.62 + V.gy).sort((u, v) => Math.hypot(u.x - wx, u.z - zw) - Math.hypot(v.x - wx, v.z - zw)).slice(0, 5);
    const mounts = [];
    for (const b of low) mounts.push(shellLink(S, inn, b.n, 3e6, 18000, 18000, 0.3, 0));
    // the spring stands nearly upright, from the hub to the strut tower: arms that lie level with the hub carry no weight
    const tower = baseN.filter(b => Math.sign(b.x) === sx && b.y > y + 0.32).sort((u, v) => Math.hypot(u.x - wx, u.z - zw) - Math.hypot(v.x - wx, v.z - zw)).slice(0, 3);
    for (const b of tower) { mounts.push(shellLink(S, hub, b.n, 2.4e5 * heavy, 40000, 40000, 0.6, 0)); for (const q of low.slice(0, 3)) link(b.n, q.n, SHELL_STEEL.ring); }
    shellLink(S, ptr, tower[0].n, 1e5, 3000, 3000, 9, 0);     // the wheel does not spin freely here: it only has to stay upright
    wheels.push({ hub, inn, ptr, sx, zw, x0: wx, y0: y, mounts, popped: false, off: false });
  }
  if (!S.gr) S.gr = new Float32Array(S.maxN);
  for (let i = 0; i < S.n; i++) if (!S.gr[i]) S.gr[i] = S.r[i];
  S.mu = 0.75; S.damp = 3;
  // triangles in solver indices, with the panel they belong to
  const T = new Int32Array(tris);
  let mass = 0; for (let i = 0; i < S.n; i++) mass += S.m[i];
  return { S, T, nT: T.length / 4, welds, wheels, engine: en, eY1, mass, awake: true, age: 0, lastBurst: 0 };
}
