/* ---------- things to crush that are not cars: stuffed toys, and an instrumented crash test dummy. Same solver, same tank ---------- */
const dummySkin = new THREE.MeshStandardMaterial({ color: lin('#d9a441'), roughness: 0.58, metalness: 0 });
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
// the fine mesh rides on the nodes nearest each vertex, as a weighted offset from them
function propBind(S, m, nodes) {
  const O = m.geometry.attributes.position.array, n = O.length / 3, K = Math.min(4, nodes.length), idx = new Int16Array(n * K), wt = new Float32Array(n * K);
  for (let i = 0; i < n; i++) {
    const near = nodes.map(q => [q, Math.hypot(S.p[q * 3] - O[i * 3], S.p[q * 3 + 1] - O[i * 3 + 1], S.p[q * 3 + 2] - O[i * 3 + 2])]).sort((a, b) => a[1] - b[1]).slice(0, K);
    let tot = 0; for (const q of near) tot += 1 / (q[1] * q[1] + 0.004);
    near.forEach((q, k) => { idx[i * K + k] = q[0]; wt[i * K + k] = 1 / (q[1] * q[1] + 0.004) / tot; });
  }
  let top = 0; for (let i = 1; i < O.length; i += 3) if (O[i] > top) top = O[i];
  m.userData.orig = Float32Array.from(O); m.userData.pb = { idx, wt, K, top };
}
function propSkin(c) {
  const S = c.shell.S, P = S.p, P0 = S.p0, CE = S.ce;
  for (const m of c.meshes) {
    const b = m.userData.pb; if (!b) continue;
    const A = m.geometry.attributes.position.array, O = m.userData.orig, K = b.K, idx = b.idx, wt = b.wt;
    for (let i = 0, a = 0; a < A.length; i++, a += 3) {
      let x = 0, y = 0, z = 0, ce = 0;
      for (let k = 0; k < K; k++) { const n = idx[i * K + k], q = n * 3, w = wt[i * K + k]; x += w * (P[q] - P0[q]); y += w * (P[q + 1] - P0[q + 1]); z += w * (P[q + 2] - P0[q + 2]); ce += w * Math.min(CE[n], 9); }
      // the part is pressed down under the lowest the track has been over it: flesh and stuffing go flat, they do not stand through the track
      A[a] = O[a] + x; y += O[a + 1]; if (ce < b.top) y *= Math.max(0.03, ce) / b.top; A[a + 1] = y > 0.006 ? y : 0.006; A[a + 2] = O[a + 2] + z;
    }
    m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals();
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
  c.plush = []; c.seams = []; let grp = 2;
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
        const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; c.group.add(m); c.meshes.push(m); propBind(S, m, nodes); meshes.push(m);
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
    const u = made[0].meshes[0].userData; u.cx = xb; u.cz = zb; c.plush.push(made[0].meshes[0]);
    c.toys = c.toys || []; c.toys.push({ top0: 0, nodes: made.flatMap(q => q.nodes), squeaked: false, burst: false, i: ti, sc, name: kind === 'bear' ? '毛绒熊' : '毛绒兔' });
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
function buildDummy(c, S) {
  const dz = rand(-0.12, 0.12), M = c.layAcross ? (x, y, z) => [z, y, -x + dz] : (x, y, z) => [x + dz * 0.5, y, z + 0.1 + dz];
  const parts = c.dummyParts = DUMMY_PARTS.map(([id, name, limit]) => ({ id, name, limit, peak: 0, links: [], broken: null }));
  const P = {}, E_BONE = 5e7;
  const N = (id, x, y, z, m, r = 0.04, gr) => { const [a, b, d] = M(x, y, z), n = shellNode(S, a, b, d, m, r, 2); P[id] = n; if (gr !== undefined) (S.gr = S.gr || new Float32Array(S.maxN))[n] = gr; return n; };
  const part = id => parts.find(p => p.id === id);
  // a load path that is part of a bone: yields at the bone's limit and is then a fracture
  const bone = (pid, a, b, Fc, Ft = Fc) => { const q = part(pid), k = shellLink(S, P[a], P[b], E_BONE, Ft, Fc, 0.2, 0); q.links.push(k); return k; };
  const flesh = (a, b, F = 1400, E = 90000) => shellLink(S, P[a], P[b], E, F * 2, F, 9, 0.8);
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
    shellLink(S, P[sh], P.t1, E_BONE, 2000, 1900, 0.02, 0); shellLink(S, P[sh], P[rb], 90000, 1500, 1500, 9, 0.6); shellLink(S, P[sh], P.th, 90000, 1500, 1500, 9, 0.6);
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
  // the meshes
  const put = (geo, mat, nodes) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; c.group.add(m); c.meshes.push(m); propBind(S, m, nodes.map(k => P[k])); return m; };
  const blob = (list, mat, nodes) => put(blobs(list.map(q => { const [a, b, d] = M(q[4], q[5], q[6]); return c.layAcross ? [q[0], q[3], q[2], q[1], a, b, d] : [q[0], q[1], q[2], q[3], a, b, d]; })), mat, nodes);
  const caps = (A, B, r, mat, nodes) => {
    const a = new THREE.Vector3(...M(...A)), b = new THREE.Vector3(...M(...B)), L = a.distanceTo(b), g = new THREE.CapsuleGeometry(r, Math.max(0.01, L), 6, 14);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return put(g, mat, nodes);
  };
  const disc = (x, y, z, r, nodes, nrm = [0, 1, 0]) => { const [a, b, d] = M(x, y, z), g = new THREE.CircleGeometry(r, 20); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...nrm))); g.translate(a, b, d); return put(g, dummyTarget, nodes); };
  blob([[0.1, 0.92, 1.0, 1.18, 0, 0.11, 0.72], [0.022, 0.9, 0.7, 1.1, 0, 0.21, 0.695], [0.058, 0.95, 0.75, 0.75, 0, 0.1, 0.625]], dummySkin, ['hd', 'hdL', 'hdR', 'hdT', 'hdJ', 'hdF']);
  disc(0.075, 0.17, 0.74, 0.024, ['hd', 'hdR', 'hdF'], [0.7, 0.7, 0]); disc(-0.075, 0.17, 0.74, 0.024, ['hd', 'hdL', 'hdF'], [-0.7, 0.7, 0]);
  for (let q = 0; q < 4; q++) caps([-0.038, 0.09, 0.535 + q * 0.024], [0.038, 0.09, 0.535 + q * 0.024], 0.015 + (q % 2) * 0.004, dummyDark, ['nk', 't1', 'hdJ']);
  blob([[0.19, 0.95, 0.56, 1.05, 0, 0.13, 0.35], [0.155, 0.92, 0.6, 0.9, 0, 0.12, 0.16]], dummySkin, ['t1', 'th', 'lu', 'st', 'rbL', 'rbR', 'ab', 'shL', 'shR']);
  disc(0, 0.243, 0.42, 0.03, ['st', 't1', 'rbL']); disc(0, 0.222, 0.07, 0.03, ['ab', 'lu', 'pv']);
  blob([[0.19, 0.95, 0.62, 0.72, 0, 0.11, -0.05]], dummySkin, ['pv', 'ilL', 'ilR', 'hpL', 'hpR', 'pvT', 'lu']);
  disc(0.13, 0.19, -0.1, 0.03, ['ilR', 'hpR', 'pvT']); disc(-0.13, 0.19, -0.1, 0.03, ['ilL', 'hpL', 'pvT']);
  for (const s of ['L', 'R']) {
    const k = s === 'L' ? -1 : 1, seg2 = (id, A, B, rA, nodes, mat = dummySkin) => { const M2 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]; caps(A, M2, rA, mat, [nodes[0], id + 'm']); caps(M2, B, rA, mat, [id + 'm', id + 'e']); };
    seg2('ua' + s, [k * 0.21, 0.1, 0.47], [k * 0.25, 0.09, 0.19], 0.05, ['sh' + s]);
    seg2('la' + s, [k * 0.25, 0.09, 0.19], [k * 0.27, 0.07, -0.08], 0.04, ['ua' + s + 'e']);
    seg2('th' + s, [k * 0.09, 0.09, -0.14], [k * 0.1, 0.08, -0.57], 0.08, ['hp' + s]);
    seg2('sh2' + s, [k * 0.1, 0.08, -0.57], [k * 0.11, 0.06, -0.97], 0.058, ['th' + s + 'e']);
    blob([[0.045, 0.9, 1, 1.1, k * 0.28, 0.05, -0.17]], dummySkin, ['hn' + s, 'la' + s + 'e']);
    blob([[0.055, 0.85, 1.8, 0.9, k * 0.13, 0.13, -1.02], [0.04, 0.9, 1, 1.4, k * 0.12, 0.05, -1.03]], dummyDark, ['ft' + s, 'sh2' + s + 'e']);
    for (const [x, y, z, r, n] of [[k * 0.21, 0.1, 0.47, 0.066, 'sh' + s], [k * 0.25, 0.09, 0.19, 0.056, 'ua' + s + 'e'], [k * 0.1, 0.08, -0.57, 0.09, 'th' + s + 'e']]) blob([[r, 1, 1, 1, x, y, z]], dummyDark, [n]);
  }
  c.plush = []; c.toys = [];
}
function buildProp(kind, modeKey) {
  const mode = MODES[modeKey], def = PROPS[kind], V = Object.assign({}, VEHICLES.sedan, { name: def.name, hold: 9, strength: 1 });
  useV(V);
  const group = new THREE.Group(), S = shellNew(260, 1100), f = { V: new Float32Array(GN), E: new Float32Array(GN), top: new Float32Array(GN), real: new Float32Array(GN), B: new Float32Array(GN), R: new Float32Array(GN).fill(Infinity), dirty: new Uint8Array(GN), vol: 1, h0: 0, hoodN: [], roofN: [], pillarN: [], doorN: [], pressOf: new Map() };
  const carZ = modeKey === 'centre' ? rand(-0.1, 0.1) : SIDES[1] + rand(-0.06, 0.06);
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const c = { prop: kind, kind, modeKey, V, f, group, meshes: [], mats: [], bags: [], tires: [], mirrors: [], plush: [], z: carZ, across: false, layAcross: !!mode.across, nb: 0, bx: [], bL: [], over: [], Hs: new Float64Array(0), bandX: SIDES[1] - carZ, crawlK: rand(0.92, 1.08), give: 0, snapped: false, lost: 0, pass: 0, sill: V.zones[1][0], belt: 0.5, ground: [], ip: CAR_IP, ir: CAR_IR, lamp: { emissiveIntensity: 0 }, tail: { emissiveIntensity: 0 }, mudCut: { value: -9 }, mudL: 9, mud: { tex: { dispose() {} } }, oil: new THREE.Mesh(new THREE.BufferGeometry(), dark), seed: rand(0, 99), fold: [1, 1], tops: new Float32Array(TOPN * TOPM), hardF: new Float32Array(GN), bandHard: new Float32Array(0), engN: [], glShown: 0, S };
  c.oil.visible = false;
  def.build(c, S);
  return c;
}
function propAttach(c) {
  const S = c.S, f = c.f;
  c.Y = CAR_CG; c.vY = 0; c.th = 0; c.ph = 0; c.w = 0; c.wr = 0; c.yawC = 0;
  S.mu = 0.75; S.damp = 3; S.cf = new Float32Array(S.maxN); S.ce = new Float32Array(S.maxN).fill(9);
  if (!S.gr) S.gr = new Float32Array(S.maxN);
  for (let i = 0; i < S.n; i++) if (!S.gr[i]) S.gr[i] = S.r[i];
  const sh = c.shell = { S, T: new Int32Array(0), nT: 0, wheels: [], engine: [], tn: new Float32Array(0), welds: [], awake: true, age: 0, prop: true, nodePanel: new Int16Array(S.n), mass: 0 };
  for (let i = 0; i < S.n; i++) sh.mass += S.m[i];
  const d0 = S.damp;
  for (let i = 0; i < 900; i++) { S.g = SHELL_G * Math.min(1, i / 600); S.damp = 25; shellStep(S, 0.001, shellContactFree); }
  S.g = undefined; S.damp = d0; S.v.fill(0);
  S.broke.length = 0; S.ce.fill(9);
  S.p0.set(S.p);        // as it now lies is its shape: only what happens from here shows on the mesh
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
      let top = 9; for (const q of T.nodes) { if (S.ce[q] < 9 && sh.load < 50) S.ce[q] = Math.min(Math.max(S.ce[q], 0) + dt * 0.25, Math.max(S.ce[q], T.top0 * 0.5)); if (S.ce[q] < top) top = S.ce[q]; }
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
  c.mudCut.value = -9;
}
// the HUD's list, told by the sensors rather than the car's stages
function propHud(c) {
  const rows = c.dummyParts ? c.dummyParts.map(q => [q.name, q.broken != null ? '断裂 ' + q.broken.toFixed(2) + ' s' : (q.peak / 1000).toFixed(1) + ' / ' + (q.limit / 1000).toFixed(1) + ' kN', q.broken != null])
    : c.toys.flatMap(T => [[T.name + ' 被压扁', T.squeakT != null ? T.squeakT.toFixed(2) + ' s' : '—', T.squeakT != null], [T.name + ' 开线爆棉', T.burstT != null ? T.burstT.toFixed(2) + ' s' : '—', T.burstT != null]]);
  hLog.textContent = ''; hLog.dataset.prop = '1';
  for (const [n, v, on] of rows) { const li = document.createElement('li'); li.dataset.on = on ? '1' : '0'; const s = document.createElement('span'); s.textContent = n; const i = document.createElement('i'); i.textContent = v; li.append(s, i); hLog.append(li); }
}
